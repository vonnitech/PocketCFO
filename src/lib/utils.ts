import { currencyDef, getActiveCurrency } from './currency';

export const formatCurrency = (val: number, privacyMode: boolean = false) => {
  if (privacyMode) return '••••';
  const def = currencyDef(getActiveCurrency());
  try {
    return new Intl.NumberFormat(def.locale, { style: 'currency', currency: def.code }).format(val);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }
};
