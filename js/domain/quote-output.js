import { formatUnitMoney } from './formatters.js';

export const DEFAULT_UOM = 'EA';

export function normalizeUom(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_UOM;
}

export function formatQuantityWithUom(quantity, uom) {
  return `${quantity} ${normalizeUom(uom)}`;
}

export function getQuotePdfFilename({ customerName, date }) {
  const safeCustomer = String(customerName || 'customer')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'customer';
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
    ? date
    : 'undated';

  return `${safeDate}-${safeCustomer}-quotation.pdf`;
}

export function buildCustomerQuoteText(quote) {
  const lines = [
    `Quote for ${quote.customerName || 'Customer'}`,
    `Customer Address: ${String(quote.customerAddress || '').replace(/\r?\n/g, ', ') || 'Not set'}`,
    `Buyer: ${quote.buyerName || 'Not set'}`,
    `Buyer Email: ${quote.buyerEmail || 'Not set'}`,
    `Buyer Phone: ${quote.buyerPhone || 'Not set'}`,
    `Sales Rep: ${quote.salesRep || 'Not set'}`,
    `Date: ${quote.date || 'Not set'}`,
    ''
  ];
  const items = Array.isArray(quote.items) ? quote.items : [];

  if (items.length === 0) {
    lines.push('No items added.');
  } else {
    items.forEach(function (item) {
      lines.push(`${formatQuantityWithUom(item.quantity, item.uom)} - ${item.name} == ${formatUnitMoney(item.price)}`);
    });
  }

  return lines.join('\n');
}
