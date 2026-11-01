// Single source of truth for Pro pricing. Every copy location (Settings table,
// ProUpsellPopover teaser, marketing) reads from here so a price change is a
// one-line edit. The Paddle price IDs themselves live in env vars, keyed by the
// plan ids below (PADDLE_PRICE_MONTHLY/ANNUAL), and must match these amounts.
// Prices are shown before tax. The Paddle prices use tax_mode 'external', so
// Paddle adds any sales tax or VAT on top at checkout, and every place that
// shows a price also shows TAX_NOTE.
export const PRICING = {
  monthly:  { label: 'Monthly',  price: '$5',  sub: 'per month',       id: 'monthly' },
  annual:   { label: 'Annual',   price: '$40', sub: '4 months free',   id: 'annual', best: true },
} as const;

export const TAX_NOTE = 'Plus tax where applicable';

// Pro upgrades stay closed until Paddle approves the account. Set
// VITE_PRO_CHECKOUT=on in Vercel and redeploy to open them; /api/checkout reads
// the same variable, so one switch covers the buttons and the server.
export const PRO_CHECKOUT_OPEN = import.meta.env.VITE_PRO_CHECKOUT === 'on';
