# Storage and Backup Plan

## Current localStorage behavior

The current application uses exactly one key, `gtm_quote_calculator_v1`, in `js/main.js:2`. Its value is the active quote object with `customerName`, `date`, and `items`; each item includes both entered and derived calculation fields. Save is manual. Load validates only that `items` is an array. A JSON syntax error deletes the value, while storage exceptions and field corruption are not handled.

Consequences:

- One quote overwrites the previous active quote.
- Unsaved edits disappear on reload/navigation.
- Clearing site data/private-session eviction loses the quote.
- No device sync, restore, conflict handling, or corruption export exists.
- Derived fields can disagree with inputs and future formulas.

## Version 1 recommendation

Keep one local active quote and localStorage; do not prematurely implement IndexedDB or the full repository layer.

### Versioned, backward-tolerant record

Retain the existing key and top-level `customerName`, `date`, and `items` so a rollback has the best chance to read core data. Add fields rather than wrap the object immediately:

```ts
interface ActiveQuoteRecordV2 {
  schemaVersion: 2;
  id: string;
  customerName: string;  // legacy-compatible alias during transition
  date: string;          // legacy-compatible alias during transition
  items: unknown[];      // migrated validated line items

  companyName: string;
  buyerName: string;
  buyerEmail?: string;
  companyAddress?: PostalAddress;
  buyerPhone?: string;
  quoteDate: string;
  expirationDate: string;
  paymentTerms: string;
  internalNotes?: string;
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
  calculationPolicyVersion: string;
}
```

The actual implementation should use a pure `migrateActiveQuote(raw)` plus validation. On first successful migration, preserve the original raw string in a one-time recovery key such as `gtm_quote_calculator_v1_legacy_backup`; document and eventually remove it only after a successful V2.5 backup. Never delete corrupt data automatically.

### Small V1 adapter

```ts
interface ActiveQuoteStorage {
  load(): LoadActiveQuoteResult;
  save(record: ActiveQuoteRecordV2): SaveResult;
  exportRecoveryValue(): string | undefined;
}
```

This is intentionally smaller than the V2 repositories. UI code should not call `localStorage` directly.

### Save/recovery behavior

- Debounce saves after valid field/line changes and flush on `pagehide`; retain a visible manual Save if users value explicit control.
- Report Saving/Saved/Not saved/Save failed accurately. Never claim saved before `setItem` succeeds.
- Add delete undo so autosave does not make an accidental deletion instantly irrecoverable.
- Catch unavailable/quota/security errors and keep the in-memory draft usable; offer customer-safe copy/PDF where possible.
- Store a `updatedAt`/revision token and listen for `storage` events. If another tab changes the same draft, warn instead of silently overwriting.
- Validate each field and recalculate derived values from inputs. Preserve a raw recovery value/quarantine on failure.
- Do not store PDF Blob URLs or bytes.

## Version 2 IndexedDB plan

Database name: `gtm_quote_manager`. Use an explicit integer database version and logical record `schemaVersion`s.

### Foundation implementation status — 2026-07-16

The first Version 2 slice implements database version 1 with `quotes`, `quoteVersions`, `quoteEvents`, `customers`, `contacts`, `settings`, `recoveryRecords`, and `migrationLog` stores. It uses the small pinned `idb` wrapper for transaction safety and `fake-indexeddb` only in unit tests; Playwright also exercises the repository against real browser IndexedDB.

This slice is deliberately disconnected from `js/main.js`. The active calculator still reads and writes `gtm_quote_calculator_v1`, and creating the new database never deletes or changes that key. The repository can import a cloned legacy quote into an unnumbered library draft, but the visible opt-in/import workflow belongs to the next PR.

Implemented guarantees:

- UUID-like injected IDs and ISO timestamps with a stable device ID in settings.
- Lossless conversion between the current flat quote and the Version 2 content snapshot, including catalog references and derived legacy calculations.
- Transactional `YYYY-NNN` base allocation using an explicit business year.
- Transactional `-R#` revision allocation and content hashes for finalized snapshots.
- No repository method that updates a finalized version; editing requires a revision draft.
- Duplicate-as-new creates an unnumbered draft with source lineage.
- Invalid records are isolated in `recoveryRecords` while healthy records remain usable.

