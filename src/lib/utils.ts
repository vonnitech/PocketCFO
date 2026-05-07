export const formatCurrency = (val: number, ghostMode: boolean = false) => {
  if (ghostMode) return '••••';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};
