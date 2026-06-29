// Single source of truth for Pro pricing. Every copy location (Settings table,
// ProUpsellPopover teaser, future Stripe line items, marketing) reads from here so
// a price change is a one-line edit.
export const PRICING = {
  monthly:  { label: 'Monthly',  price: '$4.99', sub: 'per month',              id: 'monthly' },
  annual:   { label: 'Annual',   price: '$39',   sub: '$3.25/mo · save 35%',    id: 'annual', best: true },
  lifetime: { label: 'Lifetime', price: '$99',   sub: 'pay once, own it',       id: 'lifetime' },
} as const;
