# Pocket CFO

A neobrutalist personal-finance app that tells you one thing the rest don't: **exactly how much you can safely spend today** without blowing your pay cycle.

Most budgeting apps show you where money *went*. Pocket CFO is forward-looking — it reserves your bills, savings, and debt obligations off the top, then divides what's genuinely left across the days until your next payday. The number on the dashboard is the only one you have to obey.

---

## Core idea — the Horizon engine

Pocket CFO models your money as **pay-cycle liquidity** rather than a static monthly budget:

```
Safe-to-spend today  =  (liquid cash − committed obligations − savings goal)
                         ÷ days remaining until next payday
```

"Committed obligations" (recurring bills, debt minimums, vault deposits) are **pre-reserved** and never counted as discretionary spend. Everything in the app — the dashboard hero number, the analytics, the month-over-month comparison — respects that separation. The math lives in [`src/core/math.ts`](src/core/math.ts) (`calculateTrueSafeSpend`, `calculateDaysUntilPayday`, spend tiers).

---

## Features

**Core**
- **Dashboard** — safe-to-spend hero, quick log-spend with category chips, recent activity feed, 7-day trend, monthly budget progress.
- **Daily Log / Transactions** — full ledger with search, category filters, infinite scroll, inline category editing, and delete.
- **Vaults** — goal-based savings buckets typed by asset class (Investment / Sinking Fund / Cash Reserve), with funding, transfers, and milestone badges.
- **Ledger & Audit (Breakdown)** — spend-by-category donut chart, pivot analytics (monthly/weekly), wealth captured, capital allocated (debt payoff) and committed (bills) cards kept distinct.

**Tools**
- **Bill Splitter** — split a shared expense across a squad with custom presets.
- **True Cost** — shows what an impulse purchase really costs against your hourly rate / future value.
- **Debt Destroyer** — avalanche/snowball debt payoff planning.
- **Savings Goals, Compound Growth, FIRE calculator** — long-horizon projections (FIRE counts only `INVESTMENT`-class vaults).
- **Subscriptions** — recurring-charge tracker.

**Lifecycle & security**
- **Payday automation** — detects when payday passes and rolls the cycle forward.
- **Statement import** — CSV / XLSX upload with column mapping, category normalization, and recurring-bill/income detection ([`src/components/ImportMapperModal.tsx`](src/components/ImportMapperModal.tsx), [`src/core/export.ts`](src/core/export.ts)).
- **Export** — CSV / XLSX / PDF reporting.
- **Screen lock** — PIN + WebAuthn, idle-timeout and background auto-lock.
- **PWA** — installable, offline-capable, IndexedDB-backed.
- **Theming** — light/dark mode with runtime-customizable accent colors (auto-contrast adjusted).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (`@theme` CSS variables, brutalist tokens) |
| State | Zustand |
| Backend | Supabase (auth + Postgres) |
| Local persistence | IndexedDB (`idb`) + localStorage |
| Charts | Recharts |
| Animation | `motion` (Framer Motion) |
| Import / Export | `papaparse`, `xlsx`, `jspdf` + `jspdf-autotable` |
| Routing | React Router v7 |
| PWA | `vite-plugin-pwa` |

---

## Getting started

**Prerequisites:** Node.js 18+ and a [Supabase](https://supabase.com) project.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase** — create a `.env.local` file in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Find these in **Supabase Dashboard → Project Settings → API**. If they're missing, the app shows a setup screen instead of booting.

3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Opens on [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server (port 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove the `dist/` folder |

---

## Project structure

```
src/
├── App.tsx              # Router, auth gate, theme + payday lifecycle
├── store/useStore.ts    # Zustand store — all state and actions
├── core/
│   ├── math.ts          # Safe-spend / horizon engine
│   ├── lifecycle.ts     # Payday detection and cycle rollover
│   ├── export.ts        # Import parsing, category mapping, CSV/XLSX/PDF export
│   ├── supabase.ts      # Supabase client
│   └── sync.ts          # Fire-and-forget Supabase write helpers
├── pages/               # Route-level screens (lazy-loaded)
├── components/          # Shared UI, modals, bottom sheets, charts
├── hooks/               # useIdleLock, usePWAInstall
├── lib/                 # crypto, webauthn, utils
└── db/                  # IndexedDB setup
```

---

## Notes

- **Bills are not "allocated capital."** Recurring obligations (rent, insurance) are tracked as *committed* spend, separate from deliberate net-worth moves (debt payoff, vault deposits). This distinction is enforced in the analytics, not just cosmetic.
- The design language is intentionally **neobrutalist** — heavy black borders, hard drop-shadows, uppercase tracked type. Some lint warnings (e.g. `border-[4px]` vs `border-4`) are kept on purpose for visual consistency.
