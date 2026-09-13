# Security readiness review

Reviewed against the 50-item checklist in the supplied screenshots on
13 September 2026. “Code complete” means the repository contains the control;
database migrations and hosting settings still need deployment verification.

| # | Risk | Status | Evidence or required action |
|---:|---|---|---|
| 1–3 | Exposed credentials, public env files, hardcoded keys | Code complete | Only `.env.example` is tracked; local env files and signing keys are ignored. The tracked tree and relevant history were scanned for obvious secret patterns. |
| 4 | Weak or missing authentication | External verification | Supabase verifies sessions server-side. Confirm email verification, password policy, leaked-password protection and MFA policy in the live Supabase project. |
| 5–7 | Missing authorization, cross-user data, open database | Code complete; deploy verify | RLS policies scope every user table to `auth.uid()` and migration 012 asserts RLS/policies exist. Run all migrations in production and test with two accounts. |
| 8 | Misconfigured object storage | Not applicable | The app does not use Firebase, Supabase Storage or S3 buckets. |
| 9–10 | Open admin/debug routes | Code complete | No application admin or debug routes exist. Server endpoints authenticate billing/account operations. |
| 11–14 | Secrets in logs, errors, Git or frontend bundles | Code complete; host verify | API responses are generic, logs are redacted, and Vite exposes only `VITE_` values. Keep all privileged values server-only and enable secret scanning on GitHub. |
| 15–16 | Client-only checks and missing validation | Code complete for critical paths | Auth, billing entitlements, free-plan caps, file boundaries and imports have server/database or boundary validation. Continue schema validation whenever a new endpoint is added. |
| 17–18 | SQL/NoSQL injection | Code complete / not applicable | Database access uses Supabase query builders and fixed columns; no raw user-built SQL or NoSQL database is present. |
| 19–20 | XSS and CSRF | Code complete | React text rendering, no HTML/eval sinks, CSP, same-origin APIs and bearer authentication reduce these paths. APIs do not use ambient auth cookies. |
| 21–23 | File upload, path traversal and SSRF | Code complete | Imports stay local, types/signatures/sizes/shape are bounded, no server file paths are accepted, and outbound hosts are fixed. Provider path IDs are URL-encoded. |
| 24–26 | Password reset, sessions and JWT secrets | External verification | Supabase owns recovery/session/JWT controls. Verify allowed redirect URLs, token lifetime, refresh-token reuse detection and key rotation. The local PIN is a privacy screen lock, not account authentication. |
| 27 | Permissive CORS | Code complete | APIs emit no permissive CORS headers and are called same-origin. |
| 28 | Missing rate limits | Release blocker | Configure Vercel firewall/rate limiting for auth-adjacent and API routes, plus Supabase Auth rate limits/CAPTCHA. Serverless in-memory counters are insufficient. |
| 29–30 | Public staging and default credentials | External verification | No default credentials exist in the repository. Protect preview deployments and verify production/test projects are separate. |
| 31–32 | Unsigned webhooks and frontend-only payment checks | Code complete; deploy verify | Raw-body HMAC, event/store/variant validation, replay ordering and database-owned entitlement fields are implemented. Apply migrations 022–023 and test LemonSqueezy retries. |
| 33–34 | IDOR and trusted client IDs/roles | Code complete; deploy verify | Billing/account user IDs come from verified access tokens; RLS binds data to the authenticated user. |
| 35–36 | Sensitive logs and source maps | Code complete | Provider bodies, user IDs and financial telemetry are not logged; production telemetry is disabled; Vite source maps are off. |
| 37–38 | Vulnerable/outdated dependencies | Production clear | `npm audit --omit=dev` reports zero known production vulnerabilities. Development tool advisories remain and need routine upgrade review. |
| 39–40 | AI prompt/tool injection | Not applicable | Pocket CFO has no AI model or tool execution feature. |
| 41 | Excessive database permissions | Code complete; deploy verify | Browser code uses the anon key under RLS; service-role access exists only in server endpoints. Verify Vercel variables and Supabase grants. |
| 42–43 | Audit logs, monitoring and alerting | Release blocker | Add a privacy-reviewed production error/alerting service and durable audit events for billing/account deletion without recording financial values or tokens. |
| 44 | Backup and restore | Release blocker | Enable and test Supabase backups/point-in-time recovery as appropriate for the plan; document a restore drill and owner. |
| 45 | Exposed internal dashboards | Not applicable / host verify | No internal dashboard ships in this repository. Restrict Supabase, Vercel and LemonSqueezy organization access with MFA. |
| 46 | Missing security headers | Code complete | Vercel config sets CSP, HSTS, frame denial, MIME-sniffing protection and cross-origin isolation headers. Reproduce them on any other host. |
| 47 | Weak cookies | Not applicable | Application authentication uses Supabase bearer tokens rather than custom session cookies. Any future cookie must be `HttpOnly`, `Secure` and intentionally `SameSite`. |
| 48 | Unencrypted sensitive data | Partial; release decision | Transport and managed database encryption rely on HTTPS/Supabase. Browser and native cached finance data rely on OS/browser storage controls and are not separately application-encrypted. Add platform secure-storage/database encryption before claiming application-level encryption at rest. |
| 49 | Poor tenant isolation | Code complete; deploy verify | Each record carries `user_id` and RLS policies enforce account isolation. Prove it in a two-user production smoke test after migrations. |
| 50 | Over-trusting generated code | Process control | Type checks, targeted security checks, production builds, native verification and Android builds are required before release. Human review remains required for migrations and payment changes. |

## Required release actions

1. Apply Supabase migrations 022 and 023, then run two-account RLS and concurrent free-cap tests.
2. Set `APP_ORIGIN` and every LemonSqueezy/Supabase server secret in Vercel; verify none use a `VITE_` prefix.
3. Configure rate limits, production monitoring/alerts, secret scanning and protected preview deployments.
4. Enable and test database restore, then decide whether local application-level encryption is required for launch.
5. Run LemonSqueezy test-mode purchases, cancellation, resumption, expiry, bad signatures and webhook retries.
