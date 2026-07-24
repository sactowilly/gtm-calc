import { expect, test } from '@playwright/test';

const makeLegacyQuote = (customerName) => ({
  customerName,
  buyerName: 'Multi-tab Buyer',
  buyerEmail: 'multitab@example.test',
  date: '2026-07-24',
  shipVia: 'Our Truck',
  fobPoint: 'Sacramento',
  terms: 'NET30',
  items: []
});

async function createDraft(page, customerName) {
  return page.evaluate(async (legacyQuote) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const draft = await repository.createDraftFromLegacyQuote(legacyQuote);
    await repository.close();
    return draft.id;
  }, makeLegacyQuote(customerName));
}

test('serializes numbering and rejects stale saves across real browser tabs', async ({ context }) => {
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();
  await Promise.all([firstPage.goto('./'), secondPage.goto('./')]);

  const [firstId, secondId] = await Promise.all([
    createDraft(firstPage, 'First Tab Numbering'),
    createDraft(secondPage, 'Second Tab Numbering')
  ]);

  const finalize = (page, quoteId) => page.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    try {
      return (await repository.finalizeBase(id, { numberYear: 2026 })).displayNumber;
    } finally {
      await repository.close();
    }
  }, quoteId);
  const displayNumbers = await Promise.all([
    finalize(firstPage, firstId),
    finalize(secondPage, secondId)
  ]);
  expect(displayNumbers.sort()).toEqual(['2026-001', '2026-002']);

  const draftId = await createDraft(firstPage, 'Shared Stale Draft');
  const staleSnapshot = await secondPage.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const draft = await repository.getQuote(id);
    await repository.close();
    return { content: draft.workingDraft.content, revision: draft.draftRevision };
  }, draftId);
  await firstPage.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const draft = await repository.getQuote(id);
    const content = structuredClone(draft.workingDraft.content);
    content.customer.companyName = 'Saved by First Tab';
    await repository.saveDraftContent(id, content, { expectedRevision: draft.draftRevision });
    await repository.close();
  }, draftId);
  const staleResult = await secondPage.evaluate(async ({ id, snapshot }) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const content = structuredClone(snapshot.content);
    content.customer.companyName = 'Stale Second Tab';
    try {
      await repository.saveDraftContent(id, content, { expectedRevision: snapshot.revision });
      return 'unexpected-save';
    } catch (error) {
      return error.name;
    } finally {
      await repository.close();
    }
  }, { id: draftId, snapshot: staleSnapshot });
  expect(staleResult).toBe('QuoteDraftConflictError');

  const state = await firstPage.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const [draft, settings] = await Promise.all([
      repository.getQuote(id),
      repository.getSettings()
    ]);
    await repository.close();
    return {
      customerName: draft.workingDraft.content.customer.companyName,
      lastBaseSequence: settings.numbering['2026'].lastBaseSequence
    };
  }, draftId);
  expect(state).toEqual({
    customerName: 'Saved by First Tab',
    lastBaseSequence: 2
  });
});
