# Product Roadmap

## Guiding constraints

Through Version 3.5 the application remains a public, static GitHub Pages application. GitHub provides source control, branches, pull requests, Actions, and hosting. Browser-local storage provides per-device data. There is no authentication, hosted database, custom backend, server function, automatic email delivery, or external email service. Customer and pricing data never belong in the Git repository or an Actions artifact.

The application is phone-first. Laptop layouts are an enhancement of the same workflow, not the source layout squeezed down. Every release preserves calculation behavior unless a separately approved rule change includes migration and regression evidence.

## Version 1.0 — Reliable mobile quote calculator

### Objective

Turn the functioning calculator into a dependable phone-first active-quote builder with a strict boundary between internal profitability and customer-facing communication.

### Included

- Framework-free Vite/ES-module foundation, automated tests, and GitHub Actions build/deployment.
- Mobile quote builder with item add, edit, duplicate, accessible reorder, and delete/undo or confirmation.
- Prominent **New Quote** action that safely clears the current quote and starts a clean draft, with confirmation when information would be lost.
- Company, buyer, email, optional address/phone, quote/expiration dates, payment terms, internal notes, and customer notes.
- Internal cost, profit dollars, markup, and—after terminology approval—gross margin.
- Versioned single-active-quote localStorage model and safer save/recovery behavior.
- Branded, locally generated customer PDF from the owner-supplied template.
- PDF preview and explicit download.
- Customer-safe copy text and prepared `mailto:` recipient/subject/body.
- File-based Web Share when capability detection succeeds.
- Clear download/email/manual-attachment fallback.
- Phone, laptop, accessibility, privacy, and Pages smoke coverage.

### Explicitly excluded

- Quote library, numbering, revisions, finalized immutability, customer database, catalog search, CSV import, backup/restore, PWA/offline shell, login, synchronization, or automatic email attachment/delivery.

### Dependencies

- Current release tag and protected `main` branch.
- Approved calculation terminology and rounding policy.
- Supplied PDF template plus logo, company details, fonts/licenses, terms language, and sample expected output.
- Vite/Vitest/Playwright toolchain and an Actions Pages cutover plan.

### Risks

- Regression while extracting the monolithic script.
- Internal data leaking through PDF/copy/email.
- Mobile PDF rendering and Web Share differences.
- Autosave overwriting an accidental edit or another tab.
- Pages outage during build-source cutover.

### Acceptance criteria

- All legacy calculation fixtures pass unchanged.
- A 360 px-wide viewport requires no page-level horizontal scroll; line items use cards/progressive disclosure.
- Required metadata and all five item operations work by keyboard and touch.
- Customer PDF/text/email contain no unit cost, landed cost, total cost, GTM dollars, markup, gross margin, or internal notes.
- PDF preview/download work; supported devices can invoke file share; fallback names the file to attach.
- Reload restores the active quote or offers recoverable error guidance.
- New Quote clears all customer, quote, item, pricing, note, and calculated-result fields, resets applicable defaults such as dates/terms, and does not allow an accidental tap to destroy an in-progress quote.
- CI tests/build pass and a post-deploy smoke test verifies the `/gtm-calc/` URL.

## Version 1.5 — Catalog search

**Status (2026-07-16): Complete for the initial local release.** PR #9 merged the storage-independent parser/search foundation. PR #10 merged versioned catalog-only local storage, phone-first import/report/search, My Items, recent selections, rollback, and editable item-form population. A representative owner CSV import/search and My Items persistence test passed.

### Objective

Reduce quote-entry time through dependable local search across a standard catalog and rep-created items.

### Included

- Validated standard catalog CSV import with row-level report.
- Catalog-backed product costs and pricing inputs, so selecting a product can populate the current approved values from the imported list.
- Locally stored manual items.
- Unified search by exact/partial SKU, full/partial name, description, and normalized dimensions.
- Recently used items and deterministic ranking.
- Dimension normalization so `12x10x8`, `12 x 10 x 8`, `12 10 8`, and `RSC 12x10x8` share canonical dimension token `12x10x8` while original text remains intact.

### Explicitly excluded

- Remote catalog, supplier API, shared manual items, inventory/availability, pricing history, or quote library.

### Dependencies

- Stable V1 line-item model and item-entry workflow.
- Owner-approved CSV columns, required fields, duplicate-SKU policy, units, encoding, and catalog update procedure.

### Risks

- Ambiguous dimensions/units, duplicate SKUs, malformed CSV, large in-memory searches, and manual/standard item conflicts.

### Acceptance criteria

- Import never silently drops an invalid row and reports accepted/rejected counts with reasons.
- Canonical dimension examples return the same relevant item.
- Exact SKU outranks prefix/substring matches; name/description and recency ranking are tested.
- Manual items persist locally and are visibly distinguished from standard items.
- Selecting a catalog item populates its stored cost/pricing inputs while keeping quote-specific values editable and preserving them in saved quote snapshots.

## Version 2.0 — Local quote library

**Status (2026-07-16): Draft-library UI in progress.** PR #11 merged the separate IndexedDB schema and tested domain/repository behavior. The PR #12 branch adds opt-in legacy import, searchable/reopenable/duplicable drafts, customer/contact recall, and conflict-aware saves while preserving `gtm_quote_calculator_v1` as a fallback. Finalization, numbering, revisions, statuses, and immutable-history UI follow.

### Objective

Replace the single active quote with a durable IndexedDB quote/customer library designed for later hosted migration.

### Included

