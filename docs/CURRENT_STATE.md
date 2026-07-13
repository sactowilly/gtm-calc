# Current State

Audit date: 2026-07-13

Audited revision: `f7c35a1b47d3df9b1a9b795a3eaa37b18f249177` (`main` and `origin/main`)

Live application: <https://sactowilly.github.io/gtm-calc/>

## Executive summary

The repository is a dependency-free static application: one HTML document, one stylesheet, one non-module JavaScript file, two brand images, a README, and a CC0 license. The live GitHub Pages files byte-for-byte matched the audited local `index.html`, CSS, JavaScript, SVG, and PNG. The current app successfully calculates a line, adds/edits/deletes items, manually saves one active quote to `localStorage`, copies quote text, opens a `mailto:` draft, and generates a PDF `Blob` for an iframe preview.

The most important finding is that the current PDF, copied quote text, and email body are **internal reports**, not customer-safe quotes. They expose landed cost, total cost, GTM dollars, and GTM percentage. Version 1 must preserve the internal view while introducing a separately tested customer projection before any customer PDF or sharing workflow is released.

## Repository inventory

Every tracked file was inspected:

| Path | Current responsibility | Assessment |
| --- | --- | --- |
| `index.html` | Entire document structure, calculator form, active-quote table, action buttons, and PDF dialog | Semantic labels and basic live status exist. The layout is one long page and the quote is a 920 px table. |
| `css/main.css` | All visual styles and one breakpoint at 720 px | Provides 44 px main controls and visible focus. On phones it stacks almost everything but retains a horizontally scrolling desktop table. |
| `js/main.js` | All state, calculations, rendering, persistence, clipboard, email, PDF generation, and event wiring in a 661-line IIFE | Functioning but tightly coupled to the DOM and not independently testable. |
| `README.md` | Usage, formula, feature, and file summary | Correct about the formulas and local save; incomplete about edit and PDF behavior. |
| `assets/gtm-calc-icon.svg` | 1280×640 branded illustration with accessible SVG title/description | Used as a source asset, not referenced by `index.html`. |
| `assets/gtm-calc-icon.png` | 1280×640 raster version | Referenced by the README, not by the application. |
| `LICENSE` | CC0 1.0 Universal legal text | No application impact. |

There is no `.github/` directory, package manifest, lockfile, build configuration, test directory, lint/format configuration, manifest, service worker, server code, database client, analytics, or third-party runtime dependency.

## Existing architecture

`index.html:169` loads `js/main.js` as a classic script. `js/main.js` is an immediately invoked function expression; none of its functions are exported. It keeps a mutable `quote` object in memory, reads/writes the DOM directly, and registers all event handlers at the end of the file (`itemForm`, the table, metadata inputs, dialog, and action buttons).

The useful seams already visible in the script are:

- Calculations and normalization: `parseNumber`, `readCurrentItem`, `normalizeItem`, `getTotals`.
- Formatting: `formatMoney`, `formatPercent`.
- State/UI synchronization: `syncQuoteMeta`, `renderQuote`, `updateCalculatorPreview`, `editItem`.
- Persistence: `saveQuote`, `loadQuote`.
- Customer communication candidates: `buildQuoteText`, `copyQuoteText`, `emailQuoteText`.
- PDF implementation: `escapePdfText`, `buildQuotePdfRows`, `buildQuotePdfBlob`, `openQuoteDialog`.

The calculation and formatting functions should be preserved and first extracted behind regression tests. DOM rendering should be replaced incrementally. The handwritten PDF serializer should eventually be replaced after a customer-safe document model is in place.

### HTML and CSS structure

`index.html` contains two primary panels inside `main.app-shell`: `section.calculator-panel` with `#itemForm`, and `section.quote-panel` with the active quote. Item inputs are `#itemName`, `#quantity`, `#unitCost`, `#price`, `#freight`, and the `freightMode` radio group. Live results are `#landedCost`, `#gtmEachDollars`, `#gtmTotalDollars`, and `#gtmTotalPercent`. Quote metadata is limited to `#customerName` and `#quoteDate`; totals are `#orderTotal`, `#totalCost`, and `#totalGtm`. `#quoteItems` is the table body. `#copyQuote`/`#emailQuote` and their dialog counterparts trigger outbound text; `#viewQuote` opens `#quoteDialog`, which contains iframe `#quotePdf`.

