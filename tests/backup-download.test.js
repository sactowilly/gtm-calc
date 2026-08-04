import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { validateBackupEnvelope } from '../js/domain/backup-envelope.js';
import {
  BackupDownloadError,
  BackupValidationError,
  createBackupDownloadService,
  formatBackupSize,
  getBackupFilename,
  serializeBackupEnvelope
} from '../js/services/backup-download-service.js';
import { createBackupService } from '../js/services/backup-service.js';
import { createQuoteLibraryRepository } from '../js/services/indexeddb-quote-repository.js';

let repository;
let validBackup;

function memoryStorage() {
  return {
    length: 0,
    key() { return null; },
    getItem() { return null; }
  };
}

function downloadEnvironment({ clickError, createUrlError } = {}) {
  let capturedBlob;
  const anchor = {
    href: '',
    download: '',
    hidden: false,
    rel: '',
    click: vi.fn(() => {
      if (clickError) throw clickError;
    }),
    remove: vi.fn()
  };
  const documentRef = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => anchor)
  };
  const urlApi = {
    createObjectURL: vi.fn((blob) => {
      if (createUrlError) throw createUrlError;
      capturedBlob = blob;
      return 'blob:test-backup';
    }),
    revokeObjectURL: vi.fn()
  };
  const schedule = vi.fn((callback) => callback());
  return { anchor, documentRef, urlApi, schedule, getBlob: () => capturedBlob };
}

beforeAll(async () => {
  repository = createQuoteLibraryRepository({
    databaseName: 'backup-download-test',
    idFactory: () => 'download-device-id',
    now: () => '2026-08-04T12:00:00.000Z'
  });
  await repository.initialize();
  validBackup = await createBackupService({
    quoteRepository: repository,
    storage: memoryStorage(),
    applicationVersion: '2.5.0-alpha.2',
    now: () => '2026-08-04T23:59:59.000-07:00'
  }).createBackup();
});

afterAll(async () => {
  await repository.destroy();
});

describe('Version 2.5 complete-backup download', () => {
  it('creates a deterministic date-only filename from the envelope UTC timestamp', () => {
    expect(getBackupFilename('2026-08-04T23:59:59.000-07:00')).toBe('gtm-calc-backup-2026-08-05.json');
    expect(() => getBackupFilename('not-a-date')).toThrow(BackupDownloadError);
  });

  it('formats exact byte boundaries without treating characters as bytes', () => {
    expect(formatBackupSize(0)).toBe('0 bytes');
    expect(formatBackupSize(1)).toBe('1 byte');
    expect(formatBackupSize(1023)).toBe('1023 bytes');
    expect(formatBackupSize(1024)).toBe('1 KB');
    expect(formatBackupSize(1536)).toBe('1.5 KB');
    expect(formatBackupSize(1024 * 1024)).toBe('1 MB');
    expect(formatBackupSize(-1)).toBe('Unknown size');
  });

  it('validates the exact readable JSON bytes before requesting one Blob download', async () => {
    const environment = downloadEnvironment();
    const stages = [];
    const service = createBackupDownloadService({
      backupService: { createBackup: vi.fn(async () => structuredClone(validBackup)) },
      beforeCreate: vi.fn(async () => {}),
      ...environment
    });

    const result = await service.downloadCompleteBackup({ onProgress: (stage) => stages.push(stage) });
    const downloadedText = await environment.getBlob().text();
    const parsed = JSON.parse(downloadedText);

    expect(await validateBackupEnvelope(parsed)).toEqual({ valid: true, errors: [] });
    expect(downloadedText).toBe(serializeBackupEnvelope(validBackup));
    expect(environment.getBlob().type).toBe('application/json;charset=utf-8');
    expect(result.byteCount).toBe(new TextEncoder().encode(downloadedText).byteLength);
    expect(result.filename).toBe('gtm-calc-backup-2026-08-05.json');
    expect(environment.anchor.download).toBe(result.filename);
    expect(environment.anchor.click).toHaveBeenCalledTimes(1);
    expect(environment.anchor.remove).toHaveBeenCalledTimes(1);
    expect(environment.urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test-backup');
    expect(stages).toEqual(['preparing', 'validating', 'downloading', 'complete']);
  });

  it('waits for repository readiness before reading data or creating a download', async () => {
    const environment = downloadEnvironment();
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    const createBackup = vi.fn(async () => structuredClone(validBackup));
    const service = createBackupDownloadService({
      backupService: { createBackup },
      beforeCreate: () => ready,
      ...environment
    });

    const download = service.downloadCompleteBackup();
    await Promise.resolve();
    expect(createBackup).not.toHaveBeenCalled();
    expect(environment.urlApi.createObjectURL).not.toHaveBeenCalled();
    expect(environment.anchor.click).not.toHaveBeenCalled();

    resolveReady();
    await download;
    expect(createBackup).toHaveBeenCalledTimes(1);
    expect(environment.anchor.click).toHaveBeenCalledTimes(1);
  });

  it('does not create a Blob URL or click when validation fails', async () => {
    const environment = downloadEnvironment();
    const damaged = structuredClone(validBackup);
    damaged.payloadChecksum = '0'.repeat(64);
    const service = createBackupDownloadService({
      backupService: { createBackup: async () => damaged },
      ...environment
    });

    await expect(service.downloadCompleteBackup()).rejects.toBeInstanceOf(BackupValidationError);
    expect(environment.urlApi.createObjectURL).not.toHaveBeenCalled();
    expect(environment.anchor.click).not.toHaveBeenCalled();
  });

  it('reports missing Blob support on demand without breaking app initialization', async () => {
    const environment = downloadEnvironment();
    const createBackup = vi.fn(async () => structuredClone(validBackup));
    const service = createBackupDownloadService({
      backupService: { createBackup },
      BlobType: null,
      ...environment
    });

    await expect(service.downloadCompleteBackup()).rejects.toBeInstanceOf(BackupDownloadError);
    expect(createBackup).not.toHaveBeenCalled();
    expect(environment.urlApi.createObjectURL).not.toHaveBeenCalled();
    expect(environment.anchor.click).not.toHaveBeenCalled();
  });

  it('removes the temporary anchor and revokes sensitive Blob data when click fails', async () => {
    const environment = downloadEnvironment({ clickError: new Error('blocked') });
    const service = createBackupDownloadService({
      backupService: { createBackup: async () => structuredClone(validBackup) },
      ...environment
    });

    await expect(service.downloadCompleteBackup()).rejects.toBeInstanceOf(BackupDownloadError);
    expect(environment.anchor.remove).toHaveBeenCalledTimes(1);
    expect(environment.urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test-backup');
  });

  it('reports object-URL setup failure without clicking or claiming a download', async () => {
    const environment = downloadEnvironment({ createUrlError: new Error('unavailable') });
    const service = createBackupDownloadService({
      backupService: { createBackup: async () => structuredClone(validBackup) },
      ...environment
    });

    await expect(service.downloadCompleteBackup()).rejects.toBeInstanceOf(BackupDownloadError);
    expect(environment.anchor.click).not.toHaveBeenCalled();
    expect(environment.urlApi.revokeObjectURL).not.toHaveBeenCalled();
  });
});
