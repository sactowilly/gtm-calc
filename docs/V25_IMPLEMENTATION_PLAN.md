# Version 2.5 Implementation Plan — Backup and Restore

Status: complete after owner acceptance, post-merge Pages verification, and annotated tag `v2.5.0` publication on 2026-08-06. Version 3.0 planning is now active from the verified Version 2.5 recovery boundary.

## Release objective

Give the user a complete, inspectable, device-local escape hatch for every quote, finalized version, event, customer/contact, setting, recovery record, active quote, catalog snapshot, manual item, and recent-use record before Version 3 adds offline application caching. All files are generated and processed locally in the browser; nothing is uploaded.

## Fixed boundaries

- Preserve calculations, customer-output privacy, `gtm_quote_calculator_v1`, quote numbering, immutable version hashes, current email/PDF behavior, and GitHub Pages hosting.
- Do not add a service worker, PWA manifest, backend, authentication, cloud storage, synchronization, automatic email, or arbitrary spreadsheet-to-quote import.
- JSON is the authoritative backup format. CSV files are explicitly lossy reporting exports.
- A restore file is never allowed to write until parsing, schema/checksum validation, reference validation, conflict analysis, and owner confirmation succeed.
- A replace restore requires a current-data safety backup first. A failed transaction must leave existing data unchanged.

## Pull-request sequence

### PR 1 — Backup foundation (complete)

Goal: establish the lossless, versioned backup contract and prove that all current stores can be read consistently without modifying them.

Deliverables:

- One readonly IndexedDB transaction captures all eight stores.
- Scoped localStorage capture includes the active quote, active/prior catalogs, manual items, usage history, and recovery entries while excluding navigation/session keys and unrelated origin data.
- Stable ordering and canonical JSON produce a SHA-256 payload checksum.
- Validation rejects unsupported envelopes, malformed known storage records, duplicate IDs/numbers, broken references, altered immutable version content, and payload tampering.
- The visible marker is `v2.5.0 · backup-foundation.1`; package version is `2.5.0-alpha.1`.

Acceptance:

- Existing source data is record-for-record unchanged after snapshot creation.
- Every current business/recovery store appears in the envelope.
- Equivalent snapshots generate identical payloads and checksums.
- No backup/restore controls appear yet and no production deployment runs from the feature branch.

Rollback: revert this PR. The new services are not yet connected to the UI or write paths; Version 2 data remains unchanged.

### PR 2 — Backup download and export workspace (complete)

Goal: provide an accessible Backup & Export surface and download a validated complete JSON backup. Include a sensitive-data warning, deterministic UTC-dated filename, progress/status messages, Blob download with explicit failure handling, file-size reporting, and phone/laptop coverage. The operation remains read-only.

Deliverables:

- Add an `Export` phone/laptop workspace that preserves active quote state and provides one `Download Complete Backup` action.
- Share the initialized quote repository with the backup workflow so a first click cannot race creation of the device settings record.
- Revalidate the exact readable JSON bytes before creating an `application/json;charset=utf-8` Blob.
- Download as `gtm-calc-backup-YYYY-MM-DD.json`, report the Blob's exact byte size, and use truthful “download requested” language that does not claim the browser saved the file.
- Warn permanently that the unencrypted file includes customer/contact information and internal pricing/profitability; no data is uploaded.
- The visible marker is `v2.5.0 · backup-download.2`; package version is `2.5.0-alpha.2`.

Acceptance:

- The actual downloaded file parses and passes full envelope/checksum validation.
- All persisted business/recovery records are included; unrelated local/session/navigation data is excluded.
- Successful and failed download attempts leave IndexedDB and browser storage unchanged.
- Phone/laptop navigation, accessibility, busy state, cleanup, retry, direct-source hosting, and production build checks pass.
- No restore, CSV, individual-record export, PWA, backend, or deployment behavior is introduced.

Acceptance record: PR #24 merged as `c1cd4c2` with green pull-request CI. Physical Android Chrome and laptop Chromium download acceptance remains required Version 2.5 release evidence; it is tracked separately and has not been claimed complete.

Rollback: revert this PR. No schema migration or stored-data transformation occurs; downloaded files already saved by a user remain outside application control.

### PR 3 — Restore inspection and conflict planning (complete)

