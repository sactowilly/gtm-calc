import { describe, expect, it, vi } from 'vitest';
import { connectivityMessage, getConnectivityState, initializeConnectivityStatus } from '../js/pwa/connectivity-status.js';

describe('offline connectivity status', () => {
  it('reports local offline readiness without implying cloud synchronization', () => {
    expect(getConnectivityState({ onLine: false })).toBe('offline');
    expect(getConnectivityState({ onLine: true })).toBe('online');
    expect(connectivityMessage('offline')).toContain('saved quotes, catalog, and calculator');
    expect(connectivityMessage('offline')).toContain('Email apps may need a connection');
  });

  it('updates on browser online and offline events', () => {
    const listeners = new Map();
    const windowReference = {
      addEventListener: vi.fn((event, listener) => listeners.set(event, listener)),
      removeEventListener: vi.fn()
    };
    const element = { dataset: {}, textContent: '' };
    const navigatorReference = { onLine: true };
    const dispose = initializeConnectivityStatus({ element, navigatorReference, windowReference });

    expect(element.dataset.connection).toBe('online');
    navigatorReference.onLine = false;
    listeners.get('offline')();
    expect(element.dataset.connection).toBe('offline');
    expect(element.textContent).toContain('saved quotes');

    dispose();
    expect(windowReference.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
  });
});
