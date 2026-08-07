import { describe, expect, it, vi } from 'vitest';
import {
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
  canRegisterServiceWorker,
  registerApplicationServiceWorker
} from '../js/pwa/service-worker-registration.js';

describe('service-worker registration', () => {
  it('uses the GitHub Pages scope and bypasses unsupported browsers', async () => {
    expect(SERVICE_WORKER_SCOPE).toBe('/gtm-calc/');
    expect(SERVICE_WORKER_URL).toBe('/gtm-calc/sw.js');
    expect(canRegisterServiceWorker({})).toBe(false);
    await expect(registerApplicationServiceWorker({ navigatorReference: {} })).resolves.toEqual({
      registered: false,
      reason: 'unsupported'
    });
  });

  it('registers without blocking normal application use when the browser supports workers', async () => {
    const registration = { scope: 'https://example.test/gtm-calc/' };
    const register = vi.fn().mockResolvedValue(registration);

    await expect(registerApplicationServiceWorker({
      navigatorReference: { serviceWorker: { register } }
    })).resolves.toEqual({ registered: true, registration });

    expect(register).toHaveBeenCalledWith('/gtm-calc/sw.js', {
      scope: '/gtm-calc/',
      updateViaCache: 'none'
    });
  });

  it('reports registration errors without throwing', async () => {
    const error = new Error('blocked');
    const warn = vi.fn();

    await expect(registerApplicationServiceWorker({
      navigatorReference: { serviceWorker: { register: vi.fn().mockRejectedValue(error) } },
      logger: { warn }
    })).resolves.toMatchObject({ registered: false, reason: 'failed', error });

    expect(warn).toHaveBeenCalledOnce();
  });
});
