import { cloneElement, ReactElement } from 'react';
import { useProStatus } from '../lib/pro';

interface Props {
  feature: string;
  children: ReactElement<any>;
}

// Wrap a write/persist button (save, lock, log, mark-paid). For free users the
// real onClick is intercepted and the upsell popover is surfaced instead, so the
// underlying action never fires. Pro users get the button untouched.
export function ProAction({ feature, children }: Props) {
  const { isPro } = useProStatus();
  if (isPro) return children;
  return cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature } }));
    },
    'data-pro-locked': true,
  });
}
