import { describe, expect, it } from 'vitest';

import {
  buildQuoteItem,
  calculateItemValues,
  getQuoteTotals,
  normalizeItem,
  parseNumber,
  parseQuantity
} from '../js/domain/calculations.js';
import { formatMoney, formatPercent, formatUnitMoney } from '../js/domain/formatters.js';
import {
  formatQuantityWithUom,
  getQuotePdfFilename,
  normalizeUom
} from '../js/domain/quote-output.js';
import { legacyCalculationFixtures } from './fixtures/legacy-calculations.js';

describe('legacy calculation fixtures', () => {
  it.each(legacyCalculationFixtures)('matches production for $name', ({ input, expected }) => {
    expect(calculateItemValues(input)).toEqual(expected);
  });

  it('keeps GTM percentage as markup with landed cost as the denominator', () => {
    const result = calculateItemValues({
      quantity: 1,
      unitCost: 60,
      price: 100,
      freight: 0,
      freightMode: 'perItem'
    });

    expect(result.gtmEachPercent).toBeCloseTo(66.6666666667);
    expect(result.gtmEachPercent).not.toBe(40);
    expect(formatPercent(result.gtmEachPercent)).toBe('66.67%');
  });

  it('retains fractional per-unit freight without rounding intermediate values', () => {
    const result = calculateItemValues({
      quantity: 3,
      unitCost: 1,
      price: 2,
      freight: 1,
      freightMode: 'total'
    });

    expect(result.freightPerUnit).toBe(1 / 3);
    expect(result.landedUnitCost).toBe(4 / 3);
    expect(result.totalCost).toBe(4);
    expect(result.orderTotal).toBe(6);
    expect(result.gtmTotalDollars).toBe(2);
    expect(formatMoney(result.landedUnitCost)).toBe('$1.33');
  });

  it('uses zero markup in the preview calculation when landed cost is zero', () => {
    const result = calculateItemValues({
      quantity: 1,
      unitCost: 0,
      price: 5,
      freight: 0,
      freightMode: 'perItem'
    });

    expect(result.landedUnitCost).toBe(0);
    expect(result.gtmEachDollars).toBe(5);
    expect(result.gtmTotalPercent).toBe(0);
  });
});

describe('quote item validation', () => {
  const validInput = {
    name: 'Synthetic carton',
    quantity: '3',
    unitCost: '10',
    price: '20',
    freight: '6',
    freightMode: 'total'
  };

  it('creates the legacy persisted item shape', () => {
    const result = buildQuoteItem(validInput, 'fixture-id');

    expect(result).toEqual({
      item: {
        id: 'fixture-id',
        name: 'Synthetic carton',
        uom: 'EA',
        quantity: 3,
        unitCost: 10,
        price: 20,
        freight: 6,
        freightMode: 'total',
        freightPerUnit: 2,
        landedUnitCost: 12,
        totalCost: 36,
        orderTotal: 60,
        gtmEachDollars: 8,
        gtmTotalDollars: 24,
        gtmEachPercent: 66.66666666666666,
        gtmTotalPercent: 66.66666666666666
      }
    });
  });

  it('rejects decimal quantity instead of truncating it', () => {
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(buildQuoteItem({ ...validInput, quantity: '1.5' }, 'fixture-id')).toEqual({
      error: 'Qty must be a whole number greater than 0.'
    });
  });

  it('rejects zero landed cost while allowing a zero price', () => {
    expect(buildQuoteItem({
      ...validInput,
      unitCost: '0',
      price: '5',
      freight: '0'
    }, 'zero-cost')).toEqual({
      error: 'Landed cost must be greater than $0.00 to calculate GTM%.'
    });

    const zeroPrice = buildQuoteItem({ ...validInput, price: '0' }, 'zero-price');
    expect(zeroPrice.item.orderTotal).toBe(0);
    expect(zeroPrice.item.gtmTotalPercent).toBeCloseTo(-100);
  });

  it('allows negative profitability but rejects negative inputs', () => {
    const negativeMargin = buildQuoteItem({
      ...validInput,
      quantity: '2',
      unitCost: '10',
      price: '8',
      freight: ''
    }, 'negative-margin');

    expect(negativeMargin.item.gtmTotalDollars).toBe(-4);
    expect(negativeMargin.item.gtmTotalPercent).toBe(-20);
    expect(buildQuoteItem({ ...validInput, unitCost: '-1' }, 'bad-cost').error)
      .toBe('Unit cost must be a valid USD amount.');
    expect(buildQuoteItem({ ...validInput, price: '-1' }, 'bad-price').error)
      .toBe('Price must be a valid USD amount.');
    expect(buildQuoteItem({ ...validInput, freight: '-1' }, 'bad-freight').error)
      .toBe('Freight must be blank or a valid USD amount.');
  });

  it('keeps the legacy blank-money parsing rule', () => {
    expect(parseNumber('')).toBe(0);
    expect(parseNumber('   ')).toBe(0);
    expect(parseNumber('7.25')).toBe(7.25);
  });
});

