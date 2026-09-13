import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWidgetSnapshot } from '../src/native/widgetSnapshot';
import { parseNativeLink } from '../src/native/deepLinks';
import { dailyDiscretionarySpend } from '../src/core/clearedToday';
import type { AppState, Transaction } from '../src/store/useStore';

const now = new Date(2026, 8, 12, 13, 0);
const tx = (category: string, amount: number, date = now): Transaction => ({
  id: category, merchant: 'Private merchant', amount, category,
  date: date.toISOString(), isFlip: false, flipAmount: 0,
});
const transactions = [
  tx('FOOD', 20), tx('TRANSPORT', 5), tx('SHOPPING', -3),
  tx('INCOME', 5000), tx('BILL_PAYMENT', 100), tx('SUBSCRIPTION_PAYMENT', 12),
  tx('VAULT_DEPOSIT', 200), tx('VAULT_WITHDRAWAL', 25), tx('VAULT_TRANSFER', 80),
  tx('DEBT_PAYMENT', 60), tx('SAVINGS', 10), tx('PENALTY', 5),
  tx('FOOD', 99, new Date(2026, 8, 11, 23, 59)),
];
const state = {
  userId: 'account-a', dataLoaded: true, dataFresh: true,
  hasCompletedOnboarding: true, nextPayday: '2026-09-25',
  privacyMode: false, lockEnabled: false, isLocked: false,
  safeSpendLimit: 100, currency: 'USD', transactions,
} as AppState;

assert.equal(dailyDiscretionarySpend(transactions, now), 22);
const snapshot = makeWidgetSnapshot(state, now)!;
assert.equal(snapshot.amountText, '$78.00');
assert.equal(snapshot.updatedAt, now.getTime());
assert.equal(snapshot.expiresAt, new Date(2026, 8, 13).getTime());
assert.equal(makeWidgetSnapshot({ ...state, safeSpendLimit: 10 }, now)!.amountText, '$0.00');
assert.equal(makeWidgetSnapshot({ ...state, safeSpendLimit: NaN }, now), null);
for (const property of ['privacyMode', 'lockEnabled', 'isLocked'] as const) {
  const hidden = makeWidgetSnapshot({ ...state, [property]: true }, now)!;
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.amountText, '');
  assert.ok(!JSON.stringify(hidden).includes('$78.00'));
}
for (const patch of [
  { userId: null }, { dataFresh: false }, { hasCompletedOnboarding: false }, { nextPayday: '' },
]) assert.equal(makeWidgetSnapshot({ ...state, ...patch }, now), null);
assert.deepEqual(Object.keys(snapshot).sort(), ['version', 'amountText', 'hidden', 'updatedAt', 'expiresAt'].sort());
assert.ok(!JSON.stringify(snapshot).includes('Private merchant'));
assert.ok(!JSON.stringify(snapshot).includes('account-a'));
const yen = makeWidgetSnapshot({ ...state, currency: 'JPY' }, now)!;
assert.equal(yen.amountText, new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(78));

assert.deepEqual(parseNativeLink('app.pocketcfo.mobile://spend'), { type: 'spend' });
assert.deepEqual(parseNativeLink('app.pocketcfo.mobile://home'), { type: 'home' });
assert.deepEqual(parseNativeLink('app.pocketcfo.mobile://auth/callback?code=one-use-code'), { type: 'auth', code: 'one-use-code' });
for (const link of ['https://example.com/spend', 'javascript:alert(1)',
  'app.pocketcfo.mobile://auth/callback', 'app.pocketcfo.mobile://attacker@auth/callback?code=x',
  'app.pocketcfo.mobile://spend/untrusted', 'app.pocketcfo.mobile://auth/elsewhere?code=x']) {
  assert.equal(parseNativeLink(link), null);
}

const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
assert.ok(pbx.includes('com.apple.product-type.app-extension'));
assert.ok(pbx.includes('PocketWidgetPlugin.swift in Sources'));
assert.ok(pbx.includes('ClearedTodayWidget.swift in Sources'));
assert.ok(pbx.includes('ClearedTodayWidget.appex in Copy Files'));
assert.ok(pbx.includes('dstSubfolderSpec = 13'));
assert.ok(!pbx.includes('= undefined;'));
assert.ok(pbx.includes('isa = PBXTargetDependency;'));
assert.ok(pbx.includes('isa = PBXContainerItemProxy;'));
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert.ok(manifest.includes('android:allowBackup="false"'));
assert.ok(manifest.includes('android:name=".ClearedTodayWidget" android:exported="false"'));
console.log('Native checks passed: daily spending, privacy/lock redaction, sign-out/cache state, expiry, currency, deep links, and widget project wiring.');
