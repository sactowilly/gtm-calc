import {
  canonicalJson,
  cloneQuoteData,
  hashQuoteContent,
  legacyQuoteToQuoteContent,
  QUOTE_RECORD_SCHEMA_VERSION,
  validateQuoteContent,
  validateQuoteRecord,
  validateQuoteVersion
} from './quote-library.js';
import {
  ACTIVE_QUOTE_STORAGE_KEY,
  CATALOG_USAGE_STORAGE_KEY,
  MANUAL_ITEMS_STORAGE_KEY,
  QUOTE_LIBRARY_DATABASE_NAME,
  QUOTE_LIBRARY_DATABASE_VERSION,
  compareStorageKeys,
  isBackupLocalStorageKey,
  QUOTE_LIBRARY_STORES
} from './storage-contract.js';

export const BACKUP_FORMAT = 'gtm-calc-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_CHECKSUM_ALGORITHM = 'SHA-256';

const STORE_NAMES = Object.freeze(Object.values(QUOTE_LIBRARY_STORES));
const ID_STORES = Object.freeze(STORE_NAMES.filter((storeName) => storeName !== QUOTE_LIBRARY_STORES.migrationLog));
const QUOTE_EVENT_TYPES = Object.freeze(new Set([
  'created', 'duplicated', 'revision_started', 'finalized', 'status_changed',
  'pdf_generated', 'downloaded', 'share_started', 'share_completed', 'share_cancelled', 'email_opened'
]));

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const OMIT_JSON_PROPERTY = Symbol('omit-json-property');

