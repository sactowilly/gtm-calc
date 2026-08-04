import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackupService } from '../js/services/backup-service.js';
import { analyzeRestoreCandidate } from '../js/domain/backup-restore-analysis.js';
import { QUOTE_LIBRARY_STORES } from '../js/domain/storage-contract.js';
import {
  BackupRestoreInspectionError,
  MAX_BACKUP_FILE_BYTES,
  createBackupRestoreInspectionService
} from '../js/services/backup-restore-inspection-service.js';
import { createQuoteLibraryRepository } from '../js/services/indexeddb-quote-repository.js';

let repositoryIndex = 0;
const repositories = [];

function memoryStorage() {
  return { length: 0, key() { return null; }, getItem() { return null; } };
}

async function createValidBackup() {
  const repository = createQuoteLibraryRepository({
    databaseName: `restore-inspection-${repositoryIndex += 1}`,
    idFactory: () => `device-${repositoryIndex}`,
    now: () => '2026-08-04T12:00:00.000Z'
  });
  repositories.push(repository);
  await repository.initialize();
  return createBackupService({
    quoteRepository: repository,
    storage: memoryStorage(),
    applicationVersion: '2.5.0-alpha.2',
    now: () => '2026-08-04T12:00:00.000Z'
  }).createBackup();
}

function fileFromBytes(bytes, { size = bytes.byteLength, onRead } = {}) {
  return {
    size,
    arrayBuffer: vi.fn(async () => {
      onRead?.();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    })
  };
}

function fileFromJson(value, options) {
  return fileFromBytes(new TextEncoder().encode(JSON.stringify(value)), options);
}

function emptyStores() {
  return Object.fromEntries(Object.values(QUOTE_LIBRARY_STORES).map((storeName) => [storeName, []]));
}

function analysisEnvelope({ sourceDeviceId, stores, entries = [] }) {
  return {
    sourceDeviceId,
    payload: {
      quoteDatabase: { stores: { ...emptyStores(), ...stores } },
      localStorage: { entries }
    }
  };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()));
});

describe('Version 2.5 restore inspection', () => {
  it('rejects a file over 25 MiB before readiness work, a current snapshot, or file reading', async () => {
    const beforeInspect = vi.fn();
    const createBackup = vi.fn();
    const file = { size: MAX_BACKUP_FILE_BYTES + 1, arrayBuffer: vi.fn() };
    const service = createBackupRestoreInspectionService({ backupService: { createBackup }, beforeInspect });

    await expect(service.inspectFile(file)).rejects.toMatchObject({ code: 'file-too-large' });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(beforeInspect).not.toHaveBeenCalled();
    expect(createBackup).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON, invalid UTF-8, unsupported schema, and checksum changes without snapshotting current data', async () => {
    const validBackup = await createValidBackup();
    const malformed = fileFromBytes(new TextEncoder().encode('{not valid json'));
    const invalidUtf8 = fileFromBytes(new Uint8Array([0xc3, 0x28]));
    const unsupported = structuredClone(validBackup);
    unsupported.backupSchemaVersion = 99;
    const tampered = structuredClone(validBackup);
    tampered.payloadChecksum = '0'.repeat(64);

    for (const file of [malformed, invalidUtf8, fileFromJson(unsupported), fileFromJson(tampered)]) {
      const createBackup = vi.fn();
      const service = createBackupRestoreInspectionService({ backupService: { createBackup } });
      await expect(service.inspectFile(file)).rejects.toBeInstanceOf(BackupRestoreInspectionError);
      expect(createBackup).not.toHaveBeenCalled();
    }
  });

  it('awaits readiness, validates the incoming file, then and only then snapshots and validates current data', async () => {
    const validBackup = await createValidBackup();
    const order = [];
    const file = fileFromJson(validBackup, { onRead: () => order.push('file-read') });
    const service = createBackupRestoreInspectionService({
      beforeInspect: async () => { order.push('ready'); },
      backupService: { createBackup: async () => { order.push('current-snapshot'); return structuredClone(validBackup); } }
    });

    const report = await service.inspectBackupFile(file);
    expect(order).toEqual(['ready', 'file-read', 'current-snapshot']);
    expect(report).toMatchObject({
      filename: 'selected-backup.json',
      formattedSize: expect.any(String),
      schemaVersion: 1,
      exportedAt: '2026-08-04T12:00:00.000Z',
      recordCounts: { quotes: 0, finalizedVersions: 0, customers: 0, catalogItems: 0, manualItems: 0 }
    });
    expect(report.incoming.recordCount).toBe(2);
    expect(report.current.recordCount).toBe(2);
  });

  it('returns a text-neutral conflict plan without customer or pricing values', () => {
    const current = analysisEnvelope({
      sourceDeviceId: 'current-device-private',
      stores: {
        quotes: [{ id: 'quote-local-private', baseNumber: '2026-001', customerName: 'Local Customer' }],
        quoteVersions: [{ id: 'version-local-private', displayNumber: '2026-001', contentHash: 'a'.repeat(64), price: 100.5 }],
        quoteEvents: [{ id: 'event-local-private', quoteId: 'quote-local-private', type: 'finalized' }],
        customers: [{ id: 'customer-private', companyName: 'Local Customer' }]
      },
      entries: [{ key: 'gtm_quote_calculator_v1', value: '{"customer":"Local Customer"}' }]
    });
    const incoming = analysisEnvelope({
      sourceDeviceId: 'incoming-device-private',
      stores: {
        quotes: [
          { id: 'quote-local-private', baseNumber: '2026-001', customerName: 'Changed Customer' },
          { id: 'quote-remote-private', baseNumber: '2026-001', customerName: 'Remote Customer' }
        ],
        quoteVersions: [
          { id: 'version-local-private', displayNumber: '2026-001', contentHash: 'b'.repeat(64), price: 200.75 },
          { id: 'version-remote-private', displayNumber: '2026-001', contentHash: 'c'.repeat(64), price: 300.25 }
        ],
        quoteEvents: [{ id: 'event-local-private', quoteId: 'quote-local-private', type: 'cancelled' }],
        customers: [{ id: 'customer-private', companyName: 'Changed Customer' }]
      },
      entries: [{ key: 'gtm_quote_calculator_v1', value: '{"customer":"Changed Customer"}' }]
    });

    const report = analyzeRestoreCandidate({ incomingEnvelope: incoming, currentEnvelope: current });

    expect(report.incoming.sourceDevice).toBe('different-device');
    expect(report.comparison.stores.quotes).toMatchObject({ incoming: 2, new: 1, identical: 0, different: 1 });
    expect(report.comparison.immutableVersions).toEqual({ sameIdDifferentHash: 1, displayNumberDifferentHash: 1 });
    expect(report.comparison.immutableEventConflicts).toBe(1);
    expect(report.comparison.baseNumberCollisions).toBe(1);
    expect(report.comparison.localStorage).toEqual({ incoming: 1, new: 0, identical: 0, different: 1 });
    expect(report.restorePlan.merge).toMatchObject({ blocked: true, immutableConflicts: 3, numberCollisions: 1 });
    expect(report.restorePlan.replace).toMatchObject({ requiresSafetyBackup: true, writePathAvailable: false });
    expect(JSON.stringify(report)).not.toMatch(/Customer|private|100\.5|200\.75|300\.25/);
  });
});
