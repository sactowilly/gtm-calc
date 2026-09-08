# Version 3.5 Implementation Plan — Mobile Workflow

Status: active planning from the accepted Version 3 PWA boundary. The first delivery focuses on inline item search in the active Quote workspace; it does not alter storage schemas, customer-facing output, or catalog import rules.

## Objective

Reduce phone quote-entry context switching. A rep should be able to type in the Quote workspace Item field, see relevant standard-catalog and My Item matches, choose one, and continue editing that line item without leaving the quote.

## First implementation slice — Inline Item Search

### Scope

- Reuse the existing local catalog/My Items search and ranking logic; do not create a second search index.
- Show a touch-friendly, keyboard-accessible result list beneath the active Item field after deliberate query input.
- Search existing approved fields: SKU, full/partial name, description, normalized dimensions, and recent local items.
- Distinguish standard catalog entries from My Items and retain current selection behavior when a user chooses a result.
- Preserve dirty manual values until the user explicitly selects a result and confirms any existing overwrite guard.
- Keep the standalone Catalog workspace, CSV import/reporting, local usage tracking, and `gtm_quote_calculator_v1` compatibility intact.

### Explicit exclusions

- No remote catalog, supplier lookup, inventory/availability, backend, authentication, PWA cache rewrite, saved-search history, favorites, bulk item bundles, or customer-specific pricing history.
- No automatic replacement of an in-progress line item, silent price/cost overwrite, or customer-facing PDF/email behavior change.

### Likely files

- `index.html` and `css/main.css` for the Item-field result region and phone presentation.
- `js/main.js` plus existing `js/catalog/catalog-ui.js` and `js/catalog/catalog-search.js` integration seams.
- Focused Vitest and Playwright coverage under `tests/` and `tests/compat/`.
- `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT_ROADMAP.md`, `docs/TEST_PLAN.md`, `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md` when the implementation changes the visible release marker or milestone state.

### Acceptance criteria

- A phone user can type, arrow through or tap results, select an item, and continue in the Quote workspace without navigating to Catalog.
- Exact SKU remains top-ranked; partial name, description, normalized dimension, My Item, and recent-item behavior match the existing catalog rules.
- A selected result populates the same editable fields as the existing Catalog workflow and preserves confirmation/dirty-input protection.
- No horizontal overflow at 360 px; results remain reachable above the keyboard with 44 px minimum targets and screen-reader labels.
- Empty, loading, no-catalog, and no-results states are clear and do not block manual entry.
- Existing import/search, quote calculations, PDF/customer-privacy, localStorage/IndexedDB, direct-source Pages, production build, and accessibility tests remain green.

## Follow-on sequencing

1. Inline Item Search — the first bounded implementation PR.
2. Quote-entry flow polish — minimize unnecessary workspace changes; validate sticky actions and one-handed reach.
3. Candidate workflow improvements — favorites, recent customers, frequent combinations, reorder controls, voice notes, attachments, and dark mode only after a demonstrated need and storage/accessibility review.

## Risks and rollback

The principal risks are accidental overwrite of a manually edited line item, a result list obscured by mobile keyboards, confusing duplicate matches, and an accessibility regression in focus management. Keep the result list UI-only and reuse existing selection operations. A rollback removes the inline result integration while leaving Catalog search, imported catalogs, My Items, stored quotes, and customer output untouched.
