# PDF and Sharing

Implementation status: the customer quotation renderer described below is implemented on the Version 1 customer-PDF feature branch. Sharing remains a later Version 1 capability.

## Non-negotiable privacy boundary

`toCustomerQuoteDocument(quote)` in `js/pdf/customer-quote-document.js` is the customer PDF's allowlist boundary. The HTML template and PDF renderer accept that projection rather than the internal quote object. Existing rep/customer clipboard and mailto behavior remains separate and unchanged by the template replacement.

### Customer PDF fields

- Company branding and seller contact details approved for public use.
- Quote label and, in V2, quote/revision number.
- Customer company name and optional address.
- Buyer name and optional email/phone.
- Quote date, expiration date, and payment terms.
- SKU (when present), item name, customer description/dimensions, quantity, unit selling price, and line total.
- Customer subtotal/total in USD.
- Customer-facing notes and approved terms/footer.
- Page number for multi-page quotes.

### Internal-only fields

The customer document, copied text, mailto body, and Web Share text must never contain:

- Unit cost or total base cost.
- Freight or freight mode.
- Landed unit cost or total landed cost.
- GTM/profit dollars.
- GTM/markup percentage.
- Gross margin percentage.
- Internal notes, internal item IDs, source lineage, calculation policy, or local database metadata.

Privacy tests should verify both the object contract and extracted PDF/text output. A visual review alone is insufficient.

## Template strategy

The supplied `quote test 2026.docx` and matching PDF are the approved visual references. The complete logo was extracted unchanged to `assets/vision-industrial-packaging-logo.png`; customer examples are not committed.

The implementation builds a fixed US Letter page shell with HTML/CSS flow layout, measures overflow in the browser, and adds continuation pages before capture. Define repeatable page rules:

1. Page 1 header/customer/quote summary.
2. Item table with wrapped descriptions and repeated column headings.
3. Continuation pages with branding and quote identity.
4. Totals/notes/terms kept together where possible.
5. Overflow tests for long names, addresses, terms, notes, 0/1/many lines, and large currency values.

## Browser PDF library recommendation

Use pinned, locally vendored `html2canvas` and `jsPDF` browser builds. HTML/CSS supplies wrapping, grid sizing, dynamic row heights, and pagination; each completed Letter page is captured and assembled into the same locally generated `Blob` used by preview and download.

Tradeoffs:

- HTML/CSS plus canvas: best fit for the reference's variable-height customer and table content while remaining entirely client-side on GitHub Pages.
- Playwright/Chromium `page.pdf()`: used for test automation and visual inspection, but unavailable as a runtime browser API and therefore cannot supply an in-app Blob.
- `pdf-lib` or raw PDF drawing: would reintroduce manual coordinate and wrapping logic that caused the defective layout.
- Tradeoff: the captured PDF is rasterized, so text selection and tagged-PDF accessibility are not yet available; the source HTML remains available for automated layout and privacy inspection.

Bundle dependencies rather than loading a CDN so builds are reproducible, Content Security Policy is simpler, and Version 3 offline work has a clean path.

Suggested small V1 service boundary:

```ts
interface PdfService {
  generateCustomerPdf(document: CustomerQuoteDocument): Promise<GeneratedPdf>;
}

interface GeneratedPdf {
  blob: Blob;
  filename: string;
  templateVersion: string;
}
```

Do not build a general document framework in V1.

## Preview and download

1. Validate quote/customer document.
2. Generate the PDF from the reviewed customer projection.
3. Hold one `GeneratedPdf` for preview/download/share; regenerate only after quote changes.
4. Create a Blob URL for preview and revoke the prior URL on regeneration/close/unload.
5. Show an HTML customer preview even when the browser cannot embed a PDF.
6. Offer explicit **Preview PDF**, **Open PDF**, and **Download PDF** controls with the visible filename.

An iframe/object can be the desktop preview, but do not make inline rendering the only phone path. On iPhone or an unsupported viewer, use a user-initiated open/download link and keep the HTML preview. Catch generation/font/template failures and leave all quote data intact.

## File naming

Use deterministic, sanitized filenames:

```text
Quote-Draft-Acme-Packaging-2026-07-13.pdf       (V1 / unnumbered draft)
Quote-2026-001-Acme-Packaging.pdf               (V2 base)
Quote-2026-001-R1-Acme-Packaging.pdf            (V2 revision)
```

Rules:

- Replace reserved/control characters, collapse whitespace, remove trailing dots, and cap total length (for example 100 characters).
- Fall back to `Customer` when company is blank during internal preview, but require/confirm a company before customer send.
- Filename creation is pure and unit tested. The exact downloaded filename is repeated in fallback instructions.

