# Build Log

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
