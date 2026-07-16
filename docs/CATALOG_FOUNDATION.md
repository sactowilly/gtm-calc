# Version 1.5 Catalog Foundation

This first Version 1.5 slice adds pure, storage-independent catalog rules. It does not change the quote UI, the active-quote storage key, pricing calculations, customer output, or GitHub Pages deployment.

## Implementation status

- PR #9 merged on 2026-07-15 with passing unit, build, visual, accessibility, and browser compatibility checks.
- The merged foundation is intentionally inactive until a UI/storage adapter calls it.
- Review confirmed the quote calculation and `gtm_quote_calculator_v1` paths are not imported or mutated by the catalog modules.
- Follow-up hardening remains for duplicate/ambiguous headers, BOM and multiline CSV fixtures, dimension false-positive fixtures, field-size limits, and local-storage failure recovery.
- The PR #10 branch implements versioned catalog-only local storage, CSV import/report UI, unified search, manual-item saving/deletion, recent selections, safe population of the existing editable item form, parser hardening, and phone/browser regression coverage.

## Provisional CSV contract

Until a representative Vision catalog CSV is approved, the importer uses a narrow default contract:

- Required: `SKU`, `Name`
- Optional: `Description`, `Dimensions`, `UOM`, `Unit Cost`, `Unit Price`, `Active`
- Common aliases such as `Item Number`, `Item Name`, `Box Dimensions`, `Cost`, and `Price` are accepted.
- A caller can supply a different header-alias contract without changing the parser.
- Duplicate normalized SKUs reject the later row and appear in the import report.
- Blank cost and price remain blank (`null`); invalid or negative values reject the row.
- Blank active status means active. Supported explicit values include yes/no, true/false, 1/0, and active/inactive.

No row is silently discarded. The import result contains accepted and rejected counts plus row-numbered errors.

## Search rules

Search works across standard and manual item-shaped records. Ranking is deterministic:

1. Exact SKU
2. SKU prefix
3. SKU substring
4. Canonical dimensions
5. Exact item name
6. Item-name prefix
7. Item-name substring
8. Description substring

Recent/frequent use breaks close matches but cannot promote a weaker match above a stronger relevance band. Inactive catalog items are excluded.

Dimension normalization recognizes the roadmap examples (`12x10x8`, `12 x 10 x 8`, `12 10 8`, and `RSC 12x10x8`) and common decimal or fractional forms. Original display text remains unchanged.

## Owner decisions before UI/import storage

- Confirm the actual CSV header names and provide a sanitized sample.
- Confirm whether SKU and name are always required.
- Choose the duplicate-SKU policy: reject, keep first, or replace.
- Confirm whether cost and price are per UOM and whether five decimal places are sufficient.
- Confirm allowed catalog UOM values and how blank/unknown UOM should behave.
- Confirm whether inactive items should remain searchable through an explicit filter.
- Choose the Version 1.5 local persistence format and catalog replacement/rollback workflow.

## Current implementation decision

PR #10 uses repository-style adapters over separate versioned localStorage keys for the standard catalog, manual items, and recent-use metadata. This is the least disruptive bridge for Version 1.5 and keeps the active quote key unchanged. Imports are replaceable and retain one rollback copy. Storage/quota failures leave the previous catalog usable. The adapter boundary allows catalog data to migrate to IndexedDB with the Version 2 repository work.

This choice is suitable for an initial moderate catalog. A sanitized production CSV must be measured before declaring a supported maximum row count; the UI must reject an import that cannot be safely stored rather than silently truncating it.