`css/main.css` is a single global stylesheet organized as design tokens/reset, shell/header/panels, forms/results/buttons, table/actions, dialog/visually-hidden helper, and one `@media (max-width: 720px)` block. It has no component scoping, print/PDF styles, dark theme, reduced-motion rule, or build-time processing. Its reusable color tokens and focus styles are worth retaining; table/dialog/mobile rules should be revised rather than layered with competing overrides.

## Current features verified in source and runtime

- Landed unit cost, GTM dollars per unit, GTM dollars for the line, and GTM percentage preview.
- Freight entered either per unit or as a total amortized across quantity.
- Add, edit, and delete line items. There is no duplicate or reorder operation.
- Customer name and quote date only; there are no buyer/contact, address, expiration, payment-term, or note fields.
- Internal quote totals and line profitability in a table.
- One manually saved active quote in the current browser.
- Copy quote text through the Clipboard API.
- Open a prepared `mailto:` URL. It has subject and body but no recipient because no buyer email is captured.
- Build a local PDF `Blob`, create an object URL, and preview it in `#quotePdf` inside `#quoteDialog`.
- There is no explicit PDF download button and no Web Share API implementation.

A headless run of the deployed app using quantity 3, unit cost $10, price $20, and $6 total freight produced landed cost $12, GTM each $8, GTM total $24, GTM percentage 66.67%, order total $60, and total cost $36. The generated 1,963-byte file began with `%PDF-1.4` and contained `COST` and `GTM%` columns.

## Current quote and line-item model

The initial in-memory object at `js/main.js:41` is:

```js
{
  customerName: '',
  date: 'YYYY-MM-DD',
  items: []
}
```

`readCurrentItem` creates each item with:

```js
{
  id,
  name,
  quantity,
  unitCost,
  price,
  freight,
  freightMode,       // "perItem" | "total"
  freightPerUnit,
  landedUnitCost,
  totalCost,
  orderTotal,
  gtmEachDollars,
  gtmTotalDollars,
  gtmEachPercent,
  gtmTotalPercent
}
```

Both inputs and derived values are persisted. `normalizeItem` trusts any finite persisted derived value instead of recalculating it, so saved data can become stale after a future rule change or can be internally inconsistent if modified/corrupted.

## Storage behavior

There is exactly one application storage key:

- `gtm_quote_calculator_v1`

`saveQuote` writes `JSON.stringify(quote)` only when the user presses **Save**. Adding, updating, deleting, or changing customer/date calls `markUnsaved` but does not persist. `loadQuote` accepts any parsed object whose `items` property is an array, copies only `customerName`, `date`, and `items`, and does not validate item fields. A JSON parse error causes the only saved value to be deleted immediately. A structurally invalid but valid-JSON value is left in place and ignored. Storage write/read exceptions such as quota or disabled storage are not handled.

This is browser/profile/origin-local data. It does not synchronize across devices, private browsing may discard it, clearing site data deletes it, and the repository contains no backup/export path.

## Calculation behavior

The current rules in `readCurrentItem` are:

```text
freightPerUnit = total mode ? freight / quantity : freight
landedUnitCost = unitCost + freightPerUnit
totalCost = landedUnitCost × quantity
orderTotal = price × quantity
gtmEachDollars = price - landedUnitCost
gtmTotalDollars = gtmEachDollars × quantity
gtmEachPercent = gtmEachDollars / landedUnitCost × 100
gtmTotalPercent = gtmTotalDollars / totalCost × 100
```

The per-unit and total percentages are algebraically the same for a line. Despite the `GTM%` label, the denominator is cost. The correct mathematical name is **markup percentage**, not gross margin percentage.

