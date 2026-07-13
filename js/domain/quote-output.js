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
