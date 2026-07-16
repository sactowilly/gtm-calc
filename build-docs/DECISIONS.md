# Decisions

## Version and Roadmap Documentation Synchronization

**DECISION:** Every application version or milestone-status change must include a roadmap-infographic and product-roadmap review. Every full or half product-version change must update README and all affected release, current-state, implementation, test, build-log, decision, and open-item documentation in the same pull request.
**RATIONALE:** Version labels, roadmap status, and release documentation had diverged. A repository-level rule and deterministic SVG roadmap keep the visible project story synchronized and make future status edits reliable.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z

## Quote Library Progressive Disclosure and Duplicate Review State

**DECISION:** Show ten matching quote drafts initially and ten more per explicit request. Mark a newly duplicated draft with visible `DUP` text and pale shading while `sourceQuoteId` exists and `draftRevision` is zero; remove the marker after its first successful save without modifying the customer/company name.
**RATIONALE:** Fifty local quotes are not a storage concern, but rendering every card creates excessive phone scrolling. Existing lineage and revision data provides the temporary review state without a schema migration or risk of leaking `DUP` into PDFs, emails, customer records, or search.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z

## Version 2 Foundation Boundary

**DECISION:** Introduce a separate `gtm_quote_manager` IndexedDB database behind a repository adapter while leaving `gtm_quote_calculator_v1` as the active visible quote. Use pinned `idb` for transaction handling and test with both `fake-indexeddb` and real browser IndexedDB. Require an explicit business year for number allocation until the owner approves the date/year rule.
**RATIONALE:** This proves migration, transaction, immutability, revision, duplicate, and recovery rules without making an irreversible UI/data cutover. The active Version 1.5 workflow remains the rollback path.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z (continued implementation authorization)

## Version 1.5 Catalog Storage Boundary

**DECISION:** Keep `gtm_quote_calculator_v1` unchanged. Store Version 1.5 catalog, manual-item, and recent-use data behind separate versioned localStorage adapter keys with validation, one prior-import rollback copy, and recoverable failure states. Keep the adapter API migratable to IndexedDB in Version 2.
**RATIONALE:** This connects catalog search with minimal disruption to the stable Version 1 quote workflow while avoiding a premature quote-repository migration. Imports that exceed safe browser storage must fail visibly and preserve the previous catalog.
**DATE:** 2026-07-15
**PARTIES:** Codex, Will Z (continued implementation authorization)

## Memory Layer Added

**DECISION:** Track project memory in `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md`.
**RATIONALE:** Keep session context durable, separable, and easy to resume without rereading the whole repository.
**DATE:** 2026-07-15
**PARTIES:** Codex, Will Z
