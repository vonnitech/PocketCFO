# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The product primarily serves people managing everyday spending from one payday to the next. They need a trustworthy way to know what spending is cleared today after money committed to bills, debt, savings, and other obligations is protected.

The product should remain understandable to budgeting beginners while giving users who want more control access to pacing, spend limits, vaults, debt planning, projections, imports, and detailed records.

## Product Purpose

The product is a pay-cycle operating system for people who live between paydays. It clears today's spending, protects future obligations, and keeps debt, savings, and vaults moving without judgment. Success means the user can make a daily spending decision without rebuilding a monthly budget in their head or accidentally spending money that already has a job.

The product also provides the supporting workflow around that number: recording income and spending, reserving recurring obligations, reviewing the day, moving money into purpose-specific vaults, planning debt payoff, and projecting longer-term outcomes.

## Positioning

The product is a forward-looking pay-cycle planner with a broader operating loop than a safe-spend calculator. It combines today's cleared amount with committed obligations, vaults, debt payoff, projections, statement imports, daily review, and restrained notifications. These parts work together to keep the current pay cycle and future goals moving.

The internal Horizon engine starts with liquid cash, protects committed obligations and savings, accounts for the days until payday, applies any voluntary spend limit, and shapes availability through pacing. “Horizon” and “safe-to-spend” are technical terms for code and internal documentation. Customer-facing language should use “cleared today,” “committed,” “vaulted,” and “left until payday.”

The daily number remains the product's primary decision aid, but the external position must not rely on owning “safe to spend.” That territory is crowded by adjacent products such as PocketGuard and Pace. The broader promise is: **Pay future-you first. Spend what's cleared.**

Every screen that presents or changes daily availability must agree with the same calculation and clearly explain any spend limit or pacing effect.

## Operating Context

Users typically check the product on a phone before or after a purchase, during a daily review, and when income, bills, or payday timing changes. The main loop is:

1. Enter current cash, payday, recurring bills, and relevant goals.
2. Check the amount cleared for today.
3. Log spending and income as they happen or import a statement.
4. Mark bills and subscriptions as paid, review the day, and adjust the pay cycle when circumstances change.
5. Use vaults, debt tools, and projections for money beyond immediate discretionary spending.

Privacy matters in shared or public environments, so the app includes a privacy mode, screen locking, and user-scoped local persistence. It is installable as a PWA and supports offline use through IndexedDB.

## Capabilities and Constraints

- The Horizon calculation in `src/core/math.ts` is the source of truth for the internal safe-to-spend value presented to users as the amount cleared today.
- Recurring bills, subscriptions, debt payments, savings, and internal transfers must remain distinct from discretionary spending so money is not deducted twice.
- Spend limits reduce the amount a user permits themselves to spend; pacing controls when that amount is available. These controls compound and must not be presented as interchangeable.
- Currency is configurable. Product language and calculations must not assume a single country or currency.
- The app uses React, TypeScript, Vite, Tailwind CSS, Zustand, Supabase, IndexedDB, and local storage.
- The product supports light and dark themes plus user-selectable accent pairs with automatically readable foreground colors.
- Core workflows must remain usable on mobile screens and with touch input.
- Pro-only tools may be previewed while locked, but core daily-money workflows must stay clear about availability and state.
- Financial projections are planning aids. Future work must not present estimates as guarantees or fabricate financial outcomes.

## Brand Commitments

The product is currently named PocketCFO pending a rename. Treat PocketCFO as a working name, not a final brand commitment. New naming, identity, domains, and customer-facing assets must remain portable until the rename is decided.

The voice is direct, candid, concise, and nonjudgmental. It treats the user as capable, explains consequences plainly, and avoids shame, moral scoring, or paternalistic language. Terms should describe what the money is doing: “committed” for obligations, “captured” or “vaulted” for deliberate reserves, “cleared today” for spendable money, and “ended early” rather than language that labels the user a failure.

The central external promise is: **Pay future-you first. Spend what's cleared.**

## Evidence on Hand

- `README.md` documents the Horizon model, current feature set, technical stack, and the distinction between committed obligations and allocated capital.
- `src/core/math.ts` and `src/core/velocity.ts` contain the current safe-spend, tier, and pacing rules.
- `src/pages/Dashboard.tsx` implements the primary daily decision surface.
- `src/components/Onboarding.tsx`, `src/components/TransactionForm.tsx`, and `src/pages/DailyLog.tsx` implement the setup, spend logging, and review loop.
- `src/index.css`, `src/core/themes.ts`, and the shared components contain the incumbent visual and theme system.
- No testimonials, customer counts, performance benchmarks, regulatory claims, or guaranteed financial outcomes are present. Future work must not invent them.

## Product Principles

1. **Protect committed money first.** Bills, debt obligations, savings, and transfers keep their intended meaning throughout calculations and reporting.
2. **One decision number, one source of truth.** Any surface showing daily availability must use the same underlying calculation and explain modifiers consistently.
3. **Make the next action obvious.** Prioritize what is cleared for the user to do today over retrospective complexity.
4. **State facts without judgment.** Confirm responsible behavior, describe risk clearly, and never turn a financial event into a verdict on the user.
5. **Progressive depth.** Keep the daily loop fast while allowing deeper planning and analysis when the user asks for it.

## Accessibility & Inclusion

Respect reduced-motion preferences, preserve keyboard-visible focus states, maintain readable contrast in both themes and custom accent combinations, and keep touch targets practical on small screens. Privacy mode must obscure sensitive values consistently. Financial language should remain plain enough for users without formal budgeting knowledge.