```text
Current markup % = (selling price - landed cost) / landed cost × 100
Gross margin %   = (selling price - landed cost) / selling price × 100
```

Recommendation: keep the current value unchanged, relabel it **Markup %**, and add **Gross margin %** beside it in the internal view. Make gross margin the primary profitability indicator and markup secondary only after the owner confirms that `GTM` is not a company-specific term. Neither percentage belongs in the customer projection.

Current edge behavior:

- Quantity uses `parseInt`, requires a positive integer, and rejects decimal quantity.
- Unit cost, price, and freight accept zero and reject negative inputs.
- Landed cost must be greater than zero to add a line. The live preview instead displays 0% for zero cost, an inconsistency.
- A zero price with positive cost is allowed and produces -100% markup.
- Price below landed cost is allowed and produces negative GTM dollars/markup without a warning.
- Calculations use binary floating-point without explicit financial rounding. Formatting rounds displayed currency and percentage to two decimals; totals sum unrounded values.
- `new Date().toISOString().slice(0, 10)` derives the default date in UTC, which can be one calendar day ahead/behind local time near midnight.

Before changing any rule, lock these behaviors with regression tests. Owner decisions are required for decimal quantity, zero-cost display/validation, terminology, and line/quote rounding. A safe currency policy is to store entered amounts as integer cents, preserve total freight exactly in cents, calculate extended line totals in cents, and define how fractional landed unit cost is displayed; compare all outputs against the legacy implementation before adoption.

## PDF behavior

`buildQuotePdfBlob` hand-assembles a US Letter PDF 1.4 using Helvetica, a fixed table, and simple page splitting. `openQuoteDialog` assigns its object URL to the iframe and revokes it on dialog close. Long item names are truncated to 24 characters; there is no wrapping, branded template, logo, address, terms, notes, explicit download, filename, error state, or share action.

The current PDF is internal-only because it includes:

- Total Cost and Total GTM$.
- Per-line landed `COST`.
- Per-line GTM$, total GTM$, and GTM%.

`escapePdfText` escapes only backslash and parentheses. Newlines/control characters are not handled, non-ASCII text is not font-encoded, stream lengths and xref offsets use JavaScript string length rather than encoded byte length, and approximate text widths can overlap. These are correctness and PDF-injection/corruption risks for unusual customer/item text.

## Copy and email behavior

`buildQuoteText` includes order total, total cost, total GTM, landed line cost, GTM dollars, and GTM percentage. `copyQuoteText` uses `navigator.clipboard.writeText`; failure opens the PDF dialog instead of providing a text-selection fallback. `emailQuoteText` constructs:

```text
mailto:?subject=GTM Calc and Quote Tool - <customer>&body=<internal quote text>
```

It does not and cannot attach the PDF, does not specify a recipient, cannot determine whether a mail client opened, and has no handling for URL-length/client limitations. The email and copy paths need the same customer-safe projection as the PDF.

## Deployment and Git state

- GitHub Pages is enabled, public, HTTPS-enforced, and reports `built`.
- Pages build type is `legacy`, sourced from `main` at `/`.
- The visible workflow is GitHub's dynamic `pages-build-deployment`; there is no workflow file in the repository.
- The latest Pages run for the audited commit completed successfully on 2026-07-10.
- `main`, `origin/main`, and the deployed files match the audited commit.
- A feature branch does not change production because Pages watches only `main` `/`.
- `main` currently has no branch protection.
- The only tag is `initial` at older commit `49d4293`; it is not a tag for the current functioning build.

Before implementation, create and push an annotated `v0.1.0` tag at `f7c35a1`, then enable pull-request/check protection on `main`. To restore without rewriting history: branch from `main`, restore the tracked tree from `v0.1.0`, commit the restoration, validate, and merge it by PR. Merely checking out a tag does not redeploy Pages.

## Mobile usability findings

