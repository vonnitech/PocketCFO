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

const headers = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers as { key: string; value: string }[];
const csp = headers.find(header => header.key === 'Content-Security-Policy')?.value ?? '';
assert.match(csp, /script-src 'self'/);
assert.match(csp, /script-src-attr 'none'/);
assert.match(csp, /object-src 'none'/);
assert.match(csp, /frame-ancestors 'none'/);
assert.equal(headers.find(header => header.key === 'X-Content-Type-Options')?.value, 'nosniff');

console.log('Security checks passed: bounded file imports, file signatures, webhook verification/order guards, and XSS response headers.');
