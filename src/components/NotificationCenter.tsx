import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Bell, BellOff, CalendarClock, CheckCheck, Inbox, Receipt, TrendingUp, Wallet, WifiOff, X } from 'lucide-react';
import { useNotifications, useNotificationToasts } from '../hooks/useNotifications';
import { CATEGORY_META, type NotificationCategory, type NotificationRecord } from '../core/notifications';

// The inbox.
//
// Every notification the engine emits lands here regardless of whether it was
// allowed to buzz the device. That is what makes the system honest without OS
// permission: someone who says no to the browser prompt still gets told, they
// just get told on their own schedule instead of ours.

const CATEGORY_ICON: Record<NotificationCategory, React.ElementType> = {
  overspend:      AlertTriangle,
  bills:          Receipt,
  payday:         Wallet,
  'safe-spend':   TrendingUp,
  'daily-review': CalendarClock,
  account:        WifiOff,
};

const CATEGORY_TINT: Record<NotificationCategory, string> = {
  overspend:      'bg-action-bleed text-white',
  bills:          'bg-action-primary text-primary-contrast',
  payday:         'bg-action-capture text-capture-contrast',
  'safe-spend':   'bg-action-primary text-primary-contrast',
  'daily-review': 'bg-black text-action-primary',
  account:        'bg-action-bleed text-white',
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

// ── Bell + panel ─────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { records, unreadCount, markRead, markAllRead, clearInbox, permission, prefs } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Two different silences that must not be described the same way. Mode "off"
  // is rejected by the first gate in passesStaticGates, so nothing is recorded
  // at all. A denied browser permission only blocks the buzz; records are still
  // written and the inbox keeps filling. The bell stays visible either way,
  // because hiding it would read as data loss.
  const recordingOff = prefs.mode === 'off';
  const muted = recordingOff || permission === 'denied';

  const openRecord = (record: NotificationRecord) => {
    markRead(record.id);
    setOpen(false);
    if (record.actionPath) navigate(record.actionPath);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative w-11 h-11 shrink-0 bg-surface border-4 border-black rounded-2xl flex items-center justify-center text-text-main shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
      >
        {muted ? <BellOff size={17} strokeWidth={2.5} /> : <Bell size={17} strokeWidth={2.5} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-action-bleed border-2 border-black rounded-full flex items-center justify-center text-[9px] font-black text-white tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-[95] bg-surface border-t-4 border-black rounded-t-3xl max-h-[85vh] flex flex-col
                         md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:max-h-none md:rounded-t-none md:rounded-l-3xl md:border-t-0 md:border-l-4"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b-4 border-black shrink-0">
                <div className="min-w-0">
                  <h2 className="text-xl font-black uppercase tracking-tighter italic text-text-main leading-none">
                    Notifications
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
                    {recordingOff
                      ? 'Notifications are off'
                      : muted
                        ? 'Blocked by your browser. Alerts still collect here.'
                        : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="w-9 h-9 shrink-0 border-4 border-black rounded-xl flex items-center justify-center text-text-main"
                >
                  <X size={15} strokeWidth={3} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
                    <div className="w-14 h-14 border-4 border-black rounded-2xl flex items-center justify-center bg-input">
                      <Inbox size={22} strokeWidth={2.5} className="text-text-muted" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-text-main">Nothing to report</p>
                    <p className="text-[10px] font-bold text-text-muted max-w-[240px] leading-snug">
                      Alerts show up here when a bill is due, your pay lands, or a day goes over.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {records.map(record => {
                      const Icon = CATEGORY_ICON[record.category];
                      const unread = !record.readAt;
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => openRecord(record)}
                            className={`w-full text-left flex gap-3 p-3 border-4 rounded-2xl transition-all hover:translate-x-0.5 hover:translate-y-0.5 ${
                              unread
                                ? 'border-black bg-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none'
                                : 'border-border bg-input opacity-70 hover:opacity-100'
                            }`}
                          >
                            <span className={`w-9 h-9 shrink-0 border-2 border-black rounded-lg flex items-center justify-center ${CATEGORY_TINT[record.category]}`}>
                              <Icon size={15} strokeWidth={2.5} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="text-[11px] font-black uppercase tracking-wide text-text-main leading-tight">
                                  {record.title}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted shrink-0">
                                  {relativeTime(record.createdAt)}
                                </span>
                              </span>
                              <span className="block text-[11px] font-bold text-text-muted leading-snug mt-1">
                                {record.body}
                              </span>
                              <span className="block text-[9px] font-black uppercase tracking-widest text-text-muted/60 mt-1.5">
                                {CATEGORY_META[record.category].label}
                                {!record.deliveredOs && permission === 'granted' ? ' · in app only' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {records.length > 0 && (
                <div className="flex gap-2 px-5 py-4 border-t-4 border-black shrink-0 sheet-pb-safe md:pb-4">
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 border-4 border-black rounded-2xl bg-input text-[10px] font-black uppercase tracking-widest text-text-main disabled:opacity-40 transition-opacity"
                  >
                    <CheckCheck size={13} strokeWidth={3} />
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={clearInbox}
                    className="h-11 px-4 border-4 border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-action-bleed hover:border-action-bleed transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── In-app banner ────────────────────────────────────────────────────────────

// Shown when a notification is emitted while the user is already looking at the
// app. The OS notification is deliberately suppressed in that case, so this is
// the delivery, not a duplicate of one.
export function NotificationToaster() {
  const { toast, dismiss } = useNotificationToasts();
  const { markRead } = useNotifications();
  const navigate = useNavigate();

  const open = () => {
    if (!toast) return;
    markRead(toast.id);
    const path = toast.actionPath;
    dismiss();
    if (path) navigate(path);
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-1.5rem)] max-w-sm"
        >
          <div className="bg-surface border-4 border-black rounded-2xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="flex items-start gap-3 p-3">
              <span className={`w-9 h-9 shrink-0 border-2 border-black rounded-lg flex items-center justify-center ${CATEGORY_TINT[toast.category]}`}>
                {(() => { const Icon = CATEGORY_ICON[toast.category]; return <Icon size={15} strokeWidth={2.5} />; })()}
              </span>
              <button type="button" onClick={open} className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-black uppercase tracking-wide text-text-main leading-tight">
                  {toast.title}
                </p>
                <p className="text-[11px] font-bold text-text-muted leading-snug mt-1">
                  {toast.body}
                </p>
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="w-7 h-7 shrink-0 border-2 border-border rounded-lg flex items-center justify-center text-text-muted hover:text-text-main transition-colors"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
