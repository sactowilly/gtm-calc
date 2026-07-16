import { describe, expect, it } from 'vitest';

import { normalizeItem } from '../js/domain/calculations.js';
import { toCustomerQuoteDocument } from '../js/pdf/customer-quote-document.js';
import { customerQuoteFixtures, onePageQuote } from './fixtures/customer-quotes.js';

describe('customer quotation projection', () => {
  it('maps every approved reference field', () => {
    const documentData = toCustomerQuoteDocument({ ...onePageQuote, quoteNumber: '2026-001-R1' });

    expect(documentData.quoteNumber).toBe('2026-001-R1');

    expect(documentData.customer).toEqual({
      name: onePageQuote.customerName,
      addressLines: ['1250 Market Street, Suite 400', 'Sacramento, CA 95814'],
      attention: onePageQuote.buyerName,
      email: onePageQuote.buyerEmail,
      phone: onePageQuote.buyerPhone
    });
    expect(documentData.sales).toEqual({
      salesRep: 'Alex Morgan',
      date: '2026-07-14',
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      terms: 'NET30'
    });
    expect(documentData.items[0]).toEqual({
      minimum: '250',
      description: 'Single Wall Corrugated Carton 12 x 10 x 8',
      unit: 'EA',
      unitPrice: '$1.24',
      leadTime: '2 weeks'
    });
  });

  it.each(Object.entries(customerQuoteFixtures))('keeps fixture %s free of internal data', (_name, quote) => {
    const projected = toCustomerQuoteDocument(quote);
    const serialized = JSON.stringify(projected).toLowerCase();

    expect(serialized).not.toMatch(/unitcost|landed|freight|gtm|margin|internal|vendor|itemid|catalogsource/);
    expect(Object.keys(projected.items[0] || {})).toEqual([
      'minimum',
      'description',
      'unit',
      'unitPrice',
      'leadTime'
    ]);
  });

  it('keeps an optional quote number customer-safe without exposing internal fields', () => {
    const projected = toCustomerQuoteDocument({
      ...onePageQuote,
      quoteNumber: '2026-001',
      currentStatus: 'sent',
      contentHash: 'secret-hash'
    });
    expect(projected.quoteNumber).toBe('2026-001');
    expect(projected).not.toHaveProperty('currentStatus');
    expect(projected).not.toHaveProperty('contentHash');
  });

  it('does not project catalog source metadata from a saved quote snapshot', () => {
    const quote = {
      ...onePageQuote,
      items: onePageQuote.items.map((item) => ({
        ...item,
        catalogItemId: 'catalog:SECRET-1',
        catalogSource: 'catalog',
        sku: 'SECRET-1'
      }))
    };
    const serialized = JSON.stringify(toCustomerQuoteDocument(quote)).toLowerCase();

    expect(serialized).not.toMatch(/secret-1|catalogsource|catalogitemid/);
  });

  it('preserves blank optional rows and fields', () => {
    const projected = toCustomerQuoteDocument(customerQuoteFixtures.blankOptionalValues);

    expect(projected.sales.shipVia).toBe('');
    expect(projected.sales.fobPoint).toBe('');
    expect(projected.sales.terms).toBe('');
    expect(projected.items.every((item) => item.leadTime === '')).toBe(true);
    expect(projected.customerNotes).toBe('');
  });

  it('loads legacy items without lead time as blank', () => {
    const normalized = normalizeItem({
      id: 'legacy',
      name: 'Legacy item',
      quantity: 1,
      uom: 'EA',
      unitCost: 1,
      price: 2,
      freight: 0,
      freightMode: 'perItem'
    });

    expect(normalized.leadTime).toBe('');
  });

  it('contains all twelve required layout fixtures', () => {
    expect(Object.keys(customerQuoteFixtures)).toHaveLength(12);
  });
});
