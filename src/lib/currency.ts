export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (C$)' },
];

export function getCurrencySymbol(code: string = 'USD'): string {
  const currency = CURRENCIES.find((c) => c.code === code.toUpperCase());
  return currency ? currency.symbol : '$';
}

export function formatCurrency(amount: number, code: string = 'USD'): string {
  const symbol = getCurrencySymbol(code);
  const rounded = Math.round(amount * 100) / 100;
  
  if (code.toUpperCase() === 'JPY') {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  
  return `${symbol}${rounded.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
