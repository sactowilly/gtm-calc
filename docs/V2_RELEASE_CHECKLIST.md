# Version 2 Release Checklist

This checklist governs the Version 2 release candidate and the post-merge production closeout. Do not mark Version 2 complete or create the `v2.0.0` tag until every required automated check, owner decision, physical-device check, and production smoke is recorded against an exact commit.

## Release candidate identity

- Candidate branch: `feature/v2-release-hardening`
- Candidate commit: pending
- Visible marker: `v2.0.0 · release-candidate.1`
- Package version: `2.0.0-rc.1`
- GitHub Pages base path: `/gtm-calc/`
- Production URL: <https://sactowilly.github.io/gtm-calc/>

## Owner policy decisions

### Customer and contact matching — approval required

Recommended rule:

- A deliberately selected saved customer/contact uses its stable record IDs.
- An unbound save may identify a customer candidate by exact normalized company name, but it must not silently merge separate same-name companies.
- Within the selected customer, an exact normalized email may match automatically.
- A name-only contact match when email is blank requires confirmation before updating an existing record.

Owner decision: [ ] Approved [ ] Revise

### Duplicate reset behavior — approval required

Recommended current behavior:

- Reset quote number, lifecycle status/events, quote date, and expiration.
- Retain customer/contact, line items/pricing, sales rep, shipping, terms, and customer notes.
- Keep the visible `DUP` review state until the duplicate's first successful save.

Owner decision: [ ] Approved [ ] Revise

### Deletion and archive — explicit deferral

Recommendation: do not add deletion, archive, or abandoned-revision cleanup during release hardening. Address retention controls in a separate approved roadmap slice.

Owner decision: [ ] Defer as recommended [ ] Revise

## Automated release gate

Record the exact results; do not copy counts from an earlier commit.

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run test:visual`
- [ ] `npm run test:compat`
- [ ] `npm run test:source`
- [ ] `npm run test:production`
- [ ] Direct-source smoke has no console errors, page errors, missing assets, or wrong-root requests.
- [ ] Production artifact loads and reloads at `/gtm-calc/`.
- [ ] Atomicity tests prove failed draft/finalization operations leave no partial customer, quote, version, event, or counter changes.
- [ ] Multi-tab tests prove stale saves are rejected and concurrent numbering remains unique within one browser database.
- [ ] Corrupt records are preserved for recovery while healthy quotes remain usable.
- [ ] Customer PDF, customer copy, and customer email contain no cost, freight cost, GTM/markup, vendor/source IDs, internal notes, or other profitability fields.
- [ ] No new manifest, service worker, PWA behavior, backend, authentication, or hosted data dependency exists.

## Android Chrome acceptance

Use synthetic customer data over HTTPS.

- [ ] Quote, Library, Customers, and Catalog navigation preserves unsaved values.
- [ ] Software keyboard does not cover the focused field or required actions.
- [ ] Save two drafts, reload, search, and reopen both.
- [ ] Cancelling saved-customer or catalog replacement keeps current values.
- [ ] Reopening a dirty draft warns; Cancel preserves work and Continue restores the saved draft.
- [ ] Duplicate is unnumbered and marked `DUP`; its first successful save clears the marker.
- [ ] Base finalization creates the next `YYYY-NNN` number.
- [ ] Revision finalization creates `-R1` while the prior version remains unchanged and viewable.
- [ ] Approved status transitions work and terminal outcomes cannot reopen.
- [ ] Real branded PDF previews and downloads without overlap or clipping.
- [ ] Native Share Sheet receives the current PDF file when supported.
- [ ] Customer copy/email/PDF privacy is manually checked with recognizable internal sentinel values.
- [ ] Portrait and landscape layouts have no horizontal overflow or clipped navigation/actions.

Owner/device/date/result: pending

## Laptop Edge acceptance

- [ ] Existing `gtm_quote_calculator_v1` and IndexedDB data load without loss.
- [ ] Two tabs demonstrate stale-save rejection without overwriting the newer draft.
- [ ] Search finds long customer/contact/item text and historical quote numbers.
- [ ] Current and historical PDFs regenerate from immutable versions.
- [ ] Email Rep remains internal; Email Customer and Copy Customer Quote remain customer-safe.
- [ ] PDF download and manual-attachment wording are correct.
- [ ] Keyboard navigation, focus visibility, 200% zoom, and direct `/gtm-calc/` reload are usable.
- [ ] Browser console has no application errors.

Owner/device/date/result: pending

## Rollback and re-entry drill

- [ ] Record the legacy localStorage raw value plus Version 2 quote/version/event/settings/recovery counts and finalized hashes.
- [ ] Load the accepted Version 1.5 source at the same origin without deleting IndexedDB.
- [ ] Confirm the legacy active quote remains usable.
- [ ] Restore the Version 2 candidate.
- [ ] Confirm all Version 2 IDs, immutable hashes, counters, and recovery records match the pre-rollback inventory.
- [ ] Allocate the next test quote number and confirm the sequence continues without reuse.

Result: pending

## Merge and production closeout

The feature branch and pull request must not deploy production.

- [ ] Pull-request checks pass without an unexplained retry.
- [ ] Owner decisions and physical-device acceptance are recorded before merge.
- [ ] Merge the reviewed candidate into `main`.
- [ ] Confirm the GitHub Pages deployment succeeds from `main`.
- [ ] Smoke the live URL: marker, direct reload, assets, calculator, library recall, PDF generation, and customer privacy.
- [ ] Open a documentation-only closeout PR that records the production result, marks Version 2 complete, and changes the infographic's next phase to Version 2.5.
- [ ] Tag the verified production commit `v2.0.0`.

Production commit/deployment/smoke/tag: pending
