import { buildCustomerQuotePdfBlob } from '../pdf/customer-quote-pdf.js';
import {
  formatExportDate,
  formatExportMoney,
  serializeCsv,
  createExportFilename,
  slugifyExportPart
} from '../domain/export-formatters.js';
import {
  cloneQuoteData,
  quoteContentToLegacyQuote,
  validateQuoteContent,
  validateQuoteRecord,
  validateQuoteVersion
} from '../domain/quote-library.js';
import { getQuotePdfFilename } from '../domain/quote-output.js';

export class QuoteExportError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'QuoteExportError';
  }
}

const CSV_MIME = 'text/csv;charset=utf-8';
const JSON_MIME = 'application/json;charset=utf-8';
const PDF_MIME = 'application/pdf';

function text(value) {
  return String(value ?? '').trim();
}

function contentFromRecord(quote, version) {
  if (version) {
    const versionErrors = validateQuoteVersion(version);
    if (versionErrors.length) throw new QuoteExportError(`The selected immutable quote version is invalid: ${versionErrors.join(' ')}`);
    if (version.quoteId !== quote.id) throw new QuoteExportError('The selected quote version belongs to a different quote.');
    return { content: cloneQuoteData(version.content), version };
  }
  if (quote.workingDraft?.content) {
    const contentErrors = validateQuoteContent(quote.workingDraft.content);
    if (contentErrors.length) throw new QuoteExportError(`The draft quote content is invalid: ${contentErrors.join(' ')}`);
    return { content: cloneQuoteData(quote.workingDraft.content), version: undefined };
  }
  throw new QuoteExportError('A finalized quote requires an explicitly selected immutable version.');
}

function quoteLabel(quote, version) {
  return text(version?.displayNumber || quote?.baseNumber || quote?.displayNumber) || 'Unnumbered';
}

function contentTotal(content) {
  return content.lines.reduce((sum, line) => sum + (Number.isFinite(line.orderTotal) ? line.orderTotal : 0), 0);
}

export function buildQuoteListCsv(quotes = [], { versionsByQuoteId = new Map(), exportedAt = new Date() } = {}) {
  if (!Array.isArray(quotes)) throw new TypeError('Quotes must be an array.');
  const rows = [[
    'Quote Number', 'Status', 'Customer', 'Buyer', 'Email', 'Quote Date', 'Updated', 'Selling Total', 'Currency'
  ]];
  [...quotes]
    .sort((left, right) => text(right.updatedAt).localeCompare(text(left.updatedAt)))
    .forEach((quote) => {
      const version = versionsByQuoteId instanceof Map
        ? versionsByQuoteId.get(quote.id)
        : versionsByQuoteId?.[quote.id];
      const checkedRecord = validateQuoteRecord(quote);
      if (checkedRecord.length) {
        throw new QuoteExportError(`The quote list contains an invalid record: ${checkedRecord.join(' ')}`);
      }
      const content = contentFromRecord(quote, version).content;
      rows.push([
        quoteLabel(quote, version),
        text(quote.currentStatus),
        text(content?.customer?.companyName),
        text(content?.contact?.buyerName),
        text(content?.contact?.email),
        text(content?.quoteDate),
        formatExportDate(quote.updatedAt),
        content ? formatExportMoney(contentTotal(content)) : '',
        text(content?.currency || 'USD')
      ]);
    });
  return serializeCsv(rows);
}

export function buildCustomerCsv(customers = [], { contacts = [], exportedAt = new Date() } = {}) {
  if (!Array.isArray(customers)) throw new TypeError('Customers must be an array.');
  const contactsByCustomer = new Map();
  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    if (!contactsByCustomer.has(contact.customerId) || contact.isPrimary) contactsByCustomer.set(contact.customerId, contact);
  });
  const rows = [['Company', 'Address', 'Primary Contact', 'Email', 'Phone', 'Payment Terms', 'Updated']];
  [...customers]
    .sort((left, right) => text(left.companyName).localeCompare(text(right.companyName)))
    .forEach((customer) => {
      const contact = contactsByCustomer.get(customer.id) || {};
      rows.push([
        text(customer.companyName),
        text(customer.addressText),
        text(contact.name),
        text(contact.email),
        text(contact.phone),
        text(customer.defaultPaymentTerms),
        formatExportDate(customer.updatedAt)
      ]);
    });
  return serializeCsv(rows);
}

export function buildManualItemsCsv(items = []) {
  if (!Array.isArray(items)) throw new TypeError('Manual items must be an array.');
  const rows = [['SKU', 'Item', 'Description', 'Unit', 'Dimensions', 'Active', 'Updated']];
  [...items]
    .sort((left, right) => text(left.name).localeCompare(text(right.name)))
    .forEach((item) => rows.push([
      text(item.sku),
      text(item.name),
      text(item.description),
      text(item.unitOfMeasure || item.uom),
      text(item.dimensionsDisplay),
      item.active === false ? 'No' : 'Yes',
      formatExportDate(item.updatedAt)
    ]));
  return serializeCsv(rows);
}

