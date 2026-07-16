import { buildCatalogSearchFields } from '../catalog/catalog-normalization.js';

export const CATALOG_STORAGE_KEY = 'gtm_catalog_v1';
export const PREVIOUS_CATALOG_STORAGE_KEY = 'gtm_catalog_v1_previous';
export const MANUAL_ITEMS_STORAGE_KEY = 'gtm_manual_items_v1';
export const CATALOG_USAGE_STORAGE_KEY = 'gtm_catalog_usage_v1';
export const MAX_CATALOG_STORAGE_CHARACTERS = 2_500_000;

const SCHEMA_VERSION = 1;

function isValidCatalogItem(item) {
  return Boolean(item && typeof item.id === 'string' && typeof item.sku === 'string' && typeof item.name === 'string');
}

function isValidManualItem(item) {
  return Boolean(item && typeof item.id === 'string' && typeof item.name === 'string');
}

function parseItemEnvelope(raw, validator) {
  const envelope = JSON.parse(raw);
  if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION || !Array.isArray(envelope.items)) {
    throw new Error('Invalid catalog storage envelope.');
  }
  if (!envelope.items.every(validator)) throw new Error('Invalid catalog item record.');
  return envelope;
}

function parseUsageEnvelope(raw) {
  const envelope = JSON.parse(raw);
  if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION || !envelope.usageById || Array.isArray(envelope.usageById)) {
    throw new Error('Invalid catalog usage envelope.');
  }
  return envelope;
}

function quarantine(storage, key, raw, now) {
  const recoveryKey = `${key}_recovery_${now}`;
  storage.setItem(recoveryKey, raw);
  storage.removeItem(key);
  return recoveryKey;
}

function loadEnvelope(storage, key, parser, now) {
  const raw = storage.getItem(key);
  if (!raw) return { status: 'empty' };

  try {
    return { status: 'loaded', envelope: parser(raw) };
  } catch (error) {
    try {
      return { status: 'recovered', recoveryKey: quarantine(storage, key, raw, now) };
    } catch (storageError) {
      return { status: 'corrupt-unrecoverable' };
    }
  }
}

function createItemEnvelope(items, metadata = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: metadata.updatedAt || new Date().toISOString(),
    ...metadata,
    items
  };
}

