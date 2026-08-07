# Build Log

### 2026-08-07 -- Version 3.0 offline shell and local-data readiness (in progress)

- Created `feature/v3-offline-shell-local-data` from merged `main` commit `56cd679` after PR #34 passed GitHub Actions and merged; the unrelated `.codex/` directory remains untracked and untouched.
- Added a versioned public application-shell cache with source Pages allowlisting and build-time Vite asset injection. Navigation uses network-first with cached-shell fallback; public static assets use cache-first delivery with a non-blocking network refresh. The worker never caches or changes PDFs, backup files, mailto URLs, IndexedDB, localStorage, customer records, pricing, catalogs, or quote data.
- Added a compact connection-status announcement. After one successful online load, direct-source and production browser tests prove offline reload, existing local quote reopening, and calculator line-item entry. Safe update activation remains a separate PR.
- Advanced the marker to `v3.0.0 · offline-shell.3` and package version to `3.0.0-alpha.3`; reviewed and updated the README, roadmap/current-state/install/implementation/test documentation, decision/open-item memory, and roadmap SVG/PNG.
- Verified 167 unit tests, JavaScript/PWA syntax, direct-source and production offline smoke, 16 customer-PDF visual tests, and the focused Android Chrome compatibility/accessibility/library/catalog profile (15/15). Full compatibility matrix and physical Android/iPhone/laptop acceptance remain required before Version 3 completion. The build retains the two known warnings for vendored non-module PDF scripts.

### 2026-08-07 -- Version 3.0 public bootstrap cache (in progress)

- Created `feature/v3-service-worker-cache-policy` from updated `origin/main` at `a6fe721`; the unrelated `.codex/` directory remains untracked and untouched.
- Added a classic `/gtm-calc/`-scoped worker with `updateViaCache: 'none'`. It versions and precaches only public bootstrap resources (the root, manifest, and branded icons), and deletes only superseded `gtm-calc-app-shell-*` caches.
- The worker deliberately has no `fetch` handler in this slice: PDFs, backups, mailto links, quote/customer data, IndexedDB, localStorage, and every normal request retain existing browser/network behavior. Offline workflow support remains PR 3 work.
- Advanced the visible marker to `v3.0.0 · shell-cache.2` and package version to `3.0.0-alpha.2`; reviewed and updated release-facing roadmap/current-state/implementation/test/memory documentation and the roadmap SVG/PNG.
- Verified unit/metadata checks, JavaScript syntax checks, build, direct-source and built-artifact Pages smokes, and the 16-case PDF visual suite. A 3-worker full compatibility run exposed only pre-existing parallel IndexedDB/timing flakes (216 passed, 6 intentional skips); the affected restore transaction workflow then passed serially in all five profiles (10/10), and the Reopen confirmation coverage passed three consecutive Firefox runs. The build retains the two known warnings for vendored non-module PDF scripts.

### 2026-08-06 -- Version 3.0 install metadata (in progress)

- Created `feature/v3-manifest-install-metadata` from updated `main` at `83814e4`; the unrelated `.codex/` directory remains untracked and untouched.
- Added a root `/gtm-calc/`-scoped manifest, 180/192/512 and maskable branded PNG icons derived from the approved Vision artwork, theme/favicon/Apple metadata, Android/iPhone installation guidance, and deterministic Vite copying for the production artifact.
- Advanced the visible marker to `v3.0.0 · install-metadata.1` and package version to `3.0.0-alpha.1`; reviewed and updated all release-facing roadmap/current-state/implementation/test/memory documentation and the roadmap SVG/PNG.
- Added unit, direct-source, and built-artifact checks for manifest scope, icon dimensions/loading, and the explicit absence of service-worker registrations. No service worker, fetch handler, cache, offline claim, data migration, backend, authentication, calculation, PDF, email, or privacy behavior is introduced.
- Verified `npm run check`, 159 unit/metadata tests, the `/gtm-calc/` production build, direct-source smoke (1/1), production-artifact smoke (1/1), and the full compatibility/accessibility matrix (219 passed, 6 intentional skips) across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari. The build retains the two known warnings for vendored non-module PDF scripts.

### 2026-08-06 -- Version 3.0 PWA plan initialized

