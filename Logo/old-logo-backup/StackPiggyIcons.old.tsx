import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconFrame({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

// The navigation marks share the same thick, rounded construction as the logo.
// Colour is reserved for the small money detail so they stay clear at 22px.
export function StackPiggyHomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="8" width="17" height="11.5" rx="3.25" strokeWidth="2.25" />
      <path d="M3.75 11.25h12.5a2.5 2.5 0 0 1 0 5h-2.1" strokeWidth="2.25" />
      <path d="M8 5.5h6.25" strokeWidth="2.25" />
      <circle cx="16.75" cy="13.75" r="1.8" fill="#22c55e" strokeWidth="1.7" />
    </IconFrame>
  );
}

export function StackPiggySpendIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 3.5h12v16.7l-2-1.35-2 1.35-2-1.35-2 1.35-2-1.35-2 1.35V3.5Z" strokeWidth="2.2" />
      <path d="M9 8.5h5.5M9 12h3.75" strokeWidth="2.2" />
      <circle cx="16.75" cy="16.25" r="2.15" fill="#fb5d95" strokeWidth="1.7" />
      <path d="M15.75 16.25h2" strokeWidth="1.4" />
    </IconFrame>
  );
}

export function StackPiggyVaultIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5.25 10.5c0-2.65 2.25-4.8 5-4.8h4.25c2.75 0 5 2.15 5 4.8v4.05c0 2.65-2.25 4.8-5 4.8H9.4l-1.65 1.4v-1.95a4.8 4.8 0 0 1-2.5-4.25V10.5Z" strokeWidth="2.2" />
      <path d="M10.5 10.5h4.15" strokeWidth="2.2" />
      <circle cx="16.5" cy="6.75" r="2.2" fill="#22c55e" strokeWidth="1.7" />
      <path d="M7.5 13.9h1.25M16.25 15.4h.01" strokeWidth="2.2" />
    </IconFrame>
  );
}

export function StackPiggyStatsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.75" y="14.5" width="4" height="5.75" rx="1.3" strokeWidth="2.15" />
      <rect x="10" y="10.25" width="4" height="10" rx="1.3" strokeWidth="2.15" />
      <rect x="16.25" y="5.75" width="4" height="14.5" rx="1.3" strokeWidth="2.15" />
      <path d="m15.85 7.7 2.3-2.3 2.1 2.1" strokeWidth="2.15" />
      <circle cx="18.15" cy="5.4" r="1.6" fill="#facc15" strokeWidth="1.5" />
    </IconFrame>
  );
}

export function StackPiggyMoreIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" strokeWidth="2.15" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" strokeWidth="2.15" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" strokeWidth="2.15" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" strokeWidth="2.15" />
      <circle cx="17" cy="17" r="1.75" fill="#fb5d95" strokeWidth="1.4" />
    </IconFrame>
  );
}

// The rest of the navigation uses the same construction: a clear black mark,
// one job per icon, and one small colour cue for the money-related action.
export function StackPiggyDailyReviewIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="5" y="3.25" width="14" height="17.5" rx="2.75" strokeWidth="2.2" />
      <path d="M8.5 7.25h4.25M8.5 10.5h7" strokeWidth="2.2" />
      <path d="m8.4 15.05 1.9 1.9 4.7-4.75" strokeWidth="2.2" />
      <circle cx="16.25" cy="7.25" r="1.65" fill="#facc15" strokeWidth="1.45" />
    </IconFrame>
  );
}

export function StackPiggySpendLimitIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="6.25" width="17" height="12" rx="4" strokeWidth="2.2" />
      <path d="M7 10h10" strokeWidth="2.2" />
      <path d="M7 14.5h5.4" strokeWidth="2.2" />
      <circle cx="16" cy="14.5" r="2.1" fill="#22c55e" strokeWidth="1.65" />
    </IconFrame>
  );
}

export function StackPiggyPacingIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 17.75c3.1 0 3.65-11.5 8-11.5s4.9 11.5 8 11.5" strokeWidth="2.2" />
      <circle cx="4" cy="17.75" r="1.9" fill="#22c55e" strokeWidth="1.55" />
      <circle cx="12" cy="6.25" r="1.9" fill="#facc15" strokeWidth="1.55" />
      <circle cx="20" cy="17.75" r="1.9" fill="#fb5d95" strokeWidth="1.55" />
    </IconFrame>
  );
}

