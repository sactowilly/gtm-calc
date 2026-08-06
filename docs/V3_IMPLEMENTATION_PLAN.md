# Version 3.0 Implementation Plan — Progressive Web App

Status: active planning from the tagged Version 2.5.0 recovery boundary (`7ab4d2e`).

Version 3 adds installability and offline application behavior only after the Version 2.5 backup/restore and export workflows are stable. The application remains public, static, phone-first, and GitHub Pages-hosted. No backend, authentication, synchronization, push notifications, automatic email, or hosted database is part of this version.

## Non-negotiable boundaries

- Preserve `gtm_quote_calculator_v1`, the `gtm_quote_manager` IndexedDB schema, catalog keys, quote numbering, immutable versions, customer-output privacy, calculations, PDF/email/share behavior, and the `/gtm-calc/` Pages base path.
- A service worker may cache application assets, but it must never cache customer PDFs, backup files, mailto URLs, or raw customer/pricing records.
- Cache migration must never delete or rewrite IndexedDB/localStorage data. Backup/restore remains the recovery path.
- Feature branches and pull requests must not deploy production. Each implementation slice requires its own PR and rollback path.

## Pull-request sequence

### PR 1 — Manifest and install metadata

Goal: make the application installable without changing runtime behavior.

Likely files: `index.html`, `vite.config.js`, `README.md`, `docs/PRODUCT_ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/TEST_PLAN.md`, and new `manifest.webmanifest`, icon assets, and installation guidance.

Work:

- Add a repository-base-safe manifest with `start_url` and `scope` rooted at `/gtm-calc/`.
- Define the application name, short name, theme/background colors, standalone display, and approved icon assets at installable sizes.
- Verify direct-source hosting and the Vite build both resolve the manifest and icons.
- Add iPhone Safari and Android Chrome installation instructions without claiming offline support yet.

Acceptance: manifest parses, icons load, the app remains unchanged in normal browser mode, and install metadata works from the built `/gtm-calc/` artifact.

Rollback: remove the manifest link/assets and revert the documentation-only metadata changes; no stored-data migration is required.

### PR 2 — Service-worker registration and cache policy

Goal: introduce an explicit versioned application-shell cache without caching business data.

Likely files: new `sw.js`, `js/pwa/service-worker-registration.js`, `index.html`, `vite.config.js`, tests, and build documentation.

Work:

- Register the worker only from the `/gtm-calc/` scope and make registration failure non-fatal.
- Precache only the generated application shell and immutable static assets required for first launch.
- Version cache names and delete only retired caches owned by this application.
- Use network-first or bypass rules for navigations and never intercept downloads, PDFs, backups, mailto, or external URLs.

Acceptance: first-load network behavior is unchanged, cache contents contain no customer data, old caches are retired safely, and unregistering the worker restores normal behavior.

Rollback: remove registration and ship a no-op worker or delete the worker; leave all application data untouched.

### PR 3 — Offline shell and local-data readiness

Goal: support offline launch, catalog search, calculator use, and draft creation after one successful online load.

Likely files: service-worker fetch strategy, local repository readiness checks, offline status UI, and browser tests.

Work:

- Prove the app shell, catalog, calculator, and draft/library screens can load from the cache while using existing local repositories.
- Keep PDF generation, email, and sharing graceful when browser/network capabilities are unavailable.
- Add explicit offline/online status messaging and retry guidance.
- Test reload, draft save, quote reopen, catalog search, backup generation, and recovery while offline.

Acceptance: offline workflows never erase or mutate records unexpectedly; failed capabilities show recoverable guidance; customer-facing privacy rules remain unchanged.

Rollback: disable offline fetch fallback while retaining the Version 2.5 local application and data stores.

### PR 4 — Updates and safe activation

Goal: let users receive updates without losing in-progress quote work.

Likely files: update coordinator, UI notification, service-worker messaging, navigation/focus handling, and tests.

Work:

- Detect a waiting worker and show a non-blocking update notice.
- Let the user save/finish work before reload or activation.
- Prevent an update from activating over an active restore transaction or unsaved quote without confirmation.
- Test failed downloads, stale caches, repeated updates, and reload recovery.

Acceptance: update activation is deliberate, recoverable, accessible, and never clears quote/customer data.

Rollback: disable update prompts and worker activation while retaining the previous cache version.

### PR 5 — V3 production closeout

Goal: certify installability and offline behavior across supported phone/laptop profiles.

Required evidence:

- Fresh install, repeat launch, offline launch, update, and cache migration on Android Chrome and iPhone Safari.
- Laptop Chromium fallback behavior and keyboard/accessibility checks.
- Backup/restore before and after cache migration with stable IDs, quote numbers, immutable hashes, and privacy output unchanged.
- Direct-source Pages smoke, production build smoke, visual checks, and an annotated `v3.0.0` tag only after owner acceptance.

## Explicitly deferred

Push notifications, background sync, server data, authentication, shared-device synchronization, automatic email, hosted reporting, permissions, and Version 3.5 workflow enhancements remain out of scope.
