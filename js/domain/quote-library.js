import { normalizeItem } from './calculations.js';

export const QUOTE_RECORD_SCHEMA_VERSION = 1;
export const QUOTE_LIBRARY_STATUSES = Object.freeze([
  'draft',
  'finalized',
  'sent',
  'accepted',
  'declined',
  'expired',
  'cancelled'
]);

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizeLine(line, index) {
  const normalized = normalizeItem(clone(line ?? {}));
  return {
    ...normalized,
    id: text(normalized.id) || `line-${index + 1}`,
    name: text(normalized.name),
    leadTime: text(normalized.leadTime),
    position: index
  };
}

export function legacyQuoteToQuoteContent(legacyQuote, { fallbackDate = '' } = {}) {
  const source = legacyQuote && typeof legacyQuote === 'object' ? legacyQuote : {};
  return {
    customer: {
      companyName: text(source.customerName),
      addressText: text(source.customerAddress)
    },
    contact: {
      buyerName: text(source.buyerName),
      email: text(source.buyerEmail),
      phone: text(source.buyerPhone)
    },
    salesRep: text(source.salesRep),
    quoteDate: text(source.date) || fallbackDate,
    expirationDate: text(source.expirationDate),
    shipVia: source.shipVia == null ? 'Our Truck' : text(source.shipVia),
    fobPoint: source.fobPoint == null ? 'Sacramento' : text(source.fobPoint),
    paymentTerms: source.terms == null ? 'NET30' : text(source.terms),
    customerNotes: text(source.customerNotes),
    internalNotes: text(source.internalNotes),
    currency: 'USD',
    lines: Array.isArray(source.items)
      ? source.items.map(normalizeLine)
      : []
  };
}

export function quoteContentToLegacyQuote(content) {
  const normalized = normalizeQuoteContent(content);
  return {
    customerName: normalized.customer.companyName,
    customerAddress: normalized.customer.addressText,
    buyerName: normalized.contact.buyerName,
    buyerEmail: normalized.contact.email,
    buyerPhone: normalized.contact.phone,
    salesRep: normalized.salesRep,
    date: normalized.quoteDate,
    shipVia: normalized.shipVia,
    fobPoint: normalized.fobPoint,
    terms: normalized.paymentTerms,
    customerNotes: normalized.customerNotes,
    items: normalized.lines.map(({ position, ...line }) => clone(line))
  };
}

export function normalizeQuoteContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  const customer = source.customer && typeof source.customer === 'object' ? source.customer : {};
  const contact = source.contact && typeof source.contact === 'object' ? source.contact : {};
  return {
    customer: {
      companyName: text(customer.companyName),
      addressText: text(customer.addressText)
    },
    contact: {
      buyerName: text(contact.buyerName),
      email: text(contact.email),
      phone: text(contact.phone)
    },
    salesRep: text(source.salesRep),
    quoteDate: text(source.quoteDate),
    expirationDate: text(source.expirationDate),
    shipVia: text(source.shipVia),
    fobPoint: text(source.fobPoint),
    paymentTerms: text(source.paymentTerms),
    customerNotes: text(source.customerNotes),
    internalNotes: text(source.internalNotes),
    currency: source.currency === 'USD' ? 'USD' : 'USD',
    lines: Array.isArray(source.lines)
      ? source.lines.map(normalizeLine)
      : []
  };
}

export function validateQuoteContent(content) {
  const errors = [];
  if (!content || typeof content !== 'object') return ['Quote content must be an object.'];
  if (!content.customer || typeof content.customer !== 'object') {
    errors.push('Customer snapshot is required.');
  } else if (typeof content.customer.companyName !== 'string' || typeof content.customer.addressText !== 'string') {
    errors.push('Customer snapshot fields must be text.');
  }
  if (!content.contact || typeof content.contact !== 'object') {
    errors.push('Contact snapshot is required.');
  } else if (
    typeof content.contact.buyerName !== 'string' ||
    typeof content.contact.email !== 'string' ||
    typeof content.contact.phone !== 'string'
  ) {
    errors.push('Contact snapshot fields must be text.');
  }
  ['salesRep', 'quoteDate', 'expirationDate', 'shipVia', 'fobPoint', 'paymentTerms', 'customerNotes', 'internalNotes'].forEach((field) => {
    if (typeof content[field] !== 'string') errors.push(`${field} must be text.`);
  });
  if (content.currency !== 'USD') errors.push('Only USD quote content is supported.');
  if (!Array.isArray(content.lines)) {
    errors.push('Quote lines must be an array.');
    return errors;
  }

  const lineIds = new Set();
  content.lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    if (!line || typeof line !== 'object') {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (typeof line.id !== 'string' || !line.id.trim()) errors.push(`${label} requires a text ID.`);
    if (lineIds.has(line.id)) errors.push(`${label} has a duplicate ID.`);
    lineIds.add(line.id);
    if (typeof line.name !== 'string' || !line.name.trim()) errors.push(`${label} requires a text description.`);
    if (typeof line.uom !== 'string' || typeof line.leadTime !== 'string') errors.push(`${label} UOM and lead time must be text.`);
    if (line.position !== index) errors.push(`${label} position must match its array order.`);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) errors.push(`${label} quantity must be a positive whole number.`);
    ['unitCost', 'price', 'freight', 'freightPerUnit', 'landedUnitCost', 'totalCost', 'orderTotal', 'gtmEachDollars', 'gtmTotalDollars', 'gtmEachPercent', 'gtmTotalPercent'].forEach((field) => {
      if (!Number.isFinite(line[field])) errors.push(`${label} ${field} must be finite.`);
    });
    if (Number.isFinite(line.unitCost) && line.unitCost < 0) errors.push(`${label} unitCost cannot be negative.`);
    if (Number.isFinite(line.price) && line.price < 0) errors.push(`${label} price cannot be negative.`);
    if (Number.isFinite(line.freight) && line.freight < 0) errors.push(`${label} freight cannot be negative.`);
  });
  return errors;
}

