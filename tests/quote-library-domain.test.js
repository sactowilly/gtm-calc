import { describe, expect, it } from 'vitest';
import { buildQuoteItem } from '../js/domain/calculations.js';
import {
  buildDisplayNumber,
  canTransitionQuoteStatus,
  canonicalJson,
  formatBaseQuoteNumber,
  hashQuoteContent,
  getAllowedQuoteStatusTransitions,
  legacyQuoteToQuoteContent,
  quoteContentToLegacyQuote,
  validateQuoteContent
} from '../js/domain/quote-library.js';

function legacyQuote() {
  const { item } = buildQuoteItem({
    name: 'RSC 12 x 10 x 8',
    quantity: '25',
    uom: 'CS',
    unitCost: '1.12345',
    price: '2.34567',
    freight: '10',
    freightMode: 'total',
    leadTime: '2-3 weeks'
  }, 'line-1');
  item.catalogItemId = 'catalog-1';
  item.catalogSource = 'standard';
  item.sku = 'RSC-121008';
  return {
    customerName: 'North River Packaging',
    customerAddress: '1250 Market Street\nSacramento, CA 95814',
    buyerName: 'Jordan Rivera',
    buyerEmail: 'jordan@example.test',
    buyerPhone: '916-555-0137',
    salesRep: 'Alex Morgan',
    date: '2026-07-16',
    shipVia: 'Our Truck',
    fobPoint: 'Sacramento',
    terms: 'NET30',
    customerNotes: 'Call before delivery.',
    items: [item]
  };
}

describe('quote-library domain mapping', () => {
  it('round-trips the active quote shape without changing calculations or catalog snapshots', () => {
    const legacy = legacyQuote();
    const content = legacyQuoteToQuoteContent(legacy);
    const restored = quoteContentToLegacyQuote(content);

    expect(validateQuoteContent(content)).toEqual([]);
    expect(restored).toEqual(legacy);
    expect(restored.items[0]).toMatchObject({
      price: 2.34567,
      unitCost: 1.12345,
      freightMode: 'total',
      catalogItemId: 'catalog-1',
      catalogSource: 'standard',
      sku: 'RSC-121008'
    });
  });

  it('keeps approved defaults when older active quotes omit newer fields', () => {
    const content = legacyQuoteToQuoteContent({ customerName: 'Legacy', items: [] }, { fallbackDate: '2026-07-16' });
    expect(content).toMatchObject({
      quoteDate: '2026-07-16',
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      paymentTerms: 'NET30'
    });
  });

  it('rejects decimal quantities but accepts zero cost, zero price, and negative profitability snapshots', () => {
    const content = legacyQuoteToQuoteContent(legacyQuote());
    content.lines[0].quantity = 1.5;
    expect(validateQuoteContent(content)).toContain('Line 1 quantity must be a positive whole number.');

    content.lines[0].quantity = 25;
    content.lines[0].unitCost = 0;
    content.lines[0].price = 0;
    content.lines[0].gtmEachDollars = -1;
    content.lines[0].gtmTotalDollars = -25;
    expect(validateQuoteContent(content)).toEqual([]);
  });

  it('formats base and revision numbers deterministically', () => {
    expect(formatBaseQuoteNumber(2026, 1)).toBe('2026-001');
    expect(formatBaseQuoteNumber(2026, 1000)).toBe('2026-1000');
    expect(buildDisplayNumber('2026-001', 0)).toBe('2026-001');
    expect(buildDisplayNumber('2026-001', 2)).toBe('2026-001-R2');
  });

  it('allows only the approved controlled status transitions', () => {
    expect(getAllowedQuoteStatusTransitions('finalized')).toEqual(['sent', 'cancelled']);
    expect(getAllowedQuoteStatusTransitions('sent')).toEqual(['accepted', 'declined', 'expired', 'cancelled']);
    expect(getAllowedQuoteStatusTransitions('accepted')).toEqual([]);
    expect(canTransitionQuoteStatus('finalized', 'sent')).toBe(true);
    expect(canTransitionQuoteStatus('finalized', 'accepted')).toBe(false);
    expect(canTransitionQuoteStatus('declined', 'sent')).toBe(false);
  });

  it('uses canonical SHA-256 content hashes independent of object key order', async () => {
    const left = { customer: { companyName: 'Acme', addressText: '' }, lines: [], currency: 'USD' };
    const right = { currency: 'USD', lines: [], customer: { addressText: '', companyName: 'Acme' } };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(await hashQuoteContent(left)).toBe(await hashQuoteContent(right));
    expect(await hashQuoteContent(left)).toMatch(/^[a-f0-9]{64}$/);
  });
});
