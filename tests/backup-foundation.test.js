import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildQuoteItem } from '../js/domain/calculations.js';
import {
  BACKUP_SCHEMA_VERSION,
  createBackupEnvelope,
  validateBackupEnvelope
} from '../js/domain/backup-envelope.js';
import { canonicalJson, legacyQuoteToQuoteContent } from '../js/domain/quote-library.js';
import { createBackupService, snapshotBackupLocalStorage } from '../js/services/backup-service.js';
import { QUOTE_LIBRARY_STORES, createQuoteLibraryRepository } from '../js/services/indexeddb-quote-repository.js';

const repositories = [];
let databaseSequence = 0;

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

function makeLegacyQuote(companyName = 'Backup Test Company') {
  const { item } = buildQuoteItem({
    name: 'Backup Carton',
    quantity: '25',
    uom: 'CS',
    unitCost: '1.125',
    price: '2.25',
    freight: '10',
    freightMode: 'total',
    leadTime: '2 weeks'
  }, 'line-backup');
  return {
    customerName: companyName,
    customerAddress: '100 Test Way\nSacramento, CA 95814',
    buyerName: 'Backup Buyer',
    buyerEmail: 'buyer@example.test',
    buyerPhone: '916-555-0100',
    salesRep: 'Sales Rep',
    date: '2026-08-03',
    shipVia: 'Our Truck',
    fobPoint: 'Sacramento',
    terms: 'NET30',
    customerNotes: 'Customer-safe note',
    items: [item]
  };
}

function makeRepository() {
  const databaseName = `backup-foundation-test-${++databaseSequence}`;
  let idSequence = 0;
  let timeSequence = 0;
  const repository = createQuoteLibraryRepository({
    databaseName,
    idFactory: () => `${databaseName}-id-${++idSequence}`,
    now: () => `2026-08-03T12:00:${String(timeSequence++).padStart(2, '0')}.000Z`
  });
  repositories.push(repository);
  return repository;
}

function catalogEnvelope(items = []) {
  return JSON.stringify({ schemaVersion: 1, updatedAt: '2026-08-03T12:00:00.000Z', items });
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()));
});

