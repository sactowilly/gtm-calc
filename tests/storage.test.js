import { describe, expect, it } from 'vitest';
import { ACTIVE_QUOTE_STORAGE_KEY, clearActiveQuote, loadActiveQuote, saveActiveQuote } from '../js/services/active-quote-storage.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

describe('active quote storage recovery', () => {
  it('preserves the established key and loads valid quotes', () => {
    const storage = memoryStorage();
    const quote = { customerName: 'Test', items: [] };
    expect(saveActiveQuote(storage, quote).status).toBe('saved');
    expect(loadActiveQuote(storage)).toEqual({ status: 'loaded', quote });
    expect(storage.values.has(ACTIVE_QUOTE_STORAGE_KEY)).toBe(true);
  });

  it('quarantines corrupt data before opening a clean quote', () => {
    const storage = memoryStorage({ [ACTIVE_QUOTE_STORAGE_KEY]: '{broken' });
    expect(loadActiveQuote(storage, 123)).toEqual({ status: 'recovered', recoveryKey: `${ACTIVE_QUOTE_STORAGE_KEY}_recovery_123` });
    expect(storage.values.get(`${ACTIVE_QUOTE_STORAGE_KEY}_recovery_123`)).toBe('{broken');
  });

  it('reports unavailable storage without throwing', () => {
    expect(loadActiveQuote({ getItem() { throw new Error('blocked'); } })).toEqual({ status: 'unavailable' });
    expect(clearActiveQuote({ removeItem() { throw new Error('blocked'); } })).toEqual({ status: 'unavailable' });
  });
});
