import {
  MUTABLE_CONFLICT_POLICY,
  RESTORE_MODE,
  planRestoreTransaction,
  restoreSummary,
  snapshotFromValidatedBackup
} from '../domain/backup-restore-transaction.js';
import { canonicalJson } from '../domain/quote-library.js';
import { isBackupLocalStorageKey } from '../domain/storage-contract.js';
import { createBackupEnvelope, validateBackupEnvelope } from '../domain/backup-envelope.js';
import {
  formatBackupSize,
  getBackupFilename,
  serializeBackupEnvelope
} from './backup-download-service.js';
import { MAX_BACKUP_FILE_BYTES } from './backup-restore-inspection-service.js';

export class BackupRestoreTransactionError extends Error {
  constructor(message, { code = 'restore-failed', validationCategories = [] } = {}) {
    super(message);
    this.name = 'BackupRestoreTransactionError';
    this.code = code;
    this.validationCategories = validationCategories;
  }
}

function assertFile(file, maxBytes) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.arrayBuffer !== 'function') {
    throw new BackupRestoreTransactionError('Choose a valid backup file before restoring.', { code: 'file-unavailable' });
  }
  if (file.size > maxBytes) {
    throw new BackupRestoreTransactionError('This backup file is larger than the supported 25 MiB restore limit.', { code: 'file-too-large' });
  }
}

async function parseBackupFile(file, { maxBytes, TextDecoderType }) {
  assertFile(file, maxBytes);
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch (error) {
    throw new BackupRestoreTransactionError('The selected backup file could not be read.', { code: 'file-unreadable' });
  }
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > maxBytes) {
    throw new BackupRestoreTransactionError('The selected backup file could not be read safely.', {
      code: bytes?.byteLength > maxBytes ? 'file-too-large' : 'file-unreadable'
    });
  }
  let text;
  try {
    text = new TextDecoderType('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BackupRestoreTransactionError('The selected backup is not valid UTF-8 JSON.', { code: 'invalid-utf8' });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupRestoreTransactionError('The selected backup does not contain valid JSON.', { code: 'invalid-json' });
  }
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

async function assertValidEnvelope(envelope, { validate, cryptoProvider, current = false } = {}) {
  const result = await validate(envelope, cryptoProvider);
  if (!result.valid) {
    throw new BackupRestoreTransactionError(
      current ? 'Current device data could not be safely validated. No restore was started.' : 'The selected backup failed safety validation.',
      {
        code: current ? 'current-data-invalid' : 'backup-invalid',
        validationCategories: classifyValidationErrors(result.errors || [])
      }
    );
  }
  return envelope;
}

function storageEntriesToMap(entries) {
  return new Map((entries || []).map((entry) => [entry.key, entry.value]));
}

function scopedStorageKeys(storage) {
  const keys = new Set();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isBackupLocalStorageKey(key)) keys.add(key);
  }
  return keys;
}

function currentScopedStorageEntries(storage) {
  return [...scopedStorageKeys(storage)]
    .map((key) => ({ key, value: storage.getItem(key) }))
    .filter((entry) => entry.value !== null)
    .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
}

function storagePlan({ incomingEntries, currentEntries, mode, mutableConflictPolicy }) {
  const incoming = storageEntriesToMap(incomingEntries);
  const current = storageEntriesToMap(currentEntries);
  const desired = mode === RESTORE_MODE.REPLACE ? new Map(incoming) : new Map(current);
  const summary = { created: 0, identical: 0, keptCurrent: 0, replaced: 0, removed: 0 };
  if (mode === RESTORE_MODE.MERGE) {
    incoming.forEach((value, key) => {
      if (!current.has(key)) {
        desired.set(key, value);
        summary.created += 1;
      } else if (current.get(key) === value) {
        summary.identical += 1;
      } else if (mutableConflictPolicy === MUTABLE_CONFLICT_POLICY.REPLACE_WITH_BACKUP) {
        desired.set(key, value);
        summary.replaced += 1;
      } else {
        summary.keptCurrent += 1;
      }
    });
  } else {
    incoming.forEach((value, key) => {
      if (!current.has(key)) summary.created += 1;
      else if (current.get(key) === value) summary.identical += 1;
      else summary.replaced += 1;
    });
    current.forEach((_, key) => {
      if (!incoming.has(key)) summary.removed += 1;
    });
  }
  return { desired, summary };
}

function applyStorageMap(storage, desired) {
  const keys = scopedStorageKeys(storage);
  desired.forEach((value, key) => keys.add(key));
  keys.forEach((key) => {
    if (desired.has(key)) storage.setItem(key, desired.get(key));
    else storage.removeItem(key);
  });
}

function snapshotFromEnvelope(envelope) {
  return snapshotFromValidatedBackup(envelope);
}

