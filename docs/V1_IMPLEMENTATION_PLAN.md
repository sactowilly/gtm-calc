# Version 1 Implementation Plan

## Recommendation and boundaries

Choose option **2: native ES modules plus Vite, keeping vanilla HTML/CSS/JavaScript and the current UI behavior during extraction**.

- Vite provides a deterministic build, `/gtm-calc/` base handling, bundled PDF dependency, local server, and future PWA-compatible asset pipeline.
- Native modules make calculations, storage, projection, PDF, and sharing independently testable without a framework rewrite.
- Vitest and Playwright fit the roadmap and can be introduced before behavior changes.
- JavaScript plus JSDoc/domain documentation is less disruptive than converting the 661-line script and UI to TypeScript at the same time. TypeScript can be reconsidered gradually for V2 repositories if its compile-time value exceeds migration cost.
- React is not justified for one active quote and ~250 quotes/year. It would replace functioning DOM/UI code, enlarge the change surface, and still require the same domain/storage/PDF tests.
- Remaining as a classic script/no build would minimize the first diff but leave bare dependency management, Pages build validation, and test seams weak.

V1 does not implement a quote library, IndexedDB, catalog, backup suite, PWA, service worker, authentication, backend, automatic email, or hosted data.

## Pre-implementation repository safeguards (owner/repository settings)

1. Confirm clean `main` still equals `f7c35a1` and the live hashes match.
2. Create annotated tag `v0.1.0` at that commit and push it.
3. Record restore procedure: create `hotfix/restore-v0.1.0` from current `main`; restore tracked content from tag; commit; run checks; merge by PR. Do not force-push/reset production.
4. Protect `main`: require PR, required CI check, and no direct pushes. The repository currently has no protection.
5. Keep Pages on legacy `main` `/` until the explicit deployment-cutover PR. A feature branch cannot change production under current settings.
6. Obtain owner decisions listed at the end and the public-safe PDF template/assets before PDF implementation.

No permanent `develop` branch is recommended. At this project size it adds merge drift without meaningful release isolation. Use short-lived `feature/<name>` branches into protected `main`; use `experiment/<name>` only for throwaway PDF/layout comparisons, and never configure them to deploy production.

The proposed first branch remains **`feature/v1-mobile-quote-foundation`** because it establishes regression safety, module boundaries, and build/CI without redesigning the app.

## Pull-request sequence

Each PR starts from updated `main`, preserves a deployable application, and has its own rollback. Do not combine the sequence into one rewrite.

### PR 1 — Mobile quote foundation and regression safety

**Goal**

Add the build/test foundation, extract pure legacy calculations/formatting into native modules, and retain current UI/output/storage behavior exactly. This is the prerequisite for safe mobile work.

**Likely files to change**

- `index.html` — module script entry only; no product redesign.
- `js/main.js` — become/import the DOM adapter while preserving IDs/flows.
- `README.md` — development/test/build commands and current deployment note.

**Likely files to create**

- `package.json`, lockfile, `vite.config.js`.
- `js/domain/calculations.js`, `js/domain/formatters.js` (exact names may vary).
- `js/app.js` or a small module entry.
- `tests/calculations.test.js`, `tests/fixtures/legacy-calculations.js`.
- `.github/workflows/ci.yml`.
- Minimal ESLint/format configuration only if enforced in CI; do not create a large style migration.

**Dependencies**

- Baseline tag/protection.
- Vite, Vitest; lint dependency only if selected.
- No runtime UI/PDF library yet.

**Tests/checks**

- All legacy calculation/freight/zero/negative/decimal/rounding fixtures in `TEST_PLAN.md`.
- Loaded legacy item normalization and multi-line totals.
- `npm run build`, module load/browser smoke, existing add/edit/delete/save/PDF/email intent smoke.
- Production-source comparison of visible numeric outputs before/after.

**Acceptance criteria**

