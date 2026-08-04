import { validateBackupEnvelope } from '../domain/backup-envelope.js';

export class BackupValidationError extends Error {
  constructor(errors = []) {
    super('The complete backup did not pass validation.');
    this.name = 'BackupValidationError';
    this.errors = [...errors];
  }
}

export class BackupDownloadError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'BackupDownloadError';
  }
}

export function getBackupFilename(exportedAt) {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) throw new BackupDownloadError('The backup export date is invalid.');
  return `gtm-calc-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function serializeBackupEnvelope(envelope) {
  try {
    return `${JSON.stringify(envelope, null, 2)}\n`;
  } catch (error) {
    throw new BackupDownloadError('The backup could not be serialized.', { cause: error });
  }
}

export function formatBackupSize(byteCount) {
  const bytes = Number(byteCount);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export function getBackupRecordCounts(envelope) {
  const stores = envelope.payload.quoteDatabase.stores;
  return {
    quotes: stores.quotes.length,
    finalizedVersions: stores.quoteVersions.length,
    events: stores.quoteEvents.length,
    customers: stores.customers.length,
    contacts: stores.contacts.length,
    recoveryRecords: stores.recoveryRecords.length,
    localStorageEntries: envelope.payload.localStorage.entries.length,
    indexedDbRecords: Object.values(stores).reduce((total, records) => total + records.length, 0)
  };
}

export function triggerBlobDownload({
  blob,
  filename,
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  schedule = globalThis.setTimeout
}) {
  if (!documentRef?.body || !urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new BackupDownloadError('This browser cannot start a local backup download.');
  }

  let objectUrl;
  let anchor;
  try {
    objectUrl = urlApi.createObjectURL(blob);
    anchor = documentRef.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    anchor.rel = 'noopener';
    documentRef.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    throw new BackupDownloadError('The browser could not start the backup download.', { cause: error });
  } finally {
    anchor?.remove();
    if (objectUrl) {
      try {
        schedule(() => urlApi.revokeObjectURL(objectUrl), 1000);
      } catch (error) {
        urlApi.revokeObjectURL(objectUrl);
      }
    }
  }
}

export function createBackupDownloadService({
  backupService,
  beforeCreate = async () => {},
  validate = validateBackupEnvelope,
  BlobType = globalThis.Blob,
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  schedule = globalThis.setTimeout
}) {
  if (!backupService?.createBackup) throw new Error('A backup service is required.');

  return {
    async downloadCompleteBackup({ onProgress = () => {} } = {}) {
      onProgress('preparing');
      if (typeof BlobType !== 'function') {
        throw new BackupDownloadError('This browser cannot prepare a local backup file.');
      }
      await beforeCreate();
      const envelope = await backupService.createBackup();

      onProgress('validating');
      const initialReport = await validate(envelope);
      if (!initialReport.valid) throw new BackupValidationError(initialReport.errors);

      const serialized = serializeBackupEnvelope(envelope);
      let serializedEnvelope;
      try {
        serializedEnvelope = JSON.parse(serialized);
      } catch (error) {
        throw new BackupDownloadError('The serialized backup could not be read.', { cause: error });
      }
      const serializedReport = await validate(serializedEnvelope);
      if (!serializedReport.valid) throw new BackupValidationError(serializedReport.errors);

      onProgress('downloading');
      let blob;
      try {
        blob = new BlobType([serialized], { type: 'application/json;charset=utf-8' });
      } catch (error) {
        throw new BackupDownloadError('The browser could not prepare the backup file.', { cause: error });
      }
      const filename = getBackupFilename(envelope.exportedAt);
      const formattedSize = formatBackupSize(blob.size);
      const counts = getBackupRecordCounts(envelope);
      triggerBlobDownload({ blob, filename, documentRef, urlApi, schedule });
      onProgress('complete');
      return {
        envelope,
        filename,
        byteCount: blob.size,
        formattedSize,
        counts
      };
    }
  };
}
