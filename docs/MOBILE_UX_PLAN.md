# Mobile UX Plan

## Experience principles

- Design at 360–390 CSS pixels first, then enhance for landscape/tablet/laptop.
- Use a line-item card and progressive disclosure model on phones. Do not render the 920 px internal table as the primary phone interface.
- Keep the next meaningful action reachable with one hand, but never cover focused fields or validation messages.
- Separate **Build**, **Review**, and **Share** mental modes. Internal profitability stays in Build/Review; customer-safe output stays in Preview/Share.
- Save changes continuously and communicate local-only storage without implying cloud backup.

## Recommended navigation

Version 1 has one active quote, so a router or permanent multi-tab application shell is unnecessary. Use a three-step in-page flow with a compact sticky step/action bar:

1. **Details** — customer, contact, dates, terms, and notes.
2. **Items** — line cards, item editor, and internal totals.
3. **Preview & Share** — customer-safe preview, PDF, download, copy, share/email fallback.

Preserve entered state when moving between steps. On laptop (about 900 px+) Details and Items may appear in a two-column workspace, while Preview remains a modal/dedicated panel. Browser Back should close an open editor/preview before leaving the page where practical, without adding a full routing framework.

## Screen inventory

### 1. Active quote / Details

- Local-only banner: “Saved on this device.”
- Company name (required).
- Buyer name (required for addressed output).
- Buyer email (required only for prepared email; sharing/download may proceed without it).
- Optional address and buyer phone behind “Add address/phone.”
- Quote date, expiration date, payment terms.
- Customer-facing notes and internal notes clearly labeled and visually separated.
- Continue to Items sticky primary action.

### 2. Items

- Compact internal summary: customer total, total cost, profit, markup, and approved gross margin label.
- Ordered line cards.
- Sticky **Add item** action near the thumb zone.
- Continue to Preview plus Save state.

### 3. Item editor (bottom sheet/full-screen dialog on phone)

- Item name/SKU/description (V1 ad hoc; V1.5 search enters here).
- Quantity, unit cost, price, freight, freight mode.
- Live internal results.
- Save line / Cancel. Edit never replaces a line until Save succeeds.

### 4. Customer preview

- HTML preview of the exact allowlisted customer fields for quick review.
- Generate/refresh status and visible filename.
- Open PDF preview, Download PDF, Copy quote text, Share PDF or Email fallback.
- Prominent assurance: internal cost/profitability is excluded.

### 5. Recovery/error surfaces

- Recover unsaved/last valid local draft.
- Storage unavailable/full.
- Corrupt saved record with preserved recovery copy.
- PDF failure and retry.
- Unsupported share/manual attachment instructions.

Version 2 adds Quote Library, Customer, Quote Detail/Timeline, Duplicate, Revision, and Status screens. Those are not V1 navigation placeholders.

The initial Version 2 draft-library slice uses a collapsed top-level Quote Library panel rather than introducing a route/navigation framework. On phones it provides one primary “Add/Save Draft” action, device-local disclosure, search, stacked draft cards with Open/Duplicate actions, and a nested Saved Customers recall panel. Finalized history, revision, and status screens remain later lifecycle work.

## Quote-building workflow

1. Load the last active quote. If a legacy `gtm_quote_calculator_v1` record exists, migrate/validate without deleting the raw value on failure.
2. Enter Details. Default quote date uses the user's local calendar date; derive expiration from an owner-approved default while allowing edits.
3. Add the first item in a focused editor. After save, return focus to the new card heading/action confirmation.
4. Review internal totals. Negative profit has text/icon warning, not color alone; it remains allowed unless owner policy changes.
5. Duplicate, reorder, edit, or delete lines. Delete offers Undo for a short visible period or requires confirmation where undo is not reliable.
6. Open customer preview. Validate required customer-facing fields and show field-linked errors.
7. Generate once, then use the same PDF `Blob`/`File` for preview, download, and share so the user cannot send a different artifact from the reviewed one.

## Line-item card model

Collapsed phone card:

```text
┌──────────────────────────────────┐
│ 1  RSC 12×10×8              ⋮    │
│ Qty 250 × $1.20        $300.00   │
│ Profit $87.50  Margin 29.17%     │  internal view only
│ [Edit] [Duplicate] [Move]        │
└──────────────────────────────────┘
```

- Show customer-relevant name, quantity, unit price, and line total first.
- Show cost/profit in a labeled internal row; allow collapse if shoulder-surfing is a concern.
- A menu may contain Delete, but Edit/Duplicate and an accessible reorder control should remain easy to reach.
- Reorder in V1 with Move up/Move down buttons or a dedicated reorder mode. Drag/swipe is deferred to V3.5 and must never be the only method.
- Wrap long descriptions and clamp collapsed text to 2–3 lines with “Show details.” Never truncate the stored/PDF text silently.
- Laptop view may use a table with row actions, but the same underlying card/component data and accessibility names should be used.

## Item-entry behavior

- `type="number"` plus `inputmode="numeric"` for integer quantity; `inputmode="decimal"` for money. Keep explicit labels and suffix/help text; do not rely on placeholders.
- Use at least 16 px input text to avoid iOS focus zoom.
- Mobile decimal separators vary by locale. Parse and validate intentionally; do not silently turn invalid input into zero.
- Set `autocomplete="organization"`, `name`, `email`, `tel`, and street-address tokens appropriately. Email uses `type="email"`, phone uses `type="tel"`, dates use `type="date"` with a visible formatted summary.
- `Enter`/Next moves through the logical field order; the final money field should not accidentally submit before freight mode is reviewed.
- When validation fails, focus the first invalid field, set `aria-invalid`, connect concise error text through `aria-describedby`, and preserve all values.
- When the virtual keyboard opens, scroll the focused field and its error/action into view. Sticky actions must move above or yield to the keyboard using dynamic viewport units/safe-area insets.