export function StackPiggySubscriptionsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="4.25" y="7.5" width="15.5" height="11.25" rx="3" strokeWidth="2.2" />
      <path d="M8.1 5.75a6.5 6.5 0 0 1 8.5 1.2M16.6 6.95V4.45M16.6 6.95h-2.5" strokeWidth="2.2" />
      <path d="M15.9 20.25a6.5 6.5 0 0 1-8.5-1.2M7.4 19.05v2.5M7.4 19.05h2.5" strokeWidth="2.2" />
      <circle cx="12" cy="13.1" r="1.75" fill="#fb5d95" strokeWidth="1.45" />
    </IconFrame>
  );
}

export function StackPiggySettingsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.25 7.5h15.5M4.25 16.5h15.5" strokeWidth="2.2" />
      <circle cx="9" cy="7.5" r="2.45" fill="#22c55e" strokeWidth="1.65" />
      <circle cx="15.5" cy="16.5" r="2.45" fill="#fb5d95" strokeWidth="1.65" />
    </IconFrame>
  );
}

export function StackPiggyBillSplitIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 3.75h12v8.4l-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25V3.75Z" strokeWidth="2.15" />
      <path d="M12 14v5.75M12 16.1l-4.5 3.3M12 16.1l4.5 3.3" strokeWidth="2.15" />
      <circle cx="7.15" cy="19.45" r="1.8" fill="#facc15" strokeWidth="1.5" />
      <circle cx="16.85" cy="19.45" r="1.8" fill="#22c55e" strokeWidth="1.5" />
    </IconFrame>
  );
}

export function StackPiggyTrueCostIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6.5 3.75h11M6.5 20.25h11M8 3.75c0 4.4 2.25 4.75 4 6.25 1.75-1.5 4-1.85 4-6.25M8 20.25c0-4.4 2.25-4.75 4-6.25 1.75 1.5 4 1.85 4 6.25" strokeWidth="2.2" />
      <circle cx="12" cy="11.95" r="2.1" fill="#facc15" strokeWidth="1.55" />
    </IconFrame>
  );
}

export function StackPiggyDebtPayoffIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="4" y="5" width="5" height="5" rx="1.35" strokeWidth="2.15" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.35" strokeWidth="2.15" />
      <rect x="15" y="14" width="5" height="5" rx="1.35" strokeWidth="2.15" />
      <path d="m5.9 15.45 3.1 3.1 6.85-7.1" strokeWidth="2.25" />
      <circle cx="18.5" cy="5.5" r="1.8" fill="#22c55e" strokeWidth="1.5" />
    </IconFrame>
  );
}

export function StackPiggySafetyNetIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3.25 19 6v5.25c0 4.65-2.8 7.75-7 9.5-4.2-1.75-7-4.85-7-9.5V6l7-2.75Z" strokeWidth="2.2" />
      <path d="M8.25 13.25h7.5" strokeWidth="2.2" />
      <circle cx="12" cy="10.25" r="2.15" fill="#22c55e" strokeWidth="1.55" />
    </IconFrame>
  );
}

export function StackPiggyFireIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12.25 3.5c1.9 2.05 4.85 4.15 4.85 8.1a5.1 5.1 0 0 1-10.2 0c0-2.55 1.55-4.35 3.35-6.15.2 1.8.65 2.8 2 3.7Z" strokeWidth="2.2" />
      <path d="M12 13.1c1.15.9 1.7 1.7 1.7 2.75a1.7 1.7 0 0 1-3.4 0c0-.85.45-1.65 1.7-2.75Z" fill="#facc15" strokeWidth="1.45" />
      <path d="m18.1 4.85.75 1.45 1.4.7-1.4.75-.75 1.4-.7-1.4-1.45-.75 1.45-.7.7-1.45Z" fill="#fb5d95" strokeWidth="1.3" />
    </IconFrame>
  );
}

export function StackPiggyIncomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.75" y="7.25" width="16.5" height="11.25" rx="3" strokeWidth="2.2" />
      <circle cx="12" cy="12.9" r="2.25" fill="#22c55e" strokeWidth="1.55" />
      <path d="M7.1 4.95h8.45M13.35 2.9l2.05 2.05-2.05 2.05" strokeWidth="2.2" />
    </IconFrame>
  );
}