Not yet connected or implemented: customer/contact repositories, status-transition rules, active-quote import UI, quote-library screens, catalog migration, backup/restore, and deletion/recovery controls.

Proposed object stores:

| Store | Key/indexes | Purpose |
| --- | --- | --- |
| `quotes` | `id`; `baseNumber`, `currentStatus`, `customerId`, `updatedAt` | Mutable aggregates and working drafts. |
| `quoteVersions` | `id`; unique `displayNumber`, `quoteId`, `[quoteId, revisionNumber]`, `finalizedAt` | Immutable finalized snapshots. |
| `quoteEvents` | `id`; `quoteId`, `quoteVersionId`, `occurredAt`, `type` | Append-only workflow/status history. |
| `customers` | `id`; `normalizedName`, `updatedAt` | Customer records. |
| `contacts` | `id`; `customerId`, `email`, `[customerId, isPrimary]` | Contacts. |
| `manualItems` | `id`; `normalizedSku`, `normalizedName`, `normalizedDimensions`, `lastUsedAt` | Local manual catalog. |
| `catalogItems` | `id`; normalized SKU/name/dimensions, `importBatchId` | Imported standard catalog if not shipped read-only with app. |
| `settings` | fixed key | Device ID, defaults, template/calculation policy, counters. |
| `recoveryRecords` | `id`; `storeName`, `detectedAt` | Raw invalid records plus validation error; never used in normal queries. |
| `migrationLog` | version | Successful migrations and counts/checksums. |

Catalog storage choice should be finalized in V1.5: a small versioned CSV can ship with the static app and only manual/recent metadata needs IndexedDB; large/updatable catalogs may justify `catalogItems`.

### Repository interfaces

```ts
interface QuoteRepository {
  get(id: UUID): Promise<Quote | undefined>;
  search(query: QuoteSearch): Promise<QuoteSummary[]>;
  saveDraft(quote: Quote): Promise<void>;
  finalizeBase(id: UUID): Promise<QuoteVersion>;
  startRevision(id: UUID, versionId: UUID): Promise<Quote>;
  finalizeRevision(id: UUID): Promise<QuoteVersion>;
  duplicateAsNew(source: QuoteSource, options: DuplicateOptions): Promise<Quote>;
  appendStatus(id: UUID, status: QuoteStatus): Promise<void>;
}

interface CustomerRepository {
  get(id: UUID): Promise<Customer | undefined>;
  search(text: string): Promise<Customer[]>;
  save(customer: Customer): Promise<void>;
  listContacts(customerId: UUID): Promise<Contact[]>;
  saveContact(contact: Contact): Promise<void>;
}

interface CatalogRepository {
  search(query: CatalogQuery): Promise<CatalogSearchResult[]>;
  importCsv(file: File): Promise<CatalogImportReport>;
  saveManual(item: ManualItem): Promise<void>;
  recordUse(itemId: UUID): Promise<void>;
}

interface SettingsRepository {
  get(): Promise<ApplicationSettings>;
  save(settings: ApplicationSettings): Promise<void>;
}

interface BackupService {
  createCompleteBackup(): Promise<BackupEnvelope>;
  validate(file: File): Promise<BackupValidationReport>;
  restore(file: File, mode: 'merge' | 'replace'): Promise<RestoreReport>;
}

interface PdfService {
  generateCustomerPdf(document: CustomerQuoteDocument): Promise<GeneratedPdf>;
}

interface ShareService {
  canShareFiles(files: File[]): boolean;
  sharePdf(file: File, message: CustomerShareMessage): Promise<ShareResult>;
  buildMailto(message: CustomerEmailMessage): string;
}
```

UI/application services depend on these contracts. Only IndexedDB adapter code uses `IDB*` APIs. Use a lightweight helper such as `idb` only if it materially reduces transaction mistakes; pin and bundle it. Do not add a state-management or ORM framework.

## Numbering and transaction safety