## Sticky and one-handed actions

- Phone bottom bar: context-specific single primary action and at most one secondary action. Minimum height 48 px, padded by `env(safe-area-inset-bottom)`.
- Do not put destructive actions in the thumb-primary slot.
- While editing an item: **Save item** primary, **Cancel** secondary.
- On Items: **Add item** is a floating/sticky action and **Preview quote** is the bottom primary when at least one valid line exists.
- On Preview: **Share PDF** when supported; otherwise **Download PDF**. Email remains an adjacent secondary action.
- Hide or compact the bar during downward scroll only if its return is predictable; V1 can keep it visible for reliability.

## PDF and share workflow

### Supported phone share

1. User opens Preview; app validates the customer projection.
2. Generate a Blob and retain its object URL with cleanup.
3. Create a named `File` and check `navigator.share` plus `navigator.canShare({ files: [file] })`.
4. Show buyer email with a one-tap **Copy email** control.
5. Invoke native Share Sheet only from the user's tap.
6. Treat `AbortError` as “Sharing cancelled” with no status change. Offer Share again, Download, and Email.

The app must not promise that the Share Sheet preselects an email app or fills the recipient.

### Fallback/laptop

1. Download the reviewed PDF and show its exact filename.
2. Offer **Open email draft** with recipient (when present), concise subject, and body.
3. Persistently state: “Attach `<filename>` from Downloads; the email draft cannot attach it automatically.”
4. Keep **Copy email**, **Copy message**, and **Download again** available.

If email is missing, allow PDF/download/share, focus the missing email when Email is selected, or let the user explicitly open a recipient-less draft. If no mail app opens, instructions and copied message remain usable.

## Mobile wireframe descriptions

### Details

```text
[GTM Quote]                  [Saved]
Step 1 of 3 · Details

Company *
[                               ]
Buyer *
[                               ]
Email
[                               ]
[+ Add address and phone]

[Quote date] [Expires]           (stack at 360 px)
Payment terms
[                               ]
[Customer notes ▾]
[Internal notes ▾]              (internal badge)

┌ sticky ──────────────────────┐
│                 [Next: Items] │
└───────────────────────────────┘
```

### Items

```text
[‹ Details] Items 2            [Saved]
[Sell $600] [Cost $410] [Profit $190]

[Line card 1]
[Line card 2]

[＋ Add item]

┌ sticky ──────────────────────┐
│              [Preview quote] │
└───────────────────────────────┘
```

### Preview and share

```text
[‹ Items] Customer preview
[Customer-safe badge]
Company / Buyer / dates / terms
Item cards with qty, price, total
Grand total
Notes

[Preview PDF] [Download]
Buyer: buyer@example.com [Copy]

┌ sticky ──────────────────────┐
│ [Email fallback] [Share PDF] │
└───────────────────────────────┘
```

## Touch, visual, and accessibility requirements

- Project minimum touch target: 44×44 CSS px; prefer 48 px for primary phone actions. Provide at least 8 px separation between adjacent targets.
- Body/input text at least 16 px; helper text at least 14 px. Respect 200% text zoom without clipping.
- WCAG 2.2 AA contrast: 4.5:1 normal text, 3:1 large text/non-text UI. Validate tokens, focus, negative-profit, disabled, and error states.
- Logical headings/landmarks, unique button names such as “Edit RSC 12×10×8,” and visible focus.
- Live regions announce save, add/update/delete/undo, PDF generation, and share errors without repeatedly announcing calculations on every keystroke.
- All dialogs have a programmatic name, initial focus, focus containment, Escape/Cancel, and return focus.
- Reorder has keyboard and screen-reader instructions and announces the new position.
- Do not use color, icons, swipes, hover, or horizontal scroll as the only signal/control.
- Test VoiceOver iOS and TalkBack Android manually; automated checks are necessary but insufficient.

## Error and recovery states

| State | UX response |
| --- | --- |
| Invalid line | Keep values; focus/link first error; no partial line insertion. |
| Negative profit | Allow under current behavior; show icon/text warning and require review, not a modal block. |
| Delete | Undo with item name and deterministic restored position, or confirm before irreversible removal. |
| Storage unavailable/full | Keep in-memory work, persistent warning, offer copy/download where possible, do not display “Saved.” |
| Corrupt local record | Preserve raw recovery value, load last valid/default draft, offer export/reset instructions. |
| Another tab changed draft | Warn and offer reload/keep-this-copy; never silently last-write-wins. |
| PDF generation failure | Keep quote state, show retry and customer text copy; no blank download. |
| Inline preview unsupported | Show HTML review plus Open/Download PDF rather than an empty iframe. |
| Share cancelled | Neutral message; do not mark Sent. |
| Share unavailable/fails | Reveal download + mailto/manual attachment fallback. |
| New window blocked | Keep same-tab/download controls and explicit user-gesture link. |
| Missing buyer email | Share/download remain enabled; email action explains/focuses missing field. |
| No default mail app | Cannot be detected reliably; leave filename, recipient, subject, and body copyable. |

## Landscape and laptop enhancement

- At 700–900 px, use two-column field groups and keep cards; avoid forcing the desktop table.
- At 900 px+, show Details and Items side by side if it reduces scrolling. An internal table is acceptable when columns fit, with cards still available at zoom/narrow widths.
- Sticky actions become a top/right action rail or normal toolbar; they must not span the entire laptop viewport.
- Preview dialog is width-limited and offers open-in-new-tab/download. Keyboard order follows visual order.