- Current live behaviors and `gtm_quote_calculator_v1` shape remain readable.
- Current formula remains markup denominator/cost and labels are not silently changed.
- Pure calculations run without DOM and are covered by regression tests.
- Pull requests run install/test/build; no deploy job and no production settings change.
- No PWA files or product redesign.

**Rollback**

Revert the PR. Because storage shape and Pages source remain unchanged, the prior classic script can be restored without data migration. Verify the module script tag is reverted with its files.

### PR 2 — GitHub Actions Pages build/deployment cutover

**Goal**

Deploy Vite's built artifact through an explicit GitHub Actions workflow while preserving the production URL and behavior.

**Likely files to change**

- `vite.config.js` — base path `/gtm-calc/` (or repository-aware equivalent).
- `README.md` — deployment/rollback/source instructions.

**Likely files to create**

- `.github/workflows/deploy-pages.yml` (or extend a carefully separated workflow).

**Dependencies**

- PR 1 passing on `main`.
- Owner/admin changes Pages build source from legacy branch to GitHub Actions at the coordinated merge window.

**Tests/checks**

- Build and serve `dist` under `/gtm-calc/`; direct URL/assets/reload smoke.
- Workflow permission/concurrency/event review.
- Feature-branch workflow proves no production deploy.
- Post-merge production hash/release marker and calculator/PDF smoke.

**Acceptance criteria**

- Only protected `main` deploys after tests.
- Production URL, relative assets, and functionality remain unchanged.
- Deployment status is visible in Actions/Pages; rollback workflow is documented and rehearsed via build artifact.

**Rollback**

Revert workflow/config PR and switch Pages source back to `main` `/` only after confirming source remains browser-runnable; otherwise restore `v0.1.0` through PR first. Coordinate settings and code so neither points to an unusable source.

### PR 3 — Versioned active quote, customer details, and safe save

**Goal**

Add all V1 quote metadata and a small versioned localStorage adapter/migration while retaining one active quote.

**Likely files to change**

- `index.html` — Details section fields.
- `css/main.css` — field groups, internal/customer note distinction, save/recovery states.
- Module entry/UI rendering.

**Likely files to create**

- `js/domain/active-quote.js`, `js/domain/validation.js`.
- `js/storage/active-quote-storage.js`, `js/storage/migrations.js`.
- Unit/integration tests and synthetic fixtures.

**Dependencies**

- PRs 1–2.
- Decisions on required fields, expiration default, terms, decimal quantity, local date, and rounding representation.

**Tests/checks**

- Legacy key migration, invalid/corrupt/unavailable/quota storage, derived recalculation, cross-tab token, save/pagehide.
- Field types/autocomplete, date/expiration validation, internal versus customer notes.
- Reload/restoration without data loss.

**Acceptance criteria**

- Company, buyer, email, optional address/phone, both dates, terms, and notes persist locally.
- Existing saved quote loads; corrupt raw data is preserved for recovery rather than deleted.
- UI never claims “Saved” after a failed write.
- Still one active quote; no IndexedDB/repositories/library.

**Rollback**

Keep top-level legacy aliases/items readable. Reverting code should still load the one-time legacy backup/core old fields; document that new-only metadata cannot be understood by v0.1.0 and provide a JSON/raw copy before rollback if active work matters.

### PR 4 — Phone-first line cards and complete line actions

**Goal**

Replace the phone table workflow with accessible line cards/editor and implement duplicate, reorder, and safer delete while preserving internal calculations.

**Likely files to change**

- `index.html`, `css/main.css`, UI/rendering modules.

**Likely files to create**

- `js/ui/line-item-card.js`, `js/ui/item-editor.js` or similarly focused modules.
- Browser E2E tests for line actions and mobile layouts.

**Dependencies**

- Stable quote/line identifiers and validation from PR 3.
- Approved V1 reorder method (recommend Move up/down; drag/swipe deferred).

**Tests/checks**