- IndexedDB repositories, schema migrations, validation, and record quarantine/recovery.
- Draft and finalized quotes, quote recall/search, remembered customers/contacts, duplicate-as-new, revisions, statuses, PDF regeneration, resend/reshare.
- Statuses: Draft, Finalized, Sent, Accepted, Declined, Expired, Cancelled.
- Per-device/year base numbering (`2026-001`) and immutable version revisions (`2026-001-R1`).
- Separate operations for duplicate-as-new and create-revision with source references.
- Immutable finalized `QuoteVersion` snapshots and append-only events for status history.

### Explicitly excluded

- Cross-device/shared numbering, multi-user concurrency, login, hosted database, server email, or cloud synchronization.

### Dependencies

- Stable V1 quote schema/customer projection and V1.5 item references.
- Approved status transitions, numbering reset/collision policy, revision workflow, and retention rules.

### Risks

- IndexedDB upgrade failure, multi-tab number collisions, corrupted legacy records, user confusion between duplicate/revision, and false expectation of cross-device availability.

### Acceptance criteria

- Drafts remain unnumbered; first finalization atomically allocates the next base number.
- Finalized snapshots cannot be edited or overwritten.
- Revisions keep the base number and increment `R#`; the prior PDF regenerates identically.
- Duplicate creates an independent unnumbered draft and retains source references.
- Search/status changes/reopen/regenerate/reshare work after reload and database upgrade.
- A user can start a new quote for a remembered customer, reopen a prior quote, and reuse saved customer and product details without retyping them.

## Version 2.5 — Backup and restore

### Objective

Give users a complete, inspectable escape hatch before PWA/offline expectations increase reliance on local data.

### Included

- Schema-versioned full JSON backup and validated merge/replace restore.
- Pre-replace safety backup, conflict report, and corrupt-record isolation.
- Quote-list, customer, and manual-item CSV exports.
- Individual quote JSON and PDF exports.

### Explicitly excluded

- Scheduled/cloud backup, encrypted cloud storage, bidirectional sync, or importing arbitrary spreadsheets as authoritative quote data.

### Dependencies

- Stable V2 stores/IDs/migrations and documented CSV schemas.

### Risks

- Destructive replace, ID/number collisions during merge, sensitive data in exported files, and restoring future/unsupported schema versions.

### Acceptance criteria

- Invalid/unsupported backups make no changes.
- Restore shows counts/conflicts before confirmation and reports final results.
- Replace can be reversed using the automatically downloaded/prepared safety backup.
- Backup/restore round trips all records and preserves immutable version hashes.

## Version 3.0 — Progressive Web App

### Objective

Make the already-stable local application installable and reliably usable offline without risking stored quotes during updates.

### Included

- Manifest, icons, install guidance, standalone display, service worker, offline application shell/catalog/calculator/draft creation, update notice, and safe cache migration.
- iPhone and Android installation instructions.

### Explicitly excluded

- Background sync to a server, push notifications, authentication, shared data, automatic email, or any Version 1 PWA work.

### Dependencies

- Stable V1–V2.5 workflows/data formats, explicit cache/version policy, and recovery-tested backups.

### Risks

- Stale application code with newer data, broken cache migration, iOS storage eviction, confusing install/update UX, and caching customer artifacts.

### Acceptance criteria

- Fresh install and upgrades preserve local data.
- Offline launch, catalog, calculator, and draft save work after first successful load.
- Update notification lets the user finish/save work before activation.
- Cache migration failure falls back safely and never deletes IndexedDB data.

## Version 3.5 — Mobile workflow improvements

### Objective

Optimize frequent rep workflows after real usage data identifies the highest-friction actions.

### Included

- Candidate features selected only after usage validation: favorites, recent customers, frequent item combinations, customer pricing history, reorder quotes, one-handed controls, drag/swipe reorder, voice-to-text notes, specification attachments, and dark mode.

### Explicitly excluded

- Features without validated demand; hosted/shared capabilities; gesture-only actions with no accessible alternative.

### Dependencies

- Usage feedback, stable PWA, sufficient storage/backup capacity, and accessibility designs for gestures/voice/attachments.

### Risks

- Scope creep, larger local datasets/attachments, privacy permissions, inaccessible gestures, and inconsistent platform APIs.

### Acceptance criteria

- Each selected feature has a measured problem, non-gesture fallback, storage/backup behavior, and device test coverage.
- No candidate ships merely because it is listed here.

## Version 4.0 — Hosted company system

### Objective

Migrate to centralized company operation only when shared access, governance, or integration benefits justify a backend.

### Included

- Future capabilities selected only after architecture/business approval: a Sites-hosted quote workspace, shared quote/customer/product data, authentication, synchronization, centrally managed cost lists, server-sent email attachments, central numbering, Microsoft 365, CRM/ERP, reporting, and permissions.

### Explicitly excluded

- Selecting a vendor, building a backend, introducing auth, or designing company permissions during local versions.

### Dependencies

- Approved business case, security/legal review, ownership/support model, hosted architecture decision, identity provider, migration rehearsal, and the stable export/domain model from V2.5.

### Risks

- Data migration/collision, access control mistakes, compliance, vendor lock-in, operational cost, integration reliability, and changed numbering semantics.

### Acceptance criteria

- Local backups import without losing stable IDs, quote numbers, immutable versions, events, customer relationships, or source links.
- Central number allocation and conflict policy are transactional and audited.
- Authorization, monitoring, recovery, retention, and support are approved before production migration.
