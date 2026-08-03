export const QUOTE_LIBRARY_DATABASE_NAME = 'gtm_quote_manager';
export const QUOTE_LIBRARY_DATABASE_VERSION = 1;

export const QUOTE_LIBRARY_STORES = Object.freeze({
  quotes: 'quotes',
  quoteVersions: 'quoteVersions',
  quoteEvents: 'quoteEvents',
  customers: 'customers',
  contacts: 'contacts',
  settings: 'settings',
  recoveryRecords: 'recoveryRecords',
  migrationLog: 'migrationLog'
});

export const ACTIVE_QUOTE_STORAGE_KEY = 'gtm_quote_calculator_v1';
export const CATALOG_STORAGE_KEY = 'gtm_catalog_v1';
export const PREVIOUS_CATALOG_STORAGE_KEY = 'gtm_catalog_v1_previous';
export const MANUAL_ITEMS_STORAGE_KEY = 'gtm_manual_items_v1';
export const CATALOG_USAGE_STORAGE_KEY = 'gtm_catalog_usage_v1';

export const BACKUP_LOCAL_STORAGE_KEYS = Object.freeze([
  ACTIVE_QUOTE_STORAGE_KEY,
  CATALOG_STORAGE_KEY,
  PREVIOUS_CATALOG_STORAGE_KEY,
  MANUAL_ITEMS_STORAGE_KEY,
  CATALOG_USAGE_STORAGE_KEY
]);

export function isBackupLocalStorageKey(key) {
  return BACKUP_LOCAL_STORAGE_KEYS.includes(key)
    || BACKUP_LOCAL_STORAGE_KEYS.some((baseKey) => key.startsWith(`${baseKey}_recovery_`));
}

export function compareStorageKeys(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}