- Created `feature/v3-pwa-foundation` from updated `main` at `7c2fdb6` after Version 2.5.0 stable release closeout.
- Added `docs/V3_IMPLEMENTATION_PLAN.md` with staged PR boundaries for manifest/install metadata, service-worker cache policy, offline local-data readiness, safe updates, and V3 production acceptance.
- Linked the V3 plan from the README, product roadmap, current state, and open-item memory. No manifest, service worker, cache, or runtime behavior is implemented in this planning slice.
- Reverified release metadata, JavaScript checks, production build, and roadmap infographic rendering; the two known vendored non-module PDF-script warnings remain.

### 2026-08-06 -- Version 2.5.0 stable tag published

- PR #29 merged the acceptance documentation and roadmap activation as `7ab4d2e`.
- Pages deployment run `31128724445` passed for the merged production commit; live `/gtm-calc/` returned HTTP 200 and served `v2.5.0 · release-closeout.6`.
- Created and pushed annotated tag `v2.5.0` at `7ab4d2e` after owner Android/laptop acceptance and post-merge verification passed.
- Version 2.5 is now closed; Version 3.0 PWA planning is active. No application behavior, storage schema, calculation, privacy, PDF, email, or deployment configuration changed in this documentation synchronization.

### 2026-08-06 -- Version 2.5 acceptance and Version 3.0 planning activation

- Owner confirmed the complete Version 2.5 physical acceptance checklist passed on Android Chrome using a Samsung Galaxy S24 Ultra and laptop Chromium using a Dell desktop/Chrome. Coverage included complete backup download/inspection, Merge/Replace, safety-backup recovery, rollback, CSV/JSON/PDF exports, email/PDF fallback, privacy, corrupted/oversized/tampered/conflicting no-write behavior, immutable quote data, and accessibility/keyboard paths.
- Created `feature/v25-release-acceptance` from updated `main` at `0716350` and recorded the acceptance results in `docs/V25_RELEASE_CHECKLIST.md`. The unrelated `.codex/` directory remains untracked and untouched.
- Updated the README, current state, Version 2.5 plan, test plan, decision/open-item logs, and roadmap SVG/PNG to mark Version 2.5 complete and Version 3.0 active planning. The annotated `v2.5.0` tag remains the final release action.
- Confirmed post-merge Pages deployment run `31128417026` succeeded for `0716350`; live `/gtm-calc/` returned HTTP 200 and served `v2.5.0 · release-closeout.6`.
- Reverified on merged `main`: `npm test` (153/153), `npm run build`, and `npm run test:production` (1/1). The build retains the two known warnings for vendored non-module PDF scripts.

### 2026-08-06 -- Version 2.5 release hardening (in progress)

- Created `feature/v25-release-closeout` from updated `origin/main` at `90823ea` after PR #27 merged. The unrelated `.codex/` directory remains untracked and untouched.
- Added `docs/V25_RELEASE_CHECKLIST.md` to separate automated evidence from the still-required physical Android Chrome/laptop acceptance and owner approval. No stable `v2.5.0` tag is created on this branch.
- Advanced the development marker to `v2.5.0 · release-closeout.6` and package version to `2.5.0-alpha.6`; reviewed and updated the README, current state, roadmap, Version 2.5 plan, test plan, and roadmap status wording. Version 2.5 remains unreleased until PR6 acceptance is complete.
- Confirmed from GitHub: PR #27 merge commit `90823ea`, pull-request CI success, Pages deployment success, live marker `record-exports.5`, and no existing `v2.5.0` tag. The closeout marker will be verified again after merge.
- Verified on the closeout branch: `npm run check`, `npm test` (153/153), `npm run build`, direct-source smoke (1/1), production build/smoke (1/1), and the application compatibility/accessibility profile (15/15 across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari). The build retains the two known warnings for vendored non-module PDF scripts.

### 2026-08-05 -- Version 2.5 CSV and individual-record exports (in progress)

