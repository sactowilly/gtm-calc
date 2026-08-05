import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { buildQuoteItem } from '../js/domain/calculations.js';
import {
  createExportFilename,
  escapeCsvCell,
  formatExportMoney,
  protectCsvCell,
  serializeCsv
} from '../js/domain/export-formatters.js';
import {
  buildCustomerCsv,
  buildIndividualQuoteJson,
  buildManualItemsCsv,
  buildQuoteListCsv,
  createQuoteExportService
} from '../js/services/quote-export-service.js';
import { legacyQuoteToQuoteContent } from '../js/domain/quote-library.js';
import { toCustomerQuoteDocument } from '../js/pdf/customer-quote-document.js';
import { createQuoteLibraryRepository } from '../js/services/indexeddb-quote-repository.js';

const repositories = [];
let sequence = 0;

function legacyQuote(companyName = 'North River Packaging') {
  const { item } = buildQuoteItem({
    name: 'Corrugated Carton',
    quantity: '100',
    uom: 'EA',
    unitCost: '0.75',
    price: '1.25',
    freight: '12.50',
    freightMode: 'total',
    leadTime: '2 weeks'
  }, `line-${companyName}`);
  return {
    customerName: companyName,
    customerAddress: '1250 Market Street\nSacramento, CA 95814',
    buyerName: 'Jordan Rivera',
    buyerEmail: 'jordan@example.test',
    buyerPhone: '916-555-0137',
    salesRep: 'Alex Morgan',
    date: '2026-07-16',
    shipVia: 'Our Truck',
    fobPoint: 'Sacramento',
    terms: 'NET30',
    customerNotes: '',
    items: [item]
  };
}

function makeRepository() {
  const databaseName = `gtm-quote-export-test-${++sequence}`;
  let id = 0;
  const repository = createQuoteLibraryRepository({
    databaseName,
    idFactory: () => `${databaseName}-id-${++id}`,
    now: () => '2026-08-05T12:00:00.000Z'
  });
  repositories.push(repository);
  return repository;
}

function downloadEnvironment() {
  const clicked = [];
  const revoked = [];
  const documentRef = {
    body: {
      appendChild() {},
      removeChild() {}
    },
    createElement() {
      return {
        click() { clicked.push(true); },
        remove() {}
      };
    }
  };
  const urlApi = {
    createObjectURL() { return 'blob:quote-export-test'; },
    revokeObjectURL(value) { revoked.push(value); }
  };
  return { clicked, revoked, documentRef, urlApi };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()));
});

