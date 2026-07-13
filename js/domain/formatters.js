const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatMoney(value) {
  return moneyFormatter.format(value);
}

export function formatPercent(value) {
  return `${percentFormatter.format(value)}%`;
}
