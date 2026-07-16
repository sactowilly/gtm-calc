# Build Log

### 2026-07-15 -- Version 1.5 catalog foundation merged

- PR #9 merged the pure CSV import/report, normalization, dimension matching, and deterministic catalog search modules.
- Verified 62 unit tests, 15 compatibility/accessibility browser checks, the production build, and GitHub Actions.
- Reviewed the merged slice against the Version 1.5 roadmap and test plan. No active-quote, calculation, PDF, email, or Pages behavior was connected to or changed by the catalog foundation.
- Implemented `feature/v15-catalog-ui` with catalog-only local storage, import/report UI, unified search, manual items, recent selections, item-form population, parser hardening, and the `v1.5.0 · catalog-preview.1` marker.
- Verified 71 unit tests, 25 compatibility/accessibility browser tests, 16 customer-PDF layout tests, syntax checks, the `/gtm-calc/` production build, and a visually inspected Pixel 7 rendering.
- Quote IndexedDB, quote numbering/library, PWA, backend, and authentication remain deferred.

### 2026-07-15 -- Added the repo memory layer

- Created the standard project memory files so future sessions can resume with context.
- Added [build-docs/DECISIONS.md](build-docs/DECISIONS.md) for locked architecture and workflow choices.
- Added [build-docs/OPEN_ITEMS.md](build-docs/OPEN_ITEMS.md) for active work and blockers.
- Added the `build-docs/archive/` folder for retired docs that should be kept, not deleted.
- Corrected the repo-facing owner name to Will Z after confirming the previous profile name was only a local machine artifact.
- Next step: keep the log current whenever a milestone closes, a decision locks, or a blocker appears.
