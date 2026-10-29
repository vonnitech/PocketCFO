// Single source of truth for Pro pricing. Every copy location (Settings table,
// ProUpsellPopover teaser, marketing) reads from here so a price change is a
// one-line edit. The LemonSqueezy variant IDs themselves live in env vars, keyed
// by the plan ids below (LEMONSQUEEZY_VARIANT_MONTHLY/ANNUAL).
// Prices are shown before tax. Lemon Squeezy adds any sales tax or VAT at
// checkout, so every place that shows a price also shows TAX_NOTE.
export const PRICING = {
  monthly:  { label: 'Monthly',  price: '$5',  sub: 'per month',       id: 'monthly' },
  annual:   { label: 'Annual',   price: '$40', sub: '4 months free',   id: 'annual', best: true },
} as const;

export const TAX_NOTE = 'Plus tax where applicable';
