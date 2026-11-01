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

// Country (ISO 3166 alpha-2) to the currencies above. Anything not listed falls
// back to USD, which is also what Zimbabwe and much of the region price in.
const EURO_COUNTRIES = ['AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV','MT','NL','PT','SI','SK'];
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', JP: 'JPY', AU: 'AUD', CA: 'CAD', CH: 'CHF', CN: 'CNY',
  HK: 'HKD', IN: 'INR', AE: 'AED', BR: 'BRL', MX: 'MXN', MY: 'MYR', PH: 'PHP',
  SA: 'SAR', SE: 'SEK', SG: 'SGD', TH: 'THB', ZA: 'ZAR',
  // Rand-linked neighbours, where prices are commonly read in rand.
  LS: 'ZAR', NA: 'ZAR', SZ: 'ZAR',
  ...Object.fromEntries(EURO_COUNTRIES.map(c => [c, 'EUR'])),
};

// The device time zone says where someone is far more reliably than the browser
// language, which is very often en-US whatever the country. Only zones that
// map cleanly to one country are listed.
const ZONE_COUNTRY: Record<string, string> = {
  'Africa/Johannesburg': 'ZA', 'Africa/Maseru': 'LS', 'Africa/Windhoek': 'NA', 'Africa/Mbabane': 'SZ',
  'Africa/Harare': 'ZW', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Accra': 'GH',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Helsinki': 'FI',
  'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH',
  'Asia/Bangkok': 'TH', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
};

/**
 * Best guess at the currency someone keeps their money in, from the device.
 * Time zone first, then the region in the browser language. Never throws.
 */
export function guessCurrency(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const zoneCountry = ZONE_COUNTRY[zone];
    if (zoneCountry) return COUNTRY_CURRENCY[zoneCountry] ?? 'USD';
    if (zone.startsWith('Australia/')) return 'AUD';
    const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
    for (const lang of langs) {
      const region = (lang || '').split('-')[1]?.toUpperCase();
      if (region && COUNTRY_CURRENCY[region]) return COUNTRY_CURRENCY[region];
    }
  } catch {}
  return 'USD';
}