- Created `feature/v25-exports` from updated `main` after PR #26 merged as `5ed749f`; the unrelated `.codex/` directory remains untracked and untouched.
- Added read-only quote-list, customer, and manual-item CSV reports with RFC 4180/CRLF serialization, formula-injection protection, deterministic local filenames, and neutral status/error recovery. Added individual draft JSON and finalized immutable-version JSON/customer-safe PDF actions to saved quote cards, including historical version actions.
- Preserved `gtm_quote_calculator_v1`, calculations, customer PDF privacy projection, existing backup/restore, email, share, and GitHub Pages behavior. No schema migration, PWA, backend, network call, or production deployment was added.
- Advanced the marker to `v2.5.0 · record-exports.5` and package version to `2.5.0-alpha.5`; reviewed and updated the README, Version 2.5 plan, current state, roadmap, storage/test documentation, decision/open-item memory, and roadmap SVG/PNG. Version 2.5 remains in progress; PR 6 physical evidence and owner acceptance are not claimed.
- Verified `npm run check`, export unit tests (14/14), full unit suite (152 tests), export compatibility (20/20 across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari), and `npm run build` for `/gtm-calc/`. The build retains only the two known warnings for vendored non-module PDF scripts.
- Remaining verification before publish: complete visual/source/production smokes, `git diff --check`, and the GitHub Actions PR matrix. No production deployment runs from this feature branch.

### 2026-08-04 -- Version 2.5 transactional restore (in progress)

- Created the owner-confirmed local restore workflow on `feature/v25-restore-transaction` after PR #25 merge `ac288a4`; the unrelated `.codex/` directory remains untracked and untouched.
- Added a hidden-until-inspected Merge/Replace choice, exact typed `RESTORE` confirmation, accessible busy/error/result announcements, and a destructive Replace explanation. The UI keeps raw records, customer/contact values, pricing, and IDs out of the restore display.
- The restore coordinator re-reads and revalidates the selected JSON at commit time. It requests the normal local safety-backup download before transaction writes, reports its neutral filename, and blocks immutable history or finalized-number conflicts.
- After a successful restore, the calculator header, navigation, and workspaces become inert and the application reloads fresh persisted state, preventing a stale in-memory quote from being saved over the restored device data.
- Advanced the marker to `v2.5.0 Â· restore-transaction.4` and package version to `2.5.0-alpha.4`; reviewed/updated the roadmap SVG/PNG, README, V2.5 plan, current state, storage/test plan, decision, and open-item documentation. Version 2.5 remains in progress; no owner acceptance or release completion is claimed.
- Verified `npm run check`, `npm test` (139 tests), all 16 customer-PDF visual/privacy tests, direct-source and built-`dist` `/gtm-calc/` smokes, `git diff --check`, and the focused transactional restore browser suite: 10 passing checks across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari. The production build transformed 36 modules and retains only the two known warnings for vendored non-module PDF scripts.


### 2026-08-04 -- Version 2.5 restore inspection

- Created `feature/v25-restore-inspection` from merged `main` commit `c1cd4c2`; the unrelated local `.codex/` directory remains untracked and untouched.
- Added a preview-only `Inspect a Backup` workflow in Export. It rejects files larger than 25 MiB before startup/read work, decodes strict UTF-8 JSON, fully validates the selected envelope before taking a readonly current-device snapshot, and reports only aggregate counts and future-restore conflict totals.
- The inspection screen cannot merge, replace, clear, import, write IndexedDB/localStorage/sessionStorage, upload data, or reveal customer names, contacts, IDs, pricing, or raw backup content. Same-ID altered immutable quote versions/events and finalized-number collisions are visibly blocking for a future merge.
- Advanced the development marker to `v2.5.0 · restore-inspection.3` and the package to `2.5.0-alpha.3`; reviewed and updated the roadmap infographic plus the Version 2.5 plan, current-state, storage/domain/UX/test, decision, and open-item documentation.
- PR 2's validated backup-download merge remains recorded; physical Android Chrome and laptop Chromium download acceptance is still pending release evidence and is not represented as complete.
- Verified JavaScript checks, 127 unit/domain/storage/privacy tests, and 16 customer-PDF visual/privacy tests. Direct-source Pages-style and built-`dist` `/gtm-calc/` smoke tests passed; the production build transformed 34 modules and retains only the two known warnings for vendored non-module PDF scripts.
- The new restore-inspection browser workflow passed 17 checks across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari, with three intentional non-Chromium skips for a controlled in-flight Blob-read case covered in Chromium. An initial full 195-check parallel compatibility run exposed a WebKit-incompatible synthetic size override in the oversize-file fixture. The fixture now patches the native Blob size getter only for its temporary test file; the affected Firefox/WebKit serial check and the corrected five-profile restore workflow both pass. A subsequent complete local compatibility attempt exceeded the ten-minute execution limit before a final result, so CI remains the clean full-suite gate and this is not recorded as a full local pass.
- `git diff --check` passed. No production deployment runs from this feature branch.

