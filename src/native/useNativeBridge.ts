import { useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useStore } from '../store/useStore';
import { supabase } from '../core/supabase';
import { isNative } from './platform';
import { parseNativeLink } from './deepLinks';
import { makeWidgetSnapshot, type WidgetSnapshot } from './widgetSnapshot';
import { toLocalDateKey } from '../core/math';

const Widget = registerPlugin<{
  update(options: WidgetSnapshot): Promise<void>;
  clear(): Promise<void>;
}>('PocketWidget');

export const NATIVE_SPEND_INTENT = 'pocketcfo-native-log-spend';

export function useNativeBridge() {
  useEffect(() => {
    if (!isNative) return;
    let live = true;
    let previous = '';
    let writes = Promise.resolve();
    let day = toLocalDateKey(new Date());
    let refreshing = false;
    const refreshData = () => {
      const state = useStore.getState();
      if (!state.userId || !state.dataLoaded || refreshing) return;
      refreshing = true;
      useStore.setState({ dataFresh: false });
      void state.fetchUserData(state.userId)
        .catch(() => console.warn('[native] Could not refresh account.'))
        .finally(() => { refreshing = false; });
    };
    const codes = new Set<string>();
    const syncWidget = () => {
      const today = toLocalDateKey(new Date());
      if (today !== day) { day = today; refreshData(); }
      const snapshot = makeWidgetSnapshot(useStore.getState());
      const signature = JSON.stringify(snapshot && { ...snapshot, updatedAt: 0 });
      if (signature === previous) return;
      previous = signature;
      writes = writes.then(() => snapshot ? Widget.update(snapshot) : Widget.clear())
        .catch(() => { previous = ''; console.warn('[widget] Could not update widget.'); });
    };
    syncWidget();
    const unsubscribe = useStore.subscribe(syncWidget);
    const timer = window.setInterval(syncWidget, 60_000);

    const openLink = async (value: string) => {
      const link = parseNativeLink(value);
      if (!link || !live) return;
      if (link.type === 'auth') {
        if (codes.has(link.code)) return;
        codes.add(link.code);
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) window.alert('Sign-in link could not be completed. Please request a new link.');
        } catch {
          window.alert('Sign-in could not connect. Please try again.');
        } finally { await Browser.close().catch(() => {}); }
        return;
      }
      if (link.type === 'spend') sessionStorage.setItem(NATIVE_SPEND_INTENT, '1');
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new Event(NATIVE_SPEND_INTENT));
    };
    const urlListener = NativeApp.addListener('appUrlOpen', ({ url }) => { void openLink(url); });
    const stateListener = NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh();
        // Preserve pending local edits on quick app switches. Retry a failed
        // load here; syncWidget separately invalidates the previous day's data.
        if (!useStore.getState().dataFresh) refreshData();
        syncWidget();
      }
      else {
        supabase.auth.stopAutoRefresh();
        if (useStore.getState().lockEnabled) useStore.setState({ isLocked: true });
      }
    });
    const backListener = NativeApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.location.pathname !== '/') window.history.back();
      else void NativeApp.minimizeApp();
    });
    void NativeApp.getLaunchUrl().then(result => { if (result) return openLink(result.url); })
      .catch(() => console.warn('[native] Could not read launch link.'));
    return () => {
      live = false;
      unsubscribe();
      clearInterval(timer);
      for (const listener of [urlListener, stateListener, backListener]) {
        void listener.then(handle => handle.remove());
      }
    };
  }, []);
}
