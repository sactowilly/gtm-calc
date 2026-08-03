import { APP_RELEASE_VERSION } from '../app-meta.js';
import { createBackupEnvelope } from '../domain/backup-envelope.js';
import {
  BACKUP_LOCAL_STORAGE_KEYS,
  compareStorageKeys,
  isBackupLocalStorageKey
} from '../domain/storage-contract.js';

export { BACKUP_LOCAL_STORAGE_KEYS, isBackupLocalStorageKey };

export function snapshotBackupLocalStorage(storage) {
  const entries = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isBackupLocalStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries.push({ key, value });
  }
  return entries.sort((left, right) => compareStorageKeys(left.key, right.key));
}

export function createBackupService({
  quoteRepository,
  storage = globalThis.localStorage,
  applicationVersion = APP_RELEASE_VERSION,
  now = () => new Date().toISOString(),
  cryptoProvider = globalThis.crypto
}) {
  if (!quoteRepository?.exportSnapshot) throw new Error('A quote repository with exportSnapshot() is required.');
  if (!storage) throw new Error('Browser storage is unavailable.');

  return {
    async createBackup() {
      const quoteDatabase = await quoteRepository.exportSnapshot();
      const settings = quoteDatabase.stores.settings.find((record) => record.id === 'application');
      if (!settings?.deviceId) throw new Error('The quote-library device ID is unavailable.');
      return createBackupEnvelope({
        applicationVersion,
        exportedAt: now(),
        sourceDeviceId: settings.deviceId,
        quoteDatabase,
        localStorageEntries: snapshotBackupLocalStorage(storage)
      }, cryptoProvider);
    }
  };
}
