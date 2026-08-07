import { afterEach, describe, expect, it, vi } from 'vitest';

const workerPath = new URL('../sw.js', import.meta.url);

async function loadWorker({ cacheNames = [] } = {}) {
  const listeners = new Map();
  const addAll = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(true);

  globalThis.self = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  globalThis.caches = {
    open: vi.fn().mockResolvedValue({ addAll }),
    keys: vi.fn().mockResolvedValue(cacheNames),
    delete: remove
  };

  await import(`${workerPath.href}?test=${crypto.randomUUID()}`);
  return { listeners, addAll, remove };
}

afterEach(() => {
  delete globalThis.self;
  delete globalThis.caches;
});

describe('Version 3 application-shell cache policy', () => {
  it('precaches only public static bootstrap assets and bypasses every fetch in this slice', async () => {
    const { listeners, addAll } = await loadWorker();
    const waitUntil = vi.fn();

    listeners.get('install')({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(addAll).toHaveBeenCalledWith(expect.arrayContaining([
      '/gtm-calc/',
      '/gtm-calc/manifest.webmanifest',
      '/gtm-calc/assets/pwa/gtm-calc-192.png',
      '/gtm-calc/assets/pwa/gtm-calc-maskable-512.png'
    ]));
    const cachedUrls = addAll.mock.calls[0][0].join('\n');
    expect(cachedUrls).not.toMatch(/(?:\.pdf(?:$|\?)|\/backup(?:\/|$)|mailto:)/i);
    expect(listeners.has('fetch')).toBe(false);
  });

  it('deletes only retired application-owned caches during activation', async () => {
    const { listeners, remove } = await loadWorker({
      cacheNames: ['gtm-calc-app-shell-v0', 'gtm-calc-app-shell-v1', 'third-party-cache']
    });
    const waitUntil = vi.fn();

    listeners.get('activate')({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('gtm-calc-app-shell-v0');
  });
});
