// Major world currencies (OANDA "majors" set). Each user picks one in Settings; the
// app formats every amount in it. This is DISPLAY currency only — there's no FX
// conversion, so amounts are assumed to already be in the user's chosen currency.
export interface CurrencyDef {
  code: string;    // ISO 4217
  name: string;
  symbol: string;  // short symbol for manual prefixes (inputs, etc.)
  locale: string;  // for Intl.NumberFormat
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'USD', name: 'US Dollar',            symbol: '$',   locale: 'en-US' },
  { code: 'EUR', name: 'Euro',                 symbol: '€',   locale: 'en-IE' },
  { code: 'GBP', name: 'British Pound',        symbol: '£',   locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen',         symbol: '¥',   locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$',  locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'C$',  locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'CHF', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan',         symbol: '¥',   locale: 'zh-CN' },
  { code: 'HKD', name: 'Hong Kong Dollar',     symbol: 'HK$', locale: 'en-HK' },
  { code: 'INR', name: 'Indian Rupee',         symbol: '₹',   locale: 'en-IN' },
  { code: 'AED', name: 'UAE Dirham',           symbol: 'AED', locale: 'en-AE' },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$',  locale: 'pt-BR' },
  { code: 'MXN', name: 'Mexican Peso',         symbol: 'MX$', locale: 'es-MX' },
  { code: 'MYR', name: 'Malaysian Ringgit',    symbol: 'RM',  locale: 'ms-MY' },
  { code: 'PHP', name: 'Philippine Peso',      symbol: '₱',   locale: 'en-PH' },
  { code: 'SAR', name: 'Saudi Riyal',          symbol: 'SAR', locale: 'en-SA' },
  { code: 'SEK', name: 'Swedish Krona',        symbol: 'kr',  locale: 'sv-SE' },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$',  locale: 'en-SG' },
  { code: 'THB', name: 'Thai Baht',            symbol: '฿',   locale: 'th-TH' },
  { code: 'ZAR', name: 'South African Rand',   symbol: 'R',   locale: 'en-ZA' },
];

// Module-level active currency. Kept here (not in the Zustand store) so the pure
// formatCurrency util can read it without importing the store (avoids a cycle).
// The store mirrors `currency` in state for reactivity and calls setActiveCurrency.
let _active = 'USD';
export const setActiveCurrency = (code: string): void => {
  if (CURRENCIES.some(c => c.code === code)) _active = code;
};
export const getActiveCurrency = (): string => _active;

export const currencyDef = (code: string = _active): CurrencyDef =>
  CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];

export const currencySymbol = (code: string = _active): string => currencyDef(code).symbol;