export function buildIndividualQuoteJson(quote, version, { exportedAt = new Date() } = {}) {
  const checkedQuote = validateQuoteRecord(quote);
  if (checkedQuote.length) throw new QuoteExportError(`The quote is invalid: ${checkedQuote.join(' ')}`);
  const selected = contentFromRecord(quote, version);
  return `${JSON.stringify({
    format: 'gtm-calc-quote-export',
    schemaVersion: 1,
    exportedAt: new Date(exportedAt).toISOString(),
    quote: {
      id: quote.id,
      status: quote.currentStatus,
      baseNumber: quote.baseNumber || null,
      sourceQuoteId: quote.sourceQuoteId || null,
      sourceQuoteVersionId: quote.sourceQuoteVersionId || null,
      updatedAt: quote.updatedAt,
      content: selected.content
    },
    version: selected.version ? {
      id: selected.version.id,
      quoteId: selected.version.quoteId,
      displayNumber: selected.version.displayNumber,
      revisionNumber: selected.version.revisionNumber,
      basedOnVersionId: selected.version.basedOnVersionId || null,
      contentHash: selected.version.contentHash,
      calculationPolicyVersion: selected.version.calculationPolicyVersion,
      pdfTemplateVersion: selected.version.pdfTemplateVersion,
      finalizedAt: selected.version.finalizedAt
    } : null
  }, null, 2)}\n`;
}

function triggerDownload({ blob, filename, documentRef, urlApi, schedule = globalThis.setTimeout }) {
  if (!documentRef?.body || typeof urlApi?.createObjectURL !== 'function') throw new QuoteExportError('This browser cannot start a local export download.');
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  anchor.rel = 'noopener';
  documentRef.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    if (typeof urlApi.revokeObjectURL === 'function') {
      // Give the browser a turn to consume the object URL before cleanup.
      if (typeof schedule === 'function') schedule(() => urlApi.revokeObjectURL(objectUrl), 1000);
      else urlApi.revokeObjectURL(objectUrl);
    }
  }
}

function getSelectedVersion(quote, versionOrId, repository) {
  if (versionOrId && typeof versionOrId === 'object') return Promise.resolve(versionOrId);
  if (!versionOrId) return Promise.resolve(undefined);
  if (!repository?.getVersion) throw new QuoteExportError('A quote repository is required to resolve an immutable version ID.');
  return repository.getVersion(versionOrId);
}

async function resolveQuoteListVersions(quotes, versionsByQuoteId, repository) {
  if (versionsByQuoteId) return versionsByQuoteId;
  if (!repository?.listVersions) return new Map();
  const map = new Map();
  for (const quote of quotes || []) {
    if (quote?.workingDraft) continue;
    const versions = await repository.listVersions(quote.id);
    const latest = [...(versions || [])].sort((left, right) => (
      Number(right.revisionNumber || 0) - Number(left.revisionNumber || 0)
      || text(right.finalizedAt).localeCompare(text(left.finalizedAt))
    ))[0];
    if (latest) map.set(quote.id, latest);
  }
  return map;
}

export function createQuoteExportService({
  repository,
  pdfService = { buildCustomerQuotePdfBlob },
  BlobType = globalThis.Blob,
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  now = () => new Date(),
  schedule = globalThis.setTimeout
} = {}) {
  if (!repository) throw new Error('A quote repository is required.');
  if (typeof BlobType !== 'function') throw new Error('A Blob implementation is required.');

  async function downloadCsv(kind, csv, date) {
    const filename = createExportFilename(`gtm-calc-${kind}`, 'csv', { date });
    const blob = new BlobType([csv], { type: CSV_MIME });
    triggerDownload({ blob, filename, documentRef, urlApi, schedule });
    return { filename, blob, byteCount: blob.size };
  }

  return {
    async exportQuoteListCsv({ quotes, versionsByQuoteId, date = now() } = {}) {
      const selectedVersions = await resolveQuoteListVersions(quotes, versionsByQuoteId, repository);
      const csv = buildQuoteListCsv(quotes, { versionsByQuoteId: selectedVersions, exportedAt: date });
      return downloadCsv('quotes', csv, date);
    },
    async exportCustomersCsv({ customers, contacts, date = now() } = {}) {
      return downloadCsv('customers', buildCustomerCsv(customers, { contacts, exportedAt: date }), date);
    },
    async exportManualItemsCsv({ items, date = now() } = {}) {
      return downloadCsv('manual-items', buildManualItemsCsv(items), date);
    },
    async exportQuoteJson({ quote, version, versionId, date = now() } = {}) {
      if (!quote) throw new QuoteExportError('A quote is required.');
      const selectedVersion = await getSelectedVersion(quote, version || versionId, repository);
      const json = buildIndividualQuoteJson(quote, selectedVersion, { exportedAt: date });
      const label = slugifyExportPart(quoteLabel(quote, selectedVersion), 'quote');
      const filename = createExportFilename('gtm-calc-quote', 'json', { date, suffix: label });
      const blob = new BlobType([json], { type: JSON_MIME });
      triggerDownload({ blob, filename, documentRef, urlApi, schedule });
      return { filename, blob, byteCount: blob.size, json };
    },
    async exportCustomerPdf({ quote, version, versionId, date = now() } = {}) {
      if (!quote) throw new QuoteExportError('A quote is required.');
      const selectedVersion = await getSelectedVersion(quote, version || versionId, repository);
      const selected = contentFromRecord(quote, selectedVersion);
      const legacyQuote = quoteContentToLegacyQuote(selected.content);
      legacyQuote.quoteNumber = quoteLabel(quote, selected.version);
      const blob = await pdfService.buildCustomerQuotePdfBlob(legacyQuote);
      if (!blob || typeof blob.size !== 'number') throw new QuoteExportError('The customer PDF could not be generated.');
      const filename = getQuotePdfFilename({
        quoteNumber: quoteLabel(quote, selected.version) === 'Unnumbered' ? '' : quoteLabel(quote, selected.version),
        customerName: selected.content.customer.companyName,
        date: selected.content.quoteDate
      });
      triggerDownload({ blob, filename, documentRef, urlApi, schedule });
      return { filename, blob, byteCount: blob.size };
    }
  };
}