- Add/edit/duplicate/move up/down/delete/undo, first/last boundaries, long descriptions, negative profitability.
- 360/390/landscape/laptop widths, 200% zoom, touch sizes, keyboard/focus/screen-reader names.
- Totals unchanged after reorder and expected after duplicate/edit/delete.

**Acceptance criteria**

- No document-level phone horizontal scroll.
- All five item operations work by touch and keyboard; actions name the item.
- Primary phone actions are reachable and do not cover fields/errors.
- Laptop has a compact enhancement without losing card accessibility.

**Rollback**

The data model/order remains compatible. Revert UI modules/CSS to the internal table; any added positions should be harmless extra fields.

### PR 5 — Customer-safe projection, copy text, and internal profitability labels

**Goal**

Create the privacy boundary used by every outbound channel, add customer HTML preview/copy text, and correctly label current markup. Add gross margin only if explicitly approved.

**Likely files to change**

- Preview/internal summary markup/styles.
- Calculation formatting labels and copy actions.

**Likely files to create**

- `js/domain/customer-document.js`.
- `js/services/clipboard-service.js` (small fallback-capable seam).
- Projection/privacy/clipboard tests.

**Dependencies**

- Owner approval of GTM/markup/gross-margin wording and zero-denominator display.
- PRs 3–4 stable quote content.

**Tests/checks**

- Exact allowlist/forbidden sentinel privacy tests.
- Customer copy text required fields/encoding/long text and Clipboard unavailable fallback.
- Markup and gross-margin denominator fixtures; internal-only placement.

**Acceptance criteria**

- Customer HTML preview and copied text contain no internal cost/profitability/internal notes.
- Internal screen retains costs/profit; current numeric formula is unchanged.
- Clipboard failure offers selectable customer-safe text rather than opening an internal PDF.

**Rollback**

Revert feature but do **not** expose legacy copy/email/PDF as customer actions. If rollback crosses the privacy boundary, disable outbound actions until the safe projection returns.

### PR 6 — Branded customer PDF, preview, download, and deployment dependency

**Goal**

Replace handwritten internal PDF with owner-approved branded customer PDF generated locally through `pdf-lib`; provide reliable preview and explicit download.

**Likely files to change**

- `package.json`/lockfile, preview markup/styles, Vite asset handling, action wiring.

**Likely files to create**

- Public approved template/logo/font assets.
- `js/services/pdf-service.js`, layout/font/wrapping helpers.
- PDF fixtures/tests and visual reference artifacts safe for the repo.

**Dependencies**

- Approved public-safe template/assets/legal copy.
- PR 5 customer projection.
- `pdf-lib`; optional `@pdf-lib/fontkit` only when required.

**Tests/checks**

- PDF extracted-text privacy/required content, header/pages/nonzero file, filenames.
- 0/1/many lines, long/Unicode/control text, address/terms/notes overflow, multi-page headings/totals.
- Blob URL lifecycle; inline unsupported fallback; download filename.
- Production build dependency bundling and Pages smoke.

**Acceptance criteria**

- PDF matches approved template at phone/laptop review sizes.
- No forbidden internal field/value exists in projection or extracted PDF/metadata.
- Preview and Download are explicit; phone fallback never shows an empty iframe as the only option.
- Generation errors preserve the quote and provide recovery.

**Rollback**

Disable PDF outbound action or restore the last customer-safe generator. Never fall back to the current internal PDF for customers. Revert dependency/assets only after references are removed.

### PR 7 — File sharing, mailto fallback, and failure states

**Goal**

Use the reviewed PDF `Blob` as a `File` for supported mobile sharing and implement a truthful download/email/manual-attachment fallback.

**Likely files to change**

- Preview/share actions, instructions, status/error styles.

**Likely files to create**

- `js/services/share-service.js`, `js/services/email-service.js`.
- Unit and browser tests for capability/error paths.

**Dependencies**

- PR 6 GeneratedPdf.
- Approved email subject/body and whether a completed Share Sheet prompts the user to mark Sent (status itself is V2).

**Tests/checks**

