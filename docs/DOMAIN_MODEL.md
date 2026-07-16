# Domain Model

## Design principles

- Use stable UUIDs and ISO-8601 UTC timestamps so local records can migrate to a hosted system later.
- Store user-entered source values and recompute derived profitability through a versioned calculation policy. Finalized versions also snapshot the displayed results/policy so historical output remains reproducible.
- Treat customer output as an allowlisted projection. Never create it by deleting fields from an internal object.
- Keep finalized content immutable. Status history and delivery actions are append-only events, not edits to finalized content.
- Keep numbering local/device-scoped until a hosted allocator exists. A number is unique only within that browser library unless the business establishes manual device ranges.
- Version 1 implements only a single active draft shape and small storage/PDF/share seams. The full aggregate/repositories begin in Version 2.

These are proposed TypeScript-style contracts, not a requirement to migrate the V1 implementation to TypeScript.

## Shared types

```ts
type UUID = string;
type ISODate = string;       // YYYY-MM-DD, business-local calendar date
type ISODateTime = string;   // UTC timestamp, e.g. 2026-07-13T20:30:00.000Z
type MoneyCents = number;    // safe integer
type QuoteStatus =
  | 'draft'
  | 'finalized'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

type FreightMode = 'perUnit' | 'total';
type ItemSource = 'adHoc' | 'catalog' | 'manual';
```

## Quote

`Quote` is the mutable workflow aggregate. It owns an unnumbered working draft, references immutable finalized versions, and caches current status for searching. A new quote is not a finalized version.

```ts
interface Quote {
  id: UUID;
  schemaVersion: number;
  originDeviceId: UUID;

  // Undefined until the first base version is finalized.
  baseNumber?: string;               // e.g. "2026-001"
  currentStatus: QuoteStatus;
  latestVersionId?: UUID;
  versionIds: UUID[];

  // Present while creating the base draft or a revision draft.
  workingDraft?: QuoteDraft;

  // Duplicate lineage; does not make this record a revision.
  sourceQuoteId?: UUID;
  sourceQuoteVersionId?: UUID;

  customerId?: UUID;
  contactId?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface QuoteDraft {
  kind: 'base' | 'revision';
  basedOnVersionId?: UUID;            // required for revision
  proposedRevisionNumber?: number;    // not authoritative until finalize
  content: QuoteContent;
  lastSavedAt: ISODateTime;
}
```

Mutability: `workingDraft`, selected customer/contact, cached status, and timestamps may change. `id`, origin, source lineage, allocated base number, and finalized version references must not be rewritten to disguise history.

## QuoteVersion

`QuoteVersion` is an immutable finalized snapshot. Revision 0 is the base quote; revisions 1+ render with `-R#`.

```ts
interface QuoteVersion {
  id: UUID;
  schemaVersion: number;
  quoteId: UUID;
  baseNumber: string;                 // "2026-001"
  revisionNumber: number;             // 0, 1, 2...
  displayNumber: string;              // "2026-001" or "2026-001-R1"
  basedOnVersionId?: UUID;

  content: QuoteContent;              // deep immutable snapshot
  calculationPolicyVersion: string;
  pdfTemplateVersion: string;
  contentHash: string;                // detects accidental mutation/corruption

  finalizedAt: ISODateTime;
  createdAt: ISODateTime;
}
```

Finalization is one IndexedDB transaction: validate the draft, allocate a base/revision number, create the version, append a finalized event, update the `Quote` aggregate, and clear the working draft. Never update a `QuoteVersion`; correction requires a revision.

### Quote content snapshot

The Version 2 foundation uses a compatibility bridge while the existing UI still owns a flat active quote. `legacyQuoteToQuoteContent` maps `customerName` and `customerAddress` into the customer snapshot; buyer name/email/phone into the contact snapshot; `salesRep`, date, Ship Via, F.O.B., terms, customer notes, and existing line snapshots into explicit content fields. `quoteContentToLegacyQuote` round-trips that data back to the current UI shape. Address remains `addressText` until the customer-record UI introduces safe structured-address editing; it is not guessed or split during migration.

