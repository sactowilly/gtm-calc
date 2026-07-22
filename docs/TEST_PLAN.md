# Test Plan

## Quality strategy

The current repository has no automated tests, package tooling, linting, or testable exports. Version 1 should add Vite and native ES modules, Vitest for pure/unit/component-light tests, Playwright for browser flows, and `@axe-core/playwright` for automated accessibility checks. Keep physical iPhone/Android checks for platform features that automation cannot prove.

Test layers:

- **Unit:** calculations, validation, projections, migrations, filenames, mailto, search/normalization, numbering policies.
- **Integration:** localStorage/IndexedDB adapters, transactions/migrations/restore, PDF generation and extracted text.
- **Browser E2E:** quote workflow, responsive UI, focus/recovery, preview/download/share fallbacks, Pages base path.
- **Manual/device:** touch/keyboard/screen reader, native date/numeric keyboards, PDF viewers, Share Sheet, mail clients.
- **Deployment:** production build, artifact inspection, GitHub Pages smoke after deployment.

No test may use real customer, buyer, cost, or quote data. Fixtures use obvious synthetic names.

## Legacy calculation regression suite (Version 1 release gate)

Extract the exact formulas from `readCurrentItem`, `normalizeItem`, and `getTotals` before UI changes. First tests must lock current behavior; any intentionally improved zero/rounding behavior needs a separate owner-approved change.

### Core fixtures

| Case | Inputs | Expected current result |
| --- | --- | --- |
| Per-unit freight | qty 10, cost 2.00, price 5.00, freight 0.50 per unit | landed 2.50; cost 25.00; sales 50.00; GTM each 2.50; GTM total 25.00; markup 100.00% |
| Total freight | qty 3, cost 10.00, price 20.00, freight 6.00 total | freight/unit 2.00; landed 12.00; cost 36.00; sales 60.00; GTM each 8.00; total 24.00; markup 66.67% formatted |
| No freight | qty 4, cost 7.25, price 10.00, blank freight | blank parses as 0; landed 7.25; sales 40.00; cost 29.00; profit 11.00 |
| Negative margin | qty 2, cost 10.00, price 8.00, no freight | GTM each -2.00; total -4.00; markup -20.00%; line is currently allowed |
| Zero price | qty 1, cost 5.00, price 0 | sales 0; profit -5.00; markup -100.00%; currently allowed |
| Zero landed cost | qty 1, cost 0, freight 0, price 5 | add returns validation error; preview currently shows landed 0 and 0.00% |
| Decimal quantity | qty 1.5 | current add rejects because quantity is not an integer; confirm V1 policy before altering |
| Total-freight fraction | qty 3, cost 1.00, price 2.00, total freight 1.00 | freight/unit retains 1/3 internally; extended total cost is 4.00; formatted unit landed is 1.33 |
| Multiple lines | combine positive and negative lines | totals equal sum of unrounded line extended values; currency format at display only |

Also test blank, whitespace, NaN-like text, Infinity (at domain boundary), negative cost/price/freight, quantity 0/negative, very large safe values, and normalized loaded items missing each derived field.

### Markup versus gross margin

For cost 60 and price 100:

- Current/markup = `(100 - 60) / 60 × 100 = 66.666…%`.
- Gross margin = `(100 - 60) / 100 × 100 = 40%`.

Tests must prevent labels/denominators from being swapped. Aggregate markup uses total profit / total landed cost; aggregate gross margin uses total profit / total sales. When a denominator is zero, assert the owner-approved `undefined`/N/A behavior rather than allowing `Infinity` or silently displaying 0.

### Rounding tests

- Inputs at 0.01/0.10/0.29 and quantities that expose IEEE-754 artifacts.
- Total freight not evenly divisible by quantity.
- Line extended totals versus quote aggregate totals.
- Half-cent boundaries if landed unit display uses more than two decimals.
- Negative values and negative-zero formatting (`-$0.00` must not appear).
- Maximum permitted digits/quantity and safe-integer cents bounds.
- Currency always USD/two customer-facing decimal places; internal unit-cost precision follows approved policy.

Record the approved rule in `calculationPolicyVersion`; do not change expected fixtures merely to match a refactor.

