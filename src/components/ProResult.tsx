import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useProResultLocked } from '../lib/pro';

interface Props {
  feature: string;
  children: ReactNode;
}

// For Pro tools that only calculate and never save, there is no write to gate
// with ProAction. Free users can still fill in the inputs, but the answer is
// blurred behind an upgrade button, so they see what the tool does before paying.
//
// The blur alone is not the lock: removing one style in devtools would reveal
// whatever is underneath. So the pages using this must pass placeholder figures
// as children when locked (useProResultLocked), never the user's real result.
// The real answer is then not computed or rendered at all for a free account.
export function ProResult({ feature, children }: Props) {
  const locked = useProResultLocked();
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden="true" inert className="pointer-events-none select-none blur-md">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature } }))}
          className="inline-flex items-center gap-2 px-5 h-12 bg-action-primary border-4 border-black rounded-2xl text-primary-contrast font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          <Lock size={14} strokeWidth={3} /> Upgrade to see your result
        </button>
      </div>
    </div>
  );
}
