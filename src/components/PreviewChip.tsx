import { Lock } from 'lucide-react';
import { useProStatus } from '../lib/pro';

// Sets expectations before the user invests effort: free users see this at the top
// of a Pro tool so the later save-action wall reads as honest, not surprise-gated.
export function PreviewChip() {
  const { isPro } = useProStatus();
  if (isPro) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-action-primary/20 border-2 border-black rounded-full text-[10px] font-black uppercase tracking-widest text-text-main">
      <Lock size={11} strokeWidth={3} /> Preview · numbers don't save
    </div>
  );
}
