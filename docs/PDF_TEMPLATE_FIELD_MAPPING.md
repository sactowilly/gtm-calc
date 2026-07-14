# Customer Quotation PDF Field Mapping

## Rendering boundary

`toCustomerQuoteDocument` in `js/pdf/customer-quote-document.js` is the customer-facing allowlist. The HTML template and PDF renderer receive only this projected object. They never receive unit cost, freight, landed cost, GTM values, internal item IDs, or internal notes.

The saved browser key remains `gtm_quote_calculator_v1`. New properties are optional when loading older records, so legacy quotes continue to load.

## Quote-level fields

| PDF field | Application source | Legacy behavior |
| --- | --- | --- |
| Customer/company name | `quote.customerName` | Existing field; blank stays blank. |
| Street/city/state/ZIP lines | `quote.customerAddress`, split on line breaks | Existing field; any number of lines may wrap. |
| ATTENTION | `quote.buyerName` | Existing field; blank row is preserved. |
| EMAIL | `quote.buyerEmail` | Existing field; blank row is preserved. |
| PHONE | `quote.buyerPhone` | Existing field; blank row is preserved. |
| FAX | `quote.buyerFax` | New optional field; legacy records load as blank. |
| SALES REP | `quote.salesRep` | Existing field; blank stays blank. |
| DATE | `quote.date` | Existing ISO date value is preserved. |
| SHIP VIA | `quote.shipVia` | New field. New quotes default to `Our Truck`; legacy records without the property load with that default. Users may clear it. |
| F.O.B. POINT | `quote.fobPoint` | New optional field; legacy records load as blank. |
| TERMS | `quote.terms` | New optional field; legacy records load as blank. |
| NOTES | `quote.customerNotes` | New customer-facing field; legacy records load as blank. This is distinct from any future internal notes. |

## Line-item fields

| PDF column | Application source | Customer-facing rule |
| --- | --- | --- |
| MIN | `item.quantity` | Existing positive whole-number quantity. |
| DESCRIPTION | `item.name` | Existing item name; wraps without truncation. |
| UNIT | `item.uom` | Existing UOM, normalized by the current UOM rule. |
| UNIT PRICE | `item.price` | Existing selling price, using the approved up-to-five-decimal currency formatter. |
| LEAD TIME | `item.leadTime` | New optional text field; legacy items load as blank. |

## Fixed company content

The logo artwork is `assets/vision-industrial-packaging-logo.png`, extracted unchanged from `word/media/image1.png` in the supplied `quote test 2026.docx`. The company address, website, telephone, fax, validity statement, thank-you statement, and category footer are copied from the supplied reference quotation.

## Explicit exclusions

The customer quotation projection excludes:

- Unit cost and landed cost.
- Freight and freight mode.
- GTM dollars and GTM percentage/markup.
- Total cost and total GTM.
- Internal item IDs.
- Internal notes, vendor data, and storage metadata.
