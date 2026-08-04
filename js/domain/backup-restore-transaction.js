import { canonicalJson, cloneQuoteData } from './quote-library.js';
import { QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION, QUOTE_LIBRARY_STORES } from './storage-contract.js';

export const RESTORE_MODE = Object.freeze({ MERGE: 'merge', REPLACE: 'replace' });
export const MUTABLE_CONFLICT_POLICY = Object.freeze({
  KEEP_CURRENT: 'keep-current',
  REPLACE_WITH_BACKUP: 'replace-with-backup'
});

export const RESTORE_STORE_NAMES = Object.freeze(Object.values(QUOTE_LIBRARY_STORES));

const IMMUTABLE_STORES = new Set([
  QUOTE_LIBRARY_STORES.quoteVersions,
  QUOTE_LIBRARY_STORES.quoteEvents
]);

function primaryKey(storeName, record) {
  return storeName === QUOTE_LIBRARY_STORES.migrationLog ? record?.version : record?.id;
}

function recordMap(snapshot, storeName) {
  return new Map((snapshot.stores[storeName] || []).map((record) => [String(primaryKey(storeName, record)), record]));
}

function cloneSnapshot(snapshot) {
  return {
    databaseName: snapshot.databaseName,
    databaseVersion: snapshot.databaseVersion,
    recordSchemaVersion: snapshot.recordSchemaVersion,
    stores: Object.fromEntries(RESTORE_STORE_NAMES.map((storeName) => [
      storeName,
      snapshot.stores[storeName].map(cloneQuoteData)
    ]))
  };
}

function preserveCurrentDeviceIdentity(projectedSnapshot, currentSnapshot) {
  const currentSettings = currentSnapshot.stores[QUOTE_LIBRARY_STORES.settings]
    .find((record) => record?.id === 'application');
  const projectedSettingsIndex = projectedSnapshot.stores[QUOTE_LIBRARY_STORES.settings]
    .findIndex((record) => record?.id === 'application');
  if (!currentSettings?.deviceId || projectedSettingsIndex < 0) {
    throw new Error('Restore requires current and incoming application settings with a device ID.');
  }
  projectedSnapshot.stores[QUOTE_LIBRARY_STORES.settings][projectedSettingsIndex] = {
    ...projectedSnapshot.stores[QUOTE_LIBRARY_STORES.settings][projectedSettingsIndex],
    deviceId: currentSettings.deviceId
  };
}

function assertSnapshotShape(snapshot) {
  if (!snapshot || typeof snapshot !== 'object'
    || snapshot.databaseName !== QUOTE_LIBRARY_DATABASE_NAME
    || snapshot.databaseVersion !== QUOTE_LIBRARY_DATABASE_VERSION
    || !snapshot.stores || typeof snapshot.stores !== 'object') {
    throw new Error('A complete, validated quote-library snapshot is required.');
  }
  RESTORE_STORE_NAMES.forEach((storeName) => {
    if (!Array.isArray(snapshot.stores[storeName])) {
      throw new Error(`Restore snapshot store ${storeName} is missing or invalid.`);
    }
  });
}

export function assertRestoreOptions({ mode, mutableConflictPolicy = MUTABLE_CONFLICT_POLICY.KEEP_CURRENT } = {}) {
  if (!Object.values(RESTORE_MODE).includes(mode)) throw new Error('Restore mode must be merge or replace.');
  if (!Object.values(MUTABLE_CONFLICT_POLICY).includes(mutableConflictPolicy)) {
    throw new Error('Mutable conflict policy must keep current data or replace it with the backup.');
  }
}

/**
 * Convert a fully envelope-validated backup payload into the only snapshot shape
 * accepted by the transactional repository method. Validation remains the caller's
 * responsibility; this function deliberately rejects partial database objects.
 */
export function snapshotFromValidatedBackup(envelope) {
  const database = envelope?.payload?.quoteDatabase;
  assertSnapshotShape(database);
  return cloneSnapshot(database);
}

function immutableConflictDetails(incoming, current) {
  const conflicts = [];
  IMMUTABLE_STORES.forEach((storeName) => {
    const currentRecords = recordMap(current, storeName);
    incoming.stores[storeName].forEach((record) => {
      const existing = currentRecords.get(String(primaryKey(storeName, record)));
      if (existing && canonicalJson(existing) !== canonicalJson(record)) {
        conflicts.push({ type: 'immutable-id', storeName });
      }
    });
  });

  const currentVersionsByDisplayNumber = new Map(current.stores.quoteVersions
    .map((record) => [record.displayNumber, record]));
  incoming.stores.quoteVersions.forEach((record) => {
    const existing = currentVersionsByDisplayNumber.get(record.displayNumber);
    if (existing && existing.id !== record.id) conflicts.push({ type: 'display-number', storeName: QUOTE_LIBRARY_STORES.quoteVersions });
  });

  const currentVersionsByQuoteRevision = new Map(current.stores.quoteVersions
    .map((record) => [`${record.quoteId}\u0000${record.revisionNumber}`, record]));
  incoming.stores.quoteVersions.forEach((record) => {
    const existing = currentVersionsByQuoteRevision.get(`${record.quoteId}\u0000${record.revisionNumber}`);
    if (existing && existing.id !== record.id) conflicts.push({ type: 'quote-revision', storeName: QUOTE_LIBRARY_STORES.quoteVersions });
  });

  const currentQuotesByBaseNumber = new Map(current.stores.quotes
    .filter((record) => record.baseNumber)
    .map((record) => [record.baseNumber, record]));
  incoming.stores.quotes.forEach((record) => {
    if (!record.baseNumber) return;
    const existing = currentQuotesByBaseNumber.get(record.baseNumber);
    if (existing && existing.id !== record.id) conflicts.push({ type: 'base-number', storeName: QUOTE_LIBRARY_STORES.quotes });
  });
  return conflicts;
}

