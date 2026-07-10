(function () {
  const STORAGE_KEY = 'gtm_quote_calculator_v1';

  const itemForm = document.getElementById('itemForm');
  const customerName = document.getElementById('customerName');
  const quoteDate = document.getElementById('quoteDate');
  const statusMessage = document.getElementById('statusMessage');
  const savedState = document.getElementById('savedState');
  const quoteItems = document.getElementById('quoteItems');
  const quoteDialog = document.getElementById('quoteDialog');
  const quotePdf = document.getElementById('quotePdf');

  const fields = {
    itemName: document.getElementById('itemName'),
    quantity: document.getElementById('quantity'),
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

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  });

  const percentFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let quote = {
    customerName: '',
    date: new Date().toISOString().slice(0, 10),
    items: []
  };
  let editingItemId = null;
  let quotePdfUrl = null;

  function formatMoney(value) {
    return moneyFormatter.format(value);
  }

  function formatPercent(value) {
    return `${percentFormatter.format(value)}%`;
  }

  function parseNumber(value) {
    if (String(value).trim() === '') {
      return 0;
    }

    return Number.parseFloat(value);
  }

  function getFreightMode() {
    const checked = itemForm.querySelector('input[name="freightMode"]:checked');
    return checked ? checked.value : 'perItem';
  }

  function setStatus(message, isError) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? '#a23333' : '';
  }

  function markUnsaved() {
    savedState.textContent = 'Not saved';
  }

  function readCurrentItem() {
    const name = fields.itemName.value.trim();
    const quantity = Number.parseInt(fields.quantity.value, 10);
    const unitCost = parseNumber(fields.unitCost.value);
    const price = parseNumber(fields.price.value);
    const freight = parseNumber(fields.freight.value);
    const freightMode = getFreightMode();

    if (!name) {
      return { error: 'Enter an item name.' };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Qty must be a whole number greater than 0.' };
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return { error: 'Unit cost must be a valid USD amount.' };
    }

    if (!Number.isFinite(price) || price < 0) {
      return { error: 'Price must be a valid USD amount.' };
    }

    if (!Number.isFinite(freight) || freight < 0) {
      return { error: 'Freight must be blank or a valid USD amount.' };
    }

    const freightPerUnit = freightMode === 'total' ? freight / quantity : freight;
    const landedUnitCost = unitCost + freightPerUnit;

    if (landedUnitCost <= 0) {
      return { error: 'Landed cost must be greater than $0.00 to calculate GTM%.' };
    }

    const totalCost = landedUnitCost * quantity;
    const orderTotal = price * quantity;
    const gtmEachDollars = price - landedUnitCost;
    const gtmTotalDollars = gtmEachDollars * quantity;
    const gtmEachPercent = (gtmEachDollars / landedUnitCost) * 100;
    const gtmTotalPercent = totalCost > 0 ? (gtmTotalDollars / totalCost) * 100 : 0;

    return {
      item: {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        name,
        quantity,
        unitCost,
        price,
        freight,
        freightMode,
        freightPerUnit,
        landedUnitCost,
        totalCost,
        orderTotal,
        gtmEachDollars,
        gtmTotalDollars,
        gtmEachPercent,
        gtmTotalPercent
      }
    };
  }

  function normalizeItem(item) {
    const landedUnitCost = Number.isFinite(item.landedUnitCost) ? item.landedUnitCost : item.unitCost + item.freightPerUnit;
    const totalCost = Number.isFinite(item.totalCost) ? item.totalCost : landedUnitCost * item.quantity;
    const orderTotal = Number.isFinite(item.orderTotal) ? item.orderTotal : item.price * item.quantity;
    const gtmEachDollars = Number.isFinite(item.gtmEachDollars) ? item.gtmEachDollars : item.price - landedUnitCost;
    const gtmTotalDollars = Number.isFinite(item.gtmTotalDollars) ? item.gtmTotalDollars : orderTotal - totalCost;
    const gtmEachPercent = Number.isFinite(item.gtmEachPercent) ? item.gtmEachPercent : (landedUnitCost > 0 ? (gtmEachDollars / landedUnitCost) * 100 : 0);
    const gtmTotalPercent = Number.isFinite(item.gtmTotalPercent) ? item.gtmTotalPercent : (totalCost > 0 ? (gtmTotalDollars / totalCost) * 100 : 0);

    return {
      ...item,
      landedUnitCost,
      totalCost,
      orderTotal,
      gtmEachDollars,
      gtmTotalDollars,
      gtmEachPercent,
      gtmTotalPercent
    };
  }

  function updateCalculatorPreview() {
    const quantity = Number.parseInt(fields.quantity.value, 10);
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

    const freightPerUnit = getFreightMode() === 'total' ? freight / quantity : freight;
    const landedUnitCost = unitCost + freightPerUnit;
    const totalCost = landedUnitCost * quantity;
    const gtmEachDollars = price - landedUnitCost;
    const gtmTotalDollars = gtmEachDollars * quantity;
    const gtmEachPercent = landedUnitCost > 0 ? (gtmEachDollars / landedUnitCost) * 100 : 0;
    const gtmTotalPercent = totalCost > 0 ? (gtmTotalDollars / totalCost) * 100 : 0;

    outputs.landedCost.textContent = formatMoney(landedUnitCost);
    outputs.gtmEachDollars.textContent = formatMoney(gtmEachDollars);
    outputs.gtmTotalDollars.textContent = formatMoney(gtmTotalDollars);
    outputs.gtmTotalPercent.textContent = formatPercent(gtmTotalPercent);
  }

  function getTotals() {
    return quote.items.reduce(function (totals, item) {
      const normalized = normalizeItem(item);
      totals.orderTotal += normalized.orderTotal;
      totals.totalCost += normalized.totalCost;
      totals.totalGtm += normalized.gtmTotalDollars;
      return totals;
    }, {
      orderTotal: 0,
      totalCost: 0,
      totalGtm: 0
    });
  }

  function syncQuoteMeta() {
    quote.customerName = customerName.value.trim();
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
      row.innerHTML = `
        <td>${escapeHtml(normalized.name)}</td>
        <td>${normalized.quantity}</td>
        <td>${formatMoney(normalized.price)}</td>
        <td>${formatMoney(normalized.landedUnitCost)}</td>
        <td>${formatMoney(normalized.gtmEachDollars)}</td>
        <td>${formatMoney(normalized.gtmTotalDollars)}</td>
        <td>${formatPercent(normalized.gtmTotalPercent)}</td>
        <td class="row-actions">
          <button type="button" class="edit-button" data-id="${normalized.id}">Edit</button>
          <button type="button" class="delete-button" data-id="${normalized.id}">Delete</button>
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
          date: parsed.date || quote.date,
          items: parsed.items
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
    const date = quote.date || new Date().toISOString().slice(0, 10);
    const lines = [
      `Quote for ${customer}`,
      `Date: ${date}`,
      '',
      `Order Total: ${formatMoney(totals.orderTotal)}`,
      `Total Cost: ${formatMoney(totals.totalCost)}`,
      `Total GTM$: ${formatMoney(totals.totalGtm)}`,
      '',
      'QTY | ITEM | PRICE | COST | GTM$ | GTM$ Total | GTM%'
    ];

    if (quote.items.length === 0) {
      lines.push('No items added.');
    } else {
      quote.items.forEach(function (item) {
        const normalized = normalizeItem(item);
        lines.push([
          normalized.quantity,
          normalized.name,
          formatMoney(normalized.price),
          formatMoney(normalized.landedUnitCost),
          formatMoney(normalized.gtmEachDollars),
          formatMoney(normalized.gtmTotalDollars),
          formatPercent(normalized.gtmTotalPercent)
        ].join(' | '));
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

  function emailQuoteText() {
    const subjectParts = ['GTM Calc and Quote Tool'];

    if (quote.customerName) {
      subjectParts.push(quote.customerName);
    }

    const url = `mailto:?subject=${encodeURIComponent(subjectParts.join(' - '))}&body=${encodeURIComponent(buildQuoteText())}`;
    window.location.href = url;
  }

  function openQuoteDialog() {
    if (quotePdfUrl) {
      URL.revokeObjectURL(quotePdfUrl);
    }

    quotePdfUrl = URL.createObjectURL(buildQuotePdfBlob());
    quotePdf.src = quotePdfUrl;

    if (typeof quoteDialog.showModal === 'function') {
      quoteDialog.showModal();
    } else {
      quoteDialog.setAttribute('open', '');
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
        formatMoney(normalized.price),
        formatMoney(normalized.landedUnitCost),
        formatMoney(normalized.gtmEachDollars),
        formatMoney(normalized.gtmTotalDollars),
        formatPercent(normalized.gtmTotalPercent)
      ];
    });
  }

  function buildQuotePdfBlob() {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 42;
    const tableWidth = pageWidth - (margin * 2);
    const rowHeight = 24;
    const headerHeight = 24;
    const headerTop = 626;
    const bottom = 58;
    const columns = [
      { label: 'QTY', width: 38, align: 'right' },
      { label: 'ITEM', width: 150, align: 'left' },
      { label: 'PRICE', width: 65, align: 'right' },
      { label: 'COST', width: 65, align: 'right' },
      { label: 'GTM$', width: 65, align: 'right' },
      { label: 'GTM$ Total', width: 75, align: 'right' },
      { label: 'GTM%', width: 70, align: 'right' }
    ];
    const rows = buildQuotePdfRows();
    const totals = getTotals();
    const customer = quote.customerName || 'Customer';
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
      if (column.align !== 'right') {
        return x + 5;
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
        textCommand('GTM Calc and Quote Tool', margin, 742, 18, 'F2'),
        textCommand(`Customer: ${customer}`, margin, 714, 11, 'F1'),
        textCommand(`Date: ${date}`, margin, 696, 11, 'F1'),
        textCommand(`Order Total: ${formatMoney(totals.orderTotal)}`, margin, 666, 11, 'F2'),
        textCommand(`Total Cost: ${formatMoney(totals.totalCost)}`, 230, 666, 11, 'F2'),
        textCommand(`Total GTM$: ${formatMoney(totals.totalGtm)}`, 405, 666, 11, 'F2'),
        '0.93 0.96 0.94 rg',
        `${margin} ${headerTop - headerHeight} ${tableWidth} ${headerHeight} re f`,
        '0 g',
        `${margin} ${headerTop - headerHeight} ${tableWidth} ${headerHeight} re S`
      ];
      let x = margin;

      columns.forEach(function (column) {
        commands.push(textCommand(column.label, cellTextX(column.label, column, x, 9), headerTop - 16, 9, 'F2'));
        commands.push(verticalLineCommand(x, headerTop - headerHeight, headerHeight));
        x += column.width;
      });
      commands.push(verticalLineCommand(margin + tableWidth, headerTop - headerHeight, headerHeight));

      if (rowsForPage.length === 0) {
        const y = headerTop - headerHeight - rowHeight;
        commands.push(`${margin} ${y} ${tableWidth} ${rowHeight} re S`);
        commands.push(textCommand('No items added.', margin + 5, y + 8, 9, 'F1'));
      }

      rowsForPage.forEach(function (row, rowIndex) {
        const y = headerTop - headerHeight - ((rowIndex + 1) * rowHeight);
        x = margin;
        commands.push(`${margin} ${y} ${tableWidth} ${rowHeight} re S`);
        row.forEach(function (value, columnIndex) {
          const column = columns[columnIndex];
          const displayValue = columnIndex === 1 ? trimCellText(value, 24) : value;
          commands.push(textCommand(displayValue, cellTextX(displayValue, column, x, 8.5), y + 8, 8.5, 'F1'));
          commands.push(verticalLineCommand(x, y, rowHeight));
          x += column.width;
        });
        commands.push(verticalLineCommand(margin + tableWidth, y, rowHeight));
      });

      if (pagedRows.length > 1) {
        commands.push(textCommand(`Page ${pageIndex + 1} of ${pagedRows.length}`, pageWidth - margin - 70, 30, 9, 'F1'));
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

  quoteDate.addEventListener('input', function () {
    syncQuoteMeta();
    markUnsaved();
  });

  document.getElementById('clearItem').addEventListener('click', clearItemForm);
  document.getElementById('saveQuote').addEventListener('click', saveQuote);
  document.getElementById('viewQuote').addEventListener('click', openQuoteDialog);
  document.getElementById('copyQuote').addEventListener('click', copyQuoteText);
  document.getElementById('emailQuote').addEventListener('click', emailQuoteText);
  document.getElementById('copyQuoteDialog').addEventListener('click', copyQuoteText);
  document.getElementById('emailQuoteDialog').addEventListener('click', emailQuoteText);
  document.getElementById('closeQuote').addEventListener('click', function () {
    quoteDialog.close();
  });

  quoteDialog.addEventListener('close', function () {
    if (quotePdfUrl) {
      URL.revokeObjectURL(quotePdfUrl);
      quotePdfUrl = null;
      quotePdf.removeAttribute('src');
    }
  });

  const loadedSavedQuote = loadQuote();
  customerName.value = quote.customerName;
  quoteDate.value = quote.date;
  if (loadedSavedQuote) {
    savedState.textContent = 'Saved locally';
  }
  renderQuote();
  updateCalculatorPreview();
})();
