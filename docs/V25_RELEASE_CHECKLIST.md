# Version 2.5 Release Closeout Checklist

Status: complete after PR #28 merged to `main` as `0716350` and owner acceptance was recorded on 2026-08-06.

This checklist is the evidence boundary for the stable `v2.5.0` tag. Automated checks, physical device checks, and owner acceptance are now complete; the tag is ready to be created at the verified production commit after this documentation is merged.

## Automated evidence

- [x] PR #27 merged to `main` as `90823ea`.
- [x] Pull-request CI passed: unit, visual/PDF, compatibility, source-hosting, build, and production smoke checks.
- [x] GitHub Pages deployed `90823ea` successfully at <https://sactowilly.github.io/gtm-calc/>.
- [x] `gtm_quote_calculator_v1` compatibility and customer-output privacy tests pass.
- [x] CSV formula-injection, JSON projection, immutable-version, and customer-PDF export tests pass.
- [x] PR #28 merged to `main` as `0716350`.
- [x] GitHub Pages deployed `0716350` successfully and the live marker is `v2.5.0 · release-closeout.6`.
- [x] Roadmap and release documentation identify Version 2.5 as complete and Version 3.0 as active.

## Physical acceptance required from owner

- [x] Android Chrome: complete-backup download, inspect, merge, replace, safety-backup, rollback, and quote/library recovery on a physical phone.
- [x] Laptop Chromium: complete-backup download, inspect, merge, replace, safety-backup, rollback, CSV export, individual JSON/PDF export, and email/PDF fallback.
- [x] Verify downloaded filenames and open the downloaded JSON/PDF files.
- [x] Verify corrupted, oversized, tampered, and conflicting backups make no changes.
- [x] Verify finalized quote numbers, immutable hashes, source links, and customer-safe output remain unchanged after round trips.
- [x] Verify accessibility and keyboard recovery paths on the laptop.
- [x] Record device, browser, date, result, and owner confirmation below.

## Owner acceptance record

| Device/browser | Date | Result | Evidence | Owner initials |
| --- | --- | --- | --- | --- |
| Android Chrome — Samsung Galaxy S24 Ultra | 2026-08-06 | PASS | Owner-confirmed in session | Will Z. |
| Laptop Chromium — Dell desktop/Chrome | 2026-08-06 | PASS | Owner-confirmed in session; Chrome accepted as Chromium laptop browser | Will Z. |

## Release actions after acceptance

1. Update `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT_ROADMAP.md`, `docs/V25_IMPLEMENTATION_PLAN.md`, `docs/TEST_PLAN.md`, `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md` to record acceptance.
2. Update and visually inspect the roadmap SVG/PNG with Version 2.5 complete and Version 3.0 active.
3. Merge this acceptance documentation PR to `main`.
4. Run the post-merge Pages smoke test and verify the deployed commit.
5. Create and push the annotated `v2.5.0` tag at the verified production commit.

## Rollback

Before merge, close the PR and delete the feature branch. After merge, revert the acceptance commit if necessary; the stable tag should remain on the verified production commit. Existing local quote data and the V2.5 backup/restore workflows require no migration to roll back this documentation/verification slice.