## Quote validation

- Company/buyer requirements for customer output and email-specific buyer email validation.
- Email trims and validates without destructive normalization; phone/address optional.
- Quote date valid local date; expiration not before quote date unless owner explicitly allows/acknowledges it.
- Payment terms required/defaulted according to owner policy.
- At least one valid line before customer PDF/send.
- Long Unicode names/descriptions/notes and control-character normalization.
- Internal notes never substitute for customer notes.
- Validation retains entered data, focuses first invalid field, sets `aria-invalid`, and associates errors.

## Customer-PDF/privacy tests (release blocking)

Create a fixture where every forbidden field has a unique sentinel value, for example `INTERNAL_COST_7319`, so accidental leakage is detectable.

1. Unit-test `toCustomerQuoteDocument` for the exact allowlisted key set at every nested level.
2. Ensure the PDF, copy text, mailto subject/body, and share title/text functions accept only the customer document contract.
3. Generate the PDF; extract text with `pdfjs-dist`; assert required customer text and absence of forbidden labels and sentinel values.
4. Scan PDF metadata as well as visible text for internal sentinels.
5. Test multi-page/long text, Unicode, parentheses, slash/backslash, CR/LF/control text, and reserved filename characters.
6. Visually compare representative PDF renders at page 1, continuation, and totals/terms.

Forbidden vocabulary/value assertions include unit cost, landed cost, total cost, freight, GTM, profit, markup, gross margin, internal notes, and internal IDs. Avoid overly broad word matching that would reject a legitimate product description; sentinel-value and schema tests are authoritative.

## Catalog and dimension tests (Version 1.5)

Implementation status as of 2026-07-16: PR #9 covers the roadmap parser/search foundation. Merged PR #10 adds BOM/multiline/ambiguous-header/oversized-field and false-positive dimension fixtures; catalog corruption, quota, rollback, manual-item, and usage storage tests; plus end-to-end import/search/persistence checks across Chromium, Firefox, WebKit, Android Chrome emulation, and iPhone Safari emulation. The owner also passed a representative CSV import/search and My Items persistence test.

### Normalization

The following must extract canonical `12x10x8` while preserving original text:

- `12x10x8`
- `12 x 10 x 8`
- `12 10 8`
- `RSC 12x10x8`
- optionally `12×10×8` after multiplying-sign normalization

Test case/whitespace, decimals, leading/trailing text, separators, invalid two/four-number strings, units, and transposed dimensions. The owner must decide whether dimension order is significant; default is significant (`12x10x8` differs from `10x12x8`).

### CSV validation/reporting

- UTF-8/BOM, quoted commas/newlines, blank rows, required headers, duplicate headers/SKUs, invalid dimensions, overlong fields, formula-like cells, and mixed newline styles.
- Report row number, accepted/rejected/warning reason, and totals; never silently drop rows.
- Import is all-or-explicit-partial according to approved policy and does not corrupt the prior catalog on failure.

### Search ranking

Assert deterministic ordering: exact SKU, SKU prefix, exact normalized dimension/name, name prefix, name substring, description substring, then recent-use boost within a documented tier. Test manual versus standard conflicts, archived/inactive exclusion, punctuation, case, partial terms, and empty/very broad queries.

## Quote library tests (Version 2)

Foundation coverage includes lossless conversion from `gtm_quote_calculator_v1`, unnumbered drafts, search, explicit business-year numbering, concurrent base allocation, immutable content hashes, sequential revisions, duplicate lineage, corrupt-record quarantine, and a real-browser IndexedDB smoke test.

PR #12 adds atomic customer/contact plus draft saves, stale revision-token rollback, customer recall/update, date-reset duplicate behavior, non-destructive legacy import, session reload, draft search/reopen/duplicate, populated phone overflow, and stale-writer UI tests across Chromium, Firefox, WebKit, Pixel 7, and iPhone Safari emulation. Accessibility scans include the expanded Quote Library.

The quote-library usability follow-up seeds 50 deterministically ordered drafts, verifies ten-at-a-time rendering and full-result search, checks summary/open/unsaved states, and proves that the visible `DUP` marker is derived from lineage plus revision zero. A rejected save must preserve that marker; the first successful save must clear it without changing the stored customer name or customer-facing content.