function writeEnvelope(storage, key, envelope) {
  try {
    storage.setItem(key, JSON.stringify(envelope));
    return { status: 'saved' };
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function loadCatalogState(storage, now = Date.now()) {
  try {
    const catalog = loadEnvelope(storage, CATALOG_STORAGE_KEY, (raw) => parseItemEnvelope(raw, isValidCatalogItem), now);
    const manual = loadEnvelope(storage, MANUAL_ITEMS_STORAGE_KEY, (raw) => parseItemEnvelope(raw, isValidManualItem), now);
    const usage = loadEnvelope(storage, CATALOG_USAGE_STORAGE_KEY, parseUsageEnvelope, now);
    const recovered = [catalog, manual, usage].filter((result) => result.status === 'recovered');
    const unrecoverable = [catalog, manual, usage].some((result) => result.status === 'corrupt-unrecoverable');

    return {
      status: unrecoverable ? 'corrupt-unrecoverable' : (recovered.length > 0 ? 'recovered' : 'loaded'),
      catalogItems: (catalog.envelope?.items || []).map(buildCatalogSearchFields),
      manualItems: (manual.envelope?.items || []).map(buildCatalogSearchFields),
      usageById: usage.envelope?.usageById || {},
      catalogMetadata: catalog.envelope ? {
        importedAt: catalog.envelope.importedAt || '',
        sourceFilename: catalog.envelope.sourceFilename || ''
      } : null,
      hasPreviousCatalog: Boolean(storage.getItem(PREVIOUS_CATALOG_STORAGE_KEY)),
      recoveryKeys: recovered.map((result) => result.recoveryKey)
    };
  } catch (error) {
    return {
      status: 'unavailable',
      catalogItems: [],
      manualItems: [],
      usageById: {},
      catalogMetadata: null,
      hasPreviousCatalog: false,
      recoveryKeys: []
    };
  }
}

export function replaceCatalog(storage, items, metadata = {}) {
  if (!Array.isArray(items) || !items.every(isValidCatalogItem)) return { status: 'invalid' };

  const envelope = createItemEnvelope(items.map(buildCatalogSearchFields), {
    importedAt: metadata.importedAt || new Date().toISOString(),
    sourceFilename: String(metadata.sourceFilename || '')
  });
  const serialized = JSON.stringify(envelope);
  if (serialized.length > MAX_CATALOG_STORAGE_CHARACTERS) {
    return { status: 'too-large', characters: serialized.length };
  }

  let currentRaw = null;
  let wroteBackup = false;
  try {
    currentRaw = storage.getItem(CATALOG_STORAGE_KEY);
    if (currentRaw) {
      storage.setItem(PREVIOUS_CATALOG_STORAGE_KEY, currentRaw);
      wroteBackup = true;
    }
    storage.setItem(CATALOG_STORAGE_KEY, serialized);
    return { status: 'saved', itemCount: items.length, hasPreviousCatalog: wroteBackup };
  } catch (error) {
    if (wroteBackup) {
      try {
        storage.removeItem(PREVIOUS_CATALOG_STORAGE_KEY);
      } catch (cleanupError) {
        // The active catalog remains untouched even if backup cleanup is blocked.
      }
    }
    return { status: 'unavailable' };
  }
}

export function restorePreviousCatalog(storage) {
  try {
    const previousRaw = storage.getItem(PREVIOUS_CATALOG_STORAGE_KEY);
    if (!previousRaw) return { status: 'empty' };
    parseItemEnvelope(previousRaw, isValidCatalogItem);
    storage.setItem(CATALOG_STORAGE_KEY, previousRaw);
    storage.removeItem(PREVIOUS_CATALOG_STORAGE_KEY);
    return { status: 'restored' };
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function upsertManualItem(storage, item, now = new Date().toISOString()) {
  if (!item || !String(item.name || '').trim()) return { status: 'invalid' };

  try {
    const loaded = loadEnvelope(storage, MANUAL_ITEMS_STORAGE_KEY, (raw) => parseItemEnvelope(raw, isValidManualItem), Date.now());
    if (loaded.status === 'corrupt-unrecoverable') return { status: 'unavailable' };
    const existingItems = loaded.envelope?.items || [];
    const candidate = buildCatalogSearchFields({
      ...item,
      id: String(item.id || `manual:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`),
      schemaVersion: SCHEMA_VERSION,
      source: 'manual',
      active: item.active !== false,
      unitOfMeasure: String(item.unitOfMeasure || '').trim().toUpperCase(),
      createdAt: item.createdAt || now,
      updatedAt: now
    });
    const matchIndex = existingItems.findIndex((existing) => (
      existing.id === candidate.id ||
      (candidate.normalizedSku && existing.normalizedSku === candidate.normalizedSku) ||
      (!candidate.normalizedSku && existing.normalizedName === candidate.normalizedName && existing.unitOfMeasure === candidate.unitOfMeasure)
    ));
    const nextItems = [...existingItems];
    let outcome = 'created';

    if (matchIndex >= 0) {
      const existing = existingItems[matchIndex];
      nextItems[matchIndex] = {
        ...candidate,
        id: existing.id,
        createdAt: existing.createdAt || candidate.createdAt
      };
      outcome = 'updated';
    } else {
      nextItems.push(candidate);
    }

    const result = writeEnvelope(storage, MANUAL_ITEMS_STORAGE_KEY, createItemEnvelope(nextItems, { updatedAt: now }));
    return result.status === 'saved'
      ? { status: outcome, item: matchIndex >= 0 ? nextItems[matchIndex] : candidate }
      : result;
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function removeManualItem(storage, itemId, now = new Date().toISOString()) {
  try {
    const loaded = loadEnvelope(storage, MANUAL_ITEMS_STORAGE_KEY, (raw) => parseItemEnvelope(raw, isValidManualItem), Date.now());
    if (loaded.status !== 'loaded') return { status: loaded.status === 'empty' ? 'not-found' : 'unavailable' };
    const nextItems = loaded.envelope.items.filter((item) => item.id !== itemId);
    if (nextItems.length === loaded.envelope.items.length) return { status: 'not-found' };
    return writeEnvelope(storage, MANUAL_ITEMS_STORAGE_KEY, createItemEnvelope(nextItems, { updatedAt: now }));
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function recordCatalogUse(storage, itemId, now = new Date().toISOString()) {
  if (!itemId) return { status: 'invalid' };

  try {
    const loaded = loadEnvelope(storage, CATALOG_USAGE_STORAGE_KEY, parseUsageEnvelope, Date.now());
    if (loaded.status === 'corrupt-unrecoverable') return { status: 'unavailable' };
    const usageById = { ...(loaded.envelope?.usageById || {}) };
    const current = usageById[itemId] || {};
    usageById[itemId] = {
      useCount: (Number.isFinite(current.useCount) ? current.useCount : 0) + 1,
      lastUsedAt: now
    };
    const result = writeEnvelope(storage, CATALOG_USAGE_STORAGE_KEY, {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: now,
      usageById
    });
    return result.status === 'saved' ? { status: 'saved', usageById } : result;
  } catch (error) {
    return { status: 'unavailable' };
  }
}