- `share`/`canShare` missing/false/true/throw, AbortError/other error, File MIME/name/size.
- Mailto encoding, missing email, concise body, filename/manual-attachment message, privacy sentinels.
- Popup/null/no mail client guidance; copy email/message.
- Physical iOS Safari and Android Chrome Share Sheet; representative laptop mail clients.

**Acceptance criteria**

- Supported devices receive the PDF File in the native Share Sheet.
- Buyer email is easy to copy and the UI makes no recipient-prefill promise.
- Fallback downloads first, opens a prepared email, and explicitly identifies the file to attach manually.
- Cancel/failure/missing email/no client paths are recoverable and never lose the PDF/quote.

**Rollback**

Remove/disable Share action; retain customer-safe Download and copy. A mailto rollback must not restore internal legacy body content.

### PR 8 — V1 accessibility, compatibility, and release hardening

**Goal**

Close release gaps, run the full matrix, update documentation, and tag Version 1 after owner acceptance.

**Likely files to change**

- Any V1 UI/service/test files for fixes.
- `README.md` and the planning docs with actual decisions/status.
- Workflows for release/browser matrix/post-deploy smoke where justified.

**Likely files to create**

- `tests/e2e/accessibility.spec.js`, deployment smoke script/checklist, release checklist.

**Dependencies**

- PRs 1–7; target device access; owner PDF/calculation acceptance.

**Tests/checks**

- Entire `TEST_PLAN.md` V1 subset; Chromium/Firefox/WebKit automation, axe, keyboard, VoiceOver/TalkBack, physical sharing, PDF/email, storage failure/recovery, Pages production smoke.

**Acceptance criteria**

- No release-blocking privacy/data-loss/accessibility issue.
- Required CI is green; manual matrix is recorded with device/browser dates.
- Production smoke passes after merge; tag/release notes and restore point are created.
- Confirm no manifest/service worker/PWA, backend, auth, hosted DB, or server email was introduced.

**Rollback**

Use the most recent customer-safe tag/restoration PR. If the defect affects privacy or data integrity, disable outbound/finalization actions first and restore through protected `main` with post-deploy smoke.

## Cross-PR architecture

Keep the V1 dependency direction simple:

```text
DOM/UI modules
  → active-quote application functions
    → calculation + validation + customer projection (pure)
    → ActiveQuoteStorage (localStorage adapter)
    → PdfService / ShareService / EmailService (browser adapters)
```

Do not introduce full `QuoteRepository`, `CustomerRepository`, or IndexedDB in V1. Define those contracts in documentation and implement them in V2 once quote finalization/library semantics are stable.

## Decisions requiring owner approval before affected PRs

1. Whether `GTM` is a company-defined term; approval to relabel current percentage Markup and display Gross Margin alongside it.
2. Zero landed-cost/zero selling-price display and whether such lines can be saved/finalized.
3. Whole-number versus decimal quantity.
4. Currency/landed-unit precision and exact line/quote rounding policy.
5. Required customer/buyer fields, default expiration days, payment terms, and date-numbering timezone/year policy.
6. PDF template/assets/fonts/legal footer and confirmation they may be public in GitHub.
7. Email subject/body/seller identity and whether customer copy text includes prices/notes in the proposed format.
8. Delete Undo versus confirmation, reorder controls, and whether negative profitability requires acknowledgement.
9. V2 status transition rules, revision-number reservation timing, and multi-device numbering disclosure (not blockers for early V1 PRs).

## Deliberately deferred

- Catalog/CSV/search/recent items: V1.5.
- IndexedDB quote/customer library, numbering, revisions, statuses, immutability: V2.
- Complete backup/restore and CSV exports: V2.5.
- Manifest, installability, service worker, offline caches/update UX: V3.
- Favorites/history/gestures/voice/attachments/dark mode: V3.5 based on evidence.
- Authentication, shared database/sync, server email attachment, centralized numbering, Microsoft 365/CRM/ERP: V4 evaluation only.

