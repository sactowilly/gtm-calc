import {
  buildQuoteItem,
  calculateItemValues,
  getQuoteTotals,
  normalizeItem,
  parseNumber,
  parseQuantity
} from './domain/calculations.js';
import { APP_BUILD_LABEL } from './app-meta.js';
import { buildCustomerQuoteText, formatQuantityWithUom, getQuotePdfFilename } from './domain/quote-output.js';
import { formatMoney, formatPercent, formatUnitMoney } from './domain/formatters.js';

(function () {
  const STORAGE_KEY = 'gtm_quote_calculator_v1';

  const itemForm = document.getElementById('itemForm');
  const customerName = document.getElementById('customerName');
  const customerAddress = document.getElementById('customerAddress');
  const buyerName = document.getElementById('buyerName');
  const buyerEmail = document.getElementById('buyerEmail');
  const buyerPhone = document.getElementById('buyerPhone');
  const salesRep = document.getElementById('salesRep');
  const quoteDate = document.getElementById('quoteDate');
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

  let quote = {
    customerName: '',
    customerAddress: '',
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    salesRep: '',
    date: new Date().toISOString().slice(0, 10),
    items: []
  };
  let editingItemId = null;
  let quotePdfBlob = null;
  let quotePdfUrl = null;

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
    savedState.textContent = 'Not saved';
  }

  function readCurrentItem() {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());

    return buildQuoteItem({
      name: fields.itemName.value,
      quantity: fields.quantity.value,
      uom: fields.uom.value,
      unitCost: fields.unitCost.value,
      price: fields.price.value,
      freight: fields.freight.value,
      freightMode: getFreightMode()
    }, id);
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
  }

  function renderQuote() {
    const totals = getTotals();

    outputs.orderTotal.textContent = formatMoney(totals.orderTotal);
    outputs.totalCost.textContent = formatMoney(totals.totalCost);
    outputs.totalGtm.textContent = formatMoney(totals.totalGtm);

    if (quote.items.length === 0) {
      quoteItems.innerHTML = '<tr><td colspan="8" class="empty-state">No quote items yet.</td></tr>';
      return;
    }

    quoteItems.innerHTML = '';

    quote.items.forEach(function (item) {
      const normalized = normalizeItem(item);
      const row = document.createElement('tr');
      const safeItemName = escapeHtml(normalized.name);
      const safeItemId = escapeHtml(normalized.id);
      row.innerHTML = `
        <th scope="row" data-label="Item">${safeItemName}</th>
        <td data-label="Qty">${formatQuantityWithUom(normalized.quantity, normalized.uom)}</td>
        <td data-label="Price">${formatUnitMoney(normalized.price)}</td>
        <td data-label="Cost">${formatUnitMoney(normalized.landedUnitCost)}</td>
        <td data-label="GTM$ EA">${formatMoney(normalized.gtmEachDollars)}</td>
        <td data-label="GTM$ Total">${formatMoney(normalized.gtmTotalDollars)}</td>
        <td data-label="GTM%">${formatPercent(normalized.gtmTotalPercent)}</td>
        <td class="row-actions" data-label="Actions">
          <button type="button" class="edit-button" data-id="${safeItemId}" aria-label="Edit ${safeItemName}">Edit</button>
          <button type="button" class="delete-button" data-id="${safeItemId}" aria-label="Delete ${safeItemName}">Delete</button>
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
    editingItemId = null;
    document.getElementById('itemSubmit').textContent = 'Add Item';
    updateCalculatorPreview();
    fields.itemName.focus();
    setStatus('', false);
  }

  function saveQuote() {
    syncQuoteMeta();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
    savedState.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    setStatus('Quote saved in this browser.', false);
  }

  function loadQuote() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw);

      if (parsed && Array.isArray(parsed.items)) {
        quote = {
          customerName: parsed.customerName || '',
          customerAddress: parsed.customerAddress || '',
          buyerName: parsed.buyerName || '',
          buyerEmail: parsed.buyerEmail || '',
          buyerPhone: parsed.buyerPhone || '',
          salesRep: parsed.salesRep || '',
          date: parsed.date || quote.date,
          items: parsed.items.map(normalizeItem)
        };
        return true;
      }
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
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
    const url = `mailto:${recipient ? encodeURIComponent(recipient) : ''}?subject=${encodeURIComponent(subjectParts.join(' - '))}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
    setStatus(successMessage, false);
  }

  function emailRepQuoteText() {
    syncQuoteMeta();
    const subjectParts = ['GTM Calc and Quote Tool - Internal Quote'];

    if (quote.customerName) {
      subjectParts.push(quote.customerName);
    }

    openPreparedEmail('', subjectParts, buildQuoteText(), 'Internal email draft opened. Download and attach the PDF manually.');
  }

  function emailCustomerQuoteText() {
    syncQuoteMeta();

    if (!quote.buyerEmail) {
      setStatus('Add Buyer Email before creating a customer email.', true);
      return;
    }

    const subjectParts = ['Your Vision Packaging Quote'];

    openPreparedEmail(quote.buyerEmail, subjectParts, buildCustomerQuoteText(quote), 'Customer email draft opened. Download and attach the PDF manually.');
  }

  function releaseQuotePdf() {
    if (quotePdfUrl) {
      URL.revokeObjectURL(quotePdfUrl);
    }

    quotePdfBlob = null;
    quotePdfUrl = null;
    quotePdf.removeAttribute('src');
    quotePdfFilename.textContent = '';
  }

  function ensureQuotePdf() {
    syncQuoteMeta();

    if (!quotePdfBlob) {
      quotePdfBlob = buildQuotePdfBlob();
      quotePdfUrl = URL.createObjectURL(quotePdfBlob);
    }

    const filename = getQuotePdfFilename(quote);
    quotePdfFilename.textContent = `File: ${filename}`;

    return { blob: quotePdfBlob, url: quotePdfUrl, filename };
  }

  function openQuoteDialog() {
    try {
      const pdf = ensureQuotePdf();
      quotePdf.src = pdf.url;
      setPdfStatus(`PDF ready. Download ${pdf.filename} to attach it manually.`, false);

      if (typeof quoteDialog.showModal === 'function') {
        quoteDialog.showModal();
      } else {
        quoteDialog.setAttribute('open', '');
      }
    } catch (error) {
      setStatus('PDF preview could not be created. Your quote is still available.', true);
    }
  }

  function downloadQuotePdf() {
    try {
      const pdf = ensureQuotePdf();
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

  function editItem(itemId) {
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
    fields.freight.value = normalized.freight || '';
    const freightModeInput = itemForm.querySelector(`input[name="freightMode"][value="${normalized.freightMode || 'perItem'}"]`);

    if (freightModeInput) {
      freightModeInput.checked = true;
    }

    document.getElementById('itemSubmit').textContent = 'Update Item';
    updateCalculatorPreview();
    fields.itemName.focus();
    setStatus('Editing item. Update Item will replace this row.', false);
  }

  function escapePdfText(value) {
    return String(value)
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');
  }

  function buildQuotePdfRows() {
    syncQuoteMeta();

    if (quote.items.length === 0) {
      return [];
    }

    return quote.items.map(function (item) {
      const normalized = normalizeItem(item);
      return [
        String(normalized.quantity),
        normalized.name,
        normalized.uom,
        formatUnitMoney(normalized.price)
      ];
    });
  }

  function buildQuotePdfBlob() {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 42;
    const tableWidth = pageWidth - (margin * 2);
    const rowHeight = 30;
    const headerHeight = 22;
    const headerTop = 528;
    const bottom = 128;
    const columns = [
      { label: 'MIN', width: 55, align: 'right' },
      { label: 'DESCRIPTION', width: 275, align: 'left' },
      { label: 'UNIT', width: 65, align: 'center' },
      { label: 'UNIT PRICE', width: 133, align: 'right' }
    ];
    const rows = buildQuotePdfRows();
    const customer = quote.customerName || 'Customer';
    const buyer = quote.buyerName || 'Not set';
    const buyerContact = [quote.buyerEmail, quote.buyerPhone].filter(Boolean).join(' / ') || 'Not set';
    const customerAddressLines = (quote.customerAddress || '')
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .slice(0, 2);
    const rep = quote.salesRep || 'Not set';
    const date = quote.date || new Date().toISOString().slice(0, 10);
    const rowsPerPage = Math.max(1, Math.floor((headerTop - headerHeight - bottom) / rowHeight));
    const pagedRows = [];

    if (rows.length === 0) {
      pagedRows.push([]);
    } else {
      for (let i = 0; i < rows.length; i += rowsPerPage) {
        pagedRows.push(rows.slice(i, i + rowsPerPage));
      }
    }

    const objects = [];

    function addObject(content) {
      objects.push(content);
      return objects.length;
    }

    const fontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageObjectIds = [];

    function textCommand(text, x, y, size, font) {
      return `BT /${font || 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
    }

    function estimatedTextWidth(text, size) {
      return String(text).length * size * 0.52;
    }

    function cellTextX(text, column, x, size) {
      if (column.align === 'left') {
        return x + 5;
      }

      if (column.align === 'center') {
        return Math.max(x + 5, x + ((column.width - estimatedTextWidth(text, size)) / 2));
      }

      return Math.max(x + 5, x + column.width - estimatedTextWidth(text, size) - 5);
    }

    function trimCellText(text, maxChars) {
      const value = String(text);

      if (value.length <= maxChars) {
        return value;
      }

      return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
    }

    function verticalLineCommand(x, y, height) {
      return `${x} ${y} m ${x} ${y + height} l S`;
    }

    pagedRows.forEach(function (rowsForPage, pageIndex) {
      const commands = [
        '0.05 0.08 0.28 rg',
        textCommand('VISION', margin, 742, 28, 'F2'),
        '0.94 0.33 0.08 rg',
        textCommand('INDUSTRIAL PACKAGING', 170, 730, 13, 'F1'),
        '0 g',
        textCommand('5851 ALDER AVE UNIT A, SACRAMENTO, CA 95828', 95, 712, 8.5, 'F1'),
        textCommand('www.visionpackaginginc.com', 95, 698, 8.5, 'F1'),
        textCommand('QUOTATION', 423, 742, 20, 'F2'),
        textCommand('916-374-9801', 455, 720, 12, 'F2'),
        textCommand('Fax: 916-374-9802', 456, 704, 9, 'F1'),
        `${margin} 688 m ${pageWidth - margin} 688 l S`,
        textCommand('TO:', margin + 6, 664, 10, 'F2'),
        textCommand(trimCellText(customer, 44), 88, 660, 15, 'F1'),
        textCommand('BUYER:', margin + 6, 642, 9, 'F2'),
        textCommand(trimCellText(buyer, 58), 58, 640, 10, 'F1'),
        textCommand('ADDRESS:', margin + 6, 628, 8, 'F2'),
        textCommand(trimCellText(customerAddressLines[0] || '', 76), 58, 626, 9, 'F1'),
        textCommand(trimCellText(customerAddressLines[1] || '', 76), 58, 614, 9, 'F1'),
        textCommand('EMAIL / PHONE:', margin + 6, 602, 8, 'F2'),
        textCommand(trimCellText(buyerContact, 68), 110, 600, 9, 'F1'),
        '0 g',
        `${margin} 540 ${tableWidth} 40 re S`,
        '0 g',
        `${margin} 562 ${tableWidth} 18 re f`,
        '1 1 1 rg',
        textCommand('SALES REP', margin + 92, 568, 9, 'F2'),
        textCommand('DATE', margin + 370, 568, 9, 'F2'),
        '0 g',
        `${margin + (tableWidth / 2)} 540 m ${margin + (tableWidth / 2)} 580 l S`,
        textCommand(trimCellText(rep, 31), margin + 8, 546, 12, 'F2'),
        textCommand(date, margin + (tableWidth / 2) + 8, 546, 12, 'F2'),
        '0 g',
        '0 0 0 rg',
        `${margin} ${headerTop - headerHeight} ${tableWidth} ${headerHeight} re f`,
        '1 1 1 rg',
        `${margin} ${headerTop - headerHeight} ${tableWidth} ${headerHeight} re S`
      ];
      let x = margin;

      columns.forEach(function (column) {
        commands.push(textCommand(column.label, cellTextX(column.label, column, x, 8.5), headerTop - 15, 8.5, 'F2'));
        commands.push('0 g');
        commands.push(verticalLineCommand(x, headerTop - headerHeight, headerHeight));
        commands.push('1 1 1 rg');
        x += column.width;
      });
      commands.push('0 g');
      commands.push(verticalLineCommand(margin + tableWidth, headerTop - headerHeight, headerHeight));

      if (rowsForPage.length === 0) {
        const y = headerTop - headerHeight - rowHeight;
        commands.push(`${margin} ${y} ${tableWidth} ${rowHeight} re S`);
        commands.push(textCommand('No items added.', margin + 5, y + 10, 9, 'F1'));
      }

      rowsForPage.forEach(function (row, rowIndex) {
        const y = headerTop - headerHeight - ((rowIndex + 1) * rowHeight);
        x = margin;
        commands.push(`${margin} ${y} ${tableWidth} ${rowHeight} re S`);
        row.forEach(function (value, columnIndex) {
          const column = columns[columnIndex];
          const displayValue = columnIndex === 1 ? trimCellText(value, 48) : value;
          commands.push(textCommand(displayValue, cellTextX(displayValue, column, x, 9), y + 10, 9, 'F1'));
          commands.push(verticalLineCommand(x, y, rowHeight));
          x += column.width;
        });
        commands.push(verticalLineCommand(margin + tableWidth, y, rowHeight));
      });

      commands.push('0 g');
      commands.push(textCommand('Thanks for the opportunity to quote your packaging supplies!', 130, 98, 12, 'F2'));
      commands.push(`${margin} 78 m ${pageWidth - margin} 78 l S`);
      commands.push(textCommand('PRICING IS VALID 30 DAYS FROM THE DATE OF THIS QUOTATION', 142, 62, 9, 'F2'));

      if (pagedRows.length > 1) {
        commands.push(textCommand(`Page ${pageIndex + 1} of ${pagedRows.length}`, pageWidth - margin - 70, 36, 8, 'F1'));
      }

      const stream = commands.join('\n');
      const contentObject = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageObject = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObject} 0 R /F2 ${boldFontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      pageObjectIds.push(pageObject);
    });

    const pagesObject = addObject(`<< /Type /Pages /Kids [${pageObjectIds.map(function (id) { return `${id} 0 R`; }).join(' ')}] /Count ${pageObjectIds.length} >>`);

    pageObjectIds.forEach(function (pageObjectId) {
      objects[pageObjectId - 1] = objects[pageObjectId - 1].replace('/Parent 0 0 R', `/Parent ${pagesObject} 0 R`);
    });

    const catalogObject = addObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);
    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach(function (content, index) {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(function (offset) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  itemForm.addEventListener('input', updateCalculatorPreview);
  itemForm.addEventListener('change', updateCalculatorPreview);

  itemForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const result = readCurrentItem();

    if (result.error) {
      setStatus(result.error, true);
      return;
    }

    let status = 'Item added to quote.';

    if (editingItemId) {
      quote.items = quote.items.map(function (item) {
        return String(item.id) === editingItemId ? { ...result.item, id: editingItemId } : item;
      });
      editingItemId = null;
      document.getElementById('itemSubmit').textContent = 'Add Item';
      status = 'Item updated.';
    } else {
      quote.items.push(result.item);
    }

    renderQuote();
    markUnsaved();
    clearItemForm();
    setStatus(status, false);
  });

  quoteItems.addEventListener('click', function (event) {
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

  document.getElementById('clearItem').addEventListener('click', clearItemForm);
  document.getElementById('saveQuote').addEventListener('click', saveQuote);
  document.getElementById('viewQuote').addEventListener('click', openQuoteDialog);
  document.getElementById('downloadQuote').addEventListener('click', downloadQuotePdf);
  document.getElementById('copyQuote').addEventListener('click', copyQuoteText);
  document.getElementById('emailRep').addEventListener('click', emailRepQuoteText);
  document.getElementById('emailCustomer').addEventListener('click', emailCustomerQuoteText);
  document.getElementById('copyQuoteDialog').addEventListener('click', copyQuoteText);
  document.getElementById('emailRepDialog').addEventListener('click', emailRepQuoteText);
  document.getElementById('emailCustomerDialog').addEventListener('click', emailCustomerQuoteText);
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

  const loadedSavedQuote = loadQuote();
  customerName.value = quote.customerName;
  customerAddress.value = quote.customerAddress;
  buyerName.value = quote.buyerName;
  buyerEmail.value = quote.buyerEmail;
  buyerPhone.value = quote.buyerPhone;
  salesRep.value = quote.salesRep;
  quoteDate.value = quote.date;
  if (loadedSavedQuote) {
    savedState.textContent = 'Saved locally';
  }
  renderQuote();
  updateCalculatorPreview();
})();