Current line snapshots additionally preserve `uom`, `leadTime`, freight mode, the legacy derived calculation fields, and optional `catalogItemId`, `catalogSource`, and `sku`. These internal identifiers remain excluded from the customer projection.

```ts
interface QuoteContent {
  customer: CustomerSnapshot;
  contact?: ContactSnapshot;
  quoteDate: ISODate;
  expirationDate: ISODate;
  paymentTerms: string;
  customerNotes?: string;
  internalNotes?: string;
  currency: 'USD';
  lines: QuoteLineItem[];
  totals: QuoteTotalsSnapshot;
}

interface CustomerSnapshot {
  companyName: string;
  address?: PostalAddress;
}

interface ContactSnapshot {
  buyerName: string;
  email?: string;
  phone?: string;
}

interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}
```

Snapshots deliberately duplicate customer/contact display data. Editing a customer later must not change a finalized quote.

## QuoteLineItem

```ts
interface QuoteLineItem {
  id: UUID;
  position: number;
  source: ItemSource;
  catalogItemId?: UUID;
  manualItemId?: UUID;

  // Customer-facing product/price fields.
  sku?: string;
  name: string;
  description?: string;
  dimensionsDisplay?: string;
  quantity: number;
  unitPriceCents: MoneyCents;
  lineTotalCents: MoneyCents;

  // Internal-only cost/profitability fields.
  unitCostCents: MoneyCents;
  freightMode: FreightMode;
  freightCents: MoneyCents;
  landedUnitCostMinor: number;       // policy-defined precision
  totalCostCents: MoneyCents;
  profitCents: MoneyCents;
  markupPercent?: number;            // undefined when cost denominator is 0
  grossMarginPercent?: number;       // undefined when price denominator is 0
}

interface QuoteTotalsSnapshot {
  customerSubtotalCents: MoneyCents;
  customerTotalCents: MoneyCents;
  totalCostCents: MoneyCents;        // internal only
  profitCents: MoneyCents;           // internal only
  markupPercent?: number;            // internal only, weighted by total cost
  grossMarginPercent?: number;       // internal only, weighted by total sales
}
```

`position` is normalized to a contiguous sequence after reorder. Quantity remains a positive integer in the proposed V1 policy unless the owner approves fractional units. Derived fields in a draft may be recomputed; values within a finalized snapshot are immutable and tied to `calculationPolicyVersion`.

## Customer-safe projection

Customer documents must be created only from this allowlisted shape:

```ts
interface CustomerQuoteDocument {
  quoteNumber?: string;               // absent for V1 draft
  companyName: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  companyAddress?: PostalAddress;
  quoteDate: ISODate;
  expirationDate: ISODate;
  paymentTerms: string;
  customerNotes?: string;
  currency: 'USD';
  lines: Array<{
    sku?: string;
    name: string;
    description?: string;
    dimensionsDisplay?: string;
    quantity: number;
    unitPriceCents: MoneyCents;
    lineTotalCents: MoneyCents;
  }>;
  subtotalCents: MoneyCents;
  totalCents: MoneyCents;
}
```

There is intentionally no unit cost, freight, landed cost, total cost, profit/GTM, markup, gross margin, internal note, internal identifier, source item ID, or calculation-policy detail. PDF, copied text, mailto body, Web Share title/text, and future hosted email payloads must accept `CustomerQuoteDocument`, never `QuoteContent`.

## Customer and Contact

```ts
interface Customer {
  id: UUID;
  schemaVersion: number;
  companyName: string;
  normalizedName: string;
  address?: PostalAddress;
  defaultPaymentTerms?: string;
  notes?: string;                     // internal only
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

interface Contact {
  id: UUID;
  schemaVersion: number;
  customerId: UUID;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  isPrimary: boolean;
  notes?: string;                     // internal only
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}
```

Customer/contact records begin in V2. V1 stores the entered snapshot directly on the active quote.

## CatalogItem and ManualItem

