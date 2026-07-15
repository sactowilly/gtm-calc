# Decisions

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