- The 720 px breakpoint stacks the calculator, metrics, metadata, totals, and actions into a single column. A 390×844 headless screenshot confirmed the controls render in a phone-width column.
- The quote remains a `min-width: 920px` table inside a 332 px scroll container. Users must discover and operate horizontal scrolling to see profitability/actions.
- Item entry, four result tiles, three full-width buttons, quote metadata, totals, and table form a very long page. Primary actions are not sticky.
- Inputs and main buttons are 44 px high, but edit/delete buttons measured about 39 px and the close button is 40 px.
- Input text computed to 14.72 px; iOS may zoom focused inputs below 16 px.
- All mobile buttons become full width and stack, consuming significant vertical space.
- Long item descriptions have no card/progressive disclosure treatment.
- The iframe-only PDF preview is unreliable/awkward on phone PDF viewers, especially where inline PDF rendering is limited.
- There is no loss warning, autosave, delete confirmation, or undo.

## Accessibility findings

Positive foundations include `lang="en"`, native labels, fieldset/legend for freight mode, a polite live status region, visible focus outlines, semantic buttons, an iframe title, and a visually hidden table action heading.

Issues to address:

- Edit/Delete buttons have repeated accessible names with no item context.
- Validation errors are not associated to fields, do not set `aria-invalid`, and do not focus the invalid input.
- The wide table has no caption, scoped headers, or hint that it scrolls horizontally.
- Status changes for saved/unsaved state are not announced.
- Some touch targets are below the 44×44 px project minimum.
- The dialog has no explicit `aria-labelledby` relationship and the fallback assumes `dialog.close()` exists.
- Color alone is used for error status; there is no icon/prefix.
- No automated accessibility checks or screen-reader/manual keyboard checks exist.

## Browser compatibility

There is no `browserslist`, transpilation target, polyfill policy, or compatibility matrix. The script uses `String.prototype.replaceAll`, `Intl.NumberFormat`, Blob/Object URLs, `crypto.randomUUID` with a timestamp/random fallback, the Clipboard API, and native `<dialog>`. Clipboard needs a secure context (the live Pages URL is HTTPS); dialog support has a visual `open`-attribute fallback, but the close handler still assumes `dialog.close()` exists. Inline PDF iframe behavior and native number/date inputs vary materially on phones. Version 1 should use capability detection and tested fallbacks rather than user-agent checks, with current Chromium/Firefox/WebKit automation plus real iOS Safari/Android Chrome release checks.

## Security, privacy, and data-loss risks

1. Customer-facing paths expose internal profitability. This is the release-blocking risk.
2. Unsaved changes are lost on refresh/navigation; corrupted JSON is deleted without recovery.
3. Customer and cost data are stored unencrypted in browser storage. This is acceptable only with clear local-device expectations and trusted-device guidance.
4. Future dependencies served from a CDN would expand supply-chain and offline risk; bundle pinned packages in the build instead.
5. `renderQuote` escapes item names but interpolates persisted item IDs into HTML attributes without escaping. Generated IDs are safe, but unvalidated/corrupted stored data creates a local injection surface.
6. Handwritten PDF encoding can corrupt output or accept control characters.
7. There is no Content Security Policy. GitHub Pages cannot set custom response headers, so an initial meta CSP is possible but must be tested with Blob PDF preview.
8. No tests protect formulas, privacy, persistence, or deployment paths.

## Preserve, extract, replace

Preserve behavior first:

- Freight modes and all current numeric outputs.
- Add/edit/delete behavior, local active quote, copy intent, mailto intent, and local PDF generation.
- CSS color tokens, visible focus treatment, and basic semantic labels.
- GitHub Pages URL and static-only operating model.

Extract behind tests:

- Calculation/normalization and totals.
- Quote validation and customer projection.
- Formatting, filename, and mailto construction.
- Active-quote storage adapter.
- PDF and share services.

Eventually replace:

- Handwritten PDF serializer.
- Desktop table as the primary phone UI.
- Global IIFE/DOM-coupled state management.
- Raw localStorage calls in UI code (small adapter in V1; IndexedDB repositories in V2).
- Persisted derived calculations as authoritative data.
