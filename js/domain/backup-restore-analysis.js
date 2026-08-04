import { canonicalJson } from './quote-library.js';
import { QUOTE_LIBRARY_STORES } from './storage-contract.js';

const STORE_NAMES = Object.freeze(Object.values(QUOTE_LIBRARY_STORES));
const ID_STORES = Object.freeze(STORE_NAMES.filter((storeName) => storeName !== QUOTE_LIBRARY_STORES.migrationLog));

function recordsFor(envelope, storeName) {
  const records = envelope?.payload?.quoteDatabase?.stores?.[storeName];
  return Array.isArray(records) ? records : [];
}

function primaryKey(storeName, record) {
  return storeName === QUOTE_LIBRARY_STORES.migrationLog ? record?.version : record?.id;
}

function countByStore(envelope) {
  return Object.fromEntries(STORE_NAMES.map((storeName) => [storeName, recordsFor(envelope, storeName).length]));
}

function countRecords(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function compareStoreRecords(incoming, current, storeName) {
  const currentByKey = new Map(recordsFor(current, storeName).map((record) => [String(primaryKey(storeName, record)), record]));
  const summary = { incoming: recordsFor(incoming, storeName).length, new: 0, identical: 0, different: 0 };

  recordsFor(incoming, storeName).forEach((record) => {
    const key = String(primaryKey(storeName, record));
    const currentRecord = currentByKey.get(key);
    if (!currentRecord) {
      summary.new += 1;
    } else if (canonicalJson(currentRecord) === canonicalJson(record)) {
      summary.identical += 1;
    } else {
      summary.different += 1;
    }
  });
  return summary;
}

function countImmutableVersionConflicts(incoming, current) {
  const currentById = new Map(recordsFor(current, QUOTE_LIBRARY_STORES.quoteVersions).map((record) => [record.id, record]));
  let sameIdDifferentHash = 0;
  recordsFor(incoming, QUOTE_LIBRARY_STORES.quoteVersions).forEach((record) => {
    const existing = currentById.get(record.id);
    if (existing && existing.contentHash !== record.contentHash) sameIdDifferentHash += 1;
  });

  const currentByDisplayNumber = new Map(recordsFor(current, QUOTE_LIBRARY_STORES.quoteVersions)
    .map((record) => [record.displayNumber, record]));
  let displayNumberDifferentHash = 0;
  recordsFor(incoming, QUOTE_LIBRARY_STORES.quoteVersions).forEach((record) => {
    const existing = currentByDisplayNumber.get(record.displayNumber);
    if (existing && existing.id !== record.id && existing.contentHash !== record.contentHash) {
      displayNumberDifferentHash += 1;
    }
  });
  return { sameIdDifferentHash, displayNumberDifferentHash };
}

function countImmutableEventConflicts(incoming, current) {
  const currentById = new Map(recordsFor(current, QUOTE_LIBRARY_STORES.quoteEvents)
    .map((record) => [record.id, record]));
  return recordsFor(incoming, QUOTE_LIBRARY_STORES.quoteEvents).reduce((count, record) => {
    const existing = currentById.get(record.id);
    return count + Number(Boolean(existing && canonicalJson(existing) !== canonicalJson(record)));
  }, 0);
}

function countBaseNumberConflicts(incoming, current) {
  const currentByBaseNumber = new Map(recordsFor(current, QUOTE_LIBRARY_STORES.quotes)
    .filter((record) => record.baseNumber)
    .map((record) => [record.baseNumber, record]));
  return recordsFor(incoming, QUOTE_LIBRARY_STORES.quotes).reduce((count, record) => {
    const existing = currentByBaseNumber.get(record.baseNumber);
    return count + Number(Boolean(existing && existing.id !== record.id));
  }, 0);
}

function compareLocalStorage(incoming, current) {
  const currentByKey = new Map((current?.payload?.localStorage?.entries || []).map((entry) => [entry.key, entry.value]));
  const result = { incoming: 0, new: 0, identical: 0, different: 0 };
  (incoming?.payload?.localStorage?.entries || []).forEach((entry) => {
    result.incoming += 1;
    if (!currentByKey.has(entry.key)) result.new += 1;
    else if (currentByKey.get(entry.key) === entry.value) result.identical += 1;
    else result.different += 1;
  });
  return result;
}

/**
 * Compare two independently validated backup envelopes without including record values
 * or stable identifiers in the result. This is intentionally a planning report: PR 3
 * has no restore write path.
 */
export function analyzeRestoreCandidate({ incomingEnvelope, currentEnvelope }) {
  const incomingCounts = countByStore(incomingEnvelope);
  const currentCounts = countByStore(currentEnvelope);
  const stores = Object.fromEntries(STORE_NAMES.map((storeName) => [
    storeName,
    compareStoreRecords(incomingEnvelope, currentEnvelope, storeName)
  ]));
  const immutableVersions = countImmutableVersionConflicts(incomingEnvelope, currentEnvelope);
  const immutableEventConflicts = countImmutableEventConflicts(incomingEnvelope, currentEnvelope);
  const baseNumberCollisions = countBaseNumberConflicts(incomingEnvelope, currentEnvelope);
  const localStorage = compareLocalStorage(incomingEnvelope, currentEnvelope);
  const mutableDifferences = ID_STORES
    .filter((storeName) => storeName !== QUOTE_LIBRARY_STORES.quoteVersions && storeName !== QUOTE_LIBRARY_STORES.quoteEvents)
    .reduce((count, storeName) => count + stores[storeName].different, 0);
  const immutableConflictCount = immutableVersions.sameIdDifferentHash
    + immutableVersions.displayNumberDifferentHash
    + immutableEventConflicts;
  const blockingConflictCount = immutableConflictCount + baseNumberCollisions;

  return {
    incoming: {
      recordCounts: incomingCounts,
      recordCount: countRecords(incomingCounts),
      localStorageEntryCount: localStorage.incoming,
      sourceDevice: incomingEnvelope.sourceDeviceId === currentEnvelope.sourceDeviceId ? 'same-device' : 'different-device'
    },
    current: {
      recordCounts: currentCounts,
      recordCount: countRecords(currentCounts),
      localStorageEntryCount: (currentEnvelope?.payload?.localStorage?.entries || []).length
    },
    comparison: {
      stores,
      localStorage,
      immutableVersions,
      immutableEventConflicts,
      baseNumberCollisions,
      mutableDifferences,
      blockingConflictCount
    },
    restorePlan: {
      merge: {
        requiresOwnerConfirmation: true,
        creates: Object.fromEntries(STORE_NAMES.map((storeName) => [storeName, stores[storeName].new])),
        skipsIdenticalRecords: Object.fromEntries(STORE_NAMES.map((storeName) => [storeName, stores[storeName].identical])),
        mutableRecordConflicts: mutableDifferences,
        immutableConflicts: immutableConflictCount,
        numberCollisions: baseNumberCollisions,
        blocked: blockingConflictCount > 0
      },
      replace: {
        requiresOwnerConfirmation: true,
        requiresSafetyBackup: true,
        incomingRecordCount: countRecords(incomingCounts),
        incomingLocalStorageEntryCount: localStorage.incoming,
        writePathAvailable: false
      }
    }
  };
}
