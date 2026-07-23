import { importCatalogCsv } from './catalog-import.js';
import { searchCatalog } from './catalog-search.js';
import {
  loadCatalogState,
  recordCatalogUse,
  removeManualItem,
  replaceCatalog,
  restorePreviousCatalog,
  upsertManualItem
} from '../services/local-catalog-storage.js';

function optionalMoney(input) {
  const raw = input.value.trim();
  if (!raw) return { value: null };
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0
    ? { value }
    : { error: `${input.labels?.[0]?.textContent.trim() || 'Value'} must be a non-negative number.` };
}

export function initializeCatalogUi({ storage, fields, updateCalculatorPreview, onItemSelected = () => {} }) {
  const elements = {
    tools: document.getElementById('catalogTools'),
    summary: document.getElementById('catalogSummary'),
    search: document.getElementById('catalogSearch'),
    file: document.getElementById('catalogFile'),
    saveManual: document.getElementById('saveManualItem'),
    restore: document.getElementById('restoreCatalog'),
    status: document.getElementById('catalogStatus'),
    report: document.getElementById('catalogImportReport'),
    reportSummary: document.getElementById('catalogImportSummary'),
    reportList: document.getElementById('catalogImportErrors'),
    results: document.getElementById('catalogResults'),
    selection: document.getElementById('catalogSelection')
  };

  let catalogState = loadCatalogState(storage);
  let selectedItem = null;

  function setCatalogStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? '#a23333' : '';
  }

  function allItems() {
    return [...catalogState.catalogItems, ...catalogState.manualItems];
  }

  function refreshState() {
    catalogState = loadCatalogState(storage);
    elements.summary.textContent = `${catalogState.catalogItems.length} catalog · ${catalogState.manualItems.length} my items`;
    elements.restore.disabled = !catalogState.hasPreviousCatalog;

    if (catalogState.status === 'recovered') {
      setCatalogStatus('Damaged catalog data was preserved in recovery storage and skipped.', true);
    } else if (catalogState.status === 'unavailable' || catalogState.status === 'corrupt-unrecoverable') {
      setCatalogStatus('Catalog storage is unavailable. Search and saved My Items may not persist.', true);
    }
    renderResults();
  }

  function resultById(itemId) {
    return allItems().find((item) => item.id === itemId);
  }

  function renderResults() {
    const query = elements.search.value.trim();
    const results = searchCatalog(allItems(), query, {
      usageById: catalogState.usageById,
      limit: 20
    });
    elements.results.replaceChildren();

    if (results.length === 0) {
      const message = document.createElement('p');
      message.className = 'catalog-empty';
      message.textContent = query
        ? 'No matching catalog or My Items.'
        : (allItems().length > 0 ? 'Search above, or select an item once to make it recent.' : 'Import a catalog or save the current entry as My Item.');
      elements.results.appendChild(message);
      return;
    }

    results.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'catalog-result';

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'catalog-result__select';
      select.dataset.itemId = item.id;

      const title = document.createElement('strong');
      title.textContent = item.name;
      const meta = document.createElement('span');
      const metaParts = [item.source === 'manual' ? 'MY ITEM' : 'CATALOG'];
      if (item.sku) metaParts.push(item.sku);
      if (item.unitOfMeasure) metaParts.push(item.unitOfMeasure);
      meta.textContent = metaParts.join(' · ');
      const description = document.createElement('span');
      description.textContent = item.description || item.dimensionsDisplay || '';
      select.append(title, meta);
      if (description.textContent) select.appendChild(description);
      row.appendChild(select);

      if (item.source === 'manual') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'catalog-result__delete';
        remove.dataset.deleteItemId = item.id;
        remove.setAttribute('aria-label', `Delete My Item ${item.name}`);
        remove.textContent = 'Delete';
        row.appendChild(remove);
      }

      elements.results.appendChild(row);
    });
  }

  function selectItem(item) {
    const allowedUom = Array.from(fields.uom.options).some((option) => option.value === item.unitOfMeasure);
    const nextValues = {
      itemName: item.name,
      uom: allowedUom ? item.unitOfMeasure : 'EA',
      unitCost: Number.isFinite(item.defaultUnitCost) ? String(item.defaultUnitCost) : '',
      price: Number.isFinite(item.defaultUnitPrice) ? String(item.defaultUnitPrice) : '',
      leadTime: item.leadTime || ''
    };
    const hasEnteredItemDetails = Boolean(
      fields.itemName.value.trim() ||
      fields.unitCost.value ||
      fields.price.value ||
      fields.leadTime.value.trim()
    );
    const wouldReplaceValues = Object.entries(nextValues).some(([key, value]) => {
      const current = String(fields[key].value || '').trim();
      return current !== String(value).trim();
    });
    if (
      hasEnteredItemDetails &&
      wouldReplaceValues &&
      !window.confirm(`Replace the current item details with ${item.name}? Quantity and freight will be kept.`)
    ) {
      setCatalogStatus('Catalog selection cancelled. The current item details were kept.');
      return;
    }

    selectedItem = item;
    fields.itemName.value = nextValues.itemName;
    fields.uom.value = nextValues.uom;
    fields.unitCost.value = nextValues.unitCost;
    fields.price.value = nextValues.price;
    fields.leadTime.value = nextValues.leadTime;

    const uomNotice = item.unitOfMeasure && !allowedUom
      ? ` Imported UOM ${item.unitOfMeasure} is not supported; EA was selected.`
      : '';
    elements.selection.textContent = `${item.source === 'manual' ? 'My Item' : 'Catalog'}${item.sku ? ` ${item.sku}` : ''} selected. Quote values remain editable.${uomNotice}`;
    updateCalculatorPreview();
    elements.tools.open = false;
    onItemSelected({ scrollTarget: '.calculator-panel' });
    fields.quantity.focus();
  }

  function showImportReport(report) {
    elements.report.hidden = false;
    elements.report.open = report.rejectedRows > 0 || report.errors.length > 0;
    elements.reportSummary.textContent = `${report.acceptedRows} accepted · ${report.rejectedRows} rejected`;
    elements.reportList.replaceChildren();

    const messages = [...report.errors, ...report.warnings].slice(0, 25);
    messages.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `Row ${entry.row}: ${entry.message}`;
      elements.reportList.appendChild(item);
    });
    if (report.errors.length + report.warnings.length > messages.length) {
      const item = document.createElement('li');
      item.textContent = `${report.errors.length + report.warnings.length - messages.length} additional messages not shown.`;
      elements.reportList.appendChild(item);
    }
  }

  async function importSelectedFile() {
    const file = elements.file.files?.[0];
    if (!file) return;

    setCatalogStatus(`Checking ${file.name}...`);
    try {
      const imported = importCatalogCsv(await file.text());
      showImportReport(imported.report);
      if (imported.report.acceptedRows === 0) {
        setCatalogStatus('Nothing was imported. Correct the CSV errors and try again.', true);
        return;
      }

      const replacementMessage = catalogState.catalogItems.length > 0
        ? `Replace the current ${catalogState.catalogItems.length}-item catalog with ${imported.report.acceptedRows} accepted rows from ${file.name}?`
        : `Import ${imported.report.acceptedRows} accepted rows from ${file.name}?`;
      const rejectedMessage = imported.report.rejectedRows > 0
        ? ` ${imported.report.rejectedRows} rejected rows will not be imported.`
        : '';
      if (!window.confirm(`${replacementMessage}${rejectedMessage}`)) {
        setCatalogStatus('Catalog import cancelled. The current catalog was kept.');
        return;
      }

      const result = replaceCatalog(storage, imported.items, {
        sourceFilename: file.name,
        importedAt: new Date().toISOString()
      });
      if (result.status === 'saved') {
        refreshState();
        setCatalogStatus(`Imported ${result.itemCount} items from ${file.name}.`);
      } else if (result.status === 'too-large') {
        setCatalogStatus('This catalog is too large for safe local storage. The previous catalog was kept.', true);
      } else {
        setCatalogStatus('The catalog could not be saved. The previous catalog was kept.', true);
      }
    } catch (error) {
      setCatalogStatus('The selected CSV could not be read. The current catalog was kept.', true);
    } finally {
      elements.file.value = '';
    }
  }

  function saveCurrentAsManualItem() {
    const name = fields.itemName.value.trim();
    if (!name) {
      setCatalogStatus('Enter an item name before saving My Item.', true);
      fields.itemName.focus();
      return;
    }

    const unitCost = optionalMoney(fields.unitCost);
    const unitPrice = optionalMoney(fields.price);
    if (unitCost.error || unitPrice.error) {
      setCatalogStatus(unitCost.error || unitPrice.error, true);
      return;
    }

    const result = upsertManualItem(storage, {
      name,
      unitOfMeasure: fields.uom.value,
      defaultUnitCost: unitCost.value,
      defaultUnitPrice: unitPrice.value,
      leadTime: fields.leadTime.value.trim()
    });
    if (result.status === 'created' || result.status === 'updated') {
      refreshState();
      elements.search.value = name;
      renderResults();
      setCatalogStatus(result.status === 'created' ? 'Saved to My Items.' : 'Updated the matching My Item.');
    } else {
      setCatalogStatus('My Item could not be saved in this browser.', true);
    }
  }

  elements.search.addEventListener('input', renderResults);
  elements.file.addEventListener('change', importSelectedFile);
  elements.saveManual.addEventListener('click', saveCurrentAsManualItem);
  elements.restore.addEventListener('click', function () {
    if (!window.confirm('Restore the catalog that was active before the most recent import?')) return;
    const result = restorePreviousCatalog(storage);
    if (result.status === 'restored') {
      refreshState();
      setCatalogStatus('Previous catalog restored.');
    } else {
      setCatalogStatus('No restorable catalog is available.', true);
    }
  });
  elements.results.addEventListener('click', function (event) {
    const selectButton = event.target.closest('[data-item-id]');
    if (selectButton) {
      const item = resultById(selectButton.dataset.itemId);
      if (item) selectItem(item);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-item-id]');
    if (!deleteButton) return;
    const item = resultById(deleteButton.dataset.deleteItemId);
    if (!item || !window.confirm(`Delete My Item ${item.name}?`)) return;
    const result = removeManualItem(storage, item.id);
    if (result.status === 'saved') {
      if (selectedItem?.id === item.id) clearSelection();
      refreshState();
      setCatalogStatus('My Item deleted.');
    } else {
      setCatalogStatus('My Item could not be deleted.', true);
    }
  });

  function clearSelection() {
    selectedItem = null;
    elements.selection.textContent = '';
    renderResults();
  }

  function recordSelectedUse() {
    if (!selectedItem) return;
    const result = recordCatalogUse(storage, selectedItem.id);
    if (result.status === 'saved') catalogState.usageById = result.usageById;
  }

  function selectById(itemId) {
    const item = resultById(itemId);
    if (item) {
      selectedItem = item;
      elements.selection.textContent = `${item.source === 'manual' ? 'My Item' : 'Catalog'}${item.sku ? ` ${item.sku}` : ''} source retained for this edit.`;
    } else {
      clearSelection();
    }
  }

  refreshState();

  return {
    clearSelection,
    getSelectedItem: () => selectedItem,
    recordSelectedUse,
    selectById
  };
}