describe('Version 2.5 backup foundation', () => {
  it('captures every quote store and business localStorage key without changing source data', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftWithCustomer(legacyQuoteToQuoteContent(makeLegacyQuote()));
    await repository.finalizeBase(draft.draft.id, { numberYear: 2026 });
    const activeQuote = JSON.stringify(makeLegacyQuote());
    const storage = memoryStorage({
      gtm_quote_calculator_v1: activeQuote,
      gtm_catalog_v1: catalogEnvelope([{ id: 'catalog:A-1', sku: 'A-1', name: 'Carton' }]),
      gtm_catalog_v1_previous: catalogEnvelope([{ id: 'catalog:A-0', sku: 'A-0', name: 'Prior carton' }]),
      gtm_manual_items_v1: catalogEnvelope([{ id: 'manual:1', name: 'Custom carton' }]),
      gtm_catalog_usage_v1: JSON.stringify({ schemaVersion: 1, usageById: { 'catalog:A-1': { useCount: 2 } } }),
      gtm_catalog_v1_recovery_123: '{damaged catalog',
      gtm_quote_library_active_v1: 'ephemeral-session-id',
      unrelated_application_key: 'leave me alone'
    });
    const beforeSnapshot = await repository.exportSnapshot();
    const beforeStorage = [...storage.values.entries()];
    const service = createBackupService({
      quoteRepository: repository,
      storage,
      applicationVersion: '2.5.0-alpha.1',
      now: () => '2026-08-03T13:00:00.000Z'
    });

    const backup = await service.createBackup();

    expect(backup).toMatchObject({
      format: 'gtm-calc-backup',
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      checksumAlgorithm: 'SHA-256'
    });
    expect(Object.keys(backup.payload.quoteDatabase.stores).sort()).toEqual(Object.values(QUOTE_LIBRARY_STORES).sort());
    expect(backup.payload.quoteDatabase.stores.quotes).toHaveLength(1);
    expect(backup.payload.quoteDatabase.stores.quoteVersions).toHaveLength(1);
    expect(backup.payload.quoteDatabase.stores.customers).toHaveLength(1);
    expect(backup.payload.localStorage.entries.map(({ key }) => key)).toEqual([
      'gtm_catalog_usage_v1',
      'gtm_catalog_v1',
      'gtm_catalog_v1_previous',
      'gtm_catalog_v1_recovery_123',
      'gtm_manual_items_v1',
      'gtm_quote_calculator_v1'
    ]);
    expect(await validateBackupEnvelope(backup)).toEqual({ valid: true, errors: [] });
    expect(await repository.exportSnapshot()).toEqual(beforeSnapshot);
    expect([...storage.values.entries()]).toEqual(beforeStorage);
  });

  it('creates deterministic payloads and checksums regardless of source ordering', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const quoteDatabase = await repository.exportSnapshot();
    const values = {
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: quoteDatabase.stores.settings[0].deviceId,
      quoteDatabase,
      localStorageEntries: [
        { key: 'gtm_manual_items_v1', value: catalogEnvelope() },
        { key: 'gtm_catalog_v1', value: catalogEnvelope() }
      ]
    };
    const first = await createBackupEnvelope(values);
    const second = await createBackupEnvelope({
      ...values,
      localStorageEntries: [...values.localStorageEntries].reverse()
    });
    expect(first.payload).toEqual(second.payload);
    expect(first.payloadChecksum).toBe(second.payloadChecksum);
    expect(await validateBackupEnvelope(JSON.parse(JSON.stringify(first)))).toEqual({ valid: true, errors: [] });

    const unsupported = structuredClone(first);
    unsupported.format = 'other-backup';
    unsupported.checksumAlgorithm = 'MD5';
    unsupported.sourceDeviceId = 'different-device';
    const unsupportedReport = await validateBackupEnvelope(unsupported);
    expect(unsupportedReport.errors).toEqual(expect.arrayContaining([
      'Backup format is not supported.',
      'Backup checksum algorithm is not supported.',
      'Source device ID does not match application settings.'
    ]));
  });

  it('sorts database records deterministically with a locale-independent total order', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const quoteDatabase = await repository.exportSnapshot();
    const records = ['r2', 'r02', 'R2', 'récovery'].map((id) => ({
      id,
      schemaVersion: 1,
      storeName: 'quotes',
      originalKey: id,
      detectedAt: '2026-08-03T13:00:00.000Z',
      errors: ['synthetic recovery fixture'],
      rawRecord: { id }
    }));
    quoteDatabase.stores.recoveryRecords = records;
    const values = {
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: quoteDatabase.stores.settings[0].deviceId,
      quoteDatabase
    };
    const first = await createBackupEnvelope(values);
    quoteDatabase.stores.recoveryRecords.reverse();
    const second = await createBackupEnvelope(values);
    expect(first.payload.quoteDatabase.stores.recoveryRecords.map(({ id }) => id)).toEqual(['R2', 'r02', 'r2', 'récovery']);
    expect(first.payloadChecksum).toBe(second.payloadChecksum);
  });

  it('rejects payload tampering and a changed immutable quote-version body', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    await repository.finalizeBase(draft.id, { numberYear: 2026 });
    const service = createBackupService({ quoteRepository: repository, storage: memoryStorage() });
    const backup = await service.createBackup();
    backup.payload.quoteDatabase.stores.quoteVersions[0].content.customer.companyName = 'Tampered Company';

    const report = await validateBackupEnvelope(backup);
    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('content hash does not match'),
      expect.stringContaining('Payload checksum does not match')
    ]));
  });

  it('rejects future schemas, incomplete stores, duplicate keys, and broken references', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const snapshot = await repository.exportSnapshot();
    const sourceDeviceId = snapshot.stores.settings[0].deviceId;
    snapshot.stores.quoteEvents[0].quoteId = 'missing-quote';

    await expect(createBackupEnvelope({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId,
      quoteDatabase: snapshot
    })).rejects.toThrow('references a missing quote');

    const validSnapshot = await repository.exportSnapshot();
    const backup = await createBackupEnvelope({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId,
      quoteDatabase: validSnapshot
    });
    backup.backupSchemaVersion += 1;
    delete backup.payload.quoteDatabase.stores.contacts;
    backup.payload.localStorage.entries = [
      { key: 'unrelated_key', value: '{}' },
      { key: 'unrelated_key', value: '{}' }
    ];
    const report = await validateBackupEnvelope(backup);
    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      'Backup schema version is not supported.',
      'Store contacts is missing or invalid.',
      'Unsupported localStorage key: unrelated_key.',
      'localStorage contains duplicate key unrelated_key.'
    ]));
    expect(draft.currentStatus).toBe('draft');
  });

  it('rejects unsupported database identity/schema versions and duplicate quote numbers', async () => {
    const repository = makeRepository();
    const firstDraft = await repository.createDraftFromLegacyQuote(makeLegacyQuote('First Company'));
    const secondDraft = await repository.createDraftFromLegacyQuote(makeLegacyQuote('Second Company'));
    await repository.finalizeBase(firstDraft.id, { numberYear: 2026 });
    await repository.finalizeBase(secondDraft.id, { numberYear: 2026 });
    const original = await repository.exportSnapshot();
    const sourceDeviceId = original.stores.settings[0].deviceId;
    const values = (quoteDatabase) => ({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId,
      quoteDatabase
    });

    const wrongName = structuredClone(original);
    wrongName.databaseName = 'wrong-database';
    await expect(createBackupEnvelope(values(wrongName))).rejects.toThrow('database name is not supported');

    const futureDatabase = structuredClone(original);
    futureDatabase.databaseVersion = 999;
    await expect(createBackupEnvelope(values(futureDatabase))).rejects.toThrow('Database schema version is not supported');

    const futureRecords = structuredClone(original);
    futureRecords.recordSchemaVersion = 999;
    await expect(createBackupEnvelope(values(futureRecords))).rejects.toThrow('Record schema version is not supported');

    const duplicateNumbers = structuredClone(original);
    const [firstQuote, secondQuote] = duplicateNumbers.stores.quotes;
    const firstVersion = duplicateNumbers.stores.quoteVersions.find(({ quoteId }) => quoteId === firstQuote.id);
    const secondVersion = duplicateNumbers.stores.quoteVersions.find(({ quoteId }) => quoteId === secondQuote.id);
    secondQuote.baseNumber = firstQuote.baseNumber;
    secondVersion.baseNumber = firstVersion.baseNumber;
    secondVersion.displayNumber = firstVersion.displayNumber;
    await expect(createBackupEnvelope(values(duplicateNumbers))).rejects.toThrow('Duplicate base quote number');

    const duplicatePrimaryKey = structuredClone(original);
    duplicatePrimaryKey.stores.quotes.push(structuredClone(duplicatePrimaryKey.stores.quotes[0]));
    await expect(createBackupEnvelope(values(duplicatePrimaryKey))).rejects.toThrow('duplicate primary key');
  });

  it('rejects malformed known localStorage records instead of normalizing them into a backup', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const quoteDatabase = await repository.exportSnapshot();
    const common = {
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: quoteDatabase.stores.settings[0].deviceId,
      quoteDatabase
    };
    const malformedEntries = [
      { key: 'gtm_quote_calculator_v1', value: JSON.stringify({ items: [null] }) },
      { key: 'gtm_catalog_v1', value: JSON.stringify({ schemaVersion: 1, items: [null] }) },
      { key: 'gtm_manual_items_v1', value: JSON.stringify({ schemaVersion: 1, items: [{ id: 'manual:1' }] }) },
      { key: 'gtm_catalog_usage_v1', value: JSON.stringify({ schemaVersion: 1, usageById: { item: 'twice' } }) }
    ];
    for (const entry of malformedEntries) {
      await expect(createBackupEnvelope({ ...common, localStorageEntries: [entry] })).rejects.toThrow(/invalid|supported/);
    }
  });

  it('rejects domain-invalid supporting records and unknown recovery-store names', async () => {
    const repository = makeRepository();
    await repository.createDraftWithCustomer(legacyQuoteToQuoteContent(makeLegacyQuote()));
    const snapshot = await repository.exportSnapshot();
    snapshot.stores.customers[0].companyName = '   ';
    snapshot.stores.quoteEvents[0].type = 'invented_event';
    snapshot.stores.recoveryRecords.push({
      id: 'recovery-unknown-store', schemaVersion: 1, storeName: 'unknownStore', originalKey: 'bad',
      detectedAt: '2026-08-03T13:00:00.000Z', errors: ['fixture'], rawRecord: { id: 'bad' }
    });

    await expect(createBackupEnvelope({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: snapshot.stores.settings[0].deviceId,
      quoteDatabase: snapshot
    })).rejects.toThrow(/Customer .* invalid|invalid type|Recovery record .* invalid/);
  });

  it('rejects cross-quote version ownership and incomplete immutable-history links', async () => {
    const repository = makeRepository();
    const firstDraft = await repository.createDraftFromLegacyQuote(makeLegacyQuote('First Company'));
    const secondDraft = await repository.createDraftFromLegacyQuote(makeLegacyQuote('Second Company'));
    await repository.finalizeBase(firstDraft.id, { numberYear: 2026 });
    await repository.finalizeBase(secondDraft.id, { numberYear: 2026 });
    const snapshot = await repository.exportSnapshot();
    const firstQuote = snapshot.stores.quotes.find(({ id }) => id === firstDraft.id);
    const secondVersion = snapshot.stores.quoteVersions.find(({ quoteId }) => quoteId === secondDraft.id);
    const firstEvent = snapshot.stores.quoteEvents.find(({ quoteId, quoteVersionId }) => quoteId === firstDraft.id && quoteVersionId);
    firstQuote.latestVersionId = secondVersion.id;
    firstEvent.quoteVersionId = secondVersion.id;

    await expect(createBackupEnvelope({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: snapshot.stores.settings[0].deviceId,
      quoteDatabase: snapshot
    })).rejects.toThrow(/latest version belongs to a different quote|owned by a different quote/);
  });

  it('rejects impossible aggregate states, invalid timestamps, and missing revision lineage', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const baseVersion = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    await repository.startRevision(draft.id, baseVersion.id);
    const revisionVersion = await repository.finalizeRevision(draft.id);
    await repository.startRevision(draft.id, revisionVersion.id);
    const original = await repository.exportSnapshot();
    const common = (quoteDatabase) => ({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: original.stores.settings[0].deviceId,
      quoteDatabase
    });

    const missingLatest = structuredClone(original);
    delete missingLatest.stores.quotes[0].latestVersionId;
    await expect(createBackupEnvelope(common(missingLatest))).rejects.toThrow('requires a base number and latest version');

    const invalidTimes = structuredClone(original);
    invalidTimes.stores.quotes[0].updatedAt = 'not-a-date';
    invalidTimes.stores.quoteVersions[0].finalizedAt = null;
    await expect(createBackupEnvelope(common(invalidTimes))).rejects.toThrow(/invalid timestamps|invalid immutable timestamps/);

    const missingLineage = structuredClone(original);
    const revision = missingLineage.stores.quoteVersions.find(({ revisionNumber }) => revisionNumber === 1);
    delete revision.basedOnVersionId;
    await expect(createBackupEnvelope(common(missingLineage))).rejects.toThrow('requires a based-on version');

    const skippedRevision = structuredClone(original);
    skippedRevision.stores.quoteVersions.find(({ revisionNumber }) => revisionNumber === 1).revisionNumber = 2;
    skippedRevision.stores.quoteVersions.find(({ revisionNumber }) => revisionNumber === 2).displayNumber = '2026-001-R2';
    await expect(createBackupEnvelope(common(skippedRevision))).rejects.toThrow('revision history must be contiguous');

    const reopenedBase = structuredClone(original);
    reopenedBase.stores.quotes[0].currentStatus = 'draft';
    reopenedBase.stores.quotes[0].workingDraft = {
      kind: 'base', content: reopenedBase.stores.quoteVersions[0].content, lastSavedAt: '2026-08-03T13:00:00.000Z'
    };
    await expect(createBackupEnvelope(common(reopenedBase))).rejects.toThrow('cannot reopen a base draft');

    const staleRevisionSource = structuredClone(original);
    staleRevisionSource.stores.quotes[0].workingDraft.basedOnVersionId = baseVersion.id;
    await expect(createBackupEnvelope(common(staleRevisionSource))).rejects.toThrow('must be based on its latest finalized version');
  });

  it('rejects unsafe or stale numbering counters that could collide after restore', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    await repository.finalizeBase(draft.id, { numberYear: 2026 });
    const original = await repository.exportSnapshot();
    const common = (quoteDatabase) => ({
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: original.stores.settings[0].deviceId,
      quoteDatabase
    });

    const stale = structuredClone(original);
    stale.stores.settings[0].numbering['2026'].lastBaseSequence = 0;
    await expect(createBackupEnvelope(common(stale))).rejects.toThrow('behind finalized quote');

    const unsafe = structuredClone(original);
    unsafe.stores.settings[0].numbering['2026'].lastBaseSequence = Number.MAX_SAFE_INTEGER + 1;
    await expect(createBackupEnvelope(common(unsafe))).rejects.toThrow('outside the supported range');

    const invalidYear = structuredClone(original);
    invalidYear.stores.settings[0].numbering['0000'] = { year: 0, lastBaseSequence: 1 };
    await expect(createBackupEnvelope(common(invalidYear))).rejects.toThrow('outside the supported range');
  });

  it('returns a validation report for malformed records and rejects non-JSON-safe recovery data', async () => {
    const repository = makeRepository();
    await repository.initialize();
    const quoteDatabase = await repository.exportSnapshot();
    const values = {
      applicationVersion: '2.5.0-alpha.1',
      exportedAt: '2026-08-03T13:00:00.000Z',
      sourceDeviceId: quoteDatabase.stores.settings[0].deviceId,
      quoteDatabase
    };
    const valid = await createBackupEnvelope(values);
    valid.payload.quoteDatabase.stores.quotes.push(null);
    await expect(validateBackupEnvelope(valid)).resolves.toMatchObject({ valid: false, errors: expect.any(Array) });

    const circular = {};
    circular.self = circular;
    const unsafeRecords = [
      { createdAt: new Date('2026-08-03T13:00:00.000Z') },
      { value: 1n },
      { values: [undefined] },
      { value: Number.POSITIVE_INFINITY },
      { value: -0 },
      circular
    ];
    for (const [index, rawRecord] of unsafeRecords.entries()) {
      const unsafe = structuredClone(quoteDatabase);
      unsafe.stores.recoveryRecords.push({
        id: `recovery-${index}`,
        schemaVersion: 1,
        storeName: 'quotes',
        originalKey: 'damaged',
        detectedAt: '2026-08-03T13:00:00.000Z',
        errors: ['fixture'],
        rawRecord
      });
      await expect(createBackupEnvelope({ ...values, quoteDatabase: unsafe })).rejects.toThrow(/unsupported|undefined|non-JSON-safe|circular/);
    }
  });

  it('uses prototype-safe canonical JSON and snapshots recovery keys without parsing them', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    expect(canonicalJson(hostile)).toBe('{"__proto__":{"polluted":true},"safe":1}');
    expect({}.polluted).toBeUndefined();

    const storage = memoryStorage({
      gtm_quote_calculator_v1_recovery_1: '{not-json',
      gtm_quote_library_signal_v1: 'ignore'
    });
    expect(snapshotBackupLocalStorage(storage)).toEqual([
      { key: 'gtm_quote_calculator_v1_recovery_1', value: '{not-json' }
    ]);
  });
});
