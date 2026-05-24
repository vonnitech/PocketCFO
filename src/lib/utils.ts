export const formatCurrency = (val: number, privacyMode: boolean = false) => {
  if (privacyMode) return '••••';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};
