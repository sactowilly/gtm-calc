import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MUTABLE_CONFLICT_POLICY,
  RESTORE_MODE,
  RESTORE_STORE_NAMES,
  planRestoreTransaction,
  restoreSummary
} from '../js/domain/backup-restore-transaction.js';
import { QUOTE_LIBRARY_STORES } from '../js/domain/storage-contract.js';
import { buildQuoteItem } from '../js/domain/calculations.js';
import { legacyQuoteToQuoteContent } from '../js/domain/quote-library.js';
import { validateBackupEnvelope } from '../js/domain/backup-envelope.js';
import { createBackupService } from '../js/services/backup-service.js';
import { createQuoteLibraryRepository } from '../js/services/indexeddb-quote-repository.js';
import {
  BackupRestoreTransactionError,
  createBackupRestoreTransactionService
} from '../js/services/backup-restore-transaction-service.js';

const repositories = [];
let databaseSequence = 0;

function emptyStores() {
  return Object.fromEntries(RESTORE_STORE_NAMES.map((storeName) => [storeName, []]));
}

function snapshot(stores = {}) {
  return {
    databaseName: 'gtm_quote_manager',
    databaseVersion: 1,
    recordSchemaVersion: 1,
    stores: { ...emptyStores(), ...stores }
  };
}

function record(id, value) {
  return { id, value };
}

function makeRepository() {
  const databaseName = `restore-transaction-test-${++databaseSequence}`;
  let id = 0;
  const repository = createQuoteLibraryRepository({
    databaseName,
    idFactory: () => `${databaseName}-${++id}`,
    now: () => '2026-08-04T16:00:00.000Z'
  });
  repositories.push(repository);
  return repository;
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function quoteContent(companyName) {
  const { item } = buildQuoteItem({
    name: 'Synthetic restore carton', quantity: '12', uom: 'CS', unitCost: '1.2', price: '2.4', freight: '0', freightMode: 'per-item'
  }, `line-${companyName}`);
  return legacyQuoteToQuoteContent({
    customerName: companyName,
    date: '2026-08-04',
    shipVia: 'Our Truck',
    fobPoint: 'Sacramento',
    terms: 'NET30',
    items: [item]
  });
}

function stableRepository({ idPrefix, companyName }) {
  const databaseName = `restore-service-${++databaseSequence}`;
  let id = 0;
  const repository = createQuoteLibraryRepository({
    databaseName,
    idFactory: () => `${idPrefix}-${++id}`,
    now: () => '2026-08-04T16:00:00.000Z'
  });
  repositories.push(repository);
  return { repository, companyName };
}

function makeBackupService(repository, storage) {
  return createBackupService({
    quoteRepository: repository,
    storage,
    applicationVersion: '2.5.0-alpha.4',
    now: () => '2026-08-04T16:00:00.000Z'
  });
}

async function seedDevice({ idPrefix, companyName, usageCount = 1, finalized = false }) {
  const { repository } = stableRepository({ idPrefix, companyName });
  const storage = memoryStorage({
    gtm_catalog_usage_v1: JSON.stringify({ schemaVersion: 1, usageById: { 'catalog:synthetic': { useCount: usageCount } } })
  });
  await repository.initialize();
  const draft = await repository.createDraftWithCustomer(quoteContent(companyName));
  if (finalized) await repository.finalizeBase(draft.draft.id, { numberYear: 2026 });
  const backupService = makeBackupService(repository, storage);
  return { repository, storage, backupService, backup: await backupService.createBackup() };
}

function fileFromEnvelope(envelope, name = 'synthetic-restore.json') {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()));
});

