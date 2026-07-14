import { formatUnitMoney } from '../domain/formatters.js';
import { normalizeUom } from '../domain/quote-output.js';

export const VISION_COMPANY = Object.freeze({
  address: '5851 ALDER AVE UNIT A, SACRAMENTO, CA 95828',
  website: 'www.visionpackaginginc.com',
  telephone: '916-374-9801',
  fax: '916-374-9802'
});

function text(value) {
  return String(value ?? '').trim();
}

function finitePrice(value) {
  return Number.isFinite(value) ? value : 0;
}

export function splitCustomerAddress(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Customer-facing allowlist. Internal cost, freight, GTM, IDs, and notes never
 * cross this boundary, so the PDF renderer cannot accidentally expose them.
 */
export function toCustomerQuoteDocument(quote) {
  const items = Array.isArray(quote?.items) ? quote.items : [];

  return {
    company: { ...VISION_COMPANY },
    customer: {
      name: text(quote?.customerName),
      addressLines: splitCustomerAddress(quote?.customerAddress),
      attention: text(quote?.buyerName),
      email: text(quote?.buyerEmail),
      phone: text(quote?.buyerPhone)
    },
    sales: {
      salesRep: text(quote?.salesRep),
      date: text(quote?.date),
      shipVia: text(quote?.shipVia),
      fobPoint: text(quote?.fobPoint),
      terms: text(quote?.terms)
    },
    items: items.map((item) => ({
      minimum: text(item.quantity),
      description: text(item.name),
      unit: normalizeUom(item.uom),
      unitPrice: formatUnitMoney(finitePrice(item.price)),
      leadTime: text(item.leadTime)
    })),
    customerNotes: text(quote?.customerNotes)
  };
}