```ts
interface CatalogItem {
  id: UUID;                           // stable import-derived ID
  schemaVersion: number;
  sku: string;
  normalizedSku: string;
  name: string;
  normalizedName: string;
  description?: string;
  normalizedDescription?: string;
  dimensionsDisplay?: string;
  normalizedDimensions?: string;     // e.g. "12x10x8"
  unitOfMeasure?: string;
  active: boolean;
  importBatchId: UUID;
  sourceRowNumber: number;
}

interface ManualItem {
  id: UUID;
  schemaVersion: number;
  sku?: string;
  name: string;
  description?: string;
  dimensionsDisplay?: string;
  normalizedDimensions?: string;
  defaultUnitCostCents?: MoneyCents;  // internal only
  defaultUnitPriceCents?: MoneyCents;
  useCount: number;
  lastUsedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}
```

Store original display strings as well as normalized search fields. Standard imports never silently overwrite manual records; unified search combines results and exposes their source.

## QuoteEvent

```ts
type QuoteEventType =
  | 'created'
  | 'duplicated'
  | 'revision_started'
  | 'finalized'
  | 'status_changed'
  | 'pdf_generated'
  | 'downloaded'
  | 'share_started'
  | 'share_completed'
  | 'share_cancelled'
  | 'email_opened';

interface QuoteEvent {
  id: UUID;
  schemaVersion: number;
  quoteId: UUID;
  quoteVersionId?: UUID;
  type: QuoteEventType;
  occurredAt: ISODateTime;
  fromStatus?: QuoteStatus;
  toStatus?: QuoteStatus;
  sourceQuoteId?: UUID;
  metadata?: Record<string, string | number | boolean | null>;
}
```

Events must not store PDF bytes, email bodies, or duplicate sensitive content. A user cancelling the Share Sheet is not an error and should not mark the quote sent.

## ApplicationSettings

```ts
interface ApplicationSettings {
  id: 'application';
  schemaVersion: number;
  deviceId: UUID;
  companyProfile: {
    legalName: string;
    address?: PostalAddress;
    phone?: string;
    email?: string;
    website?: string;
  };
  defaultPaymentTerms?: string;
  defaultExpirationDays: number;
  calculationPolicyVersion: string;
  pdfTemplateVersion: string;
  numbering: Record<string, {
    year: number;
    lastBaseSequence: number;
  }>;
  updatedAt: ISODateTime;
}
```

Number allocation must update settings and create the finalized version in the same transaction. Never reuse a number after a failed/successful finalization record has been committed.

## BackupEnvelope

```ts
interface BackupEnvelope {
  format: 'gtm-calc-backup';
  backupSchemaVersion: number;
  applicationVersion: string;
  databaseSchemaVersion: number;
  exportedAt: ISODateTime;
  sourceDeviceId: UUID;
  checksumAlgorithm: 'SHA-256';
  payloadChecksum: string;
  payload: {
    quotes: Quote[];
    quoteVersions: QuoteVersion[];
    quoteEvents: QuoteEvent[];
    customers: Customer[];
    contacts: Contact[];
    catalogItems: CatalogItem[];
    manualItems: ManualItem[];
    settings: ApplicationSettings;
  };
}
```

Backups contain sensitive customer/pricing data and must carry a warning. Validation checks the envelope, checksum, supported schema, unique IDs/numbers, references, immutable hashes, field types/ranges, and record counts before any write.

## Required operations

### Duplicate as new quote

1. Select a source draft or finalized version.
2. Create a new `Quote.id`, no `baseNumber`, status `draft`, and a mutable base `workingDraft`.
3. Copy selected customer/contact and lines; reset dates/status/events and owner-selected notes.
4. Set `sourceQuoteId` and, where applicable, `sourceQuoteVersionId`.
5. Allocate a new base number only when this new quote is finalized.

### Create revision

1. Require a finalized source version.
2. Keep the same `Quote.id` and `baseNumber`; create a mutable revision draft based on the selected version.
3. Determine the proposed next revision from max existing revision + 1, but allocate/confirm it transactionally at finalization.
4. On finalization, append a new immutable `QuoteVersion`; never alter the source version.

### Status changes

Append a `status_changed` event and update the aggregate's cached current status. Content remains immutable. The approved initial transition matrix is Finalized → Sent or Cancelled, and Sent → Accepted, Declined, Expired, or Cancelled. Accepted, Declined, Expired, and Cancelled are terminal. Starting a revision is a separate operation available only from the latest finalized version while the aggregate is Finalized or Sent.

