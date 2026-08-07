import { afterEach, describe, expect, it, vi } from 'vitest';

const workerPath = new URL('../sw.js', import.meta.url);

async function loadWorker({ cacheNames = [], manifestAssets = [] } = {}) {
  const listeners = new Map();
  const addAll = vi.fn().mockResolvedValue(undefined);
  const match = vi.fn().mockResolvedValue(undefined);
  const put = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(true);

  globalThis.self = {
    location: { origin: 'https://example.test' },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  globalThis.caches = {
    open: vi.fn().mockResolvedValue({ addAll, match, put }),
    keys: vi.fn().mockResolvedValue(cacheNames),
    delete: remove
  };
  await import(`${workerPath.href}?test=${crypto.randomUUID()}`);
  return { listeners, addAll, match, put, remove };
}

afterEach(() => {
  delete globalThis.self;
  delete globalThis.caches;
});

describe('Version 3 offline shell cache policy', () => {
  it('precaches only public shell assets named by the local manifest', async () => {
    const { listeners, addAll } = await loadWorker({
      manifestAssets: ['/gtm-calc/js/main.js', '/gtm-calc/css/main.css', '/gtm-calc/assets/vision-industrial-packaging-logo.png']
    });
    const waitUntil = vi.fn();

    listeners.get('install')({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(addAll).toHaveBeenNthCalledWith(1, expect.arrayContaining([
      '/gtm-calc/',
      '/gtm-calc/manifest.webmanifest',
      '/gtm-calc/assets/pwa/gtm-calc-192.png'
    ]));
    expect(addAll).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      '/gtm-calc/js/main.js',
      '/gtm-calc/css/main.css',
      '/gtm-calc/assets/vision-industrial-packaging-logo.png'
    ]));
    const cachedUrls = addAll.mock.calls.flat().flat().join('\n');
    expect(cachedUrls).not.toMatch(/(?:\.pdf(?:$|\?)|mailto:)/i);
  });

  it('bypasses sensitive output and only intercepts public same-origin application files', async () => {
    const { listeners } = await loadWorker();
    const respondWith = vi.fn();

    listeners.get('fetch')({
      request: { method: 'GET', url: 'https://example.test/gtm-calc/customer.pdf', mode: 'cors' },
      respondWith
    });
    listeners.get('fetch')({
      request: { method: 'GET', url: 'https://example.test/gtm-calc/backup/export.json', mode: 'cors' },
      respondWith
    });
    listeners.get('fetch')({
      request: { method: 'GET', url: 'https://external.example/app.js', mode: 'cors' },
      respondWith
    });
    listeners.get('fetch')({
      request: { method: 'POST', url: 'https://example.test/gtm-calc/js/main.js', mode: 'cors' },
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it('deletes only retired application-owned caches during activation', async () => {
    const { listeners, remove } = await loadWorker({
      cacheNames: ['gtm-calc-app-shell-v0', 'gtm-calc-app-shell-v1', 'gtm-calc-app-shell-v2', 'third-party-cache']
    });
    const waitUntil = vi.fn();

    listeners.get('activate')({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith('gtm-calc-app-shell-v0');
    expect(remove).toHaveBeenCalledWith('gtm-calc-app-shell-v1');
  });
});
