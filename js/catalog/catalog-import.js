import { buildCatalogSearchFields, normalizeSku } from './catalog-normalization.js';

export const DEFAULT_CATALOG_HEADERS = Object.freeze({
  sku: ['sku', 'item number', 'item no', 'item #'],
  name: ['name', 'item name', 'product name'],
  description: ['description', 'item description'],
  dimensionsDisplay: ['dimensions', 'box dimensions', 'size'],
  unitOfMeasure: ['uom', 'unit', 'unit of measure'],
  defaultUnitCost: ['unit cost', 'cost', 'default unit cost'],
  defaultUnitPrice: ['unit price', 'price', 'default unit price'],
  active: ['active', 'status']
});

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (inQuotes && csvText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && csvText[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    return { rows: [], error: 'CSV contains an unclosed quoted field.' };
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows };
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function resolveHeaderIndexes(headerRow, aliases) {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const indexes = {};
  const duplicateFields = [];

  Object.entries(aliases).forEach(([field, candidates]) => {
    const normalizedCandidates = candidates.map(normalizeHeader);
    const matches = normalizedHeaders
      .map((header, index) => normalizedCandidates.includes(header) ? index : -1)
      .filter((index) => index >= 0);
    indexes[field] = matches[0] ?? -1;
    if (matches.length > 1) duplicateFields.push(field);
  });

  return { indexes, duplicateFields };
}

function readCell(row, index) {
  return index >= 0 ? String(row[index] ?? '').trim() : '';
}

function parseOptionalMoney(value, label) {
  if (value === '') return { value: null };
  const parsed = Number(value.replace(/[$,]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${label} must be blank or a non-negative number.` };
  }
  return { value: parsed };
}

function parseActive(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { value: true };
  if (['true', 'yes', 'y', '1', 'active'].includes(normalized)) return { value: true };
  if (['false', 'no', 'n', '0', 'inactive'].includes(normalized)) return { value: false };
  return { error: 'Active must be blank, yes/no, true/false, 1/0, or active/inactive.' };
}

function isBlankRow(row) {
  return row.every((cell) => String(cell ?? '').trim() === '');
}

function stableCatalogId(normalizedSku) {
  return `catalog:${encodeURIComponent(normalizedSku)}`;
}

/**
 * Parse and validate a standard catalog CSV without persisting it. The default
 * contract is intentionally small and can be replaced with owner-approved
 * aliases/required fields when a production sample CSV is available.
 */
export function importCatalogCsv(csvText, options = {}) {
  const aliases = options.headerAliases || DEFAULT_CATALOG_HEADERS;
  const requiredFields = ['sku', 'name'];
  const maxFieldLength = Number.isInteger(options.maxFieldLength) && options.maxFieldLength > 0
    ? options.maxFieldLength
    : 2000;
  const parsed = parseCsvRows(String(csvText ?? ''));
  const report = {
    totalRows: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    errors: [],
    warnings: []
  };

  if (parsed.error) {
    report.errors.push({ row: 0, code: 'invalid_csv', message: parsed.error });
    return { items: [], report };
  }

  const headerRowIndex = parsed.rows.findIndex((row) => !isBlankRow(row));
  if (headerRowIndex < 0) {
    report.errors.push({ row: 1, code: 'missing_header', message: 'CSV is empty.' });
    return { items: [], report };
  }

  const headerRow = parsed.rows[headerRowIndex];
  const { indexes, duplicateFields } = resolveHeaderIndexes(headerRow, aliases);
  const missingHeaders = requiredFields.filter((field) => !Number.isInteger(indexes[field]) || indexes[field] < 0);
  if (missingHeaders.length > 0) {
    report.errors.push({
      row: headerRowIndex + 1,
      code: 'missing_required_header',
      message: `Missing required column(s): ${missingHeaders.join(', ')}.`
    });
    return { items: [], report };
  }
  if (duplicateFields.length > 0) {
    report.errors.push({
      row: headerRowIndex + 1,
      code: 'ambiguous_header',
      message: `Multiple columns map to: ${duplicateFields.join(', ')}.`
    });
    return { items: [], report };
  }

  const items = [];
  const seenSkus = new Set();
  const dataRows = parsed.rows
    .slice(headerRowIndex + 1)
    .map((row, index) => ({ row, rowNumber: headerRowIndex + index + 2 }))
    .filter(({ row }) => !isBlankRow(row));
  report.totalRows = dataRows.length;

  dataRows.forEach(({ row, rowNumber }) => {
    const sku = readCell(row, indexes.sku);
    const normalizedSku = normalizeSku(sku);
    const name = readCell(row, indexes.name);
    const rowErrors = [];

    if (row.some((cell) => String(cell ?? '').length > maxFieldLength)) {
      rowErrors.push(`A field exceeds the ${maxFieldLength}-character import limit.`);
    }
    if (!sku) rowErrors.push('SKU is required.');
    if (!name) rowErrors.push('Name is required.');
    if (normalizedSku && seenSkus.has(normalizedSku)) rowErrors.push(`Duplicate SKU: ${sku}.`);

    const unitCost = parseOptionalMoney(readCell(row, indexes.defaultUnitCost), 'Unit cost');
    const unitPrice = parseOptionalMoney(readCell(row, indexes.defaultUnitPrice), 'Unit price');
    const active = parseActive(readCell(row, indexes.active));
    if (unitCost.error) rowErrors.push(unitCost.error);
    if (unitPrice.error) rowErrors.push(unitPrice.error);
    if (active.error) rowErrors.push(active.error);

    if (rowErrors.length > 0) {
      report.rejectedRows += 1;
      rowErrors.forEach((message) => {
        report.errors.push({ row: rowNumber, code: 'invalid_row', message });
      });
      return;
    }

    seenSkus.add(normalizedSku);
    const item = buildCatalogSearchFields({
      id: stableCatalogId(normalizedSku),
      schemaVersion: 1,
      source: 'catalog',
      sku,
      name,
      description: readCell(row, indexes.description),
      dimensionsDisplay: readCell(row, indexes.dimensionsDisplay),
      unitOfMeasure: readCell(row, indexes.unitOfMeasure).toUpperCase(),
      defaultUnitCost: unitCost.value,
      defaultUnitPrice: unitPrice.value,
      active: active.value,
      sourceRowNumber: rowNumber
    });

    items.push(item);
    report.acceptedRows += 1;
  });

  return { items, report };
}