### 2026-08-04 -- Version 2.5 validated backup download

- Created `feature/v25-backup-download-workspace` from merged `main` commit `e88e914` after PR #23 passed CI and merged; existing local `.codex/` data remains untracked and untouched.
- Added a fifth state-preserving `Export` workspace with a permanent warning that the complete unencrypted backup contains customer/contact and internal pricing/profitability data.
- Shared the initialized quote repository between Library and Export, revalidated the exact readable JSON before Blob creation, used the deterministic UTC-derived `gtm-calc-backup-YYYY-MM-DD.json` filename, reported exact Blob bytes, and cleaned up the temporary anchor/object URL.
- Kept the operation persisted-data-only and read-only: no restore picker/write, CSV/individual export, event, backup history, PWA, backend, authentication, cloud upload, or production-deployment behavior was added.
- Advanced the development marker to `v2.5.0 · backup-download.2` and package version to `2.5.0-alpha.2`; synchronized the roadmap, current-state, storage/domain/test, decision, and open-item documentation while keeping Version 2.5 in progress.
- Hardened unsupported-browser handling so missing Blob support produces a visible, retryable Export error instead of interrupting application startup. The five-destination phone navigation uses the matching visible and accessible label `Clients` for saved customer records so labels fit at 320 px.
- Updated the Vite transitive PostCSS lock entry after npm reported a new moderate build-time advisory. A subsequent clean `npm ci` audited 75 packages with zero vulnerabilities.
- Verified JavaScript checks, 123 unit/domain/storage/privacy tests, 16 customer-PDF visual/privacy tests, one direct-source GitHub Pages smoke, and one production-artifact smoke/build. The build transformed 31 modules for `/gtm-calc/` and retains only the two known warnings for vendored non-module PDF scripts.
- Verified 172 compatibility/accessibility tests across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari, with three intentional non-Chromium skips for a controlled in-flight UI test. Firefox's parallel local run twice exposed the existing Vite/Firefox resource flake; the complete Firefox profile then passed 34/34 serially with retries disabled. The new backup tests cover exact downloaded bytes, checksum validation, no network or stored-data mutation, failure recovery, duplicate activation, keyboard activation, and live busy state.
- Regenerated and visually inspected the roadmap PNG at 1200 × 1900. Version 2.5 remains visibly in progress with the backup foundation merged, validated local download in development, and restore writes still gated.

### 2026-08-03 -- Version 2.5 backup foundation started

- Created `feature/v25-backup-foundation` from clean `main`/`origin/main` release record `3a62da4`; existing local `.codex/` data remains untracked and untouched.
- Added a lossless, readonly snapshot across all eight quote-library IndexedDB stores and an allowlisted capture of the active quote, current/prior catalog, manual items, usage history, and recovery localStorage values.
- Added the Version 2.5 backup envelope, deterministic canonical ordering, SHA-256 payload checksum, known-record validation, duplicate/reference checks, immutable quote-version hash verification, and prototype-safe canonicalization.
- Advanced the development marker to `v2.5.0 · backup-foundation.1` and package version to `2.5.0-alpha.1`; updated the Version 2.5 plan, roadmap, domain/storage/current-state/test documentation, and infographic status.
- No UI, download, restore write, CSV export, PWA, backend, authentication, calculation, PDF, email, or production-deployment behavior is introduced in this foundation slice.
- After independent Chief of Staff, code, and QA review, hardened the contract against unsupported schemas, malformed local records, cross-quote history links, non-JSON structured-clone data, locale-dependent ordering, prototype-shaped input, and serialized checksum drift. Added a golden Version 2 immutable-content hash regression.
- Verified a clean `npm ci` with zero audit vulnerabilities, JavaScript checks, 115 unit/domain/storage tests, 16 customer-PDF visual/privacy tests, one direct-source Pages smoke, and one production-artifact smoke/build. The build retains only the two known warnings for vendored non-module PDF scripts.
- Verified all 29 compatibility/accessibility workflows separately in Chromium, WebKit, Android Chrome, and iPhone Safari. Firefox first passed 27/29 in a parallel run with two initialization timing failures; both passed immediately in isolation, and the complete Firefox profile then passed 29/29 serially. The backup creation/JSON round-trip smoke passed in all five profiles using real IndexedDB and Web Crypto.
- Regenerated and visually inspected the roadmap PNG; Version 2 remains complete, Version 2.5 is clearly in progress, and later phases remain planned. `git diff --check` passes; `.codex/` remains unrelated and untracked.