- Drafts have no number.
- Finalize base atomically increments the local year counter and writes `YYYY-NNN` plus version/event in one transaction.
- A transaction abort must not leave a number assigned without a version. Once committed, never reuse a number even if the quote is later cancelled.
- Revision finalization reads the maximum committed revision for the base and writes the next `R#` in the same transaction.
- Use a unique `displayNumber` index to catch collisions and retry/report rather than overwrite.
- Multi-tab tests are required. Numbers are not globally unique across devices; UI/exports must communicate the local scope until Version 4.

## Schema version and migrations

Maintain two related versions:

- IndexedDB database version controls object-store/index upgrade transactions.
- Each record/envelope `schemaVersion` controls shape migration/validation.

Rules:

1. Migrations are ordered pure transforms where possible and tested from every supported prior version.
2. `onupgradeneeded` structural work occurs inside the upgrade transaction; an exception aborts the upgrade.
3. Never perform network work during migration.
4. Validate migrated records on read/write. Move an invalid record's raw clone and errors to `recoveryRecords`; continue loading other valid records.
5. Record migration version, time, and counts without customer content.
6. Keep finalized snapshot/hash semantics stable; if a calculation model changes, preserve old policy readers rather than rewriting history.
7. Block opening a database created by a newer unsupported app version and direct the user to update/export, rather than downgrading it.

## Backup format and creation

Version 2.5 uses the `BackupEnvelope` in `DOMAIN_MODEL.md` with `format`, backup/app/database versions, source device, export timestamp, payload, and SHA-256 checksum. Serialize deterministically for checksums where practical. PDF files are regenerated and need not bloat the complete backup; template/policy versions are retained.

Backup workflow:

1. Read a consistent snapshot in readonly transactions.
2. Validate references/counts before offering the file.
3. Build JSON locally and download with a dated filename such as `gtm-calc-backup-2026-07-13.json`.
4. Clearly warn that it contains customer and pricing data.
5. Never upload it or log its contents.

CSV exports are lossy reporting formats, not backups. Use explicit UTF-8, headers, RFC 4180 quoting, formula-injection protection for cells beginning with `=`, `+`, `-`, or `@`, and documented date/currency units.

## Restore safety

Restore is a staged operation:

1. Read file with a configured size guard; parse without writing.
2. Validate envelope/checksum/schema/types/ranges/IDs/references/numbers/version hashes.
3. Show counts, warnings, unsupported records, and collision policy.
4. Create/download a safety backup of current data before replace or a material merge.
5. Apply in a single multi-store readwrite transaction when feasible. On any error, abort all writes.
6. Re-read and validate resulting counts/references; present a detailed report.

Merge rules:

- Same stable ID and identical hash: skip.
- Same ID but different mutable record: owner-select newest/keep-local/import-copy according to record type and report it.
- Same finalized-version ID or display number with different content hash: never overwrite; quarantine/report as a conflict.
- Number collision from another device: preserve both records and require an explicit resolution/migration strategy; do not silently renumber finalized history.

Replace clears normal stores only within the same committing transaction after validation/safety backup; recovery/migration metadata policy must be explicit.

## Corruption and partial-record recovery

- Validate per record, not by assuming an entire store is trustworthy.
- Keep raw invalid data, store name/key, detected time, and validation messages in `recoveryRecords`.
- Exclude corrupt records from calculations/search/finalization but show a non-blocking recovery count.
- Provide export of recovery records for support and allow deletion only after confirmation/backup.
- Maintain last-known-good active draft/recovery value in V1; IndexedDB transactions provide atomic writes in V2.
- Rebuild derived search fields/indexable normalized values from authoritative source fields when safe; never manufacture missing finalized financial data.

## Future hosted-system migration path

- Stable UUIDs, ISO UTC timestamps, explicit currency/minor units, source device IDs, schema versions, and immutable version hashes map cleanly to server tables/documents.
- Avoid IndexedDB auto-increment IDs and browser-specific object types in domain records.
- Keep repositories independent of IndexedDB so a future remote adapter/application sync layer can replace it.
- Preserve customer/contact snapshots on finalized versions; relational customer edits must not rewrite history.
- Quote numbers currently identify local finalized versions. Version 4 needs an explicit collision/import policy and centralized transactional allocator; never pretend existing device numbers were globally unique.
- Events enable audit migration. Do not add auth/user fields with fake values now; add actor identity only when a real identity system exists.

