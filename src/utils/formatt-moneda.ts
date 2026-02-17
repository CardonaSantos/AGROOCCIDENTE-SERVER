import * as currency from 'currency.js';

export function formatCurrencyGT(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') {
    return 'Q 0.00';
  }

  const numericValue = Number(value);

  return currency(numericValue, {
    symbol: 'Q ',
    separator: ',',
    decimal: '.',
    precision: 2,
  }).format();
}
