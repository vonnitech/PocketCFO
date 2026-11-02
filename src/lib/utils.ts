import { currencyDef, getActiveCurrency } from './currency';

// Whole amounts in the user's currency and locale ("R 300 000"), for figures
// where cents add nothing: incomes, targets, projections.
export const formatWhole = (val: number): string => {
  const def = currencyDef(getActiveCurrency());
  try {
    return new Intl.NumberFormat(def.locale, { style: 'currency', currency: def.code, maximumFractionDigits: 0 }).format(val);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  }
};

export const formatCurrency = (val: number, privacyMode: boolean = false) => {
  if (privacyMode) return '••••';
  const def = currencyDef(getActiveCurrency());
  try {
    return new Intl.NumberFormat(def.locale, { style: 'currency', currency: def.code }).format(val);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }
};
