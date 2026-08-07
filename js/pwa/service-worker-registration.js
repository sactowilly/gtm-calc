export const SERVICE_WORKER_SCOPE = '/gtm-calc/';
export const SERVICE_WORKER_URL = `${SERVICE_WORKER_SCOPE}sw.js`;

export function canRegisterServiceWorker(navigatorReference = globalThis.navigator) {
  return Boolean(navigatorReference?.serviceWorker?.register);
}

export async function registerApplicationServiceWorker({
  navigatorReference = globalThis.navigator,
  logger = globalThis.console
} = {}) {
  if (!canRegisterServiceWorker(navigatorReference)) {
    return { registered: false, reason: 'unsupported' };
  }

  try {
    const registration = await navigatorReference.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: 'none'
    });
    return { registered: true, registration };
  } catch (error) {
    logger?.warn?.('GTM Calc service worker registration failed; normal online use remains available.', error);
    return { registered: false, reason: 'failed', error };
  }
}
