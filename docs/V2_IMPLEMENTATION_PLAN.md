# Version 2 Implementation Plan

## Objective and safety boundary

Replace the single active quote with a phone-first, per-browser quote/customer library while preserving the current calculations, catalog, PDF privacy projection, email behavior, and GitHub Pages deployment. Version 2 remains entirely local: no authentication, backend, synchronization, global numbering, or automatic email delivery.

The existing `gtm_quote_calculator_v1` value remains readable throughout the transition. Library import must copy it before the owner explicitly chooses to remove the legacy active copy. A Version 2 rollback must therefore be able to return to the Version 1.5 UI without data migration.

## Reviewable pull-request sequence

### PR 11 — Quote-library domain and IndexedDB foundation

Goal: prove the record shapes and transaction rules without replacing the working UI.

Included:

- Pinned `idb` runtime helper and test-only `fake-indexeddb`.
- Database version 1 and quote/version/event/settings/recovery stores.
- Lossless active-quote/content conversion.
- Unnumbered draft creation/save/search.
- Explicit-year transactional base numbering.
- Immutable hashed versions, revision allocation, and duplicate lineage.
- Corrupt-record quarantine and browser IndexedDB smoke coverage.
- `v2.0.0 · quote-library-foundation.1` build marker.

Excluded: visible library controls, automatic legacy migration, customer/contact persistence, status changes, quote deletion, backup/restore, catalog migration, and any change to `gtm_quote_calculator_v1`.

Rollback: revert the PR. Since the new repository is not connected to the visible app and does not mutate the active quote key, Version 1.5 behavior and data remain available. The unused `gtm_quote_manager` database may remain harmlessly on a device until a later cleanup/export policy is approved.

### PR 12 — Draft library, customer recall, and legacy import UI

Goal: let a user opt into the local library, save multiple unnumbered drafts, find/reopen them, and reuse customer/contact data.

Included:

- Phone-first Quotes screen/list/search and clear local-device disclosure.
- One-time, non-destructive “Add current saved quote to library” workflow.
- Create, save, reopen, and duplicate draft operations.
- Customer/contact repositories and customer/contact selection/editing.
- Unsaved-change, multi-tab revision-token, storage-unavailable, and recovery-count states.
- Existing calculator/PDF/email/catalog services continue to receive their current shapes through adapters.

Excluded: finalization/number allocation controls, finalized-version editing, revisions, status workflow, delete/purge, and backup/restore.

Rollback: revert the UI connection. Keep `gtm_quote_calculator_v1` updated during the transition so the stable active-quote workflow remains usable. Do not delete IndexedDB records.

### PR 13 — Finalization, numbering, immutable history, duplicate, and revision UI

Goal: complete the quote lifecycle with clear, distinct user operations.

Included:

- Finalize confirmation and local-device/year numbering disclosure.
- Finalized read-only view and PDF regeneration from the selected immutable version.
- Duplicate as new unnumbered draft.
- Create revision from a selected finalized version; R1/R2 allocation on finalization.
- Status changes with append-only events after owner approves the transition matrix.
- Resend/reshare existing finalized versions using the existing customer-safe services.

Excluded: shared/global numbering, automatic email, server sync, backup/restore, and arbitrary editing of finalized versions.

Rollback: disable lifecycle actions and revert the UI/service connection. Preserve IndexedDB and the active quote bridge; never delete or renumber committed versions during rollback.

### PR 14 — Version 2 release hardening

Goal: validate upgrades, recovery, accessibility, phone/laptop workflows, and production deployment before calling Version 2 stable.

Included:

- Multi-tab allocation/conflict tests and real-device Android/laptop smoke tests.
- Database upgrade and injected-failure tests.
- Search scale/long-text/accessibility tests.
- Recovery-record visibility/export guidance without destructive repair.
- Documentation, deployment smoke, and release tag checklist.

Excluded: complete backup/restore (Version 2.5), PWA/offline shell (Version 3), and hosted access (Version 4).

## Owner approvals needed before affected controls ship

1. Numbering year: quote-date year or finalization-date year. The foundation requires the caller to provide the year and does not decide silently.
2. Status transition matrix, including whether Accepted/Declined/Expired/Cancelled are terminal and who may reopen them.
3. Draft deletion/archive behavior and retention of abandoned revisions.
4. Customer/contact merge rules when names or email addresses match.
5. Which fields a duplicate resets besides number, date, status, and events.
6. Whether a revision can be based on any finalized version or only the latest one.

## Version 2 completion gate

- Existing `gtm_quote_calculator_v1` data can be copied into the library without loss.
- Multiple drafts survive reload and are searchable by customer/contact/item.
- Base and revision numbers are atomic and unique within one browser database.
- Finalized content cannot be overwritten and regenerates the same customer-facing content.
- Duplicate and revision are visibly different operations with the required lineage.
- Corrupt records do not prevent healthy quotes from loading.
- Android and laptop workflows pass, CI/build pass, and the Pages production path remains `/gtm-calc/`.
