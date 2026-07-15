import { describe, expect, it } from 'vitest';

import { searchCatalog } from '../js/catalog/catalog-search.js';

const items = [
  { id: 'exact', source: 'catalog', sku: 'BOX-12', name: 'Shipping Carton', description: 'RSC 12 x 10 x 8', active: true },
  { id: 'prefix', source: 'catalog', sku: 'BOX-120', name: 'BOX-12 Display', description: '', active: true },
  { id: 'name', source: 'manual', sku: 'M-1', name: 'Box 12', description: 'Manual box', active: true },
  { id: 'description', source: 'catalog', sku: 'C-9', name: 'Carton', description: 'Compatible with BOX-12 orders', active: true },
  { id: 'inactive', source: 'catalog', sku: 'BOX-12-OLD', name: 'Old carton', description: '', active: false }
];

describe('unified catalog search', () => {
  it('ranks exact SKU above prefix, name, and description matches', () => {
    const results = searchCatalog(items, 'BOX-12');
    expect(results.map((item) => item.id)).toEqual(['exact', 'prefix', 'name', 'description']);
    expect(results[0].searchScore).toBe(1000);
  });

  it('finds equivalent box-dimension queries', () => {
    expect(searchCatalog(items, '12 10 8').map((item) => item.id)).toEqual(['exact']);
    expect(searchCatalog(items, 'RSC 12x10x8').map((item) => item.id)).toEqual(['exact']);
  });

  it('uses recent/frequent usage only within a relevance band', () => {
    const usageById = {
      exact: { useCount: 1, lastUsedAt: '2026-07-01T00:00:00Z' },
      prefix: { useCount: 500, lastUsedAt: '2026-07-14T00:00:00Z' }
    };

    expect(searchCatalog(items, 'BOX-12', { usageById })[0].id).toBe('exact');
  });

  it('returns recently used active items for an empty query', () => {
    const results = searchCatalog(items, '', {
      usageById: {
        exact: { useCount: 2, lastUsedAt: '2026-07-01T00:00:00Z' },
        name: { useCount: 1, lastUsedAt: '2026-07-14T00:00:00Z' },
        inactive: { useCount: 10, lastUsedAt: '2026-07-15T00:00:00Z' }
      }
    });

    expect(results.map((item) => item.id)).toEqual(['name', 'exact']);
  });

  it('applies a stable alphabetical tie-breaker and result limit', () => {
    const tied = [
      { id: 'z', sku: 'Z-1', name: 'Tape Zebra', active: true },
      { id: 'a', sku: 'A-1', name: 'Tape Alpha', active: true }
    ];

    expect(searchCatalog(tied, 'tape', { limit: 1 }).map((item) => item.id)).toEqual(['a']);
  });
});
