import { useState, useEffect, useRef } from 'react';
import { Lock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRICING } from '../lib/pricing';
import { logProductEvent } from '../core/telemetry';

// Single global instance (mounted once in App.tsx). Any ProAction click dispatches
// a 'pro-upsell' event; this renders a small, dismissable floating card (not a
// full-screen takeover). Auto-dismisses after 6s or on outside click.
export function ProUpsellPopover() {
  const [open, setOpen] = useState(false);
  // Kept so the CTA click can be attributed to the tool that triggered the
  // paywall, not just recorded as an anonymous click.
  const [feature, setFeature] = useState('unknown');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onUpsell = (e: Event) => {
      const next = (e as CustomEvent).detail?.feature ?? 'unknown';
      setFeature(next);
      logProductEvent({ type: 'paywall_viewed', feature: next });
      setOpen(true);
    };
    window.addEventListener('pro-upsell', onUpsell as EventListener);
    return () => window.removeEventListener('pro-upsell', onUpsell as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 6000);
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Defer so the click that opened it doesn't immediately close it.
    const id = setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => { clearTimeout(timer); clearTimeout(id); window.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div ref={cardRef} className="pointer-events-auto w-full max-w-sm bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-action-primary border-4 border-black flex items-center justify-center shrink-0">
            <Lock size={18} strokeWidth={3} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-tight text-text-main">This preview saves with Pro</p>
            <p className="text-[11px] font-bold text-text-muted leading-snug mt-0.5">
              Preview the tool free. Upgrade to keep results and use the full action set. From {PRICING.monthly.price}/mo · {PRICING.annual.price}/yr · or {PRICING.lifetime.price} once.
            </p>
            <div className="flex gap-2 mt-3">
              <Link to="/settings#pro"
                onClick={() => { logProductEvent({ type: 'paywall_cta_clicked', feature }); setOpen(false); }}
                className="inline-flex items-center h-9 px-4 bg-black border-2 border-black rounded-xl text-action-primary font-black uppercase text-[11px] tracking-widest">
                See Pricing
              </Link>
              <button type="button" onClick={() => setOpen(false)}
                className="inline-flex items-center h-9 px-4 bg-surface border-2 border-black rounded-xl text-text-muted font-black uppercase text-[11px] tracking-widest">
                Maybe later
              </button>
            </div>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setOpen(false)} className="shrink-0 text-text-muted hover:text-text-main transition-colors">
            <X size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