function toJsonSafeValue(value, path = 'payload', seen = new Set(), inArray = false) {
  if (value === undefined) {
    if (inArray) throw new Error(`${path} contains undefined in an array.`);
    return OMIT_JSON_PROPERTY;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error(`${path} contains a non-JSON-safe number.`);
    return value;
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`${path} contains unsupported ${typeof value} data.`);
  }
  if (seen.has(value)) throw new Error(`${path} contains a circular reference.`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => toJsonSafeValue(entry, `${path}[${index}]`, seen, true));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains unsupported ${value?.constructor?.name || 'structured-clone'} data.`);
    }
    return Object.keys(value).sort(compareStorageKeys).reduce((result, key) => {
      const normalized = toJsonSafeValue(value[key], `${path}.${key}`, seen, false);
      if (normalized !== OMIT_JSON_PROPERTY) result[key] = normalized;
      return result;
    }, Object.create(null));
  } finally {
    seen.delete(value);
  }
}

function isIsoDateTime(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function isStrictUtcDateTime(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function recordKey(storeName, record) {
  return storeName === QUOTE_LIBRARY_STORES.migrationLog ? record?.version : record?.id;
}

function sortRecords(storeName, records) {
  return [...records].sort((left, right) => {
    const leftKey = recordKey(storeName, left);
    const rightKey = recordKey(storeName, right);
    return compareStorageKeys(leftKey ?? '', rightKey ?? '');
  }).map((record, index) => toJsonSafeValue(record, `payload.quoteDatabase.stores.${storeName}[${index}]`));
}

async function sha256Hex(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new Error('SHA-256 is unavailable in this browser.');
  const bytes = new TextEncoder().encode(value);
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizePayload({ quoteDatabase, localStorageEntries }) {
  STORE_NAMES.forEach((storeName) => {
    if (!Array.isArray(quoteDatabase.stores[storeName])) {
      throw new Error(`A complete ${storeName} store snapshot is required.`);
    }
  });
  const stores = Object.fromEntries(STORE_NAMES.map((storeName) => [
    storeName,
    sortRecords(storeName, quoteDatabase.stores[storeName])
  ]));
  const entries = [...localStorageEntries]
    .map(({ key, value }) => ({ key: String(key), value: String(value) }))
    .sort((left, right) => compareStorageKeys(left.key, right.key));
  return {
    quoteDatabase: {
      databaseName: String(quoteDatabase.databaseName),
      databaseVersion: quoteDatabase.databaseVersion,
      recordSchemaVersion: quoteDatabase.recordSchemaVersion,
      stores
    },
    localStorage: { entries }
  };
}

function addDuplicateErrors(records, storeName, errors) {
  const seen = new Set();
  records.forEach((record, index) => {
    const key = recordKey(storeName, record);
    if (key === undefined || key === null || key === '') {
      errors.push(`${storeName}[${index}] is missing its primary key.`);
    } else if (seen.has(String(key))) {
      errors.push(`${storeName} contains duplicate primary key ${key}.`);
    }
    seen.add(String(key));
  });
}

function validateKnownLocalStorageEntry(entry, errors) {
  if (!isObject(entry) || typeof entry.key !== 'string' || typeof entry.value !== 'string') {
    errors.push('Every localStorage entry must contain text key and value fields.');
    return;
  }
  if (!isBackupLocalStorageKey(entry.key)) {
    errors.push(`Unsupported localStorage key: ${entry.key}.`);
    return;
  }
  if (entry.key.includes('_recovery_')) return;

  let parsed;
  try {
    parsed = JSON.parse(entry.value);
  } catch (error) {
    errors.push(`${entry.key} does not contain valid JSON.`);
    return;
  }
  if (entry.key === ACTIVE_QUOTE_STORAGE_KEY) {
    if (!isObject(parsed) || !Array.isArray(parsed.items)) {
      errors.push(`${entry.key} is not a supported active quote.`);
      return;
    }
    const contentErrors = validateQuoteContent(legacyQuoteToQuoteContent(parsed));
    if (contentErrors.length) errors.push(`${entry.key} is invalid: ${contentErrors.join(' ')}`);
    return;
  }
  if (entry.key === CATALOG_USAGE_STORAGE_KEY) {
    if (!isObject(parsed) || parsed.schemaVersion !== 1 || !isObject(parsed.usageById)) {
      errors.push(`${entry.key} is not a supported catalog-usage envelope.`);
      return;
    }
    Object.entries(parsed.usageById).forEach(([itemId, usage]) => {
      if (!itemId || !isObject(usage) || !Number.isInteger(usage.useCount) || usage.useCount < 0 || (usage.lastUsedAt != null && !isIsoDateTime(usage.lastUsedAt))) {
        errors.push(`${entry.key} contains invalid usage for ${itemId || '(blank item ID)'}.`);
      }
    });
    return;
  }
  if (!isObject(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.items)) {
    errors.push(`${entry.key} is not a supported catalog-item envelope.`);
    return;
  }
  const isManual = entry.key === MANUAL_ITEMS_STORAGE_KEY;
  parsed.items.forEach((item, index) => {
    const valid = isObject(item)
      && typeof item.id === 'string'
      && item.id.trim() !== ''
      && typeof item.name === 'string'
      && item.name.trim() !== ''
      && (isManual || (typeof item.sku === 'string' && item.sku.trim() !== ''));
    if (!valid) errors.push(`${entry.key} item ${index + 1} is invalid.`);
  });
}

function validateReferences(stores, errors) {
  const quotes = stores.quotes.filter(isObject);
  const versions = stores.quoteVersions.filter(isObject);
  const events = stores.quoteEvents.filter(isObject);
  const contacts = stores.contacts.filter(isObject);
  const quotesById = new Map(quotes.map((record) => [record.id, record]));
  const versionsById = new Map(versions.map((record) => [record.id, record]));
  const customersById = new Map(stores.customers.filter(isObject).map((record) => [record.id, record]));
  const contactsById = new Map(contacts.map((record) => [record.id, record]));
  const displayNumbers = new Set();
  const baseNumbers = new Set();

  quotes.forEach((quote) => {
    if (quote.baseNumber) {
      if (baseNumbers.has(quote.baseNumber)) errors.push(`Duplicate base quote number ${quote.baseNumber}.`);
      baseNumbers.add(quote.baseNumber);
    }
    if (quote.customerId && !customersById.has(quote.customerId)) errors.push(`Quote ${quote.id} references a missing customer.`);
    if (quote.contactId) {
      const contact = contactsById.get(quote.contactId);
      if (!contact) errors.push(`Quote ${quote.id} references a missing contact.`);
      else if (quote.customerId && contact.customerId !== quote.customerId) errors.push(`Quote ${quote.id} contact belongs to a different customer.`);
    }
    if (quote.sourceQuoteId && !quotesById.has(quote.sourceQuoteId)) errors.push(`Quote ${quote.id} references a missing source quote.`);
    if (quote.sourceQuoteVersionId) {
      const sourceVersion = versionsById.get(quote.sourceQuoteVersionId);
      if (!quote.sourceQuoteId) errors.push(`Quote ${quote.id} has a source version without a source quote.`);
      else if (!sourceVersion) errors.push(`Quote ${quote.id} references a missing source version.`);
      else if (sourceVersion.quoteId !== quote.sourceQuoteId) errors.push(`Quote ${quote.id} source version belongs to a different source quote.`);
    }
    const versionIds = Array.isArray(quote.versionIds) ? quote.versionIds : [];
    if (new Set(versionIds).size !== versionIds.length) errors.push(`Quote ${quote.id} contains duplicate version IDs.`);
    versionIds.forEach((versionId) => {
      const version = versionsById.get(versionId);
      if (!version) errors.push(`Quote ${quote.id} references missing version ${versionId}.`);
      else if (version.quoteId !== quote.id) errors.push(`Version ${versionId} belongs to a different quote.`);
    });
    if (quote.latestVersionId) {
      const latestVersion = versionsById.get(quote.latestVersionId);
      if (!latestVersion) errors.push(`Quote ${quote.id} references a missing latest version.`);
      else {
        if (latestVersion.quoteId !== quote.id || !versionIds.includes(latestVersion.id)) errors.push(`Quote ${quote.id} latest version belongs to a different quote or is not linked.`);
        const revisions = versions.filter((version) => version.quoteId === quote.id).map((version) => version.revisionNumber);
        if (revisions.length && latestVersion.revisionNumber !== Math.max(...revisions)) errors.push(`Quote ${quote.id} latest version is not its highest revision.`);
      }
    }
    if (quote.workingDraft?.basedOnVersionId) {
      const basedOn = versionsById.get(quote.workingDraft.basedOnVersionId);
      if (!basedOn || basedOn.quoteId !== quote.id) errors.push(`Quote ${quote.id} revision draft is based on a missing or foreign version.`);
    }
  });

  versions.forEach((version) => {
    const quote = quotesById.get(version.quoteId);
    if (!quote) errors.push(`Version ${version.id} references a missing quote.`);
    else {
      if (!Array.isArray(quote.versionIds) || !quote.versionIds.includes(version.id)) errors.push(`Version ${version.id} is not linked from its quote.`);
      if (version.baseNumber !== quote.baseNumber) errors.push(`Version ${version.id} base number does not match its quote.`);
    }
    if (version.basedOnVersionId) {
      const basedOn = versionsById.get(version.basedOnVersionId);
      if (!basedOn || basedOn.quoteId !== version.quoteId || basedOn.revisionNumber >= version.revisionNumber) {
        errors.push(`Version ${version.id} is based on a missing, foreign, or newer version.`);
      }
    }
    if (displayNumbers.has(version.displayNumber)) errors.push(`Duplicate display number ${version.displayNumber}.`);
    displayNumbers.add(version.displayNumber);
  });
  events.forEach((event) => {
    if (!quotesById.has(event.quoteId)) errors.push(`Event ${event.id} references a missing quote.`);
    if (event.quoteVersionId) {
      const version = versionsById.get(event.quoteVersionId);
      if (!version) errors.push(`Event ${event.id} references a missing quote version.`);
      else if (version.quoteId !== event.quoteId) errors.push(`Event ${event.id} references a version owned by a different quote.`);
    }
  });
  contacts.forEach((contact) => {
    if (!customersById.has(contact.customerId)) errors.push(`Contact ${contact.id} references a missing customer.`);
  });
}

function validateSupportingRecords(stores, errors) {
  stores.quoteEvents.forEach((record) => {
    if (!isObject(record) || typeof record.id !== 'string' || typeof record.quoteId !== 'string') {
      errors.push('Every quote event requires text event and quote IDs.');
    }
    if (record?.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION) errors.push(`Event ${record?.id || '(unknown)'} has an unsupported schema version.`);
    if (!isIsoDateTime(record?.occurredAt) || !QUOTE_EVENT_TYPES.has(record?.type)) errors.push(`Event ${record?.id || '(unknown)'} has an invalid type or timestamp.`);
    if (record?.quoteVersionId != null && typeof record.quoteVersionId !== 'string') errors.push(`Event ${record?.id || '(unknown)'} has an invalid quote-version ID.`);
    if (record?.metadata != null && !isObject(record.metadata)) errors.push(`Event ${record?.id || '(unknown)'} has invalid metadata.`);
  });
  stores.customers.forEach((record) => {
    if (!isObject(record) || record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION || typeof record.id !== 'string' || !record.id.trim() || typeof record.companyName !== 'string' || !record.companyName.trim() || typeof record.normalizedName !== 'string' || !record.normalizedName.trim() || typeof record.addressText !== 'string' || typeof record.defaultPaymentTerms !== 'string' || !isIsoDateTime(record.createdAt) || !isIsoDateTime(record.updatedAt)) {
      errors.push(`Customer ${record?.id || '(unknown)'} is invalid.`);
    }
  });
  stores.contacts.forEach((record) => {
    if (!isObject(record) || record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION || typeof record.id !== 'string' || !record.id.trim() || typeof record.customerId !== 'string' || !record.customerId.trim() || typeof record.name !== 'string' || typeof record.normalizedName !== 'string' || typeof record.email !== 'string' || typeof record.normalizedEmail !== 'string' || typeof record.phone !== 'string' || typeof record.isPrimary !== 'boolean' || !isIsoDateTime(record.createdAt) || !isIsoDateTime(record.updatedAt)) {
      errors.push(`Contact ${record?.id || '(unknown)'} is invalid.`);
    }
  });
  stores.settings.forEach((record) => {
    if (!isObject(record) || record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION || typeof record.id !== 'string' || typeof record.deviceId !== 'string' || !isObject(record.numbering) || !isIsoDateTime(record.updatedAt)) {
      errors.push(`Settings record ${record?.id || '(unknown)'} is invalid.`);
      return;
    }
    Object.entries(record.numbering).forEach(([yearKey, counter]) => {
      const year = Number(yearKey);
      if (!/^\d{4}$/.test(yearKey) || !isObject(counter) || counter.year !== year || !Number.isInteger(counter.lastBaseSequence) || counter.lastBaseSequence < 0) {
        errors.push(`Settings numbering counter ${yearKey} is invalid.`);
      }
    });
  });
  stores.recoveryRecords.forEach((record) => {
    if (!isObject(record) || record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION || typeof record.id !== 'string' || !record.id.trim() || !STORE_NAMES.includes(record.storeName) || typeof record.originalKey !== 'string' || !isIsoDateTime(record.detectedAt) || !Array.isArray(record.errors) || !record.errors.every((error) => typeof error === 'string')) {
      errors.push(`Recovery record ${record?.id || '(unknown)'} is invalid.`);
    }
  });
  stores.migrationLog.forEach((record) => {
    if (!isObject(record) || !Number.isInteger(record.version) || record.version < 1 || record.version > QUOTE_LIBRARY_DATABASE_VERSION || !isIsoDateTime(record.appliedAt) || typeof record.description !== 'string' || !record.description.trim()) {
      errors.push(`Migration record ${record?.version ?? '(unknown)'} is invalid.`);
    }
  });
}

function validateHistoryAndNumbering(stores, errors) {
  const versionsByQuote = new Map();
  stores.quoteVersions.filter(isObject).forEach((version) => {
    const quoteVersions = versionsByQuote.get(version.quoteId) || [];
    quoteVersions.push(version);
    versionsByQuote.set(version.quoteId, quoteVersions);
    if (!isStrictUtcDateTime(version.createdAt) || !isStrictUtcDateTime(version.finalizedAt)) {
      errors.push(`Version ${version.id || '(unknown)'} has invalid immutable timestamps.`);
    }
    if (version.revisionNumber > 0 && typeof version.basedOnVersionId !== 'string') {
      errors.push(`Revision ${version.id || '(unknown)'} requires a based-on version.`);
    }
    if (version.revisionNumber === 0 && version.basedOnVersionId != null) {
      errors.push(`Base version ${version.id || '(unknown)'} cannot have revision lineage.`);
    }
  });

  stores.quotes.filter(isObject).forEach((quote) => {
    if (!isStrictUtcDateTime(quote.createdAt) || !isStrictUtcDateTime(quote.updatedAt)) {
      errors.push(`Quote ${quote.id || '(unknown)'} has invalid timestamps.`);
    }
    const versions = versionsByQuote.get(quote.id) || [];
    if (versions.length > 0 && (!quote.latestVersionId || !quote.baseNumber)) {
      errors.push(`Quote ${quote.id} with finalized versions requires a base number and latest version.`);
    }
    if (versions.length === 0 && (quote.latestVersionId || quote.baseNumber)) {
      errors.push(`Quote ${quote.id} cannot have numbering/version pointers without finalized versions.`);
    }
    if (quote.currentStatus !== 'draft' && quote.workingDraft) {
      errors.push(`Quote ${quote.id} cannot keep a working draft in status ${quote.currentStatus}.`);
    }
    if (quote.currentStatus !== 'draft' && versions.length === 0) {
      errors.push(`Quote ${quote.id} status ${quote.currentStatus} requires a finalized version.`);
    }
    if (quote.workingDraft?.kind === 'revision') {
      const maxRevision = Math.max(...versions.map((version) => version.revisionNumber), -1);
      const latestVersion = versions.find((version) => version.revisionNumber === maxRevision);
      if (typeof quote.workingDraft.basedOnVersionId !== 'string'
        || !Number.isInteger(quote.workingDraft.proposedRevisionNumber)
        || quote.workingDraft.proposedRevisionNumber !== maxRevision + 1) {
        errors.push(`Quote ${quote.id} revision draft has invalid lineage or proposed revision number.`);
      }
      if (!latestVersion
        || quote.workingDraft.basedOnVersionId !== latestVersion.id
        || quote.latestVersionId !== latestVersion.id) {
        errors.push(`Quote ${quote.id} revision draft must be based on its latest finalized version.`);
      }
    }
    if (quote.workingDraft?.kind === 'base' && versions.length > 0) {
      errors.push(`Quote ${quote.id} with finalized history cannot reopen a base draft.`);
    }
    if (quote.workingDraft?.kind === 'revision' && versions.length === 0) {
      errors.push(`Quote ${quote.id} cannot start a revision without finalized history.`);
    }
    const revisionNumbers = versions.map((version) => version.revisionNumber).sort((left, right) => left - right);
    if (new Set(revisionNumbers).size !== revisionNumbers.length) errors.push(`Quote ${quote.id} contains duplicate revision numbers.`);
    if (revisionNumbers.some((revisionNumber, index) => revisionNumber !== index)) {
      errors.push(`Quote ${quote.id} revision history must be contiguous from its base version.`);
    }
    versions.filter((version) => version.revisionNumber > 0).forEach((version) => {
      const predecessor = versions.find((candidate) => candidate.id === version.basedOnVersionId);
      if (!predecessor || predecessor.revisionNumber !== version.revisionNumber - 1) {
        errors.push(`Version ${version.id} must be based on the immediately preceding revision.`);
      }
    });
  });

  const maximumSequenceByYear = new Map();
  stores.quotes.filter(isObject).forEach((quote) => {
    const match = /^(\d{4})-(\d{3,})$/.exec(String(quote.baseNumber || ''));
    if (!match) return;
    const year = Number(match[1]);
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) errors.push(`Quote ${quote.id} has an unsafe base-number sequence.`);
    maximumSequenceByYear.set(year, Math.max(maximumSequenceByYear.get(year) || 0, sequence));
  });
  const settings = stores.settings.find((record) => record?.id === 'application');
  if (!isObject(settings?.numbering)) return;
  Object.entries(settings.numbering).forEach(([yearKey, counter]) => {
    const year = Number(yearKey);
    if (!Number.isInteger(year) || year < 2000 || year > 9999
      || !isObject(counter)
      || counter.year !== year
      || !Number.isSafeInteger(counter.lastBaseSequence)
      || counter.lastBaseSequence < 0
      || counter.lastBaseSequence > 999999999) {
      errors.push(`Settings numbering counter ${yearKey} is outside the supported range.`);
    }
  });
  maximumSequenceByYear.forEach((maximumSequence, year) => {
    const counter = settings.numbering[String(year)];
    if (!counter || counter.lastBaseSequence < maximumSequence) {
      errors.push(`Settings numbering for ${year} is behind finalized quote ${year}-${String(maximumSequence).padStart(3, '0')}.`);
    }
  });
}

async function validateBackupEnvelopeInternal(envelope, cryptoProvider = globalThis.crypto) {
  const errors = [];
  if (!isObject(envelope)) return { valid: false, errors: ['Backup must be an object.'] };
  if (envelope.format !== BACKUP_FORMAT) errors.push('Backup format is not supported.');
  if (envelope.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) errors.push('Backup schema version is not supported.');
  if (typeof envelope.applicationVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(envelope.applicationVersion)) errors.push('Application version is invalid.');
  if (envelope.databaseSchemaVersion !== QUOTE_LIBRARY_DATABASE_VERSION) errors.push('Database schema version is not supported.');
  if (!isIsoDateTime(envelope.exportedAt)) errors.push('Export timestamp is invalid.');
  if (typeof envelope.sourceDeviceId !== 'string' || !envelope.sourceDeviceId.trim()) errors.push('Source device ID is required.');
  if (envelope.checksumAlgorithm !== BACKUP_CHECKSUM_ALGORITHM) errors.push('Backup checksum algorithm is not supported.');
  if (!/^[a-f0-9]{64}$/.test(String(envelope.payloadChecksum || ''))) errors.push('Payload checksum is invalid.');
  if (!isObject(envelope.payload)) {
    errors.push('Backup payload is required.');
    return { valid: false, errors };
  }

  const quoteDatabase = envelope.payload.quoteDatabase;
  const localStorage = envelope.payload.localStorage;
  const hasQuoteDatabase = isObject(quoteDatabase);
  const hasLocalStorage = isObject(localStorage) && Array.isArray(localStorage.entries);
  if (!hasQuoteDatabase) errors.push('Quote database snapshot is required.');
  if (!hasLocalStorage) errors.push('localStorage snapshot is required.');
  if (!hasQuoteDatabase || !hasLocalStorage) return { valid: false, errors };

  if (quoteDatabase.databaseName !== QUOTE_LIBRARY_DATABASE_NAME) errors.push('Quote database name is not supported.');
  if (quoteDatabase.databaseVersion !== envelope.databaseSchemaVersion) errors.push('Database schema versions do not match.');
  if (quoteDatabase.recordSchemaVersion !== QUOTE_RECORD_SCHEMA_VERSION) errors.push('Record schema version is not supported.');
  const hasStoresObject = isObject(quoteDatabase.stores);
  if (!hasStoresObject) {
    errors.push('Quote database stores are required.');
  } else {
    STORE_NAMES.forEach((storeName) => {
      if (!Array.isArray(quoteDatabase.stores[storeName])) errors.push(`Store ${storeName} is missing or invalid.`);
    });
  }

  const entries = localStorage.entries;
  const entryKeys = new Set();
  entries.forEach((entry) => {
    validateKnownLocalStorageEntry(entry, errors);
    if (isObject(entry) && typeof entry.key === 'string') {
      if (entryKeys.has(entry.key)) errors.push(`localStorage contains duplicate key ${entry.key}.`);
      entryKeys.add(entry.key);
    }
  });
  const hasAllStores = hasStoresObject && STORE_NAMES.every((storeName) => Array.isArray(quoteDatabase.stores[storeName]));
  if (!hasAllStores) return { valid: false, errors };

  const stores = quoteDatabase.stores;
  STORE_NAMES.forEach((storeName) => addDuplicateErrors(stores[storeName], storeName, errors));
  stores.quotes.forEach((record) => errors.push(...validateQuoteRecord(record).map((error) => `Quote ${record?.id || '(unknown)'}: ${error}`)));
  for (const record of stores.quoteVersions) {
    errors.push(...validateQuoteVersion(record).map((error) => `Version ${record?.id || '(unknown)'}: ${error}`));
    if (isObject(record?.content) && /^[a-f0-9]{64}$/.test(String(record.contentHash || ''))) {
      const actualHash = await hashQuoteContent(record.content, cryptoProvider);
      if (actualHash !== record.contentHash) errors.push(`Version ${record.id} content hash does not match its content.`);
    }
  }
  ID_STORES.forEach((storeName) => {
    if ([QUOTE_LIBRARY_STORES.quotes, QUOTE_LIBRARY_STORES.quoteVersions].includes(storeName)) return;
    stores[storeName].forEach((record, index) => {
      if (!isObject(record)) errors.push(`${storeName}[${index}] must be an object.`);
    });
  });
  validateSupportingRecords(stores, errors);
  validateHistoryAndNumbering(stores, errors);
  validateReferences(stores, errors);

  const settings = stores.settings.find((record) => record?.id === 'application');
  if (!settings) errors.push('Application settings are missing.');
  else if (settings.deviceId !== envelope.sourceDeviceId) errors.push('Source device ID does not match application settings.');

  const actualChecksum = await sha256Hex(canonicalJson(envelope.payload), cryptoProvider);
  if (actualChecksum !== envelope.payloadChecksum) errors.push('Payload checksum does not match the backup contents.');
  return { valid: errors.length === 0, errors };
}

export async function validateBackupEnvelope(envelope, cryptoProvider = globalThis.crypto) {
  try {
    return await validateBackupEnvelopeInternal(envelope, cryptoProvider);
  } catch (error) {
    return {
      valid: false,
      errors: [`Backup validation could not safely inspect the supplied data: ${error instanceof Error ? error.message : 'unknown error'}`]
    };
  }
}

export async function createBackupEnvelope({
  applicationVersion,
  exportedAt,
  sourceDeviceId,
  quoteDatabase,
  localStorageEntries = []
}, cryptoProvider = globalThis.crypto) {
  if (!quoteDatabase?.stores) throw new Error('A complete quote database snapshot is required.');
  const payload = normalizePayload({ quoteDatabase, localStorageEntries });
  const envelope = {
    format: BACKUP_FORMAT,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    applicationVersion: String(applicationVersion || ''),
    databaseSchemaVersion: quoteDatabase.databaseVersion,
    exportedAt: String(exportedAt || ''),
    sourceDeviceId: String(sourceDeviceId || ''),
    checksumAlgorithm: BACKUP_CHECKSUM_ALGORITHM,
    payloadChecksum: await sha256Hex(canonicalJson(payload), cryptoProvider),
    payload
  };
  let serialized;
  try {
    serialized = JSON.stringify(envelope);
  } catch (error) {
    throw new Error(`Backup serialization failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  const serializedEnvelope = JSON.parse(serialized);
  const report = await validateBackupEnvelope(serializedEnvelope, cryptoProvider);
  if (!report.valid) throw new Error(`Backup validation failed: ${report.errors.join(' ')}`);
  return cloneQuoteData(serializedEnvelope);
}
