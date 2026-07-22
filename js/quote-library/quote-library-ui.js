import {
  getAllowedQuoteStatusTransitions,
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

const STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  finalized: 'Finalized',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled'
});

export function isUnreviewedDuplicate(quote) {
  return Boolean(quote?.currentStatus === 'draft' && quote.sourceQuoteId && quote.draftRevision === 0);
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

function quoteLabel(quote) {
  return quote.displayNumber || quote.baseNumber || 'Unnumbered';
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
  const statusFilter = document.getElementById('quoteLibraryStatusFilter');
  const quoteResults = document.getElementById('quoteLibraryResults');
  const showMoreQuotes = document.getElementById('showMoreQuotes');
  const customerSearch = document.getElementById('customerLibrarySearch');
  const customerResults = document.getElementById('customerLibraryResults');
  const recovery = document.getElementById('quoteLibraryRecovery');

  let boundQuoteId;
  let boundRevision;
  let boundVersionId;
  let dirty = false;
  let externalChange = false;
  let channel;
  let matchingQuotes = [];
  let visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;

  function setLibraryStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function readSessionSelection() {
    try {
      const raw = session.getItem(QUOTE_LIBRARY_SESSION_KEY);
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.quoteId) return parsed;
      } catch (error) {
        // Previous builds stored only the draft quote ID.
      }
      return { quoteId: raw };
    } catch (error) {
      return undefined;
    }
  }

  function writeSessionSelection(selection) {
    try {
      if (selection?.quoteId) session.setItem(QUOTE_LIBRARY_SESSION_KEY, JSON.stringify(selection));
      else session.removeItem(QUOTE_LIBRARY_SESSION_KEY);
    } catch (error) {
      // The library remains usable for the current page if sessionStorage is blocked.
    }
  }

  function updateQuoteSummary() {
    const total = matchingQuotes.length;
    const selectedStatus = statusFilter.value;
    const noun = selectedStatus === 'draft' ? 'draft' : 'quote';
    if (!total) {
      summary.textContent = quoteSearch.value.trim()
        ? `0 matching ${noun}s`
        : `0 ${noun}s on this device`;
      return;
    }
    const parts = [
      `${total} ${noun}${total === 1 ? '' : 's'}`,
      `${Math.min(total, visibleQuoteLimit)} shown`
    ];
    if (boundQuoteId) parts.push('one open');
    if (boundQuoteId && !boundVersionId && dirty) parts.push('unsaved');
    summary.textContent = parts.join(' · ');
  }

  function updateBoundUi() {
    if (boundVersionId) {
      saveButton.textContent = 'Finalized Quote Is Read Only';
      saveButton.disabled = true;
    } else {
      saveButton.textContent = boundQuoteId ? 'Save Draft to Library' : 'Add Current Quote to Library';
      saveButton.disabled = false;
    }
    saveButton.dataset.boundQuoteId = boundQuoteId || '';
    saveButton.dataset.boundVersionId = boundVersionId || '';
    updateQuoteSummary();
  }

  function bindDraft(quote) {
    boundQuoteId = quote.id;
    boundVersionId = undefined;
    boundRevision = Number.isInteger(quote.draftRevision) ? quote.draftRevision : 0;
    dirty = false;
    externalChange = false;
    writeSessionSelection({ quoteId: boundQuoteId });
    updateBoundUi();
  }

  function bindVersion(quote, version) {
    boundQuoteId = quote.id;
    boundVersionId = version.id;
    boundRevision = undefined;
    dirty = false;
    externalChange = false;
    writeSessionSelection({ quoteId: quote.id, versionId: version.id });
    updateBoundUi();
  }

  function unbindCurrent() {
    boundQuoteId = undefined;
    boundRevision = undefined;
    boundVersionId = undefined;
    dirty = false;
    externalChange = false;
    writeSessionSelection();
    updateBoundUi();
    refreshQuotes();
  }

  function notifyOtherTabs(quoteId) {
    const signal = { quoteId, changedAt: Date.now() };
    try {
      channel?.postMessage(signal);
      storage.setItem(QUOTE_LIBRARY_SIGNAL_KEY, JSON.stringify(signal));
    } catch (error) {
      // Conflict tokens still protect draft saves when signaling APIs are unavailable.
    }
  }

  function handleExternalSignal(signal) {
    if (!signal?.quoteId || signal.quoteId !== boundQuoteId || boundVersionId) return;
    externalChange = true;
    setLibraryStatus('This draft changed in another tab. Reopen it before saving here.', true);
  }

  function showActiveQuote() {
    tools.open = false;
    const activeQuote = document.querySelector('.quote-panel');
    activeQuote?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function createStatusControl(quote) {
    const transitions = getAllowedQuoteStatusTransitions(quote.currentStatus);
    if (!transitions.length) return undefined;
    const wrap = document.createElement('div');
    wrap.className = 'library-card__status-control';
    const label = document.createElement('label');
    label.textContent = 'Next status';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Next status for ${quoteLabel(quote)}`);
    transitions.forEach((nextStatus) => {
      const option = document.createElement('option');
      option.value = nextStatus;
      option.textContent = STATUS_LABELS[nextStatus];
      select.append(option);
    });
    label.append(select);
    const updateButton = makeButton('Update Status', 'button secondary', () => changeQuoteStatus(quote.id, select.value));
    wrap.append(label, updateButton);
    return wrap;
  }

  function renderQuoteResults(quotes) {
    matchingQuotes = quotes;
    quoteResults.replaceChildren();
    updateQuoteSummary();
    if (!quotes.length) {
      showMoreQuotes.hidden = true;
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = 'No saved quotes match this search and status filter.';
      quoteResults.appendChild(empty);
      updateBoundUi();
      return;
    }

    quotes.slice(0, visibleQuoteLimit).forEach((quote) => {
      const content = quote.libraryContent;
      if (!content) return;
      const card = document.createElement('article');
      card.className = 'library-card';
      card.dataset.quoteId = quote.id;
      card.dataset.quoteStatus = quote.currentStatus;
      if (quote.id === boundQuoteId) card.classList.add('is-active');
      const unreviewedDuplicate = isUnreviewedDuplicate(quote);
      if (unreviewedDuplicate) card.classList.add('is-unreviewed-duplicate');

      const headingRow = document.createElement('div');
      headingRow.className = 'library-card__heading';
      const heading = document.createElement('h3');
      heading.textContent = content.customer.companyName || (quote.currentStatus === 'draft' ? 'Untitled draft' : 'Untitled quote');
      headingRow.appendChild(heading);
      if (unreviewedDuplicate) {
        const duplicateBadge = document.createElement('span');
        duplicateBadge.className = 'library-card__duplicate-badge';
        duplicateBadge.textContent = 'DUP';
        duplicateBadge.setAttribute('aria-label', 'Duplicate draft needs review');
        headingRow.appendChild(duplicateBadge);
      }
      const statusBadge = document.createElement('span');
      statusBadge.className = `library-card__status-badge is-${quote.currentStatus}`;
      statusBadge.textContent = STATUS_LABELS[quote.currentStatus];
      headingRow.appendChild(statusBadge);

      const number = document.createElement('p');
      number.className = 'library-card__number';
      number.textContent = quoteLabel(quote);
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

      if (quote.currentStatus === 'draft') {
        actions.append(
          makeButton(quote.id === boundQuoteId && !boundVersionId ? 'Reopen' : 'Open', 'button secondary', () => openDraft(quote.id)),
          makeButton('Duplicate', 'button secondary', () => duplicateQuote(quote.id)),
          makeButton('Finalize', 'button primary', () => finalizeDraft(quote.id))
        );
      } else {
        actions.append(
          makeButton('View', 'button secondary', () => openFinalized(quote.id, quote.latestVersionId)),
          makeButton('Duplicate', 'button secondary', () => duplicateQuote(quote.id, quote.latestVersionId))
        );
        if (['finalized', 'sent'].includes(quote.currentStatus)) {
          actions.append(makeButton('Create Revision', 'button primary', () => createRevision(quote.id, quote.latestVersionId)));
        }
      }

      card.append(headingRow, number, meta, saved, actions);
      if (quote.libraryVersions?.length > 1) {
        const history = document.createElement('details');
        history.className = 'library-card__history';
        const historySummary = document.createElement('summary');
        historySummary.textContent = `Version history (${quote.libraryVersions.length})`;
        const versionList = document.createElement('div');
        versionList.className = 'library-card__version-list';
        quote.libraryVersions.forEach((version) => {
          versionList.append(makeButton(
            `View ${version.displayNumber}`,
            'button secondary',
            () => openFinalized(quote.id, version.id)
          ));
        });
        history.append(historySummary, versionList);
        card.append(history);
      }
      const statusControl = createStatusControl(quote);
      if (statusControl) card.append(statusControl);
      quoteResults.appendChild(card);
    });

    const remaining = quotes.length - Math.min(quotes.length, visibleQuoteLimit);
    showMoreQuotes.hidden = remaining <= 0;
    if (remaining > 0) {
      const nextCount = Math.min(QUOTE_LIBRARY_PAGE_SIZE, remaining);
      showMoreQuotes.textContent = `Show ${nextCount} more`;
      showMoreQuotes.setAttribute('aria-label', `Show ${nextCount} more saved quotes`);
    }
    updateBoundUi();
  }

  async function hydrateQuote(quote) {
    if (quote.workingDraft) {
      return { ...quote, libraryContent: quote.workingDraft.content };
    }
    const versions = await repository.listVersions(quote.id);
    const version = versions.find((candidate) => candidate.id === quote.latestVersionId);
    return version
      ? { ...quote, displayNumber: version.displayNumber, libraryContent: version.content, libraryVersions: versions }
      : { ...quote, libraryContent: undefined };
  }

  async function refreshQuotes() {
    try {
      const records = await repository.searchQuotes({
        query: quoteSearch.value,
        status: statusFilter.value || undefined,
        limit: 100
      });
      renderQuoteResults(await Promise.all(records.map(hydrateQuote)));
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
    if (boundVersionId) return { status: 'read-only' };
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
      bindDraft(draft);
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
    if (!boundQuoteId || boundVersionId) return { status: boundVersionId ? 'read-only' : 'not-bound' };
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
      bindDraft(saved);
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
    if (!restoringSession && (quoteId !== boundQuoteId || boundVersionId) && shouldConfirmReplace()) {
      const confirmed = window.confirm('Open this saved draft? It will replace the active quote on this tab. Save the current draft first if you need to keep changes.');
      if (!confirmed) return;
    }
    try {
      const draft = await repository.getQuote(quoteId);
      if (!draft?.workingDraft) {
        setLibraryStatus('That draft is no longer available for editing.', true);
        await refreshQuotes();
        return;
      }
      replaceActiveQuote(quoteContentToLegacyQuote(draft.workingDraft.content), {
        readOnly: false,
        label: draft.workingDraft.kind === 'revision' ? `Revision draft for ${draft.baseNumber}` : 'Loaded draft'
      });
      bindDraft(draft);
      if (!restoringSession) showActiveQuote();
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

  async function openFinalized(quoteId, versionId, { restoringSession = false } = {}) {
    if (!restoringSession && (quoteId !== boundQuoteId || versionId !== boundVersionId) && shouldConfirmReplace()) {
      const confirmed = window.confirm('View this finalized quote? It will replace the active form on this tab. Save the current draft first if you need to keep changes.');
      if (!confirmed) return;
    }
    try {
      const [quoteRecord, version] = await Promise.all([
        repository.getQuote(quoteId),
        repository.getVersion(versionId)
      ]);
      if (!quoteRecord || !version || version.quoteId !== quoteId) throw new Error('Missing finalized version');
      replaceActiveQuote({
        ...quoteContentToLegacyQuote(version.content),
        quoteNumber: version.displayNumber
      }, {
        readOnly: true,
        label: version.id === quoteRecord.latestVersionId
          ? `${STATUS_LABELS[quoteRecord.currentStatus]} ${version.displayNumber}`
          : `Historical ${version.displayNumber}`
      });
      bindVersion(quoteRecord, version);
      if (!restoringSession) showActiveQuote();
      setLibraryStatus(`Viewing immutable quote ${version.displayNumber}. PDF, copy, and email actions remain available.`);
      await refreshQuotes();
    } catch (error) {
      setLibraryStatus('The finalized quote version could not be opened. The active quote was kept.', true);
    }
  }

  async function finalizeDraft(quoteId) {
    const quoteRecord = await repository.getQuote(quoteId);
    if (!quoteRecord?.workingDraft) {
      setLibraryStatus('That draft is no longer available to finalize.', true);
      await refreshQuotes();
      return;
    }
    const finalizingActiveDraft = quoteId === boundQuoteId && !boundVersionId;
    if (finalizingActiveDraft) {
      const saved = await saveBoundCurrent(getActiveQuote());
      if (saved.status !== 'saved') return;
    }
    const kind = quoteRecord.workingDraft.kind;
    const message = kind === 'revision'
      ? `Finalize the next revision of ${quoteRecord.baseNumber}? The saved version cannot be edited afterward.`
      : 'Finalize this quote and assign the next number for this device? The finalized version cannot be edited afterward.';
    if (!window.confirm(message)) return;
    try {
      const version = kind === 'revision'
        ? await repository.finalizeRevision(quoteId)
        : await repository.finalizeBase(quoteId, { numberYear: new Date().getFullYear() });
      const finalizedQuote = await repository.getQuote(quoteId);
      if (finalizingActiveDraft) {
        replaceActiveQuote({
          ...quoteContentToLegacyQuote(version.content),
          quoteNumber: version.displayNumber
        }, { readOnly: true, label: `Finalized ${version.displayNumber}` });
        bindVersion(finalizedQuote, version);
      }
      await refreshQuotes();
      notifyOtherTabs(quoteId);
      setLibraryStatus(
        finalizingActiveDraft
          ? `Finalized as ${version.displayNumber}. This version is now read only.`
          : `Finalized as ${version.displayNumber}. The active quote was kept; choose View to open the finalized version.`
      );
    } catch (error) {
      setLibraryStatus(`The quote could not be finalized: ${error.message}`, true);
    }
  }

  async function duplicateQuote(quoteId, versionId) {
    try {
      const duplicate = await repository.duplicateAsNew(quoteId, {
        versionId,
        quoteDate: new Date().toISOString().slice(0, 10)
      });
      visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;
      statusFilter.value = '';
      await refreshQuotes();
      setLibraryStatus(`Created an unnumbered duplicate of ${duplicate.workingDraft.content.customer.companyName || 'the quote'}. The highlighted DUP draft is ready to open.`);
      notifyOtherTabs(duplicate.id);
    } catch (error) {
      setLibraryStatus('The quote could not be duplicated.', true);
    }
  }

  async function createRevision(quoteId, versionId) {
    const replacingActiveQuote = quoteId !== boundQuoteId || versionId !== boundVersionId;
    const confirmation = replacingActiveQuote && shouldConfirmReplace()
      ? 'Create this revision and replace the active quote on this tab? Save the active draft first if you need to keep changes. The prior finalized version will remain unchanged.'
      : 'Create an editable revision from the latest finalized version? The prior version will remain unchanged.';
    if (!window.confirm(confirmation)) return;
    try {
      const revisionDraft = await repository.startRevision(quoteId, versionId);
      replaceActiveQuote(quoteContentToLegacyQuote(revisionDraft.workingDraft.content), {
        readOnly: false,
        label: `Revision draft for ${revisionDraft.baseNumber}`
      });
      bindDraft(revisionDraft);
      showActiveQuote();
      saveActiveFallback({ preserveState: true });
      statusFilter.value = '';
      await refreshQuotes();
      notifyOtherTabs(quoteId);
      setLibraryStatus(`Revision draft started for ${revisionDraft.baseNumber}. The prior finalized version remains unchanged.`);
    } catch (error) {
      setLibraryStatus(`A revision could not be started: ${error.message}`, true);
    }
  }

  async function changeQuoteStatus(quoteId, nextStatus) {
    try {
      const updated = await repository.changeStatus(quoteId, nextStatus);
      if (quoteId === boundQuoteId && boundVersionId) {
        const version = await repository.getVersion(boundVersionId);
        if (version) {
          replaceActiveQuote({
            ...quoteContentToLegacyQuote(version.content),
            quoteNumber: version.displayNumber
          }, {
            readOnly: true,
            label: version.id === updated.latestVersionId
              ? `${STATUS_LABELS[updated.currentStatus]} ${version.displayNumber}`
              : `Historical ${version.displayNumber}`
          });
          bindVersion(updated, version);
        }
      }
      await refreshQuotes();
      notifyOtherTabs(quoteId);
      setLibraryStatus(`${quoteLabel(updated)} marked ${STATUS_LABELS[nextStatus]}.`);
    } catch (error) {
      setLibraryStatus(`Status could not be updated: ${error.message}`, true);
    }
  }

  async function useCustomer(customerId) {
    if (boundVersionId) {
      setLibraryStatus('Finalized quote versions are read only. Start a new quote or revision before loading a customer.', true);
      return;
    }
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
    if (boundVersionId) return;
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
      const selection = readSessionSelection();
      if (selection?.versionId) {
        await openFinalized(selection.quoteId, selection.versionId, { restoringSession: true });
      } else if (selection?.quoteId) {
        await openDraft(selection.quoteId, { restoringSession: true });
      }
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
  statusFilter.addEventListener('change', () => {
    visibleQuoteLimit = QUOTE_LIBRARY_PAGE_SIZE;
    refreshQuotes();
  });
  showMoreQuotes.addEventListener('click', () => {
    visibleQuoteLimit += QUOTE_LIBRARY_PAGE_SIZE;
    renderQuoteResults(matchingQuotes);
  });
  customerSearch.addEventListener('input', refreshCustomers);
  window.addEventListener('beforeunload', (event) => {
    if (!boundQuoteId || boundVersionId || !dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  return {
    initialize,
    markDirty,
    unbindCurrent,
    hasBoundQuote: () => Boolean(boundQuoteId),
    hasBoundDraft: () => Boolean(boundQuoteId && !boundVersionId),
    saveBoundCurrent,
    refreshQuotes,
    refreshCustomers
  };
}
