import {
  legacyQuoteToQuoteContent,
  quoteContentToLegacyQuote
} from '../domain/quote-library.js';
import {
  QuoteDraftConflictError,
  createQuoteLibraryRepository
} from '../services/indexeddb-quote-repository.js';

export const QUOTE_LIBRARY_SESSION_KEY = 'gtm_quote_library_active_v1';
export const QUOTE_LIBRARY_SIGNAL_KEY = 'gtm_quote_library_signal_v1';
export const QUOTE_LIBRARY_PAGE_SIZE = 10;

export function isUnreviewedDuplicate(quote) {
  return Boolean(
    quote?.currentStatus === 'draft' &&
    quote.sourceQuoteId &&
    quote.draftRevision === 0
  );
}

function formatSavedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved on this device';
  return `Saved ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function makeButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

export function initializeQuoteLibraryUi({
  repository = createQuoteLibraryRepository(),
  session = window.sessionStorage,
  storage = window.localStorage,
  getActiveQuote,
  replaceActiveQuote,
  applyCustomerDetails,
  saveActiveFallback,
  shouldConfirmReplace = () => false
}) {
  const tools = document.getElementById('quoteLibraryTools');
  const summary = document.getElementById('quoteLibrarySummary');
  const status = document.getElementById('quoteLibraryStatus');
  const saveButton = document.getElementById('addCurrentToLibrary');
  const quoteSearch = document.getElementById('quoteLibrarySearch');
  const quoteResults = document.getElementById('quoteLibraryResults');
  const showMoreQuotes = document.getElementById('showMoreQuotes');
  const customerSearch = document.getElementById('customerLibrarySearch');
  const customerResults = document.getElementById('customerLibraryResults');
  const recovery = document.getElementById('quoteLibraryRecovery');

  let boundQuoteId;
  let boundRevision;
  let dirty = false;
  let externalChange = false;
  let channel;
  let matchingQuotes = [];
  let visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;

  function setLibraryStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function readSessionQuoteId() {
    try {
      return session.getItem(QUOTE_LIBRARY_SESSION_KEY) || undefined;
    } catch (error) {
      return undefined;
    }
  }

  function writeSessionQuoteId(quoteId) {
    try {
      if (quoteId) session.setItem(QUOTE_LIBRARY_SESSION_KEY, quoteId);
      else session.removeItem(QUOTE_LIBRARY_SESSION_KEY);
    } catch (error) {
      // The library remains usable for the current page even if sessionStorage is blocked.
    }
  }

  function updateBoundUi() {
    saveButton.textContent = boundQuoteId ? 'Save Draft to Library' : 'Add Current Quote to Library';
    saveButton.dataset.boundQuoteId = boundQuoteId || '';
    updateQuoteSummary();
  }

  function updateQuoteSummary() {
    const total = matchingQuotes.length;
    if (!total) {
      summary.textContent = quoteSearch.value.trim() ? '0 matching drafts' : '0 drafts on this device';
      return;
    }
    const parts = [
      `${total} draft${total === 1 ? '' : 's'}`,
      `${Math.min(total, visibleQuoteLimit)} shown`
    ];
    if (boundQuoteId) parts.push('one open');
    if (boundQuoteId && dirty) parts.push('unsaved');
    summary.textContent = parts.join(' · ');
  }

  function bindQuote(quote) {
    boundQuoteId = quote.id;
    boundRevision = Number.isInteger(quote.draftRevision) ? quote.draftRevision : 0;
    dirty = false;
    externalChange = false;
    writeSessionQuoteId(boundQuoteId);
    updateBoundUi();
  }

  function unbindCurrent() {
    boundQuoteId = undefined;
    boundRevision = undefined;
    dirty = false;
    externalChange = false;
    writeSessionQuoteId();
    updateBoundUi();
    refreshQuotes();
  }

  function notifyOtherTabs(quoteId) {
    const signal = { quoteId, changedAt: Date.now() };
    try {
      channel?.postMessage(signal);
      storage.setItem(QUOTE_LIBRARY_SIGNAL_KEY, JSON.stringify(signal));
    } catch (error) {
      // Conflict tokens still protect saves when tab-notification APIs are unavailable.
    }
  }

  function handleExternalSignal(signal) {
    if (!signal?.quoteId || signal.quoteId !== boundQuoteId) return;
    externalChange = true;
    setLibraryStatus('This draft changed in another tab. Reopen it before saving here.', true);
  }

  function renderQuoteResults(quotes) {
    matchingQuotes = quotes;
    quoteResults.replaceChildren();
    updateQuoteSummary();
    if (!quotes.length) {
      showMoreQuotes.hidden = true;
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = 'No saved drafts match this search.';
      quoteResults.appendChild(empty);
      updateBoundUi();
      return;
    }

    quotes.slice(0, visibleQuoteLimit).forEach((quote) => {
      const content = quote.workingDraft?.content;
      if (!content) return;
      const card = document.createElement('article');
      card.className = 'library-card';
      card.dataset.quoteId = quote.id;
      if (quote.id === boundQuoteId) card.classList.add('is-active');
      const unreviewedDuplicate = isUnreviewedDuplicate(quote);
      if (unreviewedDuplicate) card.classList.add('is-unreviewed-duplicate');

      const headingRow = document.createElement('div');
      headingRow.className = 'library-card__heading';
      const heading = document.createElement('h3');
      heading.textContent = content.customer.companyName || 'Untitled draft';
      headingRow.appendChild(heading);
      if (unreviewedDuplicate) {
        const badge = document.createElement('span');
        badge.className = 'library-card__duplicate-badge';
        badge.textContent = 'DUP';
        badge.setAttribute('aria-label', 'Duplicate draft needs review');
        headingRow.appendChild(badge);
      }
      const meta = document.createElement('p');
      meta.textContent = [
        content.contact.buyerName,
        content.quoteDate,
        `${content.lines.length} item${content.lines.length === 1 ? '' : 's'}`
      ].filter(Boolean).join(' · ');
      const saved = document.createElement('p');
      saved.className = 'library-card__saved';
      saved.textContent = formatSavedTime(quote.updatedAt);
      const actions = document.createElement('div');
      actions.className = 'library-card__actions';
      actions.append(
        makeButton(quote.id === boundQuoteId ? 'Reopen' : 'Open', 'button secondary', () => openDraft(quote.id)),
        makeButton('Duplicate', 'button secondary', () => duplicateDraft(quote.id))
      );
      card.append(headingRow, meta, saved, actions);
      quoteResults.appendChild(card);
    });
    const remaining = quotes.length - Math.min(quotes.length, visibleQuoteLimit);
    showMoreQuotes.hidden = remaining <= 0;
    if (remaining > 0) {
      const nextCount = Math.min(QUOTE_LIBRARY_PAGE_SIZE, remaining);
      showMoreQuotes.textContent = `Show ${nextCount} more`;
      showMoreQuotes.setAttribute('aria-label', `Show ${nextCount} more saved drafts`);
    }
    updateBoundUi();
  }

  async function refreshQuotes() {
    try {
      const quotes = await repository.searchQuotes({
        query: quoteSearch.value,
        status: 'draft',
        limit: 100
      });
      renderQuoteResults(quotes);
      const recoveryRecords = await repository.getRecoveryRecords();
      recovery.hidden = recoveryRecords.length === 0;
      recovery.textContent = recoveryRecords.length
        ? `${recoveryRecords.length} damaged record${recoveryRecords.length === 1 ? '' : 's'} preserved for recovery.`
        : '';
    } catch (error) {
      showMoreQuotes.hidden = true;
      setLibraryStatus('The quote library is unavailable. The current quote can still be saved in this browser.', true);
    }
  }

  function renderCustomerResults(customers) {
    customerResults.replaceChildren();
    if (!customers.length) {
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = 'No saved customers match this search.';
      customerResults.appendChild(empty);
      return;
    }
    customers.forEach((customer) => {
      const row = document.createElement('article');
      row.className = 'customer-card';
      const details = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = customer.companyName;
      const address = document.createElement('p');
      address.textContent = customer.addressText || 'No address saved';
      details.append(heading, address);
      row.append(details, makeButton('Use Customer', 'button secondary', () => useCustomer(customer.id)));
      customerResults.appendChild(row);
    });
  }

  async function refreshCustomers() {
    try {
      renderCustomerResults(await repository.searchCustomers({ query: customerSearch.value, limit: 30 }));
    } catch (error) {
      renderCustomerResults([]);
    }
  }

  async function saveCustomerSnapshot(legacyQuote, quoteRecord) {
    return repository.saveCustomerAndContact(legacyQuoteToQuoteContent(legacyQuote), {
      customerId: quoteRecord?.customerId,
      contactId: quoteRecord?.contactId
    });
  }

  async function addCurrentToLibrary() {
    if (boundQuoteId) {
      const result = await saveBoundCurrent(getActiveQuote());
      if (result.status === 'saved') {
        const fallback = saveActiveFallback();
        setLibraryStatus(
          fallback.status === 'saved'
            ? 'Draft saved to the quote library and browser fallback.'
            : 'Draft saved to the quote library, but the original browser fallback could not be updated.',
          fallback.status !== 'saved'
        );
      }
      return result;
    }
    try {
      const legacyQuote = getActiveQuote();
      const links = await saveCustomerSnapshot(legacyQuote);
      const draft = await repository.createDraftFromLegacyQuote(legacyQuote, links);
      bindQuote(draft);
      visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;
      const fallback = saveActiveFallback();
      await Promise.all([refreshQuotes(), refreshCustomers()]);
      setLibraryStatus(
        fallback.status === 'saved'
          ? 'Current quote added as an unnumbered draft. It remains saved in the original browser copy too.'
          : 'Draft added to the library, but the original browser fallback could not be updated.',
        fallback.status !== 'saved'
      );
      notifyOtherTabs(draft.id);
      return { status: 'saved', quote: draft };
    } catch (error) {
      setLibraryStatus('The current quote could not be added to the library. Its original browser copy was not removed.', true);
      return { status: 'unavailable', error };
    }
  }

  async function saveBoundCurrent(legacyQuote) {
    if (!boundQuoteId) return { status: 'not-bound' };
    if (externalChange) {
      setLibraryStatus('Reopen this draft before saving because another tab changed it.', true);
      return { status: 'conflict' };
    }
    try {
      const saved = await repository.saveDraftWithCustomer(
        boundQuoteId,
        legacyQuoteToQuoteContent(legacyQuote),
        { expectedRevision: boundRevision }
      );
      bindQuote(saved);
      await Promise.all([refreshQuotes(), refreshCustomers()]);
      notifyOtherTabs(saved.id);
      setLibraryStatus('Draft saved to the quote library.', false);
      return { status: 'saved', quote: saved };
    } catch (error) {
      if (error instanceof QuoteDraftConflictError || error?.name === 'QuoteDraftConflictError') {
        externalChange = true;
        setLibraryStatus(error.message, true);
        return { status: 'conflict', error };
      }
      setLibraryStatus('The library draft could not be saved. The original browser save is still available.', true);
      return { status: 'unavailable', error };
    }
  }

  async function openDraft(quoteId, { restoringSession = false } = {}) {
    if (!restoringSession && quoteId !== boundQuoteId && shouldConfirmReplace()) {
      const confirmed = window.confirm('Open this saved draft? It will replace the active quote on this tab. Save or add the current quote to the library first if you need to keep it.');
      if (!confirmed) return;
    }
    try {
      const draft = await repository.getQuote(quoteId);
      if (!draft?.workingDraft) {
        setLibraryStatus('That draft is no longer available for editing.', true);
        await refreshQuotes();
        return;
      }
      replaceActiveQuote(quoteContentToLegacyQuote(draft.workingDraft.content));
      bindQuote(draft);
      const fallback = saveActiveFallback();
      setLibraryStatus(
        fallback.status === 'saved'
          ? `Opened ${draft.workingDraft.content.customer.companyName || 'untitled draft'}.`
          : 'Draft opened, but the original browser fallback could not be updated.',
        fallback.status !== 'saved'
      );
      await refreshQuotes();
    } catch (error) {
      setLibraryStatus('The selected draft could not be opened. The active quote was kept.', true);
    }
  }

  async function duplicateDraft(quoteId) {
    try {
      const duplicate = await repository.duplicateAsNew(quoteId, {
        quoteDate: new Date().toISOString().slice(0, 10)
      });
      visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;
      await refreshQuotes();
      setLibraryStatus(`Created an unnumbered duplicate of ${duplicate.workingDraft.content.customer.companyName || 'the draft'}. The highlighted DUP draft is ready to open.`);
      notifyOtherTabs(duplicate.id);
    } catch (error) {
      setLibraryStatus('The draft could not be duplicated.', true);
    }
  }

  async function useCustomer(customerId) {
    try {
      const [customer, contacts] = await Promise.all([
        repository.getCustomer(customerId),
        repository.listContacts(customerId)
      ]);
      if (!customer) throw new Error('Missing customer');
      const contact = contacts[0];
      const current = getActiveQuote();
      applyCustomerDetails({
        customerName: customer.companyName,
        customerAddress: customer.addressText || '',
        buyerName: contact?.name || '',
        buyerEmail: contact?.email || '',
        buyerPhone: contact?.phone || '',
        terms: customer.defaultPaymentTerms || current.terms
      });
      dirty = true;
      updateBoundUi();
      setLibraryStatus(`Loaded ${customer.companyName}. Save the quote to keep these changes.`);
      tools.open = false;
    } catch (error) {
      setLibraryStatus('That customer record could not be loaded.', true);
    }
  }

  function markDirty() {
    dirty = true;
    updateBoundUi();
  }

  async function initialize() {
    try {
      await repository.initialize();
      if (typeof BroadcastChannel === 'function') {
        channel = new BroadcastChannel('gtm_quote_library_changes_v1');
        channel.addEventListener('message', (event) => handleExternalSignal(event.data));
      }
      window.addEventListener('storage', (event) => {
        if (event.key !== QUOTE_LIBRARY_SIGNAL_KEY || !event.newValue) return;
        try {
          handleExternalSignal(JSON.parse(event.newValue));
        } catch (error) {
          // Ignore invalid non-customer signaling data.
        }
      });
      const sessionQuoteId = readSessionQuoteId();
      if (sessionQuoteId) await openDraft(sessionQuoteId, { restoringSession: true });
      await Promise.all([refreshQuotes(), refreshCustomers()]);
    } catch (error) {
      setLibraryStatus('The quote library is unavailable. Continue using Save for the original browser copy.', true);
      saveButton.disabled = true;
      summary.textContent = 'Library unavailable';
    }
  }

  saveButton.addEventListener('click', addCurrentToLibrary);
  quoteSearch.addEventListener('input', () => {
    visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;
    refreshQuotes();
  });
  showMoreQuotes.addEventListener('click', () => {
    visibleQuoteLimit += QUOTE_LIBRARY_PAGE_SIZE;
    renderQuoteResults(matchingQuotes);
  });
  customerSearch.addEventListener('input', refreshCustomers);
  window.addEventListener('beforeunload', (event) => {
    if (!boundQuoteId || !dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  return {
    initialize,
    markDirty,
    unbindCurrent,
    hasBoundDraft: () => Boolean(boundQuoteId),
    saveBoundCurrent,
    refreshQuotes,
    refreshCustomers
  };
}