describe('saved item normalization and totals', () => {
  it('fills every missing derived field in a saved v1 item', () => {
    const savedItem = {
      id: 'saved-item',
      name: 'Saved synthetic carton',
      quantity: 3,
      unitCost: 10,
      price: 20,
      freight: 6,
      freightMode: 'total'
    };

    expect(normalizeItem(savedItem)).toEqual({
      ...savedItem,
      uom: 'EA',
      freightPerUnit: 2,
      landedUnitCost: 12,
      totalCost: 36,
      orderTotal: 60,
      gtmEachDollars: 8,
      gtmTotalDollars: 24,
      gtmEachPercent: 66.66666666666666,
      gtmTotalPercent: 66.66666666666666
    });
  });

  it('preserves finite derived values already stored by v0.1.0', () => {
    const persisted = {
      id: 'legacy-item',
      name: 'Legacy item',
      quantity: 1,
      unitCost: 10,
      price: 20,
      freight: 0,
      freightMode: 'perItem',
      freightPerUnit: 7,
      landedUnitCost: 17,
      totalCost: 17,
      orderTotal: 20,
      gtmEachDollars: 3,
      gtmTotalDollars: 3,
      gtmEachPercent: 17.647,
      gtmTotalPercent: 17.647
    };

    expect(normalizeItem(persisted)).toEqual({ ...persisted, uom: 'EA' });
  });

  it('sums unrounded values across positive and negative lines', () => {
    const fractional = buildQuoteItem({
      name: 'Fractional freight',
      quantity: '3',
      unitCost: '1',
      price: '2',
      freight: '1',
      freightMode: 'total'
    }, 'fractional').item;
    const negative = buildQuoteItem({
      name: 'Negative line',
      quantity: '2',
      unitCost: '10',
      price: '8',
      freight: '',
      freightMode: 'perItem'
    }, 'negative').item;

    expect(getQuoteTotals([fractional, negative])).toEqual({
      orderTotal: 22,
      totalCost: 24,
      totalGtm: -2
    });
  });
});

describe('legacy display formatting', () => {
  it('rounds currency and percent only for display', () => {
    expect(formatMoney(12)).toBe('$12.00');
    expect(formatMoney(1 / 3)).toBe('$0.33');
    expect(formatMoney(0.1 + 0.2)).toBe('$0.30');
    expect(formatMoney(-2)).toBe('-$2.00');
    expect(formatPercent(200 / 3)).toBe('66.67%');
    expect(formatPercent(-20)).toBe('-20.00%');
  });

  it('locks the current Intl negative-zero representation', () => {
    expect(formatMoney(-0)).toBe('-$0.00');
    expect(formatPercent(-0)).toBe('-0.00%');
  });

  it('formats per-unit cost and price with up to five decimals, without padding zeroes', () => {
    expect(formatUnitMoney(46.27)).toBe('$46.27');
    expect(formatUnitMoney(1.2)).toBe('$1.2');
    expect(formatUnitMoney(1.23456)).toBe('$1.23456');
    expect(formatUnitMoney(1.234567)).toBe('$1.23457');
  });
});

describe('quote output helpers', () => {
  it('defaults legacy items to EA and normalizes provided UOM values', () => {
    expect(normalizeUom()).toBe('EA');
    expect(normalizeUom(' rl ')).toBe('RL');
    expect(formatQuantityWithUom(40, 'rl')).toBe('40 RL');
  });

  it('stores normalized UOM on newly created items', () => {
    const result = buildQuoteItem({
      name: 'Single face roll',
      uom: ' rl ',
      quantity: '40',
      unitCost: '1.23456',
      price: '46.27',
      freight: '',
      freightMode: 'perItem'
    }, 'uom-item');

    expect(result.item.uom).toBe('RL');
    expect(result.item.unitCost).toBe(1.23456);
  });

  it('creates stable, download-safe quote PDF filenames', () => {
    expect(getQuotePdfFilename({
      customerName: 'Vintage Design, Inc.',
      date: '2026-05-29'
    })).toBe('2026-05-29-vintage-design-inc-quotation.pdf');
    expect(getQuotePdfFilename({ customerName: '', date: 'not-a-date' }))
      .toBe('undated-customer-quotation.pdf');
  });
});
