import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { buildQuoteItem } from '../js/domain/calculations.js';
import { quoteContentToLegacyQuote } from '../js/domain/quote-library.js';
import {
  QUOTE_LIBRARY_DATABASE_VERSION,
  QUOTE_LIBRARY_STORES,
  createQuoteLibraryRepository
} from '../js/services/indexeddb-quote-repository.js';

const repositories = [];
let databaseSequence = 0;

function makeLegacyQuote(companyName = 'North River Packaging') {
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

function makeRepository(overrides = {}) {
  const databaseName = overrides.databaseName || `gtm-quote-test-${++databaseSequence}`;
  let idSequence = 0;
  let timeSequence = 0;
  const repository = createQuoteLibraryRepository({
    databaseName,
    idFactory: overrides.idFactory || (() => `${databaseName}-id-${++idSequence}`),
    now: overrides.now || (() => `2026-07-16T12:00:${String(timeSequence++).padStart(2, '0')}.000Z`)
  });
  repositories.push(repository);
  return { repository, databaseName };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()));
});

describe('IndexedDB quote library repository', () => {
  it('creates the versioned schema and stable per-device settings', async () => {
    const { repository, databaseName } = makeRepository();
    const settings = await repository.initialize();
    const reloaded = await repository.getSettings();
    expect(reloaded).toEqual(settings);
    expect(settings).toMatchObject({ id: 'application', schemaVersion: 1, numbering: {} });

    const database = await openDB(databaseName, QUOTE_LIBRARY_DATABASE_VERSION);
    expect([...database.objectStoreNames]).toEqual(expect.arrayContaining(Object.values(QUOTE_LIBRARY_STORES)));
    database.close();
  });

  it('imports the current active quote shape into an unnumbered searchable draft', async () => {
    const { repository } = makeRepository();
    const legacy = makeLegacyQuote();
    const draft = await repository.createDraftFromLegacyQuote(legacy);
    expect(draft).toMatchObject({ currentStatus: 'draft', versionIds: [] });
    expect(draft).not.toHaveProperty('baseNumber');
    expect(quoteContentToLegacyQuote(draft.workingDraft.content)).toEqual(legacy);

    expect(await repository.searchQuotes({ query: 'north river' })).toHaveLength(1);
    expect(await repository.searchQuotes({ query: 'jordan@example' })).toHaveLength(1);
    expect(await repository.searchQuotes({ status: 'finalized' })).toEqual([]);
  });

  it('saves only working-draft content and refuses to edit a finalized quote', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const edited = structuredClone(draft.workingDraft.content);
    edited.customer.companyName = 'Edited Company';
    await repository.saveDraftContent(draft.id, edited);
    expect((await repository.getQuote(draft.id)).workingDraft.content.customer.companyName).toBe('Edited Company');

    await repository.finalizeBase(draft.id, { numberYear: 2026 });
    await expect(repository.saveDraftContent(draft.id, edited)).rejects.toThrow('Start a revision before editing');
  });

  it('allocates base numbers atomically and does not consume a number on validation failure', async () => {
    const { repository } = makeRepository();
    const first = await repository.createDraftFromLegacyQuote(makeLegacyQuote('First Company'));
    const second = await repository.createDraftFromLegacyQuote(makeLegacyQuote('Second Company'));

    await expect(repository.finalizeBase(first.id, { numberYear: 26 })).rejects.toThrow('four-digit business year');
    const [firstVersion, secondVersion] = await Promise.all([
      repository.finalizeBase(first.id, { numberYear: 2026 }),
      repository.finalizeBase(second.id, { numberYear: 2026 })
    ]);
    expect([firstVersion.displayNumber, secondVersion.displayNumber].sort()).toEqual(['2026-001', '2026-002']);
    expect((await repository.getSettings()).numbering['2026'].lastBaseSequence).toBe(2);
  });

  it('keeps finalized versions immutable and creates sequential revisions', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const base = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    const returnedCopy = await repository.getVersion(base.id);
    returnedCopy.content.customer.companyName = 'Attempted Mutation';
    expect((await repository.getVersion(base.id)).content.customer.companyName).toBe('North River Packaging');

    await repository.startRevision(draft.id, base.id);
    const revisionDraft = await repository.getQuote(draft.id);
    const revisedContent = structuredClone(revisionDraft.workingDraft.content);
    revisedContent.lines[0].price = 1.5;
    revisedContent.lines[0].orderTotal = 150;
    await repository.saveDraftContent(draft.id, revisedContent);
    const revision1 = await repository.finalizeRevision(draft.id);
    expect(revision1.displayNumber).toBe('2026-001-R1');
    expect((await repository.getVersion(base.id)).content.lines[0].price).toBe(1.25);

    await repository.startRevision(draft.id, revision1.id);
    const revision2 = await repository.finalizeRevision(draft.id);
    expect(revision2.displayNumber).toBe('2026-001-R2');
    expect((await repository.listVersions(draft.id)).map((version) => version.displayNumber)).toEqual([
      '2026-001',
      '2026-001-R1',
      '2026-001-R2'
    ]);
  });

  it('duplicates a finalized version as a new independent unnumbered draft with lineage', async () => {
    const { repository } = makeRepository();
    const source = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const version = await repository.finalizeBase(source.id, { numberYear: 2026 });
    const duplicate = await repository.duplicateAsNew(source.id, { versionId: version.id });

    expect(duplicate).toMatchObject({
      currentStatus: 'draft',
      versionIds: [],
      sourceQuoteId: source.id,
      sourceQuoteVersionId: version.id
    });
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.baseNumber).toBeUndefined();
    expect(duplicate.workingDraft.content).toEqual(version.content);
    expect((await repository.listEvents(duplicate.id)).map((event) => event.type)).toEqual(['duplicated']);
  });

  it('quarantines malformed quote records without hiding healthy records', async () => {
    const { repository, databaseName } = makeRepository();
    const healthy = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    await repository.close();
    const database = await openDB(databaseName, QUOTE_LIBRARY_DATABASE_VERSION);
    await database.put(QUOTE_LIBRARY_STORES.quotes, { id: 'broken', schemaVersion: 99 });
    database.close();

    expect(await repository.getQuote('broken')).toBeUndefined();
    expect(await repository.getQuote(healthy.id)).toBeTruthy();
    expect(await repository.getRecoveryRecords()).toEqual([
      expect.objectContaining({ storeName: 'quotes', originalKey: 'broken', rawRecord: { id: 'broken', schemaVersion: 99 } })
    ]);
  });

  it('detects a modified finalized snapshot by its content hash', async () => {
    const { repository, databaseName } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const version = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    await repository.close();
    const database = await openDB(databaseName, QUOTE_LIBRARY_DATABASE_VERSION);
    const tampered = await database.get(QUOTE_LIBRARY_STORES.quoteVersions, version.id);
    tampered.content.customer.companyName = 'Tampered';
    await database.put(QUOTE_LIBRARY_STORES.quoteVersions, tampered);
    database.close();

    expect(await repository.getVersion(version.id)).toBeUndefined();
    expect(await repository.getRecoveryRecords()).toEqual([
      expect.objectContaining({ storeName: 'quoteVersions', originalKey: version.id })
    ]);
  });
});
