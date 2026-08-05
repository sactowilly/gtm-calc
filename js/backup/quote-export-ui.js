import { loadCatalogState } from '../services/local-catalog-storage.js';

function setStatus(status, message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

export function initializeQuoteExportUi({ exportService, repository, storage = globalThis.localStorage }) {
  if (!exportService || !repository) throw new Error('Quote export service and repository are required.');
  const workspace = document.getElementById('exportWorkspace');
  const status = document.getElementById('quoteExportStatus');
  const buttons = {
    quotes: document.getElementById('exportQuoteListCsv'),
    customers: document.getElementById('exportCustomersCsv'),
    manualItems: document.getElementById('exportManualItemsCsv')
  };
  let busy = false;

  function setBusy(value) {
    busy = value;
    Object.values(buttons).forEach((button) => { button.disabled = value; });
    workspace.setAttribute('aria-busy', value ? 'true' : 'false');
  }

  async function collectQuoteRows() {
    const quotes = await repository.searchQuotes({ limit: 100 });
    const versionsByQuoteId = new Map();
    await Promise.all(quotes.filter((quote) => quote.latestVersionId).map(async (quote) => {
      const version = await repository.getVersion(quote.latestVersionId);
      if (version) versionsByQuoteId.set(quote.id, version);
    }));
    return { quotes, versionsByQuoteId };
  }

  async function exportQuotes() {
    return exportService.exportQuoteListCsv(await collectQuoteRows());
  }

  async function exportCustomers() {
    const customers = await repository.searchCustomers({ limit: 100 });
    const contacts = (await Promise.all(customers.map((customer) => repository.listContacts(customer.id)))).flat();
    return exportService.exportCustomersCsv({ customers, contacts });
  }

  async function exportManualItems() {
    const state = loadCatalogState(storage);
    return exportService.exportManualItemsCsv({ items: state.manualItems });
  }

  async function run(kind, action) {
    if (busy) return;
    setBusy(true);
    setStatus(status, 'Preparing the local export. No saved data is being changed.');
    try {
      const result = await action();
      setStatus(status, `${kind} export requested: ${result.filename}. Check your browser downloads.`);
    } catch {
      setStatus(status, `The ${kind} export could not be prepared. No saved data was changed. Try again.`, true);
    } finally {
      setBusy(false);
    }
  }

  buttons.quotes.addEventListener('click', () => run('Quote-list CSV', exportQuotes));
  buttons.customers.addEventListener('click', () => run('Customer CSV', exportCustomers));
  buttons.manualItems.addEventListener('click', () => run('Manual-item CSV', exportManualItems));

  return { exportQuotes, exportCustomers, exportManualItems };
}