### 2026-07-27 -- Version 2 stable acceptance and closeout

- Recorded PR #19 head `22cf299`, merge `3e41007`, passing CI run `30130612587`, and successful Pages run `30132341911`.
- Approved the implemented customer/contact matching behavior, duplicate reset behavior, and explicit deletion/archive deferral documented in `docs/V2_RELEASE_CHECKLIST.md`; ambiguity prompts remain a documented later improvement.
- Passed live production phone/laptop/privacy smoke. Android acceptance passed on Samsung Galaxy S24 Ultra with Chrome; laptop Chromium acceptance passed on a Dell desktop with Chrome using the owner's approved substitution for Edge.
- Passed rollback/re-entry against accepted Version 1.5 commit `3f1f1a0`: the legacy raw value and IndexedDB counts, IDs, finalized hashes, counters, and recovery records were preserved, and the next allocated number was `2026-002`.
- PR #20 merged as `b61890c` after passing CI run `30304252373`; Pages run `30304688708` deployed that exact commit successfully.
- The live stable-marker, calculator, PDF, reload, phone-overflow, browser-error, and no-PWA smoke passed. Annotated tag `v2.0.0` now identifies verified production commit `b61890c`; Version 2.5 backup/restore is current/next.

### 2026-07-24 -- Version 2 release-hardening candidate

- Started PR #19 from merged `main` after PR #18 CI and Pages deployment passed.
- Independent Chief of Staff, Code Reviewer, and Test Automation audits identified stale cached PDFs, customer-dialog copy privacy, dirty-draft reopen, non-atomic first library save, and missing source/build release evidence as blockers.
- The candidate invalidates PDF artifacts on quote mutation, separates internal/customer copy, protects dirty reopen and replacement-sensitive inputs, makes initial customer/contact/draft creation atomic, and adds 100-record Unicode scale coverage.
- Added zero-transform source hosting and built-`dist` browser smokes under `/gtm-calc/`, failure artifacts in CI, a release metadata consistency test, and `docs/V2_RELEASE_CHECKLIST.md`.
- Updated the visible marker to `v2.0.0 · release-candidate.1` and package version to `2.0.0-rc.1`.
- Verified JavaScript checks, 100 unit/storage/privacy/metadata tests, 16 customer-PDF visual-layout tests, and 140 compatibility/accessibility tests across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari. Direct-source and built-`dist` `/gtm-calc/` smokes also passed; the production build retains only the two known warnings for vendored non-module PDF scripts.
- Owner policy decisions, physical Android/laptop acceptance, merge CI, production smoke, and the rollback/re-entry drill remain pending. Version 2 is not marked complete.

### 2026-07-23 -- Version 2 navigation design-hardening candidate

