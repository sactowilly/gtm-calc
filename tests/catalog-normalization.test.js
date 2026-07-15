import { describe, expect, it } from 'vitest';

import {
  buildCatalogSearchFields,
  normalizeDimensions,
  normalizeSearchText,
  normalizeSku
} from '../js/catalog/catalog-normalization.js';

describe('catalog normalization', () => {
  it.each([
    '12x10x8',
    '12 x 10 x 8',
    '12 10 8',
    'RSC 12x10x8'
  ])('normalizes %s to the same dimension token', (value) => {
    expect(normalizeDimensions(value)).toBe('12x10x8');
  });

  it('supports common decimal and fractional dimension text', () => {
    expect(normalizeDimensions('Box 12.50 x 10 x 8.00')).toBe('12.5x10x8');
    expect(normalizeDimensions('Mailer 12 1/2 x 10 x 8')).toBe('12.5x10x8');
  });

  it('does not treat two-part or four-part values as valid box dimensions', () => {
    expect(normalizeDimensions('12x10')).toBe('');
    expect(normalizeDimensions('12x10x8x4')).toBe('');
    expect(normalizeDimensions('RSC 12 10 8 4')).toBe('');
  });

  it('normalizes search text and SKU without changing display fields', () => {
    expect(normalizeSearchText('  Café—Carton  ')).toBe('cafe carton');
    expect(normalizeSku(' ab 12-c ')).toBe('AB12-C');

    expect(buildCatalogSearchFields({
      sku: ' ab 12-c ',
      name: 'RSC 12 x 10 x 8',
      description: 'Kraft carton'
    })).toMatchObject({
      sku: 'ab 12-c',
      normalizedSku: 'AB12-C',
      name: 'RSC 12 x 10 x 8',
      normalizedName: 'rsc 12 x 10 x 8',
      normalizedDescription: 'kraft carton',
      normalizedDimensions: '12x10x8'
    });
  });
});