Goal: parse a selected JSON file without writes and show a complete restore preview. Include a file-size guard, schema/checksum/version validation, record counts, corrupt/unsupported record isolation, missing-reference reporting, duplicate ID/number/hash analysis, and an explicit merge-versus-replace plan. Invalid files make no changes.

Deliverables:

- A 25 MiB pre-read file guard, strict UTF-8 decoding, local JSON parsing, and full existing-envelope validation.
- A readonly current-device snapshot only after the incoming file validates.
- Sanitized aggregate preview data: incoming/current totals, mutable/local-storage differences, immutable-version/event conflicts, and quote-number collisions without customer names, emails, IDs, pricing, or raw file content.
- A phone/laptop accessible Export preview UI with no Merge or Replace control and clear recovery/retry states.
- The visible marker is `v2.5.0 · restore-inspection.3`; package version is `2.5.0-alpha.3`.

Acceptance:

- Empty, oversized, malformed, non-UTF-8, unsupported, tampered, duplicate, and broken-reference files cause no read beyond the needed guard and no stored-data mutation.
- Valid files show only safe metadata/counts and a future restore plan; inspection never writes IndexedDB, localStorage, or sessionStorage and never sends a network request.
- Same-ID immutable version/event changes and finalized-number collisions are visibly blocking for a future merge.
- Accessibility, direct-source Pages, production-build, and mobile/laptop coverage pass.

Rollback: revert this PR. No repository restore/import/clear API, schema migration, or data transformation is introduced.

Acceptance record: PR #25 merged as `ac288a4` with green pull-request CI. The no-write browser UI intentionally shows only aggregate counts/conflicts and the PR 2 physical backup-download checks remain separate Version 2.5 release evidence.

### PR 4 — Transactional merge and replace (complete)

Goal: execute an owner-confirmed restore safely. Require a pre-restore safety backup, refuse immutable-version conflicts, apply explicit mutable-record policies, use a single multi-store IndexedDB transaction, coordinate localStorage staging/rollback, and perform post-restore validation with a detailed report.

Deliverables:

- Revalidate the selected file and its full envelope immediately before a restore; the UI never passes raw record content to the screen.
- Keep restore choices hidden until a valid local inspection completes. Offer Merge, which preserves this device's mutable conflicts, and Replace, which intentionally replaces the scoped local dataset.
- Require the owner to type `RESTORE`; disable both choices for immutable-version/event conflicts or finalized-number collisions.
- Request/download a new complete safety backup before the first IndexedDB or scoped localStorage write. Announce its neutral filename before the transaction starts.
- Apply the chosen scoped restore in one multi-store IndexedDB transaction with staged localStorage rollback. Validate the committed state and report only aggregate completion data.
- Immediately lock the stale in-memory calculator/library UI after a successful restore and reload the application before the restored data can be saved over by pre-restore memory.
- Preserve `gtm_quote_calculator_v1`, calculation behavior, customer PDF/privacy rules, GitHub Pages source, and the existing Export download behavior.
- The visible marker is `v2.5.0 · restore-transaction.4`; package version is `2.5.0-alpha.4`.

Acceptance:

- Invalid, altered, oversized, or newly conflicting files make no change, including when they were valid at inspection time.
- No write begins unless the safety-backup download request succeeds; a failed request leaves all persisted state unchanged.
- Injected IndexedDB/localStorage/post-validation failures restore the prior state or leave it unchanged; no partial records remain.
- Merge adds only safe incoming records and keeps current mutable conflict records. Replace restores the selected backup's scoped records while retaining an immediately downloadable safety backup.
- The phone/laptop UI has 44 px controls, keyboard-operable radio/confirmation flow, clear destructive wording, live busy/error announcements, no raw backup/customer/pricing content, and no accidental double activation.
- A successful restore disables stale application controls and reloads fresh persisted state before any quote/library action can run.
- Browser, source-hosting, production-build, accessibility, privacy, and transaction tests pass; physical release evidence remains for PR 6.

Rollback: revert this PR. If a restore has already completed, retain the automatically requested safety backup, inspect it, then restore it through the same confirmed workflow; do not clear browser storage manually.

Acceptance record: PR #26 merged into `main` as `5ed749f` with the full pull-request CI workflow green (`test-and-build`, run `31023072205`).

### PR 5 — CSV and individual-record exports (complete)

Goal: deliver quote-list, customer, and manual-item CSV exports with RFC 4180 quoting and formula-injection protection; individual quote JSON export; and existing customer-safe PDF export from a chosen immutable version.