## Primary phone Share Sheet workflow

```js
const file = new File([generated.blob], generated.filename, {
  type: 'application/pdf',
  lastModified: Date.now()
});

const canShareFile =
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });
```

Only show **Share PDF** as primary when `canShareFile` is true. Invoke `navigator.share({ files: [file], title, text })` synchronously from the user's click after generation is ready. The title/text remain customer-safe and concise.

The Web Share API does not provide a reliable cross-app way to prefill the recipient. Display the buyer's email beside the action and provide **Copy email** before opening the Share Sheet. Never state that the PDF was emailed; at most record that the Share Sheet completed. Marking status `Sent` should require explicit user confirmation or a later approved rule.

## Fallback email workflow

Always retain fallback actions, even if file sharing is supported:

1. Download the PDF.
2. Show: “Downloaded `<filename>`. Attach this file from Downloads.”
3. Build a concise `mailto:` URL with recipient when present, subject, and body.
4. Open it from a direct user action using an anchor/same-context navigation; do not depend on an unprompted popup.
5. Keep recipient, subject, body, and filename individually copyable.

Example, with every component encoded independently:

```text
mailto:buyer@example.com
  ?subject=Quote%20from%20Vision%20Packaging%20-%20Acme%20Packaging
  &body=Hello%20Alex%2C%0D%0A...%0D%0APlease%20attach%20the%20downloaded%20PDF...
```

The user-facing message must say that `mailto:` **cannot attach the PDF automatically**. Keep the body short because mail clients/browser URL handling have practical length limits. Do not paste internal details or a huge line table into the URL.

## Failure handling

| Condition | Required behavior |
| --- | --- |
| User cancels Share Sheet (`AbortError`) | Neutral “Sharing cancelled”; no error telemetry/status; allow retry/download/email. |
| Share API/canShare unavailable or false | Do not show a broken primary action; show download + email/manual-attach flow. |
| Share throws another error | Explain share failed, retain generated PDF, expose fallback, log only non-sensitive error category. |
| PDF generation fails | No empty/stale download; show retry and customer-safe text copy; identify missing template/font generically. |
| Inline preview fails | Keep HTML preview and Open/Download link. |
| Browser blocks new window | Use an explicit same-page link/action; if `window.open` is used for PDF, detect `null` and show download. |
| No default email application | Cannot reliably detect; keep all fields copyable and show manual instructions. |
| PDF too large | Optimize template/images, show size, keep download; if share rejects it, fall back. Owner should approve a warning threshold after real template measurements. |
| Customer email missing | Allow preview/download/share; email action focuses/explains the field or opens a deliberately recipient-less draft after confirmation. |
| Generated quote changes after preview | Mark artifact stale and disable/share only after regenerating from current customer projection. |

## Security and lifecycle

- Treat all customer/item text as data; let `pdf-lib` encode it and normalize control characters. Never concatenate PDF syntax.
- Embed only approved public assets/fonts and pin package versions/lockfile.
- Do not upload PDFs or quote data. Generation, preview, download, clipboard, and share are local browser operations.
- Revoke object URLs; do not cache PDF bytes in localStorage. Version 2 may regenerate from immutable content rather than store duplicate blobs.
- A meta Content Security Policy must allow the tested Blob preview path (`frame-src blob:` as needed) while disallowing unexpected network/script origins.

## Testing matrix

| Area | Automated | Manual/device |
| --- | --- | --- |
| Customer projection privacy | Unit test exact allowed keys and forbidden terms/values | Review sample output |
| PDF content | Generate fixtures; extract text with `pdfjs-dist`; assert required/forbidden text | Visual compare template, wrapping, pages |
| PDF format | Header/nonzero pages/size and long/Unicode/control text fixtures | Open/download in target browsers |
| Filename | Reserved chars, empty/long company, base/revision | Verify downloaded name |
| Share capability | Mock share/canShare true/false/missing/throw/AbortError | iOS Safari Share Sheet; Android Chrome Share Sheet |
| Email | Exact URL encoding, missing recipient, concise body, no forbidden fields | Outlook/iOS Mail/Gmail/default-client behavior where available |
| Preview | Blob URL lifecycle and stale artifact state | iPhone inline fallback, Android, laptop Chrome/Edge/Safari/Firefox |
| Failure | Template/font failure, share error, popup null | Airplane/offline after load where relevant; no mail app |

Physical device checks are release gates for file sharing; desktop emulation cannot prove native Share Sheet behavior.

