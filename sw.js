/* Version 3 PR 2: cache bootstrap only. Offline fetch handling arrives in PR 3. */
const APP_SCOPE = '/gtm-calc/';
const CACHE_PREFIX = 'gtm-calc-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

// Only static, public application files belong here. Never add generated PDFs,
// backups, mailto URLs, customer data, or application storage exports.
const APP_SHELL_URLS = [
  APP_SCOPE,
  `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}assets/pwa/gtm-calc-180.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-192.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-512.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-maskable-512.png`
];

function isRetiredApplicationCache(cacheName) {
  return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)));
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames.filter(isRetiredApplicationCache).map((cacheName) => caches.delete(cacheName))
      ))
    );
  });
}
