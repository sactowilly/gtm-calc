# Version 2 Release Checklist

This checklist records the accepted Version 2 release candidate and governs the remaining stable-publication steps. All required automated checks, owner decisions, physical-device checks, production smoke, and rollback/re-entry evidence passed. Version 2 is complete; create the `v2.0.0` tag only after the closeout change merges and that deployment is verified.

## Release candidate identity

- Candidate branch: `feature/v2-release-hardening`
- Candidate commit: `22cf29960c8b6af3f83509cbe1297812b2a68b3d`
- Merge commit: `3e41007988df6134d9982feb998e6e633977c48d`
- Accepted production-candidate marker: `v2.0.0 · release-candidate.1`
- Accepted production-candidate package: `2.0.0-rc.1`
- Closeout marker: `v2.0.0 · stable`
- Closeout package version: `2.0.0`
- GitHub Pages base path: `/gtm-calc/`
- Production URL: <https://sactowilly.github.io/gtm-calc/>
- Pull-request CI: run `30130612587` — PASS
- Pages deployment: run `30132341911` — PASS

## Owner policy decisions

### Customer and contact matching — approved

Accepted Version 2 behavior:

- A deliberately selected saved customer/contact uses its stable record IDs.
- An unbound save reuses the first exact normalized company-name match.
- Within that customer, an exact normalized email match is reused automatically.
- When the email is blank, an exact normalized buyer-name match is reused automatically.
- Same-name company disambiguation and blank-email confirmation are not part of Version 2 and remain documented limitations for a later approved slice.

Owner decision: [x] Approved [ ] Revise — 2026-07-27

### Duplicate reset behavior — approved

Recommended current behavior:

- Reset quote number, lifecycle status/events, quote date, and expiration.
- Retain customer/contact, line items/pricing, sales rep, shipping, terms, and customer notes.
- Keep the visible `DUP` review state until the duplicate's first successful save.

Owner decision: [x] Approved [ ] Revise — 2026-07-27

### Deletion and archive — explicit deferral

Recommendation: do not add deletion, archive, or abandoned-revision cleanup during release hardening. Address retention controls in a separate approved roadmap slice.

Owner decision: [x] Defer as recommended [ ] Revise — 2026-07-27

## Automated release gate

Record the exact results; do not copy counts from an earlier commit.

- [x] `npm ci`
- [x] `npm run check`
- [x] `npm test`
- [x] `npm run test:visual`
- [x] `npm run test:compat`
- [x] `npm run test:source`
- [x] Production-artifact smoke equivalent to `npm run test:production` ran in CI as separate build and Playwright production-smoke steps.
- [x] Direct-source smoke has no console errors, page errors, missing assets, or wrong-root requests.
- [x] Production artifact loads and reloads at `/gtm-calc/`.
- [x] Atomicity tests prove failed draft/finalization operations leave no partial customer, quote, version, event, or counter changes.
- [x] Multi-tab tests prove stale saves are rejected and concurrent numbering remains unique within one browser database.
- [x] Corrupt records are preserved for recovery while healthy quotes remain usable.
- [x] Customer PDF, customer copy, and customer email contain no cost, freight cost, GTM/markup, vendor/source IDs, internal notes, or other profitability fields.
- [x] No new manifest, service worker, PWA behavior, backend, authentication, or hosted data dependency exists.

Result: PASS on PR #19 head `22cf299`; CI run `30130612587`.

## Android Chrome acceptance

Use synthetic customer data over HTTPS.

- [x] Quote, Library, Customers, and Catalog navigation preserves unsaved values.
- [x] Software keyboard does not cover the focused field or required actions.
- [x] Save two drafts, reload, search, and reopen both.
- [x] Cancelling saved-customer or catalog replacement keeps current values.
- [x] Reopening a dirty draft warns; Cancel preserves work and Continue restores the saved draft.
- [x] Duplicate is unnumbered and marked `DUP`; its first successful save clears the marker.
- [x] Base finalization creates the next `YYYY-NNN` number.
- [x] Revision finalization creates `-R1` while the prior version remains unchanged and viewable.
- [x] Approved status transitions work and terminal outcomes cannot reopen.
- [x] Real branded PDF previews and downloads without overlap or clipping.
- [x] Native Share Sheet receives the current PDF file when supported.
- [x] Customer copy/email/PDF privacy is manually checked with recognizable internal sentinel values.
- [x] Portrait and landscape layouts have no horizontal overflow or clipped navigation/actions.

Owner/device/date/result: Samsung Galaxy S24 Ultra / Chrome / 2026-07-27 / PASS

## Laptop Chromium acceptance

The owner approved Chrome on the Dell desktop as the Version 2 laptop Chromium substitution for Edge. Edge remains an ongoing compatibility target.

- [x] Existing `gtm_quote_calculator_v1` and IndexedDB data load without loss.
- [x] Two tabs demonstrate stale-save rejection without overwriting the newer draft.
- [x] Search finds long customer/contact/item text and historical quote numbers.
- [x] Current and historical PDFs regenerate from immutable versions.
- [x] Email Rep remains internal; Email Customer and Copy Customer Quote remain customer-safe.
- [x] PDF download and manual-attachment wording are correct.
- [x] Keyboard navigation, focus visibility, 200% zoom, and direct `/gtm-calc/` reload are usable.
- [x] Browser console has no application errors.

Owner/device/date/result: Dell desktop / Chrome / 2026-07-27 / PASS; owner-approved Edge substitution

## Rollback and re-entry drill

- [x] Record the legacy localStorage raw value plus Version 2 quote/version/event/settings/recovery counts and finalized hashes.
- [x] Load accepted Version 1.5 commit `3f1f1a0` at the same origin without deleting IndexedDB.
- [x] Confirm the legacy active quote remains usable.
- [x] Restore the Version 2 candidate.
- [x] Confirm all Version 2 IDs, immutable hashes, counters, and recovery records match the pre-rollback inventory.
- [x] Allocate the next test quote number and confirm the sequence continues without reuse.

Result: PASS on 2026-07-27. The recorded legacy raw value and all IndexedDB counts, IDs, finalized hashes, counters, and recovery records were preserved; the next allocated number was `2026-002`.

## Merge and production closeout

The feature branch and pull request must not deploy production.

- [x] Pull-request checks passed without an unexplained retry: run `30130612587`.
- [x] Merge the reviewed candidate into `main` as `3e41007`.
- [x] Confirm the GitHub Pages deployment succeeds from `main`: run `30132341911`.
- [x] Smoke the live URL on phone and laptop: marker, direct reload, assets, calculator, library recall, PDF generation, and customer privacy passed.
- [x] Record owner decisions and physical-device acceptance before stable closeout. PR #19 had already merged as the release candidate; stable acceptance was recorded on 2026-07-27.
- [x] Prepare a closeout change that records the production result, marks Version 2 complete, and changes the roadmap's next phase to Version 2.5.
- [x] Merge PR #20 as `b61890c` and verify GitHub Pages deployment run `30304688708`.
- [x] Tag verified production commit `b61890c` with annotated tag `v2.0.0`.

Production release-candidate commit/deployment/smoke: `3e41007` / run `30132341911` / PASS on 2026-07-27.

Closeout deployment/tag: PR #20 CI run `30304252373`, merge `b61890c`, Pages run `30304688708`, live stable smoke, and annotated tag `v2.0.0` — PASS on 2026-07-27.