- Applied the UI Designer and UX Researcher review: corrected `aria-current`, strengthened the active indicator, shortened the Quotes destination to Library, protected non-empty item/customer form values before replacement, and restored visible focus/status after quote or customer recall.
- Hardened narrow-phone and software-keyboard layouts by preventing navigation-label clipping, releasing sticky item actions while editing or on short screens, increasing scroll clearance, and delaying the desktop quote table to 1120 px.
- Updated the visible build marker to `v2.0.0 · navigation.2`, package pre-release to `2.0.0-alpha.7`, Version 2 plan, current-state/test/UX documentation, and roadmap wording. The roadmap remains in Version 2.0; only its current-step wording changed.
- Verified JavaScript checks, 96 unit/storage/privacy tests, 16 customer-PDF layout tests, and 95 compatibility/accessibility tests across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari. After the final 320 px action-label adjustment, all 15 workspace-navigation tests passed again across those five profiles.
- Rebuilt for `/gtm-calc/`, visually inspected the regenerated roadmap plus 320 px phone and 1280 px laptop screenshots, and passed a direct-source GitHub Pages-style smoke with the correct marker, one current navigation destination, no control/page overflow, and no browser errors. The build retains only the two known warnings for vendored non-module PDF scripts.

### 2026-07-22 -- Version 2 workspace navigation candidate

- Added a state-preserving Quote / Quotes / Customers / Catalog workspace layout with a fixed phone bottom bar and sticky laptop rail; current quote data stays mounted while switching views.
- Connected existing flows so opening/reopening a quote, applying a saved customer, and selecting a catalog item all return to Quote without changing `gtm_quote_calculator_v1`, IndexedDB records, calculations, customer PDF privacy, or email behavior.
- Updated the visible build marker to `v2.0.0 · navigation.1`, the V2 sequence, roadmap status/artwork, release documentation, and navigation regression coverage.
- Verified JavaScript checks, 96 unit/storage/privacy tests, 16 customer-PDF layout tests, and 80 compatibility/accessibility tests across Chromium, Firefox, WebKit, Android Chrome, and iPhone Safari. Rebuilt for `/gtm-calc/`, rendered and inspected the roadmap infographic, and inspected phone/laptop workspace screenshots. The production build retains only the known warnings for the vendored non-module PDF scripts.

### 2026-07-16 -- Version 2 quote lifecycle candidate

- Implemented finalization-date-year base numbering, immutable read-only current/historical version views, latest-version-only revisions, duplicate-as-new, and the approved controlled status graph with append-only status events.
- Added optional customer-safe quote numbers to copied customer text, PDF projection/header, email subjects, and stable PDF filenames without adding internal status/hash/cost data to customer output.
- Added all-status library filtering, status badges/actions, historical-version controls, read-only active-quote behavior, and phone-safe control layouts while preserving `gtm_quote_calculator_v1` and the GitHub Pages source model.
- Verified JavaScript checks, 96 unit/privacy/storage tests, 65 compatibility/accessibility tests across Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 profiles, 16 customer-PDF layout tests, the `/gtm-calc/` production build, and a 412 px direct-source Pages-style smoke with no page/console errors or horizontal overflow.
- Rendered and visually inspected the numbered one-page quotation and updated roadmap PNG; both are free of clipping or overlap. The production build retains only the two known warnings for vendored non-module PDF scripts.

### 2026-07-16 -- Version and roadmap maintenance rule

- Added repository-level instructions requiring a roadmap infographic review after every version/status change and coordinated README/release-document updates for every full or half version milestone.
- Replaced the README's stale raster roadmap reference with a maintainable SVG that marks Versions 1.0 and 1.5 complete and Version 2.0 in progress.
- Rendered the SVG through Chromium and visually verified all seven roadmap cards, status labels, footer text, and the Version 2 current-phase banner without clipping or overlap.

### 2026-07-16 -- Version 2 quote-library list usability

- Added ten-at-a-time phone rendering over the existing newest-first, 100-result draft search; search still covers the complete repository result set and resets the visible count to ten.
- Added a pale, text-labeled `DUP` review state derived from existing duplicate lineage and revision zero. The marker clears after the first successful save without changing customer/company data.
- Visually inspected 412 px renderings with 51 drafts and a long duplicate customer name; the badge, card actions, count summary, and 48 px Show More control fit without horizontal overflow.
- Verified syntax checks, 92 unit tests, 50 compatibility/accessibility tests across Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 profiles, 16 customer-PDF/privacy tests, the `/gtm-calc/` production build, and a direct-source GitHub Pages smoke test with no browser errors.

### 2026-07-16 -- GitHub Pages source-import hotfix

