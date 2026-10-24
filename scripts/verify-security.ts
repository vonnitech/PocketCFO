import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BACKUP_BYTES, MAX_STATEMENT_BYTES, validateBackupFile,
  validateParsedTable, validateStatementFile,
} from '../src/core/fileValidation';
import { spreadsheetSafe } from '../src/core/export';

const file = (parts: BlobPart[], name: string, type = '') => new File(parts, name, { type });

assert.equal(await validateStatementFile(file(['date,merchant,amount\n2026-01-01,Cafe,4'], 'safe.csv')), 'csv');
assert.equal(await validateStatementFile(file([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'safe.xlsx')), 'xlsx');
await assert.rejects(() => validateStatementFile(file(['<html>'], 'attack.html')), /CSV, XLSX, or XLS/);
await assert.rejects(() => validateStatementFile(file([new Uint8Array([0, 1, 2])], 'fake.csv')), /binary/);
await assert.rejects(() => validateStatementFile(file(['not a zip'], 'fake.xlsx')), /signature/);
await assert.rejects(() => validateStatementFile(file([new Uint8Array(MAX_STATEMENT_BYTES + 1)], 'large.csv')), /5 MB/);
assert.throws(() => validateBackupFile(file([new Uint8Array(MAX_BACKUP_BYTES + 1)], 'large.json')), /2 MB/);
assert.throws(() => validateParsedTable(['a'], [{ a: 'x'.repeat(501) }]), /500/);
assert.equal(spreadsheetSafe('=HYPERLINK("https://example.test")'), "'=HYPERLINK(\"https://example.test\")");
assert.equal(spreadsheetSafe('Coffee shop'), 'Coffee shop');

const source = readFileSync('api/lemonsqueezy-webhook.ts', 'utf8');
assert.match(source, /timingSafeEqual/);
assert.match(source, /bytes > 1024 \* 1024/);
assert.match(source, /LEMONSQUEEZY_STORE_ID/);
assert.match(source, /ls_event_updated_at/);
assert.match(source, /throw new Error\(`Supabase entitlement update failed/);

// A LemonSqueezy event may only revoke Pro that LemonSqueezy granted, so a late
// expiry cannot cancel someone's Paddle subscription.
assert.match(source, /if \(fields\.pro_plan === null\) query = query\.eq\('pro_source', 'lemonsqueezy'\)/);

// Paddle: signatures are checked for real, not just pattern-matched.
const { verifyPaddleSignature } = await import('../api/_paddle');
const { createHmac } = await import('node:crypto');
const body = Buffer.from('{"event_type":"subscription.created"}');
const sign = (ts: number, secret: string, payload = body) =>
  createHmac('sha256', secret).update(`${ts}:`).update(payload).digest('hex');
const now = 1_800_000_000;
assert.equal(verifyPaddleSignature(body, `ts=${now};h1=${sign(now, 'sec')}`, 'sec', now), true);
assert.equal(verifyPaddleSignature(Buffer.from('{"tampered":1}'), `ts=${now};h1=${sign(now, 'sec')}`, 'sec', now), false);
assert.equal(verifyPaddleSignature(body, `ts=${now};h1=${sign(now, 'other')}`, 'sec', now), false);
assert.equal(verifyPaddleSignature(body, `ts=${now - 600};h1=${sign(now - 600, 'sec')}`, 'sec', now), false);
assert.equal(verifyPaddleSignature(body, `ts=${now};h1=${sign(now, 'old')};h1=${sign(now, 'sec')}`, 'sec', now), true);
assert.equal(verifyPaddleSignature(body, `ts=${now};h1=${sign(now, 'sec')}`, '', now), false);
assert.equal(verifyPaddleSignature(body, '', 'sec', now), false);

const paddleHelper = readFileSync('api/_paddle.ts', 'utf8');
const paddleWebhook = readFileSync('api/paddle-webhook.ts', 'utf8');
assert.match(paddleHelper, /timingSafeEqual/);
// Only an explicit 'production' reaches live Paddle; anything else is sandbox.
assert.match(paddleHelper, /PADDLE_LIVE = process\.env\.PADDLE_ENV === 'production'/);
assert.match(paddleWebhook, /bytes > 1024 \* 1024/);
assert.match(paddleWebhook, /if \(!secret\)/);
assert.match(paddleWebhook, /paddle_event_updated_at/);
// The account is found by the server-linked customer, never by custom_data.
assert.match(paddleWebhook, /\.eq\('paddle_customer_id', sub\.customer_id!\)/);
assert.doesNotMatch(paddleWebhook, /custom_data/);
assert.match(paddleWebhook, /\.eq\('paddle_subscription_id', sub\.id!\)\.eq\('pro_source', 'paddle'\)/);

const checkout = readFileSync('api/checkout.ts', 'utf8');
const portal = readFileSync('api/portal.ts', 'utf8');
const deletion = readFileSync('api/_delete-account-core.ts', 'utf8');
assert.match(checkout, /requireUser\(req\)/);
assert.doesNotMatch(checkout, /req\.headers\.origin/);
assert.doesNotMatch(checkout, /req\.body[^;]*user_id/);
// The customer link must exist before the transaction is created.
assert.ok(checkout.indexOf('customerFor(caller.id') < checkout.indexOf("'/transactions'"));
assert.match(portal, /encodeURIComponent\(customerId\)/);
assert.match(portal, /trusted\(session\?\.urls\?\.general\?\.overview, 'paddle\.com'\)/);
assert.doesNotMatch(portal, /resp\.status, json/);
assert.match(deletion, /encodeURIComponent\(subscriptionId\)/);
assert.match(deletion, /cancelPaddleSubscription/);
assert.doesNotMatch(deletion, /resp\.text\(\)/);

const paddleMigration = readFileSync('supabase/migrations/027_paddle_billing.sql', 'utf8');
for (const column of ['paddle_customer_id', 'paddle_subscription_id', 'paddle_event_updated_at']) {
  assert.match(paddleMigration, new RegExp(`new\\.${column} := null`));
  assert.match(paddleMigration, new RegExp(`new\\.${column} is distinct from old\\.${column}`));
}

const capMigration = readFileSync('supabase/migrations/023_free_tier_cap_hardening.sql', 'utf8');
assert.match(capMigration, /security definer/);
assert.match(capMigration, /set search_path = ''/);
assert.match(capMigration, /pg_advisory_xact_lock/);
assert.doesNotMatch(capMigration, /if current_user/);

const telemetry = readFileSync('src/core/telemetry.ts', 'utf8');
assert.match(telemetry, /import\.meta\.env\.DEV/);
assert.doesNotMatch(telemetry, /userIdRef|userId:/);
assert.match(telemetry, /key !== 'safeSpend' && key !== 'billsReserved'/);

const viteConfig = readFileSync('vite.config.ts', 'utf8');
assert.doesNotMatch(viteConfig, /sourcemap\s*:\s*true/);

const authGate = readFileSync('src/components/AuthGate.tsx', 'utf8');
const authPlatform = readFileSync('src/native/platform.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
assert.doesNotMatch(authGate, /err instanceof Error \? err\.message/);
assert.match(authGate, /If an account exists for that email/);
assert.match(authPlatform, /access_token.*refresh_token/);
assert.match(authPlatform, /history\.replaceState/);
assert.match(app, /clearAuthCallbackUrl\(\)/);

const recoveryEmail = readFileSync('supabase/templates/recovery.html', 'utf8');
assert.match(recoveryEmail, /StackPiggy/);
assert.equal((recoveryEmail.match(/\{\{ \.ConfirmationURL \}\}/g) ?? []).length, 1);
assert.doesNotMatch(recoveryEmail, /\{\{ \.(Token|TokenHash|Email) \}\}/);

const headers = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers as { key: string; value: string }[];
const csp = headers.find(header => header.key === 'Content-Security-Policy')?.value ?? '';
assert.match(csp, /script-src 'self'/);
assert.match(csp, /script-src-attr 'none'/);
assert.match(csp, /object-src 'none'/);
assert.match(csp, /frame-ancestors 'none'/);
// Analytics has to be allowed through explicitly, and its absence fails silently:
// the browser refuses each send with nothing surfacing in the app, so the only
// symptom is an empty dashboard that looks like nobody is using the product.
// These two assertions exist so tightening the policy breaks a test instead.
assert.match(csp, /connect-src[^;]*https:\/\/us\.i\.posthog\.com/);
assert.match(csp, /script-src 'self'[^;]*https:\/\/us-assets\.i\.posthog\.com/);
// Checkout is a Paddle overlay: its script and frame must be allowed, or the
// upgrade button silently does nothing in production.
assert.match(csp, /script-src 'self'[^;]*https:\/\/cdn\.paddle\.com/);
assert.match(csp, /frame-src[^;]*https:\/\/buy\.paddle\.com[^;]*https:\/\/sandbox-buy\.paddle\.com/);
assert.equal(headers.find(header => header.key === 'X-Content-Type-Options')?.value, 'nosniff');

console.log('Security checks passed: bounded imports, spreadsheet/XSS defenses, signed ordered webhooks, trusted billing URLs, redacted telemetry, and race-safe plan caps.');
