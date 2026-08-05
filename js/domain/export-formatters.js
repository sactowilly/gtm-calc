/**
 * Small, dependency-free formatters used by the Version 2.5 reporting
 * exports.  CSV is intentionally treated as a reporting format, never as a
 * backup: values are flattened and formula-like text is neutralized before
 * RFC 4180 quoting.
 */

const FORMULA_PREFIX = /^\s*[=+\-@]/;

export function protectCsvCell(value) {
  const text = String(value ?? '');
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function escapeCsvCell(value) {
  const safe = protectCsvCell(value).replaceAll('"', '""');
  return `"${safe}"`;
}

/** Serialize rows as UTF-8-friendly RFC 4180 CSV with a trailing newline. */
export function serializeCsv(rows, { bom = false } = {}) {
  if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row))) {
    throw new TypeError('CSV rows must be arrays.');
  }
  const output = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const text = `${output}${rows.length ? '\r\n' : ''}`;
  return `${bom ? '\uFEFF' : ''}${text}`;
}

export function toFiniteMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(5)) : 0;
}

export function formatExportMoney(value) {
  return toFiniteMoney(value).toFixed(5).replace(/\.?0+$/, '');
}

export function formatExportDate(value, fallback = 'undated') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}

export function slugifyExportPart(value, fallback = 'record') {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function createExportFilename(prefix, extension, { date, suffix = '' } = {}) {
  const safePrefix = slugifyExportPart(prefix, 'gtm-calc');
  const safeSuffix = suffix ? `-${slugifyExportPart(suffix, 'record')}` : '';
  const datePart = formatExportDate(date || new Date(), 'undated');
  const safeExtension = String(extension || '').replace(/^\./, '').toLowerCase();
  if (!safeExtension) throw new TypeError('An export filename extension is required.');
  return `${safePrefix}-${datePart}${safeSuffix}.${safeExtension}`;
}