- Reproduced the live failure in Chromium: GitHub Pages served the source tree directly and the browser rejected the bare `idb` package import before any application controller initialized.
- Vendored the pinned `idb` ES module and ISC license, changed the repository import to a browser-resolvable relative path, and replaced the static `Loading drafts...` placeholder with a neutral label.
- Added regression coverage that rejects package-only imports in directly hosted browser modules.
- Verified syntax checks, 92 unit tests, the `/gtm-calc/` production build, and a direct-source 412 px Chromium smoke test that imported and listed a CSV item with no console or page errors.

### 2026-07-16 -- Version 2 draft-library UI

- Confirmed PR #11 merged with passing CI and created `feature/v2-draft-library-ui` from updated `main`.
- Added an opt-in phone-first quote library, non-destructive active-quote import, searchable/reopenable/duplicable drafts, saved customer/contact recall, per-tab session binding, and clear device-local disclosure.
- Normal Save still writes `gtm_quote_calculator_v1`; bound library drafts update IndexedDB and the legacy fallback.
- Added atomic draft/customer saves with revision-token conflict rejection so a stale tab cannot overwrite a newer library draft or partially change customer records.
- Visually inspected a populated 412 px phone rendering with long company, buyer, and email values; the library card wrapped without page-level horizontal overflow.
- Verified JavaScript syntax checks, 90 unit tests, the `/gtm-calc/` production build, 40 cross-browser/mobile/accessibility tests, and 16 customer-PDF layout checks.
- The production build retains the existing warnings for the two vendored non-module PDF scripts; no new build warning was introduced.

### 2026-07-16 -- Version 1.5 accepted; Version 2 foundation started

- PR #10 merged with passing CI. The owner imported a representative CSV, confirmed catalog items were listed/searchable, and confirmed My Items persistence and previous-catalog restore.
- Marked Version 1.5 complete for the initial local release.
- Started `feature/v2-quote-library-foundation` from updated `main`.
- Added an inactive, separate IndexedDB domain/repository foundation for legacy conversion, drafts, search, local numbering, immutable versions, revisions, duplicates, and corrupt-record quarantine.
- Kept `gtm_quote_calculator_v1` as the visible active-quote source; no automatic migration or UI cutover occurs in this slice.
- Verified a clean `npm ci`, JavaScript syntax checks, 86 unit tests, the `/gtm-calc/` production build, 30 full cross-browser/mobile/accessibility checks, 16 customer-PDF layout checks, and a post-hardening five-browser IndexedDB smoke rerun.
- The production build retains the existing warnings for the two vendored non-module PDF scripts; no new build warning was introduced.

### 2026-07-15 -- Version 1.5 catalog foundation merged

- PR #9 merged the pure CSV import/report, normalization, dimension matching, and deterministic catalog search modules.
- Verified 62 unit tests, 15 compatibility/accessibility browser checks, the production build, and GitHub Actions.
- Reviewed the merged slice against the Version 1.5 roadmap and test plan. No active-quote, calculation, PDF, email, or Pages behavior was connected to or changed by the catalog foundation.
- Implemented `feature/v15-catalog-ui` with catalog-only local storage, import/report UI, unified search, manual items, recent selections, item-form population, parser hardening, and the `v1.5.0 · catalog-preview.1` marker.
- Verified 71 unit tests, 25 compatibility/accessibility browser tests, 16 customer-PDF layout tests, syntax checks, the `/gtm-calc/` production build, and a visually inspected Pixel 7 rendering.
- Quote IndexedDB, quote numbering/library, PWA, backend, and authentication remain deferred.

### 2026-07-15 -- Added the repo memory layer

- Created the standard project memory files so future sessions can resume with context.
- Added [build-docs/DECISIONS.md](build-docs/DECISIONS.md) for locked architecture and workflow choices.
- Added [build-docs/OPEN_ITEMS.md](build-docs/OPEN_ITEMS.md) for active work and blockers.
- Added the `build-docs/archive/` folder for retired docs that should be kept, not deleted.
- Corrected the repo-facing owner name to Will Z after confirming the previous profile name was only a local machine artifact.
- Next step: keep the log current whenever a milestone closes, a decision locks, or a blocker appears.