describe('Version 2.5 restore transaction planning', () => {
  it('plans merge policies deterministically without mutating either snapshot', () => {
    const current = snapshot({
      quotes: [record('quote-current', 'current')],
      customers: [record('customer-shared', 'current customer')],
      settings: [{ ...record('application', 'local settings'), deviceId: 'local-device' }],
      migrationLog: [{ version: 1, appliedAt: '2026-08-01T00:00:00.000Z', value: 'local migration' }]
    });
    const incoming = snapshot({
      quotes: [record('quote-current', 'current'), record('quote-new', 'backup')],
      customers: [record('customer-shared', 'backup customer')],
      settings: [{ ...record('application', 'local settings'), deviceId: 'backup-device' }],
      migrationLog: [{ version: 1, appliedAt: '2026-08-02T00:00:00.000Z', value: 'backup migration' }]
    });
    const beforeCurrent = structuredClone(current);
    const beforeIncoming = structuredClone(incoming);

    const keepCurrent = planRestoreTransaction({
      currentSnapshot: current,
      incomingSnapshot: incoming,
      mode: RESTORE_MODE.MERGE,
      mutableConflictPolicy: MUTABLE_CONFLICT_POLICY.KEEP_CURRENT
    });
    const replaceMutable = planRestoreTransaction({
      currentSnapshot: current,
      incomingSnapshot: incoming,
      mode: RESTORE_MODE.MERGE,
      mutableConflictPolicy: MUTABLE_CONFLICT_POLICY.REPLACE_WITH_BACKUP
    });

    expect(keepCurrent.allowed).toBe(true);
    expect(keepCurrent.summaryByStore.quotes).toMatchObject({ created: 1, identical: 1 });
    expect(keepCurrent.summaryByStore.customers).toMatchObject({ keptCurrent: 1 });
    expect(keepCurrent.projectedSnapshot.stores.customers).toEqual([record('customer-shared', 'current customer')]);
    expect(replaceMutable.summaryByStore.customers).toMatchObject({ replaced: 1 });
    expect(replaceMutable.projectedSnapshot.stores.customers).toEqual([record('customer-shared', 'backup customer')]);
    expect(replaceMutable.summaryByStore.migrationLog).toMatchObject({ keptCurrent: 1 });
    expect(replaceMutable.projectedSnapshot.stores.migrationLog).toEqual(current.stores.migrationLog);
    expect(replaceMutable.projectedSnapshot.stores.settings).toEqual([{ ...record('application', 'local settings'), deviceId: 'local-device' }]);
    expect(restoreSummary(replaceMutable)).toMatchObject({ mode: 'merge', created: 1, identical: 2, replaced: 1, keptCurrent: 1 });
    expect(current).toEqual(beforeCurrent);
    expect(incoming).toEqual(beforeIncoming);
  });

  it('refuses immutable version, event, and finalized-number conflicts before a write plan exists', () => {
    const current = snapshot({
      quotes: [{ id: 'quote-current', baseNumber: '2026-001' }],
      quoteVersions: [{ id: 'version-current', quoteId: 'quote-current', revisionNumber: 0, displayNumber: '2026-001', contentHash: 'a'.repeat(64) }],
      quoteEvents: [{ id: 'event-current', type: 'finalized' }]
    });
    const incoming = snapshot({
      quotes: [{ id: 'quote-other', baseNumber: '2026-001' }],
      quoteVersions: [
        { id: 'version-current', quoteId: 'quote-current', revisionNumber: 0, displayNumber: '2026-001', contentHash: 'b'.repeat(64) },
        { id: 'version-other', quoteId: 'quote-other', revisionNumber: 0, displayNumber: '2026-001', contentHash: 'c'.repeat(64) }
      ],
      quoteEvents: [{ id: 'event-current', type: 'cancelled' }]
    });

    const plan = planRestoreTransaction({ currentSnapshot: current, incomingSnapshot: incoming, mode: RESTORE_MODE.MERGE });

    expect(plan.allowed).toBe(false);
    expect(plan.immutableConflictCount).toBeGreaterThanOrEqual(4);
    expect(plan.immutableConflicts.map((conflict) => conflict.type)).toEqual(expect.arrayContaining([
      'immutable-id', 'display-number', 'base-number'
    ]));
    expect(Object.values(plan.actions).every((actions) => actions.length === 0)).toBe(true);
    expect(plan.projectedSnapshot).toEqual(current);
  });
});

