import { describe, expect, it } from 'vitest';

import {
  CATALOG_STORAGE_KEY,
  CATALOG_USAGE_STORAGE_KEY,
  MAX_CATALOG_STORAGE_CHARACTERS,
  MANUAL_ITEMS_STORAGE_KEY,
  PREVIOUS_CATALOG_STORAGE_KEY,
  loadCatalogState,
  recordCatalogUse,
  removeManualItem,
  replaceCatalog,
  restorePreviousCatalog,
  upsertManualItem
} from '../js/services/local-catalog-storage.js';

function memoryStorage(initial = {}, setFailure) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (setFailure?.(key, value)) throw new Error('quota');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
    values
  };
}

const catalogItem = (overrides = {}) => ({
  id: 'catalog:A-1',
  schemaVersion: 1,
  source: 'catalog',
  sku: 'A-1',
  name: 'RSC Carton',
  active: true,
  ...overrides
});

describe('local catalog storage', () => {
  it('keeps catalog data separate from the established active quote key', () => {
    const storage = memoryStorage({ gtm_quote_calculator_v1: '{"items":[]}' });
    expect(replaceCatalog(storage, [catalogItem()], { sourceFilename: 'catalog.csv' })).toMatchObject({ status: 'saved', itemCount: 1 });
    expect(storage.values.get('gtm_quote_calculator_v1')).toBe('{"items":[]}');

    expect(loadCatalogState(storage)).toMatchObject({
      status: 'loaded',
      catalogItems: [expect.objectContaining({ sku: 'A-1', normalizedName: 'rsc carton' })],
      catalogMetadata: { sourceFilename: 'catalog.csv', importedAt: expect.any(String) }
    });
  });

  it('retains one prior catalog and restores it', () => {
    const storage = memoryStorage();
    replaceCatalog(storage, [catalogItem({ name: 'First' })]);
    replaceCatalog(storage, [catalogItem({ name: 'Second' })]);
    expect(storage.values.has(PREVIOUS_CATALOG_STORAGE_KEY)).toBe(true);
    expect(loadCatalogState(storage).catalogItems[0].name).toBe('Second');

    expect(restorePreviousCatalog(storage)).toEqual({ status: 'restored' });
    expect(loadCatalogState(storage).catalogItems[0].name).toBe('First');
    expect(storage.values.has(PREVIOUS_CATALOG_STORAGE_KEY)).toBe(false);
  });

  it('leaves the active catalog intact when replacement storage fails', () => {
    const initial = JSON.stringify({ schemaVersion: 1, items: [catalogItem({ name: 'Existing' })] });
    const storage = memoryStorage({ [CATALOG_STORAGE_KEY]: initial }, (key, value) => key === CATALOG_STORAGE_KEY && value !== initial);

    expect(replaceCatalog(storage, [catalogItem({ name: 'Replacement' })])).toEqual({ status: 'unavailable' });
    expect(storage.values.get(CATALOG_STORAGE_KEY)).toBe(initial);
    expect(storage.values.has(PREVIOUS_CATALOG_STORAGE_KEY)).toBe(false);
  });

  it('rejects an oversized catalog before changing stored data', () => {
    const storage = memoryStorage();
    const result = replaceCatalog(storage, [catalogItem({ padding: 'x'.repeat(MAX_CATALOG_STORAGE_CHARACTERS + 1) })]);

    expect(result.status).toBe('too-large');
    expect(storage.values.has(CATALOG_STORAGE_KEY)).toBe(false);
  });

  it('quarantines corrupt catalog, manual-item, and usage records', () => {
    const storage = memoryStorage({
      [CATALOG_STORAGE_KEY]: '{bad',
      [MANUAL_ITEMS_STORAGE_KEY]: '{bad',
      [CATALOG_USAGE_STORAGE_KEY]: '{bad'
    });

    const result = loadCatalogState(storage, 123);
    expect(result.status).toBe('recovered');
    expect(result.recoveryKeys).toEqual([
      `${CATALOG_STORAGE_KEY}_recovery_123`,
      `${MANUAL_ITEMS_STORAGE_KEY}_recovery_123`,
      `${CATALOG_USAGE_STORAGE_KEY}_recovery_123`
    ]);
    expect(result.catalogItems).toEqual([]);
  });

  it('creates and updates a same-name/UOM manual item instead of duplicating it', () => {
    const storage = memoryStorage();
    expect(upsertManualItem(storage, {
      name: 'Custom Carton',
      unitOfMeasure: 'EA',
      defaultUnitCost: 1,
      defaultUnitPrice: 2
    }, '2026-07-15T10:00:00Z').status).toBe('created');

    expect(upsertManualItem(storage, {
      name: 'Custom Carton',
      unitOfMeasure: 'EA',
      defaultUnitCost: 1.5,
      defaultUnitPrice: 3
    }, '2026-07-15T11:00:00Z').status).toBe('updated');

    const loaded = loadCatalogState(storage);
    expect(loaded.manualItems).toHaveLength(1);
    expect(loaded.manualItems[0]).toMatchObject({ defaultUnitCost: 1.5, defaultUnitPrice: 3 });
    expect(removeManualItem(storage, loaded.manualItems[0].id)).toEqual({ status: 'saved' });
    expect(loadCatalogState(storage).manualItems).toEqual([]);
  });

  it('records recent use independently from catalog records', () => {
    const storage = memoryStorage();
    recordCatalogUse(storage, 'catalog:A-1', '2026-07-15T10:00:00Z');
    const result = recordCatalogUse(storage, 'catalog:A-1', '2026-07-15T11:00:00Z');
    expect(result).toMatchObject({
      status: 'saved',
      usageById: { 'catalog:A-1': { useCount: 2, lastUsedAt: '2026-07-15T11:00:00Z' } }
    });
  });
});
