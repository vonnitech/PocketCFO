// Who runs StackPiggy, as stated on the Terms, Privacy and Refunds pages.
//
// FILL IN BEFORE GOING LIVE. Paddle's verification and South Africa's POPIA
// both expect a named operator and a working contact. Anything still in
// [square brackets] is shown on the pages exactly as written, so a missed
// field is visible rather than silently blank.
export const OPERATOR = {
  // The person or company that sells StackPiggy: your full legal name if you
  // signed up to Paddle as an individual, or the registered company name.
  legalName: 'Christina Gumpo',
  // Must be a real, monitored inbox: privacy, refund and support requests go here.
  contactEmail: 'hello@stackpiggy.com',
  // POPIA information officer. For a one-person business this is normally the owner.
  informationOfficer: 'Christina Gumpo',
  country: 'South Africa',
} as const;

// Shown at the top of every page. Change it whenever the wording changes.
export const LEGAL_UPDATED = '29 October 2026';
