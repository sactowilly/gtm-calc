(function () {
  const DEFAULT_MIN_GTM = 30;
  const PAGE_SIZE = 25;
  const MAX_GTM_ROWS = 300;
  const STORAGE_KEY = 'packaging_gtm_saved_quotes_v1';

  const form = document.getElementById('gtm-form');
  const resultsBody = document.getElementById('resultsBody');
  const summary = document.getElementById('summary');
  const validationMessage = document.getElementById('validationMessage');
  const nextRowsButton = document.getElementById('nextRows');
  const saveQuoteButton = document.getElementById('saveQuote');
  const savedList = document.getElementById('savedList');

  let currentRows = [];
  let rowsShown = 0;
  let currentInputSnapshot = null;

  function parseNumber(value) {
    return Number.parseFloat(value);
  }

  function format3(value) {
    return value.toFixed(3);
  }

  function clearValidation() {
    validationMessage.textContent = '';
  }

  function setValidation(message) {
    validationMessage.textContent = message;
  }

  function readInputs() {
    const itemCost = parseNumber(form.itemCost.value);
    const freightTotal = parseNumber(form.freightTotal.value);
    const quantity = Number.parseInt(form.quantity.value, 10);
    const enteredMin = form.minGtm.value.trim();
    const minGtm = enteredMin ? parseNumber(enteredMin) : DEFAULT_MIN_GTM;

    if (!Number.isFinite(itemCost) || itemCost < 0) {
      return { error: 'Enter a valid non-negative item cost.' };
    }

    if (!Number.isFinite(freightTotal) || freightTotal < 0) {
      return { error: 'Enter a valid non-negative freight total.' };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Quantity must be a whole number greater than 0.' };
    }

    if (!Number.isFinite(minGtm) || minGtm <= 0 || minGtm >= 100) {
      return { error: 'Minimum GTM % must be greater than 0 and less than 100.' };
    }

    return {
      values: {
        itemCost,
        freightTotal,
        quantity,
        minGtm
      }
    };
  }

  function buildRows(input) {
    const freightPerUnit = input.freightTotal / input.quantity;
    const totalUnitCost = input.itemCost + freightPerUnit;
    const rows = [];

    for (let i = 0; i < MAX_GTM_ROWS; i += 1) {
      const gtmPercent = input.minGtm + (i * 0.01);

      if (gtmPercent >= 99.99) {
        break;
      }

      const gtmDecimal = gtmPercent / 100;
      const sellPrice = totalUnitCost / (1 - gtmDecimal);
      const marginPerUnit = sellPrice - totalUnitCost;

      rows.push({
        gtmPercent,
        freightPerUnit,
        totalUnitCost,
        sellPrice,
        marginPerUnit
      });
    }

    return rows;
  }

  function renderSummary(input, rowCount) {
    const freightPerUnit = input.freightTotal / input.quantity;
    const totalUnitCost = input.itemCost + freightPerUnit;

    summary.innerHTML = [
      `<span><strong>Quantity:</strong> ${input.quantity}</span>`,
      `<span><strong>Freight / Unit:</strong> ${format3(freightPerUnit)}</span>`,
      `<span><strong>Total Cost / Unit:</strong> ${format3(totalUnitCost)}</span>`,
      `<span><strong>Rows Generated:</strong> ${rowCount}</span>`
    ].join('');
  }

  function renderNextRows() {
    const nextLimit = Math.min(rowsShown + PAGE_SIZE, currentRows.length);

    if (rowsShown === 0) {
      resultsBody.innerHTML = '';
    }

    for (let i = rowsShown; i < nextLimit; i += 1) {
      const row = currentRows[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${format3(row.gtmPercent)}</td>
        <td>${format3(row.freightPerUnit)}</td>
        <td>${format3(row.totalUnitCost)}</td>
        <td>${format3(row.sellPrice)}</td>
        <td>${format3(row.marginPerUnit)}</td>
      `;
      resultsBody.appendChild(tr);
    }

    rowsShown = nextLimit;
    nextRowsButton.disabled = rowsShown >= currentRows.length;
  }

  function saveCurrentQuote() {
    if (!currentInputSnapshot || currentRows.length === 0) {
      setValidation('Generate pricing rows before saving a quote.');
      return;
    }

    const data = readSavedQuotes();
    data.unshift({
      id: Date.now(),
      createdAtIso: new Date().toISOString(),
      input: currentInputSnapshot,
      firstSellPrice: currentRows[0] ? currentRows[0].sellPrice : null
    });

    const capped = data.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    renderSavedQuotes();
    setValidation('Quote saved. Use your phone screenshot to share if needed.');
  }

  function readSavedQuotes() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function renderSavedQuotes() {
    const items = readSavedQuotes();

    if (items.length === 0) {
      savedList.innerHTML = '<li class="saved-empty">No saved quotes yet.</li>';
      return;
    }

    savedList.innerHTML = '';

    items.forEach(function (item) {
      const li = document.createElement('li');
      const createdAt = new Date(item.createdAtIso).toLocaleString();
      li.textContent = `${createdAt} | Qty ${item.input.quantity} | Min GTM ${format3(item.input.minGtm)}% | Cost ${format3(item.input.itemCost)} | Freight ${format3(item.input.freightTotal)} | First Price ${item.firstSellPrice ? format3(item.firstSellPrice) : 'n/a'}`;
      savedList.appendChild(li);
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearValidation();

    const inputResult = readInputs();

    if (inputResult.error) {
      setValidation(inputResult.error);
      return;
    }

    currentInputSnapshot = inputResult.values;
    currentRows = buildRows(inputResult.values);
    rowsShown = 0;

    if (currentRows.length === 0) {
      resultsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No rows could be generated with those values.</td></tr>';
      nextRowsButton.disabled = true;
      return;
    }

    renderSummary(currentInputSnapshot, currentRows.length);
    renderNextRows();
    setValidation(`Showing first ${Math.min(PAGE_SIZE, currentRows.length)} rows. Tap "See next 25" for more.`);
  });

  nextRowsButton.addEventListener('click', function () {
    clearValidation();
    renderNextRows();
  });

  saveQuoteButton.addEventListener('click', function () {
    saveCurrentQuote();
  });

  renderSavedQuotes();
})();
