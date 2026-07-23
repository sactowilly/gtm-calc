import {
  buildQuoteItem,
  calculateItemValues,
  getQuoteTotals,
  normalizeItem,
  parseNumber,
  parseQuantity
} from './domain/calculations.js';
import { APP_BUILD_LABEL } from './app-meta.js';
import { initializeCatalogUi } from './catalog/catalog-ui.js';
import { buildCustomerQuoteText, formatQuantityWithUom, getQuotePdfFilename } from './domain/quote-output.js';
import { formatMoney, formatPercent, formatUnitMoney } from './domain/formatters.js';
import { initializeAppNavigation } from './navigation/app-navigation.js';
import { buildCustomerQuotePdfBlob } from './pdf/customer-quote-pdf.js';
import { buildAttachmentInstruction, buildMailtoUrl } from './services/email-service.js';
import { initializeQuoteLibraryUi } from './quote-library/quote-library-ui.js';
import { createPdfFile, sharePdf } from './services/share-service.js';
import { ACTIVE_QUOTE_STORAGE_KEY, clearActiveQuote, loadActiveQuote, saveActiveQuote } from './services/active-quote-storage.js';

(function () {
  const STORAGE_KEY = ACTIVE_QUOTE_STORAGE_KEY;

  const itemForm = document.getElementById('itemForm');
  const customerName = document.getElementById('customerName');
  const customerAddress = document.getElementById('customerAddress');
  const buyerName = document.getElementById('buyerName');
  const buyerEmail = document.getElementById('buyerEmail');
  const buyerPhone = document.getElementById('buyerPhone');
  const salesRep = document.getElementById('salesRep');
  const quoteDate = document.getElementById('quoteDate');
  const shipVia = document.getElementById('shipVia');
  const fobPoint = document.getElementById('fobPoint');
  const terms = document.getElementById('terms');
  const customerNotes = document.getElementById('customerNotes');
  const statusMessage = document.getElementById('statusMessage');
  const savedState = document.getElementById('savedState');
  const quoteItems = document.getElementById('quoteItems');
  const quoteDialog = document.getElementById('quoteDialog');
  const quotePdf = document.getElementById('quotePdf');
  const quotePdfFilename = document.getElementById('quotePdfFilename');
  const pdfStatus = document.getElementById('pdfStatus');

  const fields = {
    itemName: document.getElementById('itemName'),
    quantity: document.getElementById('quantity'),
    uom: document.getElementById('uom'),
    unitCost: document.getElementById('unitCost'),
    price: document.getElementById('price'),
    leadTime: document.getElementById('leadTime'),
    freight: document.getElementById('freight')
  };

  const outputs = {
    landedCost: document.getElementById('landedCost'),
    gtmEachDollars: document.getElementById('gtmEachDollars'),
    gtmTotalDollars: document.getElementById('gtmTotalDollars'),
    gtmTotalPercent: document.getElementById('gtmTotalPercent'),
    orderTotal: document.getElementById('orderTotal'),
    totalCost: document.getElementById('totalCost'),
    totalGtm: document.getElementById('totalGtm')
  };

  function createEmptyQuote() {
    return {
      quoteNumber: '',
      customerName: '',
      customerAddress: '',
      buyerName: '',
      buyerEmail: '',
      buyerPhone: '',
      salesRep: '',
      date: new Date().toISOString().slice(0, 10),
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      terms: 'NET30',
      customerNotes: '',
      items: []
    };
  }

  function normalizeLegacyQuote(source) {
    const parsed = source && typeof source === 'object' ? source : {};
    const empty = createEmptyQuote();
    return {
      quoteNumber: parsed.quoteNumber || '',
      customerName: parsed.customerName || '',
      customerAddress: parsed.customerAddress || '',
      buyerName: parsed.buyerName || '',
      buyerEmail: parsed.buyerEmail || '',
      buyerPhone: parsed.buyerPhone || '',
      salesRep: parsed.salesRep || '',
      date: parsed.date || empty.date,
      shipVia: parsed.shipVia ?? empty.shipVia,
      fobPoint: parsed.fobPoint ?? empty.fobPoint,
      terms: parsed.terms ?? empty.terms,
      customerNotes: parsed.customerNotes || '',
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : []
    };
  }

  let quote = createEmptyQuote();
  let editingItemId = null;
  let quotePdfBlob = null;
  let quotePdfUrl = null;
  let quotePdfPromise = null;
  let catalogController = null;
  let quoteLibraryController = null;
  let appNavigation = null;
  let quoteReadOnly = false;

  document.getElementById('appVersion').textContent = APP_BUILD_LABEL;

  function getFreightMode() {
    const checked = itemForm.querySelector('input[name="freightMode"]:checked');
    return checked ? checked.value : 'perItem';
  }

  function setStatus(message, isError) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? '#a23333' : '';
  }

  function setPdfStatus(message, isError) {
    pdfStatus.textContent = message;
    pdfStatus.style.color = isError ? '#a23333' : '';
  }

  function markUnsaved() {
    if (quoteReadOnly) return;
    savedState.textContent = 'Not saved';
    quoteLibraryController?.markDirty();
  }

  function readCurrentItem() {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());

    const result = buildQuoteItem({
      name: fields.itemName.value,
      quantity: fields.quantity.value,
      uom: fields.uom.value,
      leadTime: fields.leadTime.value,
      unitCost: fields.unitCost.value,
      price: fields.price.value,
      freight: fields.freight.value,
      freightMode: getFreightMode()
    }, id);

    const selectedCatalogItem = catalogController?.getSelectedItem();
    if (result.item && selectedCatalogItem) {
      result.item.catalogItemId = selectedCatalogItem.id;
      result.item.catalogSource = selectedCatalogItem.source;
      result.item.sku = selectedCatalogItem.sku || '';
    }
    return result;
  }

  function updateCalculatorPreview() {
    const quantity = parseQuantity(fields.quantity.value);
    const unitCost = parseNumber(fields.unitCost.value);
    const price = parseNumber(fields.price.value);
    const freight = parseNumber(fields.freight.value);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitCost) ||
      !Number.isFinite(price) ||
      !Number.isFinite(freight) ||
      unitCost < 0 ||
      price < 0 ||
      freight < 0
    ) {
      outputs.landedCost.textContent = '$0.00';
      outputs.gtmEachDollars.textContent = '$0.00';
      outputs.gtmTotalDollars.textContent = '$0.00';
      outputs.gtmTotalPercent.textContent = '0.00%';
      return;
    }

    const values = calculateItemValues({
      quantity,
      unitCost,
      price,
      freight,
      freightMode: getFreightMode()
    });

    outputs.landedCost.textContent = formatMoney(values.landedUnitCost);
    outputs.gtmEachDollars.textContent = formatMoney(values.gtmEachDollars);
    outputs.gtmTotalDollars.textContent = formatMoney(values.gtmTotalDollars);
    outputs.gtmTotalPercent.textContent = formatPercent(values.gtmTotalPercent);
  }

  function getTotals() {
    return getQuoteTotals(quote.items);
  }

  function syncQuoteMeta() {
    quote.customerName = customerName.value.trim();
    quote.customerAddress = customerAddress.value.trim();
    quote.buyerName = buyerName.value.trim();
    quote.buyerEmail = buyerEmail.value.trim();
    quote.buyerPhone = buyerPhone.value.trim();
    quote.salesRep = salesRep.value.trim();
    quote.date = quoteDate.value;
    quote.shipVia = shipVia.value.trim();
    quote.fobPoint = fobPoint.value.trim();
    quote.terms = terms.value.trim();
    quote.customerNotes = customerNotes.value.trim();
  }

  function renderQuote() {
    const totals = getTotals();

    outputs.orderTotal.textContent = formatMoney(totals.orderTotal);
    outputs.totalCost.textContent = formatMoney(totals.totalCost);
    outputs.totalGtm.textContent = formatMoney(totals.totalGtm);

    if (quote.items.length === 0) {
      quoteItems.innerHTML = '<tr><td colspan="9" class="empty-state">No quote items yet.</td></tr>';
      return;
    }

    quoteItems.innerHTML = '';

    quote.items.forEach(function (item) {
      const normalized = normalizeItem(item);
      const row = document.createElement('tr');
      const safeItemName = escapeHtml(normalized.name);
      const safeItemId = escapeHtml(normalized.id);
      const actions = quoteReadOnly
        ? ''
        : `<button type="button" class="edit-button" data-id="${safeItemId}" aria-label="Edit ${safeItemName}">Edit</button>
          <button type="button" class="delete-button" data-id="${safeItemId}" aria-label="Delete ${safeItemName}">Delete</button>`;
      row.innerHTML = `
        <th scope="row" data-label="Item">${safeItemName}</th>
        <td data-label="Qty">${formatQuantityWithUom(normalized.quantity, normalized.uom)}</td>
        <td data-label="Lead Time">${escapeHtml(normalized.leadTime || '')}</td>
        <td data-label="Price">${formatUnitMoney(normalized.price)}</td>
        <td data-label="Cost">${formatUnitMoney(normalized.landedUnitCost)}</td>
        <td data-label="GTM$ EA">${formatMoney(normalized.gtmEachDollars)}</td>
        <td data-label="GTM$ Total">${formatMoney(normalized.gtmTotalDollars)}</td>
        <td data-label="GTM%">${formatPercent(normalized.gtmTotalPercent)}</td>
        <td class="row-actions" data-label="Actions">
          ${actions || '<span class="read-only-label">Finalized snapshot</span>'}
        </td>
      `;
      quoteItems.appendChild(row);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clearItemForm() {
    itemForm.reset();
    catalogController?.clearSelection();
    editingItemId = null;
    document.getElementById('itemSubmit').textContent = 'Add Item';
    updateCalculatorPreview();
    fields.itemName.focus();
    setStatus('', false);
  }

  function populateQuoteMeta() {
    customerName.value = quote.customerName;
    customerAddress.value = quote.customerAddress;
    buyerName.value = quote.buyerName;
    buyerEmail.value = quote.buyerEmail;
    buyerPhone.value = quote.buyerPhone;
    salesRep.value = quote.salesRep;
    quoteDate.value = quote.date;
    shipVia.value = quote.shipVia;
    fobPoint.value = quote.fobPoint;
    terms.value = quote.terms;
    customerNotes.value = quote.customerNotes;
  }

  function setQuoteReadOnly(readOnly, label = '') {
    quoteReadOnly = Boolean(readOnly);
    const controls = [
      ...itemForm.querySelectorAll('input, select, textarea, button'),
      customerName,
      customerAddress,
      buyerName,
      buyerEmail,
      buyerPhone,
      salesRep,
      quoteDate,
      shipVia,
      fobPoint,
      terms,
      customerNotes,
      document.getElementById('saveQuote')
    ];
    controls.forEach((control) => {
      control.disabled = quoteReadOnly;
    });
    savedState.textContent = quoteReadOnly
      ? `${label || quote.quoteNumber || 'Finalized quote'} · Read only`
      : label || 'Loaded draft';
  }

  function replaceActiveQuote(source, options = {}) {
    quote = normalizeLegacyQuote(source);
    releaseQuotePdf();
    itemForm.reset();
    catalogController?.clearSelection();
    editingItemId = null;
    document.getElementById('itemSubmit').textContent = 'Add Item';
    populateQuoteMeta();
    setQuoteReadOnly(options.readOnly, options.label);
    renderQuote();
    updateCalculatorPreview();
    setPdfStatus('', false);
  }

  function applyCustomerDetails(details) {
    if (quoteReadOnly) return;
    quote = { ...quote, ...details };
    releaseQuotePdf();
    populateQuoteMeta();
    savedState.textContent = 'Not saved';
    setPdfStatus('', false);
  }

  function hasActiveQuoteInformation() {
    syncQuoteMeta();
    const emptyQuote = createEmptyQuote();

    return Boolean(
      quote.customerName ||
      quote.customerAddress ||
      quote.buyerName ||
      quote.buyerEmail ||
      quote.buyerPhone ||
      quote.salesRep ||
      quote.customerNotes ||
      quote.items.length ||
      quote.date !== emptyQuote.date ||
      quote.shipVia !== emptyQuote.shipVia ||
      quote.fobPoint !== emptyQuote.fobPoint ||
      quote.terms !== emptyQuote.terms ||
      fields.itemName.value.trim() ||
      fields.quantity.value ||
      fields.uom.value !== 'EA' ||
      fields.unitCost.value ||
      fields.price.value ||
      fields.leadTime.value.trim() ||
      fields.freight.value ||
      getFreightMode() !== 'perItem'
    );
  }

  function startNewQuote() {
    const hadLibraryQuote = Boolean(quoteLibraryController?.hasBoundQuote());
    const confirmationMessage = hadLibraryQuote
      ? 'Start a new quote? This clears the active form and original browser fallback. The saved library quote will remain available.'
      : 'Start a new quote? This clears the current quote and removes its saved copy from this device. This cannot be undone.';
    if (
      hasActiveQuoteInformation() &&
      !window.confirm(confirmationMessage)
    ) {
      setStatus('New quote cancelled. The current quote was kept.', false);
      return;
    }

    quoteLibraryController?.unbindCurrent();
    quote = createEmptyQuote();
    setQuoteReadOnly(false, 'Not saved');
    const clearResult = clearActiveQuote(localStorage);
    releaseQuotePdf();
    clearItemForm();
    populateQuoteMeta();
    renderQuote();
    savedState.textContent = 'Not saved';
    setPdfStatus('', false);
    setStatus(
      clearResult.status === 'cleared'
        ? (hadLibraryQuote ? 'New quote ready. The previous library quote remains saved.' : 'New quote ready.')
        : 'New quote ready, but this browser could not remove the previous saved copy. Save this quote before leaving.',
      clearResult.status !== 'cleared'
    );
    customerName.focus();
  }

  function saveActiveQuoteFallback({ preserveState = false } = {}) {
    syncQuoteMeta();
    const result = saveActiveQuote(localStorage, quote);
    if (result.status === 'saved' && !preserveState) {
      savedState.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (result.status !== 'saved') {
      savedState.textContent = 'Not saved';
    }
    return result;
  }

  async function saveQuote() {
    if (quoteReadOnly) {
      setStatus('Finalized quote versions are read only. Create a revision to make changes.', true);
      return;
    }
    const localResult = saveActiveQuoteFallback();
    if (localResult.status !== 'saved') {
      setStatus('This browser could not save the quote. Keep this page open and copy or download it before leaving.', true);
      return;
    }

    if (quoteLibraryController?.hasBoundDraft()) {
      const libraryResult = await quoteLibraryController.saveBoundCurrent(quote);
      if (libraryResult.status === 'saved') {
        setStatus('Draft saved to the quote library and browser fallback.', false);
      } else if (libraryResult.status === 'conflict') {
        setStatus('The browser fallback was saved, but the library draft changed in another tab. Reopen the library draft before saving it again.', true);
      } else {
        setStatus('The browser fallback was saved, but the quote library could not be updated.', true);
      }
      return;
    }

    setStatus('Quote saved in this browser. Add it to the Quote Library when you want searchable draft history.', false);
  }

  function loadQuote() {
    const result = loadActiveQuote(localStorage);
    if (result.status === 'empty') {
      return false;
    }
    if (result.status === 'loaded') {
      quote = normalizeLegacyQuote(result.quote);
      return true;
    }
    if (result.status === 'recovered') {
      setStatus('The saved quote was damaged. A recovery copy was preserved in this browser and a clean quote was opened.', true);
    } else {
      setStatus('Saved quote storage is unavailable. Keep this page open and copy or download your work before leaving.', true);
    }
    return false;
  }

  function buildQuoteText() {
    syncQuoteMeta();
    const totals = getTotals();
    const customer = quote.customerName || 'Customer';
    const buyer = quote.buyerName || 'Not set';
    const rep = quote.salesRep || 'Not set';
    const date = quote.date || new Date().toISOString().slice(0, 10);
    const lines = [
      `Quote for ${customer}`,
      ...(quote.quoteNumber ? [`Quote Number: ${quote.quoteNumber}`] : []),
      `Buyer: ${buyer}`,
      `Buyer Email: ${quote.buyerEmail || 'Not set'}`,
      `Buyer Phone: ${quote.buyerPhone || 'Not set'}`,
      `Date: ${date}`,
      `Sales Rep: ${rep}`,
      '',
      `Order Total: ${formatMoney(totals.orderTotal)}`,
      `Total Cost: ${formatMoney(totals.totalCost)}`,
      `Total GTM$: ${formatMoney(totals.totalGtm)}`,
      ''
    ];

    if (quote.customerAddress) {
      lines.splice(1, 0, `Customer Address: ${quote.customerAddress.replace(/\r?\n/g, ', ')}`);
    }

    if (quote.items.length === 0) {
      lines.push('No items added.');
    } else {
      quote.items.forEach(function (item) {
        const normalized = normalizeItem(item);
        lines.push(`${formatQuantityWithUom(normalized.quantity, normalized.uom)} - ${normalized.name} == ${formatUnitMoney(normalized.price)} | Cost: ${formatUnitMoney(normalized.landedUnitCost)}, GTM$: ${formatMoney(normalized.gtmEachDollars)}, GTM$ Total: ${formatMoney(normalized.gtmTotalDollars)}, GTM%: ${formatPercent(normalized.gtmTotalPercent)}`);
      });
    }

    return lines.join('\n');
  }

  async function copyQuoteText() {
    const text = buildQuoteText();

    try {
      await navigator.clipboard.writeText(text);
      setStatus('Quote copied.', false);
    } catch (error) {
      setStatus('Copy is unavailable here. Use the rendered PDF preview.', true);
      openQuoteDialog();
    }
  }

  function openPreparedEmail(recipient, subjectParts, text, successMessage) {
    window.location.href = buildMailtoUrl({ recipient, subject: subjectParts.join(' - '), body: text });
    setStatus(successMessage, false);
  }

  function emailRepQuoteText(attachmentInstruction = 'Download the PDF and attach it manually.') {
    syncQuoteMeta();
    const subjectParts = ['GTM Calc and Quote Tool - Internal Quote'];

    if (quote.customerName) {
      subjectParts.push(quote.customerName);
    }
    if (quote.quoteNumber) subjectParts.push(quote.quoteNumber);

    openPreparedEmail('', subjectParts, `${buildQuoteText()}\n\n${attachmentInstruction}`, 'Internal email draft opened. Attach the downloaded PDF manually.');
  }

  function emailCustomerQuoteText(attachmentInstruction = 'Download the PDF and attach it manually.') {
    syncQuoteMeta();

    if (!quote.buyerEmail) {
      setStatus('Add Buyer Email before creating a customer email.', true);
      return;
    }

    const subjectParts = ['Your Vision Packaging Quote'];
    if (quote.quoteNumber) subjectParts.push(quote.quoteNumber);

    openPreparedEmail(quote.buyerEmail, subjectParts, `${buildCustomerQuoteText(quote)}\n\n${attachmentInstruction}`, 'Customer email draft opened. Attach the downloaded PDF manually.');
  }

  function releaseQuotePdf() {
    if (quotePdfUrl) {
      URL.revokeObjectURL(quotePdfUrl);
    }

    quotePdfBlob = null;
    quotePdfPromise = null;
    quotePdfUrl = null;
    quotePdf.removeAttribute('src');
    quotePdfFilename.textContent = '';
  }

  async function ensureQuotePdf() {
    syncQuoteMeta();

    if (!quotePdfBlob) {
      if (!quotePdfPromise) {
        setPdfStatus('Generating customer quotation PDF...', false);
        quotePdfPromise = buildCustomerQuotePdfBlob(quote);
      }

      try {
        quotePdfBlob = await quotePdfPromise;
      } finally {
        quotePdfPromise = null;
      }

      quotePdfUrl = URL.createObjectURL(quotePdfBlob);
    }

    const filename = getQuotePdfFilename(quote);
    quotePdfFilename.textContent = `File: ${filename}`;

    return { blob: quotePdfBlob, url: quotePdfUrl, filename };
  }

  async function openQuoteDialog() {
    try {
      if (typeof quoteDialog.showModal === 'function') {
        quoteDialog.showModal();
      } else {
        quoteDialog.setAttribute('open', '');
      }

      const pdf = await ensureQuotePdf();
      quotePdf.src = pdf.url;
      setPdfStatus(`PDF ready. Download ${pdf.filename} to attach it manually.`, false);
    } catch (error) {
      setPdfStatus('PDF preview could not be created. Close the preview and try again.', true);
      setStatus('PDF preview could not be created. Your quote is still available.', true);
    }
  }

  async function downloadQuotePdf() {
    try {
      const pdf = await ensureQuotePdf();
      const link = document.createElement('a');
      link.href = pdf.url;
      link.download = pdf.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      window.setTimeout(function () {
        link.remove();
      }, 1000);
      setPdfStatus(`Download started: ${pdf.filename}`, false);
    } catch (error) {
      setPdfStatus('PDF download could not start. Try opening the preview again.', true);
    }
  }

  async function shareQuotePdf() {
    try {
      const pdf = await ensureQuotePdf();
      const result = await sharePdf(navigator, createPdfFile(pdf.blob, pdf.filename), quote.customerName);

      if (result.status === 'shared') {
        setPdfStatus('Share Sheet completed.', false);
      } else if (result.status === 'cancelled') {
        setPdfStatus('Sharing cancelled. The quote is still available to download.', false);
      } else if (result.status === 'unsupported') {
        setPdfStatus(`File sharing is unavailable here. Download ${pdf.filename}, then open an email and attach it manually.`, true);
      } else {
        setPdfStatus(`Sharing failed. Download ${pdf.filename} and attach it manually.`, true);
      }
    } catch (error) {
      setPdfStatus('The PDF could not be prepared for sharing. Try Download PDF.', true);
    }
  }

  async function copyBuyerEmail() {
    syncQuoteMeta();
    if (!quote.buyerEmail) {
      setPdfStatus('Add Buyer Email before copying it.', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(quote.buyerEmail);
      setPdfStatus('Buyer email copied.', false);
    } catch (error) {
      setPdfStatus(`Copy unavailable. Buyer email: ${quote.buyerEmail}`, true);
    }
  }

  async function openEmailWithDownloadedPdf(emailFunction) {
    syncQuoteMeta();
    if (emailFunction === emailCustomerQuoteText && !quote.buyerEmail) {
      setStatus('Add Buyer Email before creating a customer email.', true);
      return;
    }
    const pdf = await ensureQuotePdf();
    await downloadQuotePdf();
    emailFunction(buildAttachmentInstruction(pdf.filename));
  }

  function editItem(itemId) {
    if (quoteReadOnly) return;
    const item = quote.items.find(function (candidate) {
      return String(candidate.id) === itemId;
    });

    if (!item) {
      return;
    }

    const normalized = normalizeItem(item);
    editingItemId = itemId;
    fields.itemName.value = normalized.name;
    fields.quantity.value = normalized.quantity;
    fields.uom.value = normalized.uom;
    if (!fields.uom.value) {
      fields.uom.value = 'EA';
      setStatus(`Saved UOM ${normalized.uom} is not in the current list. EA is selected for this edit.`, false);
    }
    fields.unitCost.value = normalized.unitCost;
    fields.price.value = normalized.price;
    fields.leadTime.value = normalized.leadTime;
    fields.freight.value = normalized.freight || '';
    catalogController?.selectById(normalized.catalogItemId);
    const freightModeInput = itemForm.querySelector(`input[name="freightMode"][value="${normalized.freightMode || 'perItem'}"]`);

    if (freightModeInput) {
      freightModeInput.checked = true;
    }

    document.getElementById('itemSubmit').textContent = 'Update Item';
    updateCalculatorPreview();
    fields.itemName.focus();
    setStatus('Editing item. Update Item will replace this row.', false);
  }


  itemForm.addEventListener('input', updateCalculatorPreview);
  itemForm.addEventListener('change', updateCalculatorPreview);

  itemForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (quoteReadOnly) return;
    const result = readCurrentItem();

    if (result.error) {
      setStatus(result.error, true);
      return;
    }

    let status = 'Item added to quote.';

    if (editingItemId) {
      quote.items = quote.items.map(function (item) {
        return String(item.id) === editingItemId ? { ...item, ...result.item, id: editingItemId } : item;
      });
      editingItemId = null;
      document.getElementById('itemSubmit').textContent = 'Add Item';
      status = 'Item updated.';
    } else {
      quote.items.push(result.item);
    }

    catalogController?.recordSelectedUse();
    renderQuote();
    markUnsaved();
    clearItemForm();
    setStatus(status, false);
  });

  quoteItems.addEventListener('click', function (event) {
    if (quoteReadOnly) return;
    if (event.target.matches('.edit-button')) {
      editItem(event.target.dataset.id);
      return;
    }

    if (!event.target.matches('.delete-button')) {
      return;
    }

    quote.items = quote.items.filter(function (item) {
      return String(item.id) !== event.target.dataset.id;
    });
    renderQuote();
    markUnsaved();
    setStatus('Item deleted.', false);
  });

  customerName.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  customerAddress.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  buyerName.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  buyerEmail.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  buyerPhone.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  salesRep.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  quoteDate.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  [shipVia, fobPoint, terms, customerNotes].forEach(function (field) {
    field.addEventListener('input', function () {
      syncQuoteMeta();
      markUnsaved();
    });
  });

  document.getElementById('clearItem').addEventListener('click', clearItemForm);
  document.getElementById('newQuote').addEventListener('click', function () {
    appNavigation?.showView('quote');
    startNewQuote();
  });
  document.getElementById('saveQuote').addEventListener('click', saveQuote);
  document.getElementById('viewQuote').addEventListener('click', openQuoteDialog);
  document.getElementById('downloadQuote').addEventListener('click', downloadQuotePdf);
  document.getElementById('shareQuote').addEventListener('click', shareQuotePdf);
  document.getElementById('copyBuyerEmail').addEventListener('click', copyBuyerEmail);
  document.getElementById('copyQuote').addEventListener('click', copyQuoteText);
  document.getElementById('emailRep').addEventListener('click', function () { openEmailWithDownloadedPdf(emailRepQuoteText); });
  document.getElementById('emailCustomer').addEventListener('click', function () { openEmailWithDownloadedPdf(emailCustomerQuoteText); });
  document.getElementById('copyQuoteDialog').addEventListener('click', copyQuoteText);
  document.getElementById('emailRepDialog').addEventListener('click', function () { openEmailWithDownloadedPdf(emailRepQuoteText); });
  document.getElementById('emailCustomerDialog').addEventListener('click', function () { openEmailWithDownloadedPdf(emailCustomerQuoteText); });
  document.getElementById('closeQuote').addEventListener('click', function () {
    if (typeof quoteDialog.close === 'function') {
      quoteDialog.close();
    } else {
      quoteDialog.removeAttribute('open');
      releaseQuotePdf();
    }
  });

  quoteDialog.addEventListener('close', function () {
    releaseQuotePdf();
  });

  appNavigation = initializeAppNavigation();
  const showQuoteWorkspace = ({
    focusTarget,
    scrollTarget = '#quoteWorkspace',
    openQuoteDetails = false,
    status
  } = {}) => {
    appNavigation.showView('quote', { scroll: false });
    if (openQuoteDetails) document.querySelector('.quote-details').open = true;
    if (status) setStatus(status, false);
    document.querySelector(scrollTarget)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (focusTarget) document.querySelector(focusTarget)?.focus({ preventScroll: true });
  };

  catalogController = initializeCatalogUi({
    storage: localStorage,
    fields,
    updateCalculatorPreview,
    onItemSelected: showQuoteWorkspace
  });
  const loadedSavedQuote = loadQuote();
  populateQuoteMeta();
  if (loadedSavedQuote) {
    savedState.textContent = 'Saved locally';
  }
  renderQuote();
  updateCalculatorPreview();

  quoteLibraryController = initializeQuoteLibraryUi({
    getActiveQuote() {
      syncQuoteMeta();
      return typeof structuredClone === 'function'
        ? structuredClone(quote)
        : JSON.parse(JSON.stringify(quote));
    },
    replaceActiveQuote,
    applyCustomerDetails,
    saveActiveFallback: saveActiveQuoteFallback,
    shouldConfirmReplace: hasActiveQuoteInformation,
    showQuoteWorkspace
  });
  quoteLibraryController.initialize();
})();
