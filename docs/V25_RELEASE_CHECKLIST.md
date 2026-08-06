# Version 2.5 Release Closeout Checklist

Status: release hardening in progress on `feature/v25-release-closeout`.

This checklist is the evidence boundary for the stable `v2.5.0` tag. The tag must not be created until the automated checks, physical device checks, and owner acceptance below are complete.

## Automated evidence

- [x] PR #27 merged to `main` as `90823ea`.
- [x] Pull-request CI passed: unit, visual/PDF, compatibility, source-hosting, build, and production smoke checks.
- [x] GitHub Pages deployed `90823ea` successfully at <https://sactowilly.github.io/gtm-calc/>.
- [x] `gtm_quote_calculator_v1` compatibility and customer-output privacy tests pass.
- [x] CSV formula-injection, JSON projection, immutable-version, and customer-PDF export tests pass.
- [x] Roadmap and release documentation identify Version 2.5 as in progress.

## Physical acceptance required from owner

- [ ] Android Chrome: complete-backup download, inspect, merge, replace, safety-backup, rollback, and quote/library recovery on a physical phone.
- [ ] Laptop Chromium: complete-backup download, inspect, merge, replace, safety-backup, rollback, CSV export, individual JSON/PDF export, and email/PDF fallback.
- [ ] Verify downloaded filenames and open the downloaded JSON/PDF files.
- [ ] Verify corrupted, oversized, tampered, and conflicting backups make no changes.
- [ ] Verify finalized quote numbers, immutable hashes, source links, and customer-safe output remain unchanged after round trips.
- [ ] Verify accessibility and keyboard recovery paths on the laptop.
- [ ] Record device, browser, date, result, and any evidence links below.

## Owner acceptance record

| Device/browser | Date | Result | Evidence | Owner initials |
| --- | --- | --- | --- | --- |
| Android Chrome |  | Pending |  |  |
| Laptop Chromium |  | Pending |  |  |

## Release actions after acceptance

1. Update `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT_ROADMAP.md`, `docs/V25_IMPLEMENTATION_PLAN.md`, `docs/TEST_PLAN.md`, `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md` to record acceptance.
2. Update and visually inspect the roadmap SVG/PNG with Version 2.5 complete and Version 3.0 active.
3. Merge the closeout PR to `main`.
4. Run the post-merge Pages smoke test and verify the deployed commit.
5. Create and push the annotated `v2.5.0` tag at the verified production commit.

## Rollback

Before merge, close the PR and delete the feature branch. After merge, revert the closeout commit. Do not create or move the stable tag until owner acceptance is recorded. Existing local quote data and the V2.5 backup/restore workflows require no migration to roll back this documentation/verification slice.