export function validateQuoteRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['Quote record must be an object.'];
  if (!text(record.id)) errors.push('Quote ID is required.');
  if (record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION) errors.push('Unsupported quote schema version.');
  if (!text(record.originDeviceId)) errors.push('Origin device ID is required.');
  if (!QUOTE_LIBRARY_STATUSES.includes(record.currentStatus)) errors.push('Quote status is invalid.');
  if (!Array.isArray(record.versionIds)) errors.push('Version IDs must be an array.');
  if (!text(record.createdAt) || !text(record.updatedAt)) errors.push('Quote timestamps are required.');
  if (typeof record.customerSearchText !== 'string') errors.push('Quote search text is required.');
  if (record.workingDraft) {
    if (!['base', 'revision'].includes(record.workingDraft.kind)) errors.push('Draft kind is invalid.');
    errors.push(...validateQuoteContent(record.workingDraft.content));
  }
  if (record.currentStatus === 'draft' && !record.workingDraft) errors.push('A draft quote requires working content.');
  if (record.baseNumber && !/^\d{4}-\d{3,}$/.test(record.baseNumber)) errors.push('Base quote number is invalid.');
  return errors;
}

export function validateQuoteVersion(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['Quote version must be an object.'];
  if (!text(record.id) || !text(record.quoteId)) errors.push('Version and quote IDs are required.');
  if (record.schemaVersion !== QUOTE_RECORD_SCHEMA_VERSION) errors.push('Unsupported quote-version schema version.');
  if (!/^\d{4}-\d{3,}$/.test(text(record.baseNumber))) errors.push('Version base number is invalid.');
  if (!Number.isInteger(record.revisionNumber) || record.revisionNumber < 0) errors.push('Revision number is invalid.');
  if (record.displayNumber !== buildDisplayNumber(record.baseNumber, record.revisionNumber)) errors.push('Display number does not match the base and revision.');
  if (!/^[a-f0-9]{64}$/.test(text(record.contentHash))) errors.push('Version content hash is invalid.');
  if (!text(record.calculationPolicyVersion) || !text(record.pdfTemplateVersion)) errors.push('Version policy identifiers are required.');
  errors.push(...validateQuoteContent(record.content));
  return errors;
}

export function createQuoteSearchText(content, baseNumber = '') {
  const normalized = normalizeQuoteContent(content);
  return [
    baseNumber,
    normalized.customer.companyName,
    normalized.contact.buyerName,
    normalized.contact.email,
    normalized.contact.phone,
    normalized.salesRep,
    ...normalized.lines.flatMap((line) => [line.sku, line.name])
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function buildDisplayNumber(baseNumber, revisionNumber) {
  if (!revisionNumber) return baseNumber;
  return `${baseNumber}-R${revisionNumber}`;
}

export function formatBaseQuoteNumber(year, sequence) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error('Quote number year must be a four-digit year.');
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('Quote sequence must be a positive whole number.');
  return `${year}-${String(sequence).padStart(3, '0')}`;
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      const sorted = sortForCanonicalJson(value[key]);
      if (sorted !== undefined) result[key] = sorted;
      return result;
    }, {});
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export async function hashQuoteContent(content, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new Error('SHA-256 is unavailable in this browser.');
  const bytes = new TextEncoder().encode(canonicalJson(content));
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function cloneQuoteData(value) {
  return clone(value);
}