async function validateProjectedRestore({
  projectedSnapshot,
  projectedStorageEntries,
  applicationVersion,
  now,
  cryptoProvider,
  validate
}) {
  const settings = projectedSnapshot.stores.settings.find((record) => record.id === 'application');
  if (!settings?.deviceId) throw new BackupRestoreTransactionError('The projected restore is missing device settings.', { code: 'projected-data-invalid' });
  const envelope = await createBackupEnvelope({
    applicationVersion,
    exportedAt: now(),
    sourceDeviceId: settings.deviceId,
    quoteDatabase: projectedSnapshot,
    localStorageEntries: projectedStorageEntries
  }, cryptoProvider);
  await assertValidEnvelope(envelope, { validate, cryptoProvider });
  return envelope;
}

function safeRestoreSummary(databaseSummary, localStorageSummary) {
  return {
    mode: databaseSummary.mode,
    mutableConflictPolicy: databaseSummary.mutableConflictPolicy,
    immutableConflictCount: databaseSummary.immutableConflictCount,
    created: databaseSummary.created,
    identical: databaseSummary.identical,
    keptCurrent: databaseSummary.keptCurrent,
    replaced: databaseSummary.replaced,
    localStorage: { ...localStorageSummary },
    stores: databaseSummary.stores
  };
}

/**
 * Owner-confirmed backup restore coordinator. It validates input again at commit
 * time, requires a current safety-backup download callback before writes, stages
 * only backup-scoped localStorage keys, and compensates both stores if IndexedDB
 * or post-restore verification fails. No network operation is performed here.
 */