Status: complete. PR #27 merged into `main` as `90823ea` with green pull-request CI and successful Pages deployment. The next closeout branch advances the marker to `v2.5.0 · release-closeout.6`; package version is `2.5.0-alpha.6`.

Deliverables:

- Add local Export-workspace buttons for quote-list, customer, and manual-item CSV reports. Reports are sorted, UTF-8 Blob downloads with CRLF/RFC 4180 quoting and formula-like cell protection.
- Add saved-quote-card actions for individual JSON and customer-safe PDF downloads. Drafts export their working content; finalized quotes export only an explicitly selected immutable version, including historical version actions.
- Keep the existing `gtm_quote_calculator_v1` and customer-PDF allowlist unchanged. Export status remains neutral and reports no raw customer, pricing, or identifier data.
- Add unit and five-profile browser coverage for serialization, privacy, immutable-version selection, deterministic filenames, local download behavior, status/error recovery, and no-network behavior.

Acceptance:

- Each CSV button requests a deterministic local download and leaves persisted data unchanged; empty, Unicode, multiline, quoted, and formula-like values remain safe and parseable.
- Quote-list, customer, and manual-item reports contain only their documented reporting fields; no internal cost/margin columns are present.
- Draft JSON exports open as valid individual records; finalized JSON/PDF exports reject an omitted version and preserve the selected immutable display number/content.
- Customer PDF exports continue through `toCustomerQuoteDocument` and expose no cost, freight, landed cost, GTM, internal note, vendor, or internal-ID fields.
- Phone/laptop controls remain accessible with truthful status/error recovery and no production deployment from the feature branch.

Rollback: revert this PR. Export buttons and services are read-only; already-downloaded files are outside application control. Existing quote storage, backup/restore, PDF, email, and calculation behavior remain available after revert.


### PR 6 — Version 2.5 release hardening and closeout (complete)

Goal: verify the complete round trip on physical phone/laptop browsers and publish stable `v2.5.0` only after owner acceptance. Evidence includes merge/replace rehearsals, collision fixtures, immutable-hash preservation, corrupt-record recovery, large-file behavior, accessibility, direct-source Pages compatibility, production build, post-merge Pages smoke, rollback instructions, roadmap advancement to Version 3.0, and an annotated stable tag.

Status: complete. PR #28 merged to `main` as `0716350`; the visible marker is `v2.5.0 · release-closeout.6`; package version is `2.5.0-alpha.6`. Owner acceptance passed on Samsung Galaxy S24 Ultra/Chrome and Dell desktop/Chrome on 2026-08-06. Pages deployment `31128417026` and post-merge smoke passed. Annotated tag `v2.5.0` identifies the verified closeout merge `7ab4d2e`.

Deliverables:

- Record the merged PR5, green CI, successful Pages deployment, local checks, and current production marker.
- Provide an explicit owner-facing device checklist for backup download, inspection, merge/replace, safety-backup recovery, rollback, CSV/JSON/PDF exports, privacy, and accessibility.
- Record the two device results and owner acceptance in `V25_RELEASE_CHECKLIST.md`.
- Update the roadmap infographic/docs to mark Version 2.5 complete and Version 3.0 active, merge the acceptance documentation, run post-merge Pages smoke, and create the annotated tag at the verified production commit.

## Release acceptance

- A complete backup round trips all normal and recovery records without changing stable IDs, quote numbers, source links, or immutable hashes.
- Unsupported, corrupted, truncated, oversized, and tampered files make no changes.
- Restore previews counts and conflicts before confirmation and reports the committed outcome afterward.
- Replace is reversible through the safety backup; injected failures leave the prior state intact.
- CSV exports cannot execute spreadsheet formulas from customer-entered values.
- Customer-facing PDFs/exports retain the existing privacy allowlist.
- Physical Android Chrome and laptop Chromium acceptance plus automated unit, browser, accessibility, source-hosting, and production-build checks pass. Annotated tag `v2.5.0` now identifies the verified production commit.

## Deliberately deferred

PWA installation/offline caching is the active Version 3.0 planning scope. Favorites and other workflow optimizations belong to Version 3.5. Shared storage, authentication, centralized numbering, server email, CRM/ERP integrations, and permissions belong to the possible Version 4 hosted migration.