describe('Version 2.5 reporting export formatters', () => {
  it.each([
    '=SUM(A1:A2)',
    '+cmd|/C calc',
    '-10+20',
    '@HYPERLINK("https://example.test")',
    '  =hidden formula',
    '\t+tab formula'
  ])('neutralizes formula-like CSV values: %s', (value) => {
    expect(protectCsvCell(value)).toBe(`'${value}`);
    expect(escapeCsvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`);
  });

  it('serializes RFC 4180 rows with commas, quotes, CRLF, Unicode, and optional BOM', () => {
    const csv = serializeCsv([
      ['Name', 'Description', 'Empty'],
      ['Caja, grande', 'Line one\r\nLine "two" 📦', '']
    ]);
    expect(csv).toBe('"Name","Description","Empty"\r\n"Caja, grande","Line one\r\nLine ""two"" 📦",""\r\n');
    expect(serializeCsv([['A'] ], { bom: true })).toBe('\uFEFF"A"\r\n');
    expect(serializeCsv([])).toBe('');
    expect(() => serializeCsv([['ok'], 'not a row'])).toThrow(TypeError);
  });

  it('formats money to five decimals without unnecessary zeroes and creates deterministic safe filenames', () => {
    expect(formatExportMoney(12.345678)).toBe('12.34568');
    expect(formatExportMoney(12.34)).toBe('12.34');
    expect(formatExportMoney(0)).toBe('0');
    expect(formatExportMoney('not-a-number')).toBe('0');
    expect(createExportFilename('GTM Calc Quotes', 'CSV', { date: '2026-08-05T23:59:00-07:00' }))
      .toBe('gtm-calc-quotes-2026-08-06.csv');
    expect(createExportFilename('GTM Calc', '.JSON', { date: 'not-a-date', suffix: '2026-001 / Draft' }))
      .toBe('gtm-calc-undated-2026-001-draft.json');
  });
});

describe('Version 2.5 CSV projections', () => {
  it('quotes list rows are sorted, escaped, and do not expose internal calculation fields', async () => {
    const repository = makeRepository();
    const older = await repository.createDraftFromLegacyQuote(legacyQuote('Older Company'));
    const newer = await repository.createDraftFromLegacyQuote(legacyQuote('=Injected Company'));
    const before = structuredClone([older, newer]);
    const csv = buildQuoteListCsv([older, newer]);

    expect(csv.indexOf("'=Injected Company")).toBeGreaterThan(csv.indexOf('Older Company'));
    expect(csv).toContain('"Quote Number","Status"');
    expect(csv).not.toMatch(/unitCost|landedUnitCost|gtmEachDollars|gtmTotalDollars|internalNotes/i);
    expect([older, newer]).toEqual(before);
  });

  it('customer and manual-item CSVs preserve empty, Unicode, multiline, quoted, and formula-like fields', () => {
    const customerCsv = buildCustomerCsv([
      {
        id: 'customer-1',
        companyName: 'Acme, "North" 📦',
        addressText: '1 Main St\nSuite 2',
        defaultPaymentTerms: '',
        updatedAt: '2026-08-05T12:00:00.000Z'
      },
      { id: 'customer-2', companyName: '', addressText: '', defaultPaymentTerms: '=NET30', updatedAt: '' }
    ], {
      contacts: [{ customerId: 'customer-1', name: '@Buyer', email: 'buyer@example.test', phone: '' }]
    });
    expect(customerCsv).toContain('"Acme, ""North"" 📦","1 Main St\nSuite 2","\'@Buyer"');
    expect(customerCsv).toContain('"","","","","","\'=NET30","undated"');

    const manualCsv = buildManualItemsCsv([
      { sku: '=SKU-1', name: 'Manual, Item', description: 'Line A\r\nLine "B" 📦', unitOfMeasure: '', dimensionsDisplay: '12x10x8', active: false, updatedAt: '2026-08-05' },
      { sku: '', name: '', description: '', uom: 'EA', dimensionsDisplay: '', active: true, updatedAt: '' }
    ]);
    expect(manualCsv).toContain('"\'=SKU-1","Manual, Item","Line A\r\nLine ""B"" 📦","","12x10x8","No","2026-08-05"');
    expect(manualCsv).toContain('"","","","EA","","Yes","undated"');
  });
});

describe('Version 2.5 individual quote exports', () => {
  it('exports a draft JSON snapshot without mutating it and preserves the full local quote contract', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(legacyQuote('JSON Export Company'));
    const before = structuredClone(draft);
    const json = buildIndividualQuoteJson(draft);
    const parsed = JSON.parse(json);

    expect(parsed).toMatchObject({
      format: 'gtm-calc-quote-export',
      schemaVersion: 1,
      quote: {
        id: draft.id,
        status: 'draft',
        baseNumber: null,
        content: { customer: { companyName: 'JSON Export Company' } }
      },
      version: null
    });
    expect(parsed.quote.content.lines[0]).toHaveProperty('unitCost');
    expect(draft).toEqual(before);
  });

  it('requires an explicit immutable version for finalized quotes and exports only selected version metadata', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(legacyQuote('Finalized Export Company'));
    const version = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    const finalized = await repository.getQuote(draft.id);

    expect(() => buildIndividualQuoteJson(finalized)).toThrow(/explicitly selected immutable version/i);
    const parsed = JSON.parse(buildIndividualQuoteJson(finalized, version));
    expect(parsed.quote.baseNumber).toBe('2026-001');
    expect(parsed.version).toMatchObject({ id: version.id, displayNumber: '2026-001', contentHash: version.contentHash });
    expect(Object.keys(parsed)).toEqual(['format', 'schemaVersion', 'exportedAt', 'quote', 'version']);
  });

  it('requires an immutable version for finalized customer PDFs and passes the selected display number', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(legacyQuote('Finalized PDF Company'));
    const version = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    const finalized = await repository.getQuote(draft.id);
    const env = downloadEnvironment();
    const pdfInputs = [];
    const service = createQuoteExportService({
      repository,
      documentRef: env.documentRef,
      urlApi: env.urlApi,
      schedule(callback) { callback(); },
      pdfService: {
        async buildCustomerQuotePdfBlob(input) {
          pdfInputs.push(input);
          return new Blob(['%PDF selected immutable version'], { type: 'application/pdf' });
        }
      }
    });

    await expect(service.exportCustomerPdf({ quote: finalized })).rejects.toThrow(/explicitly selected immutable version/i);
    const exported = await service.exportCustomerPdf({ quote: finalized, version, date: new Date('2026-08-05T12:00:00.000Z') });
    expect(exported.filename).toBe('2026-001-finalized-pdf-company-quotation.pdf');
    expect(pdfInputs).toHaveLength(1);
    expect(pdfInputs[0].quoteNumber).toBe('2026-001');
  });

  it('downloads CSV, JSON, and customer PDF locally with deterministic names and no network/storage side effects', async () => {
    const repository = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(legacyQuote('Service Export Customer'));
    const env = downloadEnvironment();
    const fetched = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { fetched.push(args); throw new Error('network must not be used'); };
    const pdfCalls = [];
    const service = createQuoteExportService({
      repository,
      now: () => new Date('2026-08-05T12:00:00.000Z'),
      documentRef: env.documentRef,
      urlApi: env.urlApi,
      schedule(callback) { callback(); },
      pdfService: {
        async buildCustomerQuotePdfBlob(quote) {
          pdfCalls.push(quote);
          return new Blob(['%PDF synthetic customer-safe'], { type: 'application/pdf' });
        }
      }
    });

    try {
      const csv = await service.exportManualItemsCsv({ items: [], date: new Date('2026-08-05T12:00:00.000Z') });
      const json = await service.exportQuoteJson({ quote: draft, date: new Date('2026-08-05T12:00:00.000Z') });
      const pdf = await service.exportCustomerPdf({ quote: draft, date: new Date('2026-08-05T12:00:00.000Z') });

      expect(csv.filename).toBe('gtm-calc-manual-items-2026-08-05.csv');
      expect(json.filename).toBe('gtm-calc-quote-2026-08-05-unnumbered.json');
      expect(pdf.filename).toBe('2026-07-16-service-export-customer-quotation.pdf');
      expect(env.clicked).toHaveLength(3);
      expect(env.revoked).toHaveLength(3);
      expect(pdfCalls).toHaveLength(1);
      const customerDocument = toCustomerQuoteDocument(pdfCalls[0]);
      expect(JSON.stringify(customerDocument).toLowerCase()).not.toMatch(/unitcost|landed|freight|gtm|margin|internal/);
      expect(fetched).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