describe('Version 2.5 transactional IndexedDB restore primitive', () => {
  it('aborts all stores on an injected failure and leaves the database record-for-record unchanged', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const before = await repository.exportSnapshot();
    const incoming = structuredClone(before);
    incoming.stores[QUOTE_LIBRARY_STORES.customers].push({ id: 'customer-from-backup', companyName: 'Synthetic only' });

    await expect(repository.applyRestoreSnapshot({
      mode: RESTORE_MODE.MERGE,
      snapshot: incoming,
      failAfterStore: QUOTE_LIBRARY_STORES.customers
    })).rejects.toThrow('Injected restore failure');

    expect(await repository.exportSnapshot()).toEqual(before);
  });

  it('commits a merge only after the multi-store transaction completes and reports aggregate results', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const incoming = await repository.exportSnapshot();
    incoming.stores[QUOTE_LIBRARY_STORES.customers].push({ id: 'customer-from-backup', companyName: 'Synthetic only' });

    const result = await repository.applyRestoreSnapshot({ mode: RESTORE_MODE.MERGE, snapshot: incoming });
    const after = await repository.exportSnapshot();

    expect(result).toMatchObject({ created: 1, mode: 'merge' });
    expect(after.stores[QUOTE_LIBRARY_STORES.customers]).toContainEqual({ id: 'customer-from-backup', companyName: 'Synthetic only' });
  });

  it('replaces every store from the supplied complete snapshot only in explicit replace mode', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const incoming = await repository.exportSnapshot();
    incoming.stores[QUOTE_LIBRARY_STORES.customers] = [{ id: 'customer-replacement', companyName: 'Synthetic replacement' }];
    incoming.stores[QUOTE_LIBRARY_STORES.recoveryRecords] = [{ id: 'recovery-replacement', detectedAt: '2026-08-04T16:00:00.000Z' }];

    const result = await repository.applyRestoreSnapshot({ mode: RESTORE_MODE.REPLACE, snapshot: incoming });
    const after = await repository.exportSnapshot();

    expect(result).toMatchObject({ mode: 'replace', replaced: expect.any(Number) });
    expect(after.stores[QUOTE_LIBRARY_STORES.customers]).toEqual(incoming.stores[QUOTE_LIBRARY_STORES.customers]);
    expect(after.stores[QUOTE_LIBRARY_STORES.recoveryRecords]).toEqual(incoming.stores[QUOTE_LIBRARY_STORES.recoveryRecords]);
  });
});

