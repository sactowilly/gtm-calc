import { analyzeRestoreCandidate } from '../domain/backup-restore-analysis.js';
import { validateBackupEnvelope } from '../domain/backup-envelope.js';

export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

export class BackupRestoreInspectionError extends Error {
  constructor(message, { code = 'inspection-failed', validationCategories = [] } = {}) {
    super(message);
    this.name = 'BackupRestoreInspectionError';
    this.code = code;
    this.validationCategories = validationCategories;
  }
}

function formatFileSize(byteCount) {
  if (!Number.isSafeInteger(byteCount) || byteCount < 0) return 'Unknown size';
  if (byteCount === 1) return '1 byte';
  if (byteCount < 1024) return `${byteCount} bytes`;
  const kibibytes = byteCount / 1024;
  if (kibibytes < 1024) return `${Number(kibibytes.toFixed(1))} KB`;
  return `${Number((kibibytes / 1024).toFixed(1))} MB`;
}

function catalogItemCount(envelope, storageKey) {
  const entry = (envelope?.payload?.localStorage?.entries || []).find(({ key }) => key === storageKey);
  if (!entry) return 0;
  try {
    const parsed = JSON.parse(entry.value);
    return Array.isArray(parsed.items) ? parsed.items.length : 0;
  } catch {
    return 0;
  }
}

function inspectionMetadata(file, incomingEnvelope) {
  const stores = incomingEnvelope.payload.quoteDatabase.stores;
  return {
    filename: typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'selected-backup.json',
    formattedSize: formatFileSize(file.size),
    schemaVersion: incomingEnvelope.backupSchemaVersion,
    exportedAt: incomingEnvelope.exportedAt,
    recordCounts: {
      quotes: stores.quotes.length,
      finalizedVersions: stores.quoteVersions.length,
      customers: stores.customers.length,
      catalogItems: catalogItemCount(incomingEnvelope, 'gtm_catalog_v1'),
      manualItems: catalogItemCount(incomingEnvelope, 'gtm_manual_items_v1')
    }
  };
}

function classifyValidationErrors(errors) {
  const categories = new Set();
  errors.forEach((error) => {
    const message = String(error).toLowerCase();
    if (message.includes('checksum') || message.includes('content hash')) categories.add('integrity');
    else if (message.includes('schema') || message.includes('format') || message.includes('database name')) categories.add('unsupported-format');
    else if (message.includes('reference') || message.includes('belongs') || message.includes('missing customer') || message.includes('missing contact')) categories.add('reference-integrity');
    else if (message.includes('duplicate')) categories.add('duplicate-record');
    else if (message.includes('number')) categories.add('numbering');
    else categories.add('invalid-record');
  });
  return [...categories].sort();
}

function assertFileSize(file, maxBytes) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0) {
    throw new BackupRestoreInspectionError('Choose a valid backup file to inspect.', { code: 'file-unavailable' });
  }
  if (file.size > maxBytes) {
    throw new BackupRestoreInspectionError('This backup file is larger than the supported 25 MiB inspection limit.', { code: 'file-too-large' });
  }
  if (typeof file.arrayBuffer !== 'function') {
    throw new BackupRestoreInspectionError('This browser cannot safely read the selected backup file.', { code: 'file-unreadable' });
  }
}

async function readStrictUtf8Json(file, { maxBytes, TextDecoderType }) {
  const bytes = await file.arrayBuffer();
  if (!(bytes instanceof ArrayBuffer)) {
    throw new BackupRestoreInspectionError('This browser did not return a readable backup file.', { code: 'file-unreadable' });
  }
  if (bytes.byteLength > maxBytes) {
    throw new BackupRestoreInspectionError('This backup file is larger than the supported 25 MiB inspection limit.', { code: 'file-too-large' });
  }
  let text;
  try {
    text = new TextDecoderType('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BackupRestoreInspectionError('The selected file is not valid UTF-8 JSON.', { code: 'invalid-utf8' });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupRestoreInspectionError('The selected file does not contain valid JSON.', { code: 'invalid-json' });
  }
}

async function assertValidatedEnvelope(envelope, { cryptoProvider, current = false }) {
  const validation = await validateBackupEnvelope(envelope, cryptoProvider);
  if (!validation.valid) {
    throw new BackupRestoreInspectionError(
      current ? 'Current device data could not be safely inspected. No restore action is available.' : 'The selected backup failed safety validation.',
      { code: current ? 'current-data-invalid' : 'backup-invalid', validationCategories: classifyValidationErrors(validation.errors) }
    );
  }
  return envelope;
}

/**
 * Reads and inspects a candidate backup without changing IndexedDB, localStorage, or
 * repository state. The current snapshot is deliberately created only after the
 * incoming file has passed parsing and full envelope validation.
 */
export function createBackupRestoreInspectionService({
  backupService,
  beforeInspect = async () => {},
  maxBytes = MAX_BACKUP_FILE_BYTES,
  TextDecoderType = globalThis.TextDecoder,
  cryptoProvider = globalThis.crypto
} = {}) {
  if (!backupService?.createBackup) throw new Error('A backup service with createBackup() is required.');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('A positive maximum backup size is required.');
  if (typeof TextDecoderType !== 'function') throw new Error('A UTF-8 TextDecoder is required.');

  return {
    async inspectBackupFile(file, { onProgress = () => {} } = {}) {
      // The declared-size guard runs before any readiness work or file read.
      assertFileSize(file, maxBytes);
      await beforeInspect();
      onProgress('reading');
      const incomingEnvelope = await readStrictUtf8Json(file, { maxBytes, TextDecoderType });
      onProgress('validating');
      await assertValidatedEnvelope(incomingEnvelope, { cryptoProvider });

      // Do not snapshot current data until the candidate is known to be safe to inspect.
      onProgress('comparing');
      const currentEnvelope = await backupService.createBackup();
      await assertValidatedEnvelope(currentEnvelope, { cryptoProvider, current: true });

      return {
        ...inspectionMetadata(file, incomingEnvelope),
        ...analyzeRestoreCandidate({ incomingEnvelope, currentEnvelope })
      };
    },
    async inspectFile(file, options) {
      return this.inspectBackupFile(file, options);
    }
  };
}