export function createBackupRestoreTransactionService({
  backupService,
  quoteRepository,
  storage = globalThis.localStorage,
  beforeRestore = async () => {},
  validate = validateBackupEnvelope,
  TextDecoderType = globalThis.TextDecoder,
  BlobType = globalThis.Blob,
  maxBytes = MAX_BACKUP_FILE_BYTES,
  cryptoProvider = globalThis.crypto,
  now = () => new Date().toISOString()
} = {}) {
  if (!backupService?.createBackup) throw new Error('A backup service with createBackup() is required.');
  if (!quoteRepository?.applyRestoreSnapshot) throw new Error('A quote repository with applyRestoreSnapshot() is required.');
  if (!storage) throw new Error('Browser storage is unavailable.');
  if (typeof TextDecoderType !== 'function' || typeof BlobType !== 'function') throw new Error('Browser file APIs are unavailable.');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('A positive maximum backup size is required.');

  async function prepareEnvelope(envelope, { mode, mutableConflictPolicy } = {}) {
    if (!Object.values(RESTORE_MODE).includes(mode)) throw new BackupRestoreTransactionError('Choose Merge or Replace before restoring.', { code: 'mode-required' });
    if (!Object.values(MUTABLE_CONFLICT_POLICY).includes(mutableConflictPolicy)) {
      throw new BackupRestoreTransactionError('Choose how to handle changed mutable records before restoring.', { code: 'mutable-policy-required' });
    }
    await assertValidEnvelope(envelope, { validate, cryptoProvider });
    const currentEnvelope = await backupService.createBackup();
    await assertValidEnvelope(currentEnvelope, { validate, cryptoProvider, current: true });

    const incomingSnapshot = snapshotFromEnvelope(envelope);
    const currentSnapshot = snapshotFromEnvelope(currentEnvelope);
    const databasePlan = planRestoreTransaction({
      incomingSnapshot,
      currentSnapshot,
      mode,
      mutableConflictPolicy
    });
    if (!databasePlan.allowed) {
      throw new BackupRestoreTransactionError('Restore is blocked by immutable history or quote-number conflicts.', {
        code: 'immutable-conflict'
      });
    }
    const localStoragePlan = storagePlan({
      incomingEntries: envelope.payload.localStorage.entries,
      currentEntries: currentEnvelope.payload.localStorage.entries,
      mode,
      mutableConflictPolicy
    });
    const projectedStorageEntries = [...localStoragePlan.desired.entries()]
      .map(([key, value]) => ({ key, value }))
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    const projectedEnvelope = await validateProjectedRestore({
      projectedSnapshot: databasePlan.projectedSnapshot,
      projectedStorageEntries,
      applicationVersion: currentEnvelope.applicationVersion,
      now,
      cryptoProvider,
      validate
    });
    return {
      incomingEnvelope: envelope,
      currentEnvelope,
      currentSnapshot,
      databasePlan,
      localStoragePlan,
      projectedEnvelope,
      projectedStorageEntries
    };
  }

  return {
    async prepareRestoreFile(file, { mode, mutableConflictPolicy = MUTABLE_CONFLICT_POLICY.KEEP_CURRENT, onProgress = () => {} } = {}) {
      assertFile(file, maxBytes);
      await beforeRestore();
      onProgress('reading');
      const envelope = await parseBackupFile(file, { maxBytes, TextDecoderType });
      onProgress('validating');
      const prepared = await prepareEnvelope(envelope, { mode, mutableConflictPolicy });
      return {
        mode,
        mutableConflictPolicy,
        restoreSummary: safeRestoreSummary(restoreSummary(prepared.databasePlan), prepared.localStoragePlan.summary)
      };
    },

    async restoreBackupFile(file, {
      mode,
      mutableConflictPolicy = MUTABLE_CONFLICT_POLICY.KEEP_CURRENT,
      confirmation,
      onProgress = () => {},
      onSafetyBackupDownload
    } = {}) {
      if (confirmation !== 'RESTORE') {
        throw new BackupRestoreTransactionError('Type RESTORE to confirm this local restore.', { code: 'confirmation-required' });
      }
      if (typeof onSafetyBackupDownload !== 'function') {
        throw new BackupRestoreTransactionError('A current-data safety backup download is required before restoring.', { code: 'safety-backup-required' });
      }
      assertFile(file, maxBytes);
      await beforeRestore();
      onProgress('reading');
      const incomingEnvelope = await parseBackupFile(file, { maxBytes, TextDecoderType });
      onProgress('validating');
      const prepared = await prepareEnvelope(incomingEnvelope, { mode, mutableConflictPolicy });

      onProgress('safety-backup');
      const safetySerialized = serializeBackupEnvelope(prepared.currentEnvelope);
      let safetyBlob;
      try {
        safetyBlob = new BlobType([safetySerialized], { type: 'application/json;charset=utf-8' });
      } catch (error) {
        throw new BackupRestoreTransactionError('The current-data safety backup could not be prepared.', { code: 'safety-backup-failed' });
      }
      const safetyBackup = {
        filename: getBackupFilename(prepared.currentEnvelope.exportedAt),
        byteCount: safetyBlob.size,
        formattedSize: formatBackupSize(safetyBlob.size),
        blob: safetyBlob
      };
      try {
        const downloadResult = await onSafetyBackupDownload(safetyBackup);
        if (downloadResult === false) throw new Error('Safety backup download was not requested.');
      } catch (error) {
        throw new BackupRestoreTransactionError('The current-data safety backup download did not start. No restore was performed.', { code: 'safety-backup-failed' });
      }

      let storageStaged = false;
      let databaseWritten = false;
      try {
        onProgress('staging');
        if (canonicalJson(currentScopedStorageEntries(storage))
          !== canonicalJson(prepared.currentEnvelope.payload.localStorage.entries)) {
          throw new BackupRestoreTransactionError('Browser storage changed after restore preparation. Inspect the backup again before restoring.', {
            code: 'restore-conflict'
          });
        }
        // Mark before the first mutation so a quota/security failure half-way through
        // localStorage staging still restores the exact scoped preflight state.
        storageStaged = true;
        applyStorageMap(storage, prepared.localStoragePlan.desired);
        onProgress('writing');
        await quoteRepository.applyRestoreSnapshot({
          mode,
          // The plan is the normalized approved input. In particular it retains
          // this browser's deviceId while restoring portable settings/numbering.
          snapshot: prepared.databasePlan.projectedSnapshot,
          mutableConflictPolicy,
          expectedCurrentSnapshot: prepared.currentSnapshot
        });
        databaseWritten = true;

        onProgress('verifying');
        const postRestoreEnvelope = await backupService.createBackup();
        await assertValidEnvelope(postRestoreEnvelope, { validate, cryptoProvider, current: true });
        if (canonicalJson(postRestoreEnvelope.payload) !== canonicalJson(prepared.projectedEnvelope.payload)) {
          throw new BackupRestoreTransactionError('Post-restore verification did not match the approved restore plan.', { code: 'post-restore-mismatch' });
        }
        onProgress('complete');
        return {
          mode,
          safetyBackup: {
            filename: safetyBackup.filename,
            byteCount: safetyBackup.byteCount,
            formattedSize: safetyBackup.formattedSize
          },
          restoreSummary: safeRestoreSummary(restoreSummary(prepared.databasePlan), prepared.localStoragePlan.summary)
        };
      } catch (error) {
        // localStorage cannot share IndexedDB's transaction. Restore its exact scoped
        // preflight snapshot and, if needed, restore IndexedDB atomically from the
        // validated current snapshot before surfacing a failure.
        const rollbackFailures = [];
        if (databaseWritten) {
          try {
            await quoteRepository.applyRestoreSnapshot({
              mode: RESTORE_MODE.REPLACE,
              snapshot: prepared.currentSnapshot,
              mutableConflictPolicy: MUTABLE_CONFLICT_POLICY.REPLACE_WITH_BACKUP
            });
          } catch (rollbackError) {
            rollbackFailures.push('quote library');
          }
        }
        if (storageStaged) {
          try {
            applyStorageMap(storage, storageEntriesToMap(prepared.currentEnvelope.payload.localStorage.entries));
          } catch (rollbackError) {
            rollbackFailures.push('browser storage');
          }
        }
        if (rollbackFailures.length) {
          throw new BackupRestoreTransactionError(`Restore failed and automatic recovery needs attention for ${rollbackFailures.join(' and ')}.`, {
            code: 'rollback-failed'
          });
        }
        if (error instanceof BackupRestoreTransactionError) throw error;
        if (String(error?.message || '').includes('changed after restore preparation')
          || String(error?.message || '').includes('blocked by immutable')) {
          throw new BackupRestoreTransactionError('This device changed after the backup was inspected. Restore was stopped before commit.', {
            code: 'restore-conflict'
          });
        }
        throw new BackupRestoreTransactionError('Restore failed before it could be committed. Current data was restored.', { code: 'restore-failed' });
      }
    }
  };
}
