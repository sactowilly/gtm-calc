/* Version 3 PR 3: cache only the public app shell. Never cache quote data or output. */
const APP_SCOPE = '/gtm-calc/';
const CACHE_PREFIX = 'gtm-calc-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const SHELL_ASSETS = [
  '/gtm-calc/', '/gtm-calc/css/main.css', '/gtm-calc/css/quote-pdf.css',
  '/gtm-calc/vendor/html2canvas.min.js', '/gtm-calc/vendor/idb.js', '/gtm-calc/vendor/jspdf.umd.min.js',
  '/gtm-calc/assets/vision-industrial-packaging-logo.png',
  '/gtm-calc/assets/pwa/gtm-calc-180.png', '/gtm-calc/assets/pwa/gtm-calc-192.png',
  '/gtm-calc/assets/pwa/gtm-calc-512.png', '/gtm-calc/assets/pwa/gtm-calc-maskable-512.png',
  '/gtm-calc/js/app-meta.js', '/gtm-calc/js/main.js',
  '/gtm-calc/js/backup/backup-export-ui.js', '/gtm-calc/js/backup/backup-restore-inspection-ui.js', '/gtm-calc/js/backup/quote-export-ui.js',
  '/gtm-calc/js/catalog/catalog-import.js', '/gtm-calc/js/catalog/catalog-normalization.js', '/gtm-calc/js/catalog/catalog-search.js', '/gtm-calc/js/catalog/catalog-ui.js',
  '/gtm-calc/js/domain/backup-envelope.js', '/gtm-calc/js/domain/backup-restore-analysis.js', '/gtm-calc/js/domain/backup-restore-transaction.js',
  '/gtm-calc/js/domain/calculations.js', '/gtm-calc/js/domain/export-formatters.js', '/gtm-calc/js/domain/formatters.js',
  '/gtm-calc/js/domain/quote-library.js', '/gtm-calc/js/domain/quote-output.js', '/gtm-calc/js/domain/storage-contract.js',
  '/gtm-calc/js/navigation/app-navigation.js',
  '/gtm-calc/js/pdf/customer-quote-document.js', '/gtm-calc/js/pdf/customer-quote-pdf.js', '/gtm-calc/js/pdf/quote-template.js',
  '/gtm-calc/js/pwa/connectivity-status.js', '/gtm-calc/js/pwa/service-worker-registration.js',
  '/gtm-calc/js/quote-library/quote-library-ui.js',
  '/gtm-calc/js/services/active-quote-storage.js', '/gtm-calc/js/services/backup-download-service.js',
  '/gtm-calc/js/services/backup-restore-inspection-service.js', '/gtm-calc/js/services/backup-restore-transaction-service.js',
  '/gtm-calc/js/services/backup-service.js', '/gtm-calc/js/services/email-service.js',
  '/gtm-calc/js/services/indexeddb-quote-repository.js', '/gtm-calc/js/services/local-catalog-storage.js',
  '/gtm-calc/js/services/quote-export-service.js', '/gtm-calc/js/services/share-service.js'
];

// Public bootstrap files duplicate the install assets needed by both direct-source
// Pages hosting and the generated Vite artifact. Generated PDFs, backups, mailto
// links, and local quote data are intentionally not eligible for caching.
const BOOTSTRAP_URLS = [
  APP_SCOPE,
  `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}assets/pwa/gtm-calc-180.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-192.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-512.png`,
  `${APP_SCOPE}assets/pwa/gtm-calc-maskable-512.png`
];

const PUBLIC_ASSET_PATTERN = /\.(?:css|js|mjs|png|svg|webmanifest|json|txt|map)$/i;
const SENSITIVE_PATH_PATTERN = /(?:\.pdf(?:$|\?)|\/backup(?:\/|$)|mailto:)/i;

function isRetiredApplicationCache(cacheName) {
  return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
}

function isSensitiveUrl(url) {
  // `js/backup/` contains public application modules; a downloaded backup does
  // not use that path (it is created from a Blob in the browser).
  const isApplicationModule = url.pathname.startsWith(`${APP_SCOPE}js/`);
  return !isApplicationModule && SENSITIVE_PATH_PATTERN.test(url.href);
}

function isPublicAppRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return false;
  if (url.pathname === `${APP_SCOPE}sw.js` || isSensitiveUrl(url)) return false;
  return request.mode === 'navigate' || PUBLIC_ASSET_PATTERN.test(url.pathname);
}

function isSafeShellUrl(value) {
  if (typeof value !== 'string') return false;
  const url = new URL(value, self.location.origin);
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith(APP_SCOPE) &&
    !isSensitiveUrl(url)
  );
}

async function cacheShell(cache) {
  await cache.addAll(BOOTSTRAP_URLS);
  await cache.addAll(SHELL_ASSETS.filter(isSafeShellUrl));
}

async function updateCachedPublicAsset(request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function respondToNavigation(request) {
  try {
    return await updateCachedPublicAsset(request);
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(request)) || (await cache.match(APP_SCOPE));
  }
}

async function respondToPublicAsset(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = updateCachedPublicAsset(request).catch(() => undefined);
  event.waitUntil(network);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return new Response('This application file is not available offline yet.', { status: 503 });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(cacheShell));
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames.filter(isRetiredApplicationCache).map((cacheName) => caches.delete(cacheName))
      ))
    );
  });

  self.addEventListener('fetch', (event) => {
    if (!isPublicAppRequest(event.request)) return;
    if (event.request.mode === 'navigate') event.respondWith(respondToNavigation(event.request));
    else event.respondWith(respondToPublicAsset(event.request, event));
  });
}
