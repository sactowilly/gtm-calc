# Version 3.0 Release Closeout Checklist

Status: in progress. Version 3 remains a local-only PWA release candidate. Do not create or move the annotated `v3.0.0` tag until every unchecked physical acceptance item is recorded and the owner approves closeout.

## Release candidate identity

- Candidate implementation PR: #36, merged to `main` as `4e59a3c` on 2026-08-14.
- Candidate marker/package: `v3.0.0 · safe-update.4` / `3.0.0-alpha.4`.
- GitHub Pages base path: `/gtm-calc/`.
- Production URL: <https://sactowilly.github.io/gtm-calc/>.
- PWA boundary: the worker caches only public application files. It never reads, writes, migrates, or caches `gtm_quote_calculator_v1`, IndexedDB, quote/customer/catalog records, PDFs, backups, mailto URLs, or generated output.

## Automated and deployed evidence

- [x] PR #36 GitHub Actions `test-and-build` passed: run `31753720960`.
- [x] PR #36 merged to `main` as `4e59a3c`.
- [x] GitHub Pages deployment for that merge passed: run `31765659119`.
- [x] Live source smoke confirmed the `safe-update.4` marker module, visible update-notice markup, cache-v3 worker source, and explicit `SKIP_WAITING` handler.
- [x] Local implementation evidence: syntax checks, 174 unit tests, direct-source Pages smoke (2/2), production artifact smoke (2/2), and all 16 customer-PDF visual checks passed.
- [ ] Record a clean full compatibility-matrix run from GitHub Actions or an explained rerun. The local 225-test run was intentionally stopped after the known unrelated Chromium backup-inspection timing flake; it is not release-pass evidence.

## Physical acceptance required from owner

Use synthetic customer data and download a complete local backup before testing. Do not use **Clear site data**; that can erase browser-local quotes, customers, catalog data, and settings.

### Android Chrome

- [ ] Open an installed/previously used copy while online. If a waiting update notice appears, confirm it says to save work before reloading.
- [ ] Enter a distinctive unsaved customer or item-form value; choose **Reload update**; decline confirmation; verify the value remains and the update stays available.
- [ ] Save the value; choose **Reload update**; verify the app reloads once to `v3.0.0 · safe-update.4` and the saved quote/library/catalog data is unchanged.
- [ ] Launch the installed app again, then turn on airplane mode and reopen it. Verify the offline message, calculator, catalog search, saved draft reopen, and local draft save work.
- [ ] Reconnect and verify PDF preview/download, Share Sheet behavior when supported, and email fallback remain recoverable. Verify customer PDF/copy/email contain no cost, freight cost, GTM, internal notes, or source/vendor data.
- [ ] Check portrait and landscape: no clipped update notice, bottom navigation, sticky actions, or keyboard-covered essential control.

### iPhone Safari

- [ ] Install/open using Safari's **Add to Home Screen** path and repeat the waiting-update, unsaved-edit, save-and-reload, offline reopen, catalog, draft, and PDF/download checks above.
- [ ] Verify the update controls remain reachable with Dynamic Type/large text and VoiceOver labels announce the notice and its buttons clearly.
- [ ] Verify the installed app does not lose saved local data when it reloads after an update.

### Laptop Chromium

- [ ] Test a normal tab: update notice, unsaved-confirm cancel, saved reload, direct `/gtm-calc/` reload, and offline reopen after one online launch.
- [ ] While preparing a backup restore, attempt **Reload update** and verify activation is blocked until the restore activity finishes or is cancelled. Do not perform a destructive restore solely for this test; inspection is sufficient to verify the busy state.
- [ ] Verify keyboard-only operation, visible focus, 200% zoom, browser console free of application errors, and no horizontal overflow.
- [ ] Verify existing `gtm_quote_calculator_v1`, IndexedDB draft/customer/version data, quote numbers, immutable versions, and customer-safe output remain unchanged before and after cache migration.

## Update-test note

The notice appears only when a browser already controls a page with an older worker and has downloaded a newer worker. If a device already shows `safe-update.4` and no notice, record the normal/offline/data-retention checks as pass and mark the update-notice test **not available on this device**. Do not ship a throwaway production change merely to force a notice. The next production update must re-run the notice path before its release.

## Owner acceptance record

| Device/browser | Date | Result | Evidence | Owner initials |
| --- | --- | --- | --- | --- |
| Android Chrome |  | Pending |  |  |
| iPhone Safari |  | Pending |  |  |
| Laptop Chromium |  | Pending |  |  |

## Release actions after acceptance

1. Record the exact device/browser/date/results above and resolve the compatibility-matrix evidence.
2. Update `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT_ROADMAP.md`, `docs/V3_IMPLEMENTATION_PLAN.md`, `docs/TEST_PLAN.md`, `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md` to mark Version 3 complete and Version 3.5 active.
3. Update and visually inspect the roadmap SVG/PNG.
4. Merge the acceptance documentation change to `main`.
5. Verify the post-merge Pages deployment and live marker.
6. Create and push annotated tag `v3.0.0` at that verified production commit. Do not move the tag afterward.

## Rollback

Before merge, close the closeout PR and delete its branch. After merge, revert the closeout documentation commit if necessary; do not move a published stable tag. If the current worker itself must be rolled back, release a reviewed worker/cache change that preserves browser-local data, then use the complete local backup/recovery workflows if a device has separate local-data trouble.
