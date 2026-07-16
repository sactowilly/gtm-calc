import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { buildQuoteItem } from '../js/domain/calculations.js';
import { quoteContentToLegacyQuote } from '../js/domain/quote-library.js';
import { isUnreviewedDuplicate } from '../js/quote-library/quote-library-ui.js';
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

  it('rejects a stale draft revision token instead of overwriting another tab', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const firstEdit = structuredClone(draft.workingDraft.content);
    firstEdit.customer.companyName = 'First Tab Saved';
    const saved = await repository.saveDraftContent(draft.id, firstEdit, { expectedRevision: 0 });
    expect(saved.draftRevision).toBe(1);

    const staleEdit = structuredClone(draft.workingDraft.content);
    staleEdit.customer.companyName = 'Stale Second Tab';
    await expect(repository.saveDraftContent(draft.id, staleEdit, { expectedRevision: 0 })).rejects.toMatchObject({
      name: 'QuoteDraftConflictError'
    });
    expect((await repository.getQuote(draft.id)).workingDraft.content.customer.companyName).toBe('First Tab Saved');
  });

  it('rolls back customer changes when an atomic draft save has a stale token', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const first = await repository.saveDraftWithCustomer(draft.id, draft.workingDraft.content, { expectedRevision: 0 });
    const contactId = first.contactId;
    expect((await repository.getContact(contactId)).phone).toBe('916-555-0137');

    const stale = structuredClone(draft.workingDraft.content);
    stale.contact.phone = '916-555-0000';
    await expect(repository.saveDraftWithCustomer(draft.id, stale, { expectedRevision: 0 })).rejects.toMatchObject({
      name: 'QuoteDraftConflictError'
    });
    expect((await repository.getContact(contactId)).phone).toBe('916-555-0137');
  });

  it('creates, recalls, and updates customer contacts without duplicating an exact company', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const first = await repository.saveCustomerAndContact(draft.workingDraft.content);
    expect(await repository.searchCustomers({ query: 'north river' })).toEqual([
      expect.objectContaining({ id: first.customerId, companyName: 'North River Packaging' })
    ]);
    expect(await repository.listContacts(first.customerId)).toEqual([
      expect.objectContaining({ id: first.contactId, name: 'Jordan Rivera', email: 'jordan@example.test' })
    ]);

    const edited = structuredClone(draft.workingDraft.content);
    edited.contact.phone = '916-555-0199';
    const second = await repository.saveCustomerAndContact(edited, first);
    expect(second).toEqual(first);
    expect((await repository.getContact(first.contactId)).phone).toBe('916-555-0199');

    const newBuyer = structuredClone(edited);
    newBuyer.contact = { buyerName: 'Taylor Buyer', email: 'taylor@example.test', phone: '916-555-0144' };
    const third = await repository.saveCustomerAndContact(newBuyer, { customerId: first.customerId });
    expect(third.contactId).not.toBe(first.contactId);
    expect((await repository.listContacts(first.customerId)).map((contact) => [contact.id, contact.isPrimary])).toEqual([
      [third.contactId, true],
      [first.contactId, false]
    ]);
    expect(await repository.searchCustomers()).toHaveLength(1);
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
    expect(await repository.searchQuotes({ query: '2026-001-r1' })).toHaveLength(1);
    expect(await repository.searchQuotes({ query: '2026-07-16' })).toHaveLength(1);

    await repository.startRevision(draft.id, revision1.id);
    const revision2 = await repository.finalizeRevision(draft.id);
    expect(revision2.displayNumber).toBe('2026-001-R2');
    expect((await repository.listVersions(draft.id)).map((version) => version.displayNumber)).toEqual([
      '2026-001',
      '2026-001-R1',
      '2026-001-R2'
    ]);
  });

  it('enforces controlled status transitions and records the transition event', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const version = await repository.finalizeBase(draft.id, { numberYear: 2026 });

    await expect(repository.changeStatus(draft.id, 'accepted')).rejects.toThrow('cannot change from finalized to accepted');
    const sent = await repository.changeStatus(draft.id, 'sent');
    expect(sent.currentStatus).toBe('sent');
    const accepted = await repository.changeStatus(draft.id, 'accepted');
    expect(accepted.currentStatus).toBe('accepted');
    await expect(repository.changeStatus(draft.id, 'cancelled')).rejects.toThrow('cannot change from accepted to cancelled');

    expect(await repository.listEvents(draft.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quoteVersionId: version.id,
        type: 'status_changed',
        metadata: { fromStatus: 'finalized', toStatus: 'sent' }
      }),
      expect.objectContaining({
        quoteVersionId: version.id,
        type: 'status_changed',
        metadata: { fromStatus: 'sent', toStatus: 'accepted' }
      })
    ]));
  });

  it('starts revisions only from the latest finalized version and blocks terminal outcomes', async () => {
    const { repository } = makeRepository();
    const draft = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const base = await repository.finalizeBase(draft.id, { numberYear: 2026 });
    await repository.startRevision(draft.id, base.id);
    expect((await repository.getQuote(draft.id)).currentStatus).toBe('draft');
    const revision = await repository.finalizeRevision(draft.id);

    await expect(repository.startRevision(draft.id, base.id)).rejects.toThrow('latest finalized version');
    await repository.changeStatus(draft.id, 'sent');
    await repository.changeStatus(draft.id, 'declined');
    await expect(repository.startRevision(draft.id, revision.id)).rejects.toThrow('Outcome statuses are terminal');
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
    expect(isUnreviewedDuplicate(duplicate)).toBe(true);

    await expect(repository.saveDraftContent(duplicate.id, duplicate.workingDraft.content, {
      expectedRevision: 1
    })).rejects.toMatchObject({ name: 'QuoteDraftConflictError' });
    expect(isUnreviewedDuplicate(await repository.getQuote(duplicate.id))).toBe(true);

    const reviewed = await repository.saveDraftContent(duplicate.id, duplicate.workingDraft.content, {
      expectedRevision: 0
    });
    expect(isUnreviewedDuplicate(reviewed)).toBe(false);
    expect(reviewed.workingDraft.content.customer.companyName).toBe('North River Packaging');
    expect((await repository.listEvents(duplicate.id)).map((event) => event.type)).toEqual(['duplicated']);
  });

  it('can reset the quote date when duplicating for a new draft workflow', async () => {
    const { repository } = makeRepository();
    const source = await repository.createDraftFromLegacyQuote(makeLegacyQuote());
    const duplicate = await repository.duplicateAsNew(source.id, { quoteDate: '2026-08-01' });
    expect(duplicate.workingDraft.content.quoteDate).toBe('2026-08-01');
    expect(duplicate.workingDraft.content.expirationDate).toBe('');
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
