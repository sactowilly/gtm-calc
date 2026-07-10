(function () {
  const STORAGE_KEY = 'gtm_quote_calculator_v1';

  const itemForm = document.getElementById('itemForm');
  const customerName = document.getElementById('customerName');
  const quoteDate = document.getElementById('quoteDate');
  const statusMessage = document.getElementById('statusMessage');
  const savedState = document.getElementById('savedState');
  const quoteItems = document.getElementById('quoteItems');
  const quoteDialog = document.getElementById('quoteDialog');
  const quotePreview = document.getElementById('quotePreview');

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
    gtmEachPercent: document.getElementById('gtmEachPercent'),
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
      outputs.gtmEachPercent.textContent = '0.00%';
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
    outputs.gtmEachPercent.textContent = formatPercent(gtmEachPercent);
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
      quoteItems.innerHTML = '<tr><td colspan="9" class="empty-state">No quote items yet.</td></tr>';
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
        <td>${formatPercent(normalized.gtmEachPercent)}</td>
        <td>${formatPercent(normalized.gtmTotalPercent)}</td>
        <td><button type="button" class="delete-button" data-id="${normalized.id}">Delete</button></td>
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
      'Item | QTY | Price | Cost EA | GTM$ EA | GTM$ Total | GTM% EA | GTM% Total'
    ];

    if (quote.items.length === 0) {
      lines.push('No items added.');
    } else {
      quote.items.forEach(function (item) {
        const normalized = normalizeItem(item);
        lines.push([
          normalized.name,
          normalized.quantity,
          formatMoney(normalized.price),
          formatMoney(normalized.landedUnitCost),
          formatMoney(normalized.gtmEachDollars),
          formatMoney(normalized.gtmTotalDollars),
          formatPercent(normalized.gtmEachPercent),
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
      quotePreview.textContent = text;
      setStatus('Copy is unavailable here. Quote text is shown in preview.', true);
      openQuoteDialog();
    }
  }

  function emailQuoteText() {
    const subjectParts = ['GTM Quote'];

    if (quote.customerName) {
      subjectParts.push(quote.customerName);
    }

    const url = `mailto:?subject=${encodeURIComponent(subjectParts.join(' - '))}&body=${encodeURIComponent(buildQuoteText())}`;
    window.location.href = url;
  }

  function openQuoteDialog() {
    quotePreview.textContent = buildQuoteText();

    if (typeof quoteDialog.showModal === 'function') {
      quoteDialog.showModal();
    } else {
      quoteDialog.setAttribute('open', '');
    }
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

    quote.items.push(result.item);
    renderQuote();
    markUnsaved();
    clearItemForm();
    setStatus('Item added to quote.', false);
  });

  quoteItems.addEventListener('click', function (event) {
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

  const loadedSavedQuote = loadQuote();
  customerName.value = quote.customerName;
  quoteDate.value = quote.date;
  if (loadedSavedQuote) {
    savedState.textContent = 'Saved locally';
  }
  renderQuote();
  updateCalculatorPreview();
})();
