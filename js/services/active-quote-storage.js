export const ACTIVE_QUOTE_STORAGE_KEY = 'gtm_quote_calculator_v1';

export function saveActiveQuote(storage, quote) {
  try {
    storage.setItem(ACTIVE_QUOTE_STORAGE_KEY, JSON.stringify(quote));
    return { status: 'saved' };
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function clearActiveQuote(storage) {
  try {
    storage.removeItem(ACTIVE_QUOTE_STORAGE_KEY);
    return { status: 'cleared' };
  } catch (error) {
    return { status: 'unavailable' };
  }
}

export function loadActiveQuote(storage, now = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(ACTIVE_QUOTE_STORAGE_KEY);
  } catch (error) {
    return { status: 'unavailable' };
  }
  if (!raw) return { status: 'empty' };
  try {
    const quote = JSON.parse(raw);
    if (!quote || !Array.isArray(quote.items)) throw new Error('Invalid quote');
    return { status: 'loaded', quote };
  } catch (error) {
    const recoveryKey = `${ACTIVE_QUOTE_STORAGE_KEY}_recovery_${now}`;
    try {
      storage.setItem(recoveryKey, raw);
      storage.removeItem(ACTIVE_QUOTE_STORAGE_KEY);
      return { status: 'recovered', recoveryKey };
    } catch (storageError) {
      return { status: 'corrupt-unrecoverable' };
    }
  }
}
