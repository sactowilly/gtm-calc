# Version 3.0 Release Closeout Checklist

Status: owner acceptance complete. Version 3 remains a local-only PWA release. Create the annotated `v3.0.0` tag only after this closeout documentation is merged, the resulting Pages deployment is verified, and the tag targets that exact production commit.

## Release candidate identity

- Closeout baseline: PR #39 merged to `main` as `0f15230` on 2026-09-08.
- Stable marker/package: `v3.0.0 · stable` / `3.0.0`.
- GitHub Pages base path: `/gtm-calc/`.
- Production URL: <https://sactowilly.github.io/gtm-calc/>.
- PWA boundary: the worker caches only public application files. It never reads, writes, migrates, or caches `gtm_quote_calculator_v1`, IndexedDB, quote/customer/catalog records, PDFs, backups, mailto URLs, or generated output.

## Automated and deployed evidence

- [x] PR #36 GitHub Actions `test-and-build` passed: run `31753720960`.
- [x] PR #36 merged to `main` as `4e59a3c`.
- [x] GitHub Pages deployment for that merge passed: run `31765659119`.
- [x] Live source smoke confirmed the `safe-update.4` marker module, visible update-notice markup, cache-v3 worker source, and explicit `SKIP_WAITING` handler.
- [x] PR #38 merged to `main` as `745f66a`; it supplies the direct **Open PDF** fallback but its PR check exposed a visual-hidden regression in the quote-library pagination control.
- [x] PR #39 GitHub Actions `test-and-build` passed: run `34266091373`.
- [x] PR #39 merged to `main` as `0f15230`; GitHub Pages deployment passed: run `34268352795`.
- [x] Live source smoke returned the deployed `hidden-controls.6` metadata module over HTTPS on 2026-09-08.
- [x] Local hidden-control evidence: syntax/PWA syntax checks, 174 unit tests, 10 quote-library scale checks across Chromium/Firefox/WebKit/Android Chrome/iPhone Safari emulation, the complete 225-test compatibility matrix, direct-source smoke (2/2), production smoke (2/2), and the Vite build all passed on 2026-09-08.
- [x] Earlier local implementation evidence: all 16 customer-PDF visual checks passed; the current branch preserves that output code.
- [x] GitHub Actions reproduced a clean full compatibility-matrix run for `hidden-controls.6` in run `34266091373`.

## Physical acceptance required from owner

Use synthetic customer data and download a complete local backup before testing. Do not use **Clear site data**; that can erase browser-local quotes, customers, catalog data, and settings.

### Recorded owner-device scope

- [x] Android Chrome — Samsung Galaxy S24 Ultra: owner confirmed the deployed app loads and the direct **Open PDF** fallback, download, email, and quote output work. The Android embedded viewer's own Open control remains unreliable, which is the reason the app-owned fallback exists; it is not treated as an application failure.
- [x] Laptop Chromium — Dell desktop/Chrome: owner previously confirmed normal quote operation, PDF/download/email behavior, and Chromium desktop usability.
- [x] iPhone Safari — explicitly deferred by owner. This is a release-scope decision, not a claim that Safari was physically tested. A future iPhone deployment, navigation, Dynamic Type, VoiceOver, update, and data-retention check remains recommended before iOS-specific changes.

## Update-test note

The notice appears only when a browser already controls a page with an older worker and has downloaded a newer worker. The automated update-coordinator coverage passed; device appearance of a notice was not forced through a throwaway production update. The next production update must re-run the notice path before its release.

## Owner acceptance record

| Device/browser | Date | Result | Evidence | Owner initials |
| --- | --- | --- | --- | --- |
| Android Chrome — Samsung Galaxy S24 Ultra | 2026-09-08 | PASS | Owner-confirmed direct **Open PDF** fallback works; download, email, and quote output work. Embedded viewer Open is known unreliable and bypassed. | Will Z. |
| iPhone Safari | 2026-09-08 | DEFERRED | Owner explicitly does not plan to test iPhone in this release; no Safari pass is claimed. | Will Z. |
| Laptop Chromium — Dell desktop/Chrome | 2026-08-14 | PASS | Owner-confirmed normal Chrome desktop quote/PDF/download/email behavior. | Will Z. |

## Release actions after acceptance

1. Merge the acceptance/closeout documentation change to `main`.
2. Verify the post-merge Pages deployment and live stable marker.
3. Create and push annotated tag `v3.0.0` at that verified production commit. Do not move the tag afterward.
4. Begin Version 3.5 with the inline Quote-workspace item-search slice.

## Rollback

Before merge, close the closeout PR and delete its branch. After merge, revert the closeout documentation commit if necessary; do not move a published stable tag. If the current worker itself must be rolled back, release a reviewed worker/cache change that preserves browser-local data, then use the complete local backup/recovery workflows if a device has separate local-data trouble.