PR #15 adds repository and phone-browser coverage for finalization-date-year base numbers, immutable read-only viewing, customer-safe quote-number output/filenames, historical version selection, sequential revision finalization, latest-version-only revision starts, controlled status events, terminal outcomes, and finalized-version duplication as a new unnumbered `DUP` draft.

The Version 2 workspace-navigation slice verifies that Quote, Quotes, Customers, and Catalog remain distinct accessible destinations on a phone and laptop; switching destinations retains unsaved active-quote fields; opening a quote or selecting a saved customer returns to Quote; catalog selection returns to Quote with the selected values; the bottom bar and laptop rail retain 44 px or larger controls; and narrow widths have no horizontal overflow.

### Numbering

- Draft has no number.
- First base finalization for 2026 returns `2026-001`; subsequent returns `002`, `003` with padding beyond 999 defined.
- Year rollover starts a new counter based on the finalization date's year, even when the quote date is backdated.
- Transaction abort leaves no partial quote/version/event/counter write.
- Committed/cancelled/deleted numbers are never reused.
- Unique index catches simulated multi-tab collision; one transaction retries/fails safely.
- Separate devices/backups with colliding display numbers produce a restore conflict, never overwrite.

### Revision numbering

- First revision of `2026-001` is `2026-001-R1`, then R2.
- Revision derives from a selected finalized version, keeps base number, and leaves all prior content/hash unchanged.
- Concurrent revision finalizations cannot both become R1.
- Abandoned revision draft and proposed-number policy behave as documented.

### Duplicate behavior

- Duplicate produces a different Quote ID, no number, draft status, copied selected fields, reset dates/status/events, and correct source references.
- Finalizing duplicate allocates next new base number; it never uses `-R#`.
- Changes to duplicate do not affect source draft/version/customer snapshot.

### Immutability/status/search

- Repository exposes no update for a finalized version; attempted mutation fails and hash remains unchanged.
- Regenerated PDF from unchanged version matches customer content/template policy (allowing non-content metadata differences).
- Status change appends event and updates cached current status without altering version content.
- Search by quote number, customer, contact, status, date, and item works after reload/migration.

## Storage, migration, backup, and restore

### V1 localStorage

- No key, valid legacy value, valid new value, malformed JSON, valid JSON wrong shape, invalid line, unavailable storage, quota exception, and cross-tab update.
- Migration preserves core customer/date/items and raw legacy backup; corrupt data is not deleted.
- Debounced save/flush and accurate Saved/Failed state; deletion undo restores position and persists.

### IndexedDB

- Fresh database and upgrade from every supported version.
- Upgrade failure aborts without partial schema/data.
- Per-record validation quarantines only corrupt records and valid records remain usable.
- Repository transaction tests use a real browser IndexedDB or `fake-indexeddb` only for unit speed plus browser integration coverage.

### Complete backup/restore

- Deterministic valid backup, checksum tampering, truncated/oversized JSON, unsupported future schema, duplicate IDs/numbers, missing references, altered immutable hash, and malicious/prototype-shaped data.
- Round trip all stores preserves records/relationships/hashes and excludes runtime Blob URLs.
- Merge identical skip, mutable conflict, and immutable/number collision reports.
- Replace creates safety backup, commits atomically, and rollback leaves old data on injected failure.
- CSV exports quote/customer/manual item columns, Unicode/quotes/newlines, and protect spreadsheet formula injection.

## Share API capability tests

Inject/mocks around the service rather than assigning business logic directly to `navigator`:

- `share` and `canShare` exist; files true -> file-share path.
- `share` missing, `canShare` missing, or files false -> fallback.
- `canShare` throws -> fallback without crash.
- `share` resolves -> completed result only; do not automatically claim email sent unless approved.
- `share` rejects `AbortError` -> cancelled/neutral.
- Other rejection -> error plus retained file/fallback.
- Verify the `File` MIME type, exact sanitized filename, nonzero Blob, and customer-safe title/text.
- Missing buyer email does not disable file share/download; copy-email handles absence.