function createEmptyActions() {
  return Object.fromEntries(RESTORE_STORE_NAMES.map((storeName) => [storeName, []]));
}

function emptySummary() {
  return Object.fromEntries(RESTORE_STORE_NAMES.map((storeName) => [storeName, {
    created: 0, identical: 0, keptCurrent: 0, replaced: 0
  }]));
}

/**
 * Produce a deterministic, no-write restore plan. The resulting projected snapshot
 * lets the service validate merge outcomes before it starts an IndexedDB transaction.
 */
export function planRestoreTransaction({
  incomingSnapshot,
  currentSnapshot,
  mode,
  mutableConflictPolicy = MUTABLE_CONFLICT_POLICY.KEEP_CURRENT
} = {}) {
  assertSnapshotShape(incomingSnapshot);
  assertSnapshotShape(currentSnapshot);
  assertRestoreOptions({ mode, mutableConflictPolicy });

  const immutableConflicts = mode === RESTORE_MODE.MERGE
    ? immutableConflictDetails(incomingSnapshot, currentSnapshot)
    : [];
  if (immutableConflicts.length) {
    return {
      allowed: false,
      mode,
      mutableConflictPolicy,
      immutableConflictCount: immutableConflicts.length,
      immutableConflicts,
      actions: createEmptyActions(),
      summaryByStore: emptySummary(),
      projectedSnapshot: cloneSnapshot(currentSnapshot)
    };
  }

  const actions = createEmptyActions();
  const summaryByStore = emptySummary();
  const projectedSnapshot = mode === RESTORE_MODE.REPLACE
    ? cloneSnapshot(incomingSnapshot)
    : cloneSnapshot(currentSnapshot);

  // deviceId identifies this browser/device, not the portable quote library. It
  // must never be adopted from a backup, including an explicit Replace restore.
  preserveCurrentDeviceIdentity(projectedSnapshot, currentSnapshot);

  if (mode === RESTORE_MODE.REPLACE) {
    RESTORE_STORE_NAMES.forEach((storeName) => {
      projectedSnapshot.stores[storeName].forEach((record) => {
        actions[storeName].push({ kind: 'put', record: cloneQuoteData(record) });
        summaryByStore[storeName].replaced += 1;
      });
    });
    return {
      allowed: true,
      mode,
      mutableConflictPolicy,
      immutableConflictCount: 0,
      immutableConflicts: [],
      actions,
      summaryByStore,
      projectedSnapshot
    };
  }

  RESTORE_STORE_NAMES.forEach((storeName) => {
    const currentByKey = recordMap(currentSnapshot, storeName);
    const projectedByKey = recordMap(projectedSnapshot, storeName);
    incomingSnapshot.stores[storeName].forEach((record) => {
      const key = String(primaryKey(storeName, record));
      const existing = currentByKey.get(key);
      const candidate = storeName === QUOTE_LIBRARY_STORES.settings && record?.id === 'application'
        ? { ...record, deviceId: currentSnapshot.stores[QUOTE_LIBRARY_STORES.settings].find((settings) => settings?.id === 'application')?.deviceId }
        : record;
      if (!existing) {
        actions[storeName].push({ kind: 'put', record: cloneQuoteData(candidate) });
        projectedByKey.set(key, cloneQuoteData(candidate));
        summaryByStore[storeName].created += 1;
      } else if (canonicalJson(existing) === canonicalJson(candidate)) {
        summaryByStore[storeName].identical += 1;
      } else if (IMMUTABLE_STORES.has(storeName)) {
        // This branch cannot be reached because immutable conflicts were rejected
        // above. Leave it explicit to protect this invariant if the plan changes.
        throw new Error(`Immutable ${storeName} data cannot be overwritten.`);
      } else if (storeName === QUOTE_LIBRARY_STORES.migrationLog) {
        // Schema migration history is local device metadata. A matching migration
        // version may legitimately have a different appliedAt timestamp on another
        // device, so merge always retains the current record for that version.
        summaryByStore[storeName].keptCurrent += 1;
      } else if (mutableConflictPolicy === MUTABLE_CONFLICT_POLICY.REPLACE_WITH_BACKUP) {
        actions[storeName].push({ kind: 'put', record: cloneQuoteData(candidate) });
        projectedByKey.set(key, cloneQuoteData(candidate));
        summaryByStore[storeName].replaced += 1;
      } else {
        summaryByStore[storeName].keptCurrent += 1;
      }
    });
    projectedSnapshot.stores[storeName] = [...projectedByKey.values()].map(cloneQuoteData);
  });

  return {
    allowed: true,
    mode,
    mutableConflictPolicy,
    immutableConflictCount: 0,
    immutableConflicts: [],
    actions,
    summaryByStore,
    projectedSnapshot
  };
}

export function restoreSummary(plan) {
  const totals = Object.values(plan.summaryByStore).reduce((summary, store) => ({
    created: summary.created + store.created,
    identical: summary.identical + store.identical,
    keptCurrent: summary.keptCurrent + store.keptCurrent,
    replaced: summary.replaced + store.replaced
  }), { created: 0, identical: 0, keptCurrent: 0, replaced: 0 });
  return {
    mode: plan.mode,
    mutableConflictPolicy: plan.mutableConflictPolicy,
    immutableConflictCount: plan.immutableConflictCount,
    ...totals,
    stores: Object.fromEntries(RESTORE_STORE_NAMES.map((storeName) => [
      storeName,
      { ...plan.summaryByStore[storeName] }
    ]))
  };
}
