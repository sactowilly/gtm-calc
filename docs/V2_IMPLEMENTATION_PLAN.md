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

Status: merged in PR #12.

Goal: let a user opt into the local library, save multiple unnumbered drafts, find/reopen them, and reuse customer/contact data.

Included:

- Phone-first Quotes screen/list/search and clear local-device disclosure.
- One-time, non-destructive “Add current saved quote to library” workflow.
- Create, save, reopen, and duplicate draft operations.
- Customer/contact repositories and customer/contact selection/editing.
- Unsaved-change, multi-tab revision-token, storage-unavailable, and recovery-count states.
- Existing calculator/PDF/email/catalog services continue to receive their current shapes through adapters.
- Conflict-aware saves use an atomic integer draft revision; customer/contact updates and the draft commit share one IndexedDB transaction.

Excluded: finalization/number allocation controls, finalized-version editing, revisions, status workflow, delete/purge, and backup/restore.

Rollback: revert the UI connection. Keep `gtm_quote_calculator_v1` updated during the transition so the stable active-quote workflow remains usable. Do not delete IndexedDB records.

### PR 13 — GitHub Pages source-import hotfix

Status: merged. The directly hosted source now imports the committed IndexedDB helper through a browser-resolvable relative path, with regression coverage for source-hosted module imports.

### PR 14 — Quote-library list usability

Status: merged in PR #14.

Goal: keep a growing phone library scannable and make a newly created duplicate unmistakable without changing customer-facing data.

Included:

- Show the ten newest matching drafts first, with ten-at-a-time progressive disclosure and search across all 100 repository results.
- Display total and shown counts while retaining open/unsaved state.
- Show a pale, text-labeled `DUP` state when `sourceQuoteId` is present and `draftRevision` is zero.
- Clear the temporary duplicate state only after the first successful draft save.
- Fifty-draft phone, search, accessibility, customer-name privacy, and duplicate-save regression coverage.

Excluded: quote titles, automatic duplicate opening, deletion/archive, repository pagination, schema migrations, and lifecycle controls.

### PR 15 — Finalization, numbering, immutable history, duplicate, and revision UI

Status: merged.

Goal: complete the quote lifecycle with clear, distinct user operations.

Included:

- Finalize confirmation and local-device/year numbering disclosure.
- Finalized read-only view and PDF regeneration from the selected immutable version.
- Duplicate as new unnumbered draft.
- Create revision from the latest finalized version; R1/R2 allocation on finalization while prior versions remain selectable for output.
- Controlled status changes with append-only events: Finalized → Sent/Cancelled; Sent → Accepted/Declined/Expired/Cancelled; outcome states are terminal.
- Resend/reshare existing finalized versions using the existing customer-safe services.

Excluded: shared/global numbering, automatic email, server sync, backup/restore, and arbitrary editing of finalized versions.

Rollback: disable lifecycle actions and revert the UI/service connection. Preserve IndexedDB and the active quote bridge; never delete or renumber committed versions during rollback.

### PR 16 — Open-quote return navigation

Status: merged.

Goal: collapse the library and return the user to the active quote when they open/reopen a quote or begin a revision.

Included:

- Return to the active quote after an Open/Reopen action or a revision start.
- Preserve the loaded active-quote state and existing library card state.

Excluded: new navigation architecture, data/schema changes, and lifecycle-policy changes.

### PR 17 — Mobile workspace navigation

Status: current candidate.

Goal: reduce all-on-one-page clutter by giving the phone and laptop distinct, accessible workspaces without unmounting the active quote or altering storage behavior.

Included:

- Four destinations: Quote, Quotes, Customers, and Catalog.
- Fixed phone bottom navigation and a sticky laptop navigation rail.
- Preserve active form values when changing destinations.
- Return to Quote after a quote is opened, a saved customer is applied, or a catalog item is selected.
- Phone/laptop layout, touch-target, overflow, and workflow regression coverage.

Excluded: routing framework, separate URL routes, customer CRUD, catalog/schema migration, new lifecycle rules, backup/restore, and PWA navigation.

Rollback: revert the view/navigation files and restore the prior one-document layout. Existing localStorage and IndexedDB records are untouched.

### PR 18 — Version 2 release hardening

Goal: validate upgrades, recovery, accessibility, phone/laptop workflows, and production deployment before calling Version 2 stable.

Included:

- Multi-tab allocation/conflict tests and real-device Android/laptop smoke tests.
- Database upgrade and injected-failure tests.
- Search scale/long-text/accessibility tests.
- Recovery-record visibility/export guidance without destructive repair.
- Documentation, deployment smoke, and release tag checklist.

Excluded: complete backup/restore (Version 2.5), PWA/offline shell (Version 3), and hosted access (Version 4).

## Owner approvals needed before affected controls ship

1. ~~Numbering year~~ — approved: use the finalization date's year.
2. ~~Status transition matrix~~ — approved: Finalized → Sent/Cancelled; Sent → Accepted/Declined/Expired/Cancelled; outcome states are terminal.
3. Draft deletion/archive behavior and retention of abandoned revisions.
4. Customer/contact merge rules when names or email addresses match.
5. Which fields a duplicate resets besides number, date, status, and events.
6. ~~Revision source~~ — approved: only the latest finalized version can start a revision.

## Version 2 completion gate

- Existing `gtm_quote_calculator_v1` data can be copied into the library without loss.
- Multiple drafts survive reload and are searchable by customer/contact/item.
- Base and revision numbers are atomic and unique within one browser database.
- Finalized content cannot be overwritten and regenerates the same customer-facing content.
- Duplicate and revision are visibly different operations with the required lineage.
- Corrupt records do not prevent healthy quotes from loading.
- Android and laptop workflows pass, CI/build pass, and the Pages production path remains `/gtm-calc/`.
