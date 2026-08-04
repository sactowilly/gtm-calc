# Version 2.5 Implementation Plan — Backup and Restore

Status: in progress. Version 2.5 began on 2026-08-03 from the verified `v2.0.0` release line.

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

### PR 2 — Backup download and export workspace (in progress)

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

Rollback: revert this PR. No schema migration or stored-data transformation occurs; downloaded files already saved by a user remain outside application control.

### PR 3 — Restore inspection and conflict planning

Goal: parse a selected JSON file without writes and show a complete restore preview. Include a file-size guard, schema/checksum/version validation, record counts, corrupt/unsupported record isolation, missing-reference reporting, duplicate ID/number/hash analysis, and an explicit merge-versus-replace plan. Invalid files make no changes.

### PR 4 — Transactional merge and replace

Goal: execute an owner-confirmed restore safely. Require a pre-restore safety backup, refuse immutable-version conflicts, apply explicit mutable-record policies, use a single multi-store IndexedDB transaction, coordinate localStorage staging/rollback, and perform post-restore validation with a detailed report.

### PR 5 — CSV and individual-record exports

Goal: deliver quote-list, customer, and manual-item CSV exports with RFC 4180 quoting and formula-injection protection; individual quote JSON export; and existing customer-safe PDF export from a chosen immutable version.

### PR 6 — Version 2.5 release hardening and closeout

Goal: verify the complete round trip on physical phone/laptop browsers and publish stable `v2.5.0` only after owner acceptance. Evidence includes merge/replace rehearsals, collision fixtures, immutable-hash preservation, corrupt-record recovery, large-file behavior, accessibility, direct-source Pages compatibility, production build, post-merge Pages smoke, rollback instructions, roadmap advancement to Version 3.0, and an annotated stable tag.

## Release acceptance

- A complete backup round trips all normal and recovery records without changing stable IDs, quote numbers, source links, or immutable hashes.
- Unsupported, corrupted, truncated, oversized, and tampered files make no changes.
- Restore previews counts and conflicts before confirmation and reports the committed outcome afterward.
- Replace is reversible through the safety backup; injected failures leave the prior state intact.
- CSV exports cannot execute spreadsheet formulas from customer-entered values.
- Customer-facing PDFs/exports retain the existing privacy allowlist.
- Physical Android Chrome and laptop Chromium acceptance plus automated unit, browser, accessibility, source-hosting, and production-build checks pass.

## Deliberately deferred

PWA installation/offline caching belongs to Version 3.0. Favorites and other workflow optimizations belong to Version 3.5. Shared storage, authentication, centralized numbering, server email, CRM/ERP integrations, and permissions belong to the possible Version 4 hosted migration.