Native Share Sheet behavior must be manually verified on current iOS Safari and Android Chrome over HTTPS. Browser automation cannot select/share to real apps in CI.

## Mailto construction tests

- Recipient, subject, and body components are independently URL encoded.
- Spaces, `&`, `?`, `#`, `+`, apostrophe, Unicode, and CRLF.
- Missing email produces the approved recipient-less result or blocks with field guidance.
- Body is concise, customer-safe, and names the downloaded file/manual attachment step.
- No `attachment` query or claim that the PDF is attached.
- Practical maximum body policy/warning.
- Trigger remains a user action and fallback fields stay copyable if no handler opens.

## Phone viewport and interaction tests

Automated viewport matrix:

- 360×800 small Android.
- 390×844 representative iPhone.
- 844×390 landscape phone.
- 768×1024 tablet.
- 1366×768 laptop.

Assertions:

- No document-level horizontal overflow at phone widths.
- Cards wrap long names; no clipped amount/actions at 200% text zoom.
- Touch targets at least 44×44 px and input font at least 16 px.
- Sticky bar respects safe area and does not cover last field/error; keyboard/focus scrolling is manually verified.
- Add/edit/duplicate/move up/down/delete/undo and Details→Items→Preview are keyboard operable.
- Focus moves/returns correctly after dialogs and updates.
- Reload, failed save, PDF failure, missing email, share fallback, and stale preview preserve work.
- Landscape/laptop enhance layout without changing data/action availability.

## Accessibility checks

- Run axe on empty quote, populated quote, item editor, validation errors, customer preview, PDF failure, share fallback, and recovery state at phone/laptop widths.
- Zero serious/critical violations; document any accepted lower finding.
- Keyboard-only full workflow, visible focus, logical order, no trap except modal, Escape and focus return.
- VoiceOver iOS and TalkBack Android: labels/hints, error association, save/live status, line position/reorder, unique item actions.
- Contrast tokens/states against WCAG 2.2 AA; test forced colors and 200%/400% zoom where practical.
- Reduced motion; no information via color/position/gesture alone.

## Browser compatibility matrix

CI/release coverage:

- Chromium (current) on every PR.
- Firefox and WebKit Playwright on release/high-risk PRs.
- Current Edge desktop smoke (Chromium but default enterprise target).
- Current iOS Safari and Android Chrome physical/device-cloud manual pass for keyboard/date/PDF/share.

Feature-detect Clipboard, dialog, Blob/File, Web Share, and file sharing; tests cover absent APIs. Do not gate solely on user-agent strings.

## GitHub Pages and Actions tests

- `npm ci`, lint, unit, browser smoke, and `npm run build` on pull requests.
- Inspect `dist` for `index.html`, bundled assets, no source maps/customer fixtures/secrets unless explicitly intended, and no service worker/manifest in V1.
- Serve `dist` under `/gtm-calc/` base path in CI and exercise a direct load/reload/assets/PDF generation.
- Deploy job runs only on push to protected `main` after tests, uses least permissions (`contents: read`, `pages: write`, `id-token: write`), concurrency control, and official pinned major actions.
- Post-deploy smoke GETs the production URL/assets, verifies expected release marker/title, and runs a minimal browser calculation/privacy path where reliable.
- Feature-branch/PR workflows must not deploy production.
- Document rollback to `v0.1.0` through a restoration PR and smoke it in a dry-run branch build.

## Current checks actually performed during planning

These are assessment checks, not a substitute for the planned suite:

- `node --check js/main.js` passed.
- Local `main`, `origin/main`, and deployed file SHA-256 values matched at `f7c35a1`.
- GitHub Pages API confirmed legacy `main` `/` source, HTTPS, and built status; latest deployment workflow succeeded.
- Headless Chrome loaded the deployed app at 390×844 for screenshot/measurements.
- Runtime calculation/freight fixture produced expected $12/$8/$24/66.67% and $60/$36/$24 totals.
- Save produced the documented `gtm_quote_calculator_v1` object.
- PDF preview generated a `%PDF-1.4` Blob and confirmed `COST`/`GTM%` exposure.

No automated project test suite, lint, accessibility scan, physical device, native Share Sheet, mail-client, or cross-browser test existed or was run.