describe('Version 2.5 owner-confirmed restore service', () => {
  it('requires exact RESTORE confirmation before reading, snapshotting, downloading, or writing', async () => {
    const current = await seedDevice({ idPrefix: 'current-confirm', companyName: 'Current' });
    const incoming = await seedDevice({ idPrefix: 'incoming-confirm', companyName: 'Incoming' });
    const applyRestoreSnapshot = vi.fn(current.repository.applyRestoreSnapshot);
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: { applyRestoreSnapshot },
      storage: current.storage
    });
    const file = fileFromEnvelope(incoming.backup);
    const safetyDownload = vi.fn();
    const before = await current.backupService.createBackup();

    await expect(service.restoreBackupFile(file, {
      mode: 'merge', confirmation: 'restore', onSafetyBackupDownload: safetyDownload
    })).rejects.toMatchObject({ code: 'confirmation-required' });

    expect(safetyDownload).not.toHaveBeenCalled();
    expect(applyRestoreSnapshot).not.toHaveBeenCalled();
    expect(await current.backupService.createBackup()).toEqual(before);
  });

  it('requires a successful safety-backup download before any database or browser-storage mutation', async () => {
    const current = await seedDevice({ idPrefix: 'current-safety', companyName: 'Current', usageCount: 1 });
    const incoming = await seedDevice({ idPrefix: 'incoming-safety', companyName: 'Incoming', usageCount: 2 });
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: current.repository,
      storage: current.storage
    });
    const before = await current.backupService.createBackup();

    await expect(service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'replace', confirmation: 'RESTORE', onSafetyBackupDownload: async () => false
    })).rejects.toMatchObject({ code: 'safety-backup-failed' });

    expect(await current.backupService.createBackup()).toEqual(before);
  });

  it('merges backup-only data, keeps changed mutable local data by policy, and validates the final state', async () => {
    const current = await seedDevice({ idPrefix: 'current-merge', companyName: 'Current', usageCount: 1 });
    const incoming = await seedDevice({ idPrefix: 'incoming-merge', companyName: 'Incoming', usageCount: 2 });
    const safetyDownloads = [];
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: current.repository,
      storage: current.storage
    });

    const result = await service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'merge',
      confirmation: 'RESTORE',
      onSafetyBackupDownload: async (safetyBackup) => {
        safetyDownloads.push(safetyBackup);
        expect(await safetyBackup.blob.text()).toContain('Current');
      }
    });
    const after = await current.backupService.createBackup();

    expect(safetyDownloads).toHaveLength(1);
    expect(safetyDownloads[0]).toMatchObject({ filename: 'gtm-calc-backup-2026-08-04.json', byteCount: expect.any(Number) });
    expect(result.restoreSummary).toMatchObject({ mode: 'merge', created: expect.any(Number), keptCurrent: expect.any(Number) });
    expect(after.payload.quoteDatabase.stores.quotes).toHaveLength(2);
    expect(current.storage.getItem('gtm_catalog_usage_v1')).toContain('"useCount":1');
    expect(await validateBackupEnvelope(after)).toEqual({ valid: true, errors: [] });
  });

  it('replaces portable data after confirmation while retaining this browser device ID', async () => {
    const current = await seedDevice({ idPrefix: 'current-replace', companyName: 'Current', usageCount: 1 });
    const incoming = await seedDevice({ idPrefix: 'incoming-replace', companyName: 'Incoming', usageCount: 2 });
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: current.repository,
      storage: current.storage
    });

    const result = await service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'replace', confirmation: 'RESTORE', onSafetyBackupDownload: async () => true
    });
    const after = await current.backupService.createBackup();

    expect(result.restoreSummary).toMatchObject({ mode: 'replace' });
    const currentDeviceId = current.backup.sourceDeviceId;
    expect(after.sourceDeviceId).toBe(currentDeviceId);
    expect(after.payload.quoteDatabase.stores.settings.find((record) => record.id === 'application').deviceId).toBe(currentDeviceId);
    expect(after.payload.quoteDatabase.stores.settings.find((record) => record.id === 'application').numbering)
      .toEqual(incoming.backup.payload.quoteDatabase.stores.settings.find((record) => record.id === 'application').numbering);
    const expectedPayload = structuredClone(incoming.backup.payload);
    expectedPayload.quoteDatabase.stores.settings.find((record) => record.id === 'application').deviceId = currentDeviceId;
    expect(after.payload).toEqual(expectedPayload);
    expect(current.storage.getItem('gtm_catalog_usage_v1')).toContain('"useCount":2');
  });

  it('refuses valid immutable-history conflicts before requesting a safety backup or changing the device', async () => {
    const current = await seedDevice({ idPrefix: 'shared-history', companyName: 'Current history', finalized: true });
    const incoming = await seedDevice({ idPrefix: 'shared-history', companyName: 'Incoming history', finalized: true });
    const safetyDownload = vi.fn();
    const before = await current.backupService.createBackup();
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: current.repository,
      storage: current.storage
    });

    await expect(service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'merge', confirmation: 'RESTORE', onSafetyBackupDownload: safetyDownload
    })).rejects.toBeInstanceOf(BackupRestoreTransactionError);
    await expect(service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'merge', confirmation: 'RESTORE', onSafetyBackupDownload: safetyDownload
    })).rejects.toMatchObject({ code: 'immutable-conflict' });

    expect(safetyDownload).not.toHaveBeenCalled();
    expect(await current.backupService.createBackup()).toEqual(before);
  });

  it('rolls back staged localStorage and committed IndexedDB data when post-restore validation fails', async () => {
    const current = await seedDevice({ idPrefix: 'current-rollback', companyName: 'Current', usageCount: 1 });
    const incoming = await seedDevice({ idPrefix: 'incoming-rollback', companyName: 'Incoming', usageCount: 2 });
    const before = await current.backupService.createBackup();
    let validationCalls = 0;
    const validate = async (envelope, cryptoProvider) => {
      validationCalls += 1;
      if (validationCalls === 4) return { valid: false, errors: ['Injected post-restore validation failure.'] };
      return validateBackupEnvelope(envelope, cryptoProvider);
    };
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: current.repository,
      storage: current.storage,
      validate
    });

    await expect(service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'replace', confirmation: 'RESTORE', onSafetyBackupDownload: async () => true
    })).rejects.toMatchObject({ code: 'current-data-invalid' });

    expect(await current.backupService.createBackup()).toEqual(before);
    expect(current.storage.getItem('gtm_catalog_usage_v1')).toContain('"useCount":1');
  });

  it('rolls back staged localStorage when IndexedDB rejects before commit', async () => {
    const current = await seedDevice({ idPrefix: 'current-storage', companyName: 'Current', usageCount: 1 });
    const incoming = await seedDevice({ idPrefix: 'incoming-storage', companyName: 'Incoming', usageCount: 2 });
    const before = await current.backupService.createBackup();
    const service = createBackupRestoreTransactionService({
      backupService: current.backupService,
      quoteRepository: { applyRestoreSnapshot: async () => { throw new Error('Injected IndexedDB failure'); } },
      storage: current.storage
    });

    await expect(service.restoreBackupFile(fileFromEnvelope(incoming.backup), {
      mode: 'replace', confirmation: 'RESTORE', onSafetyBackupDownload: async () => true
    })).rejects.toMatchObject({ code: 'restore-failed' });

    expect(await current.backupService.createBackup()).toEqual(before);
    expect(current.storage.getItem('gtm_catalog_usage_v1')).toContain('"useCount":1');
  });
});
