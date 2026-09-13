# Security checks and deployment requirements

## File imports

Statement imports are processed locally and are never uploaded as files. CSV,
XLSX and XLS are allowlisted, limited to 5 MB, checked for the expected binary
signature, and capped at 10,000 rows, 100 columns and 500 characters per cell.
JSON backups are limited to 2 MB. Imported backup keys are restricted to known
data fields and cannot replace store actions, authenticated-user state, freshness
flags, or screen-lock credentials. User-controlled text is prefixed safely when
exported to CSV/XLSX so spreadsheet applications do not execute it as a formula.

These controls reduce parser and memory abuse; they do not make arbitrary office
files trustworthy. Keep the `xlsx` and `papaparse` dependencies current. The app
does not retain or publicly serve uploaded files, so filename traversal and public
file retrieval are outside this flow.

## XSS controls

React renders imported descriptions and other user data as text. There are no
`dangerouslySetInnerHTML`, direct HTML insertion, `eval`, or dynamic-function
sinks in application code. Production headers add a restrictive Content Security
Policy, block object embedding and inline script attributes, prevent framing,
disable MIME sniffing, and isolate the top-level browsing context. Billing URLs
must be credential-free HTTPS values on both the API and browser boundaries.

The CSP is configured in `vercel.json`; a different host must reproduce those
headers. `style-src 'unsafe-inline'` remains because the UI uses runtime inline
styles. It does not permit inline JavaScript.

## LemonSqueezy webhooks

Deploy `supabase/migrations/022_billing_webhook_order.sql` and
`supabase/migrations/023_free_tier_cap_hardening.sql` before deploying the
updated API. Configure these server-only variables in Vercel:

```text
LEMONSQUEEZY_WEBHOOK_SECRET
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_VARIANT_MONTHLY
LEMONSQUEEZY_VARIANT_ANNUAL
LEMONSQUEEZY_VARIANT_LIFETIME
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_ORIGIN
```

Never prefix secrets with `VITE_`. In LemonSqueezy, point the webhook to
`https://YOUR-DOMAIN/api/lemonsqueezy-webhook` and select only the order and
subscription events used by the handler.

The endpoint accepts only JSON POSTs up to 1 MB, verifies `X-Signature` over the
raw body with HMAC-SHA256 and a timing-safe comparison, matches the header event
name, store, user UUID and configured variants, and rejects malformed payloads.
The database update cursor makes retries idempotent and ignores delayed older
events. An expiry for an old subscription cannot revoke a replacement one.
Database errors return a failure response so LemonSqueezy retries instead of the
endpoint acknowledging a lost update.

Checkout return URLs use the fixed HTTPS `APP_ORIGIN`; request headers cannot
choose the destination. Customer and subscription identifiers are URL-encoded,
and API logs contain only operational status/code fields rather than provider
response bodies. LemonSqueezy-returned checkout and portal URLs must remain on a
`lemonsqueezy.com` host.

Migration 023 repairs the database free-tier cap. The earlier trigger was a
`SECURITY DEFINER` function that checked `current_user`; PostgreSQL changes that
identity to the function owner, which accidentally bypassed the cap. The repaired
function has no identity bypass and serializes inserts per user to prevent two
concurrent requests from both passing the count check.

## Logging and source maps

Production builds do not emit the placeholder product/security telemetry.
Development telemetry omits user identifiers, balances, safe-spend values and
reserved bill totals. Server errors return generic messages and log only status or
error codes. Vite production source maps remain disabled.

Before enabling live payments, use LemonSqueezy test mode to exercise monthly,
annual and lifetime purchases, cancellation, resumption, failed-payment recovery
and expiry. Confirm invalid signatures, wrong stores and unknown variants do not
alter a profile. Confirm a database failure produces a non-200 response, then use
LemonSqueezy's webhook log to resend after recovery.

Run local static and boundary checks with:

```sh
npm run verify:security
npm run lint
npm run build
```

References: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
[OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html),
[LemonSqueezy signing requests](https://docs.lemonsqueezy.com/help/webhooks/signing-requests),
[LemonSqueezy webhook requests](https://docs.lemonsqueezy.com/help/webhooks/webhook-requests).
