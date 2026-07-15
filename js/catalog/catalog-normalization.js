const DIMENSION_NUMBER_PATTERN = String.raw`(?:\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)`;
const DIMENSION_SEPARATOR_PATTERN = String.raw`(?:\s*[xX×]\s*|\s+)`;
const DIMENSION_PATTERN = new RegExp(
  String.raw`(^|[^\d.])(${DIMENSION_NUMBER_PATTERN})${DIMENSION_SEPARATOR_PATTERN}(${DIMENSION_NUMBER_PATTERN})${DIMENSION_SEPARATOR_PATTERN}(${DIMENSION_NUMBER_PATTERN})(?=$|[^\d.])`
);

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9./]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeSku(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeDimensionPart(value) {
  const compact = String(value).replace(/\s+/g, '');

  const mixedFraction = String(value).match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    if (denominator !== 0) return String(Number((whole + numerator / denominator).toFixed(5)));
  }

  if (compact.includes('/')) {
    const [numerator, denominator] = compact.split('/').map(Number);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return String(Number((numerator / denominator).toFixed(5)));
    }
  }

  const number = Number(compact);
  return Number.isFinite(number) ? String(number) : compact.toLowerCase();
}

/**
 * Extract the first three-part dimension group while preserving the source text
 * elsewhere. Examples such as "12x10x8", "12 x 10 x 8", "12 10 8", and
 * "RSC 12x10x8" all produce the canonical token "12x10x8".
 */
export function normalizeDimensions(value) {
  const match = String(value ?? '').match(DIMENSION_PATTERN);
  if (!match) return '';

  return [match[2], match[3], match[4]].map(normalizeDimensionPart).join('x');
}

export function buildCatalogSearchFields(item) {
  const sku = String(item.sku ?? '').trim();
  const name = String(item.name ?? '').trim();
  const description = String(item.description ?? '').trim();
  const dimensionsDisplay = String(item.dimensionsDisplay ?? '').trim();
  const dimensionSource = dimensionsDisplay || `${name} ${description}`;

  return {
    ...item,
    sku,
    normalizedSku: normalizeSku(sku),
    name,
    normalizedName: normalizeSearchText(name),
    description,
    normalizedDescription: normalizeSearchText(description),
    dimensionsDisplay,
    normalizedDimensions: normalizeDimensions(dimensionSource)
  };
}
