import {
  buildCatalogSearchFields,
  normalizeDimensions,
  normalizeSearchText,
  normalizeSku
} from './catalog-normalization.js';

function getUsage(usageById, itemId) {
  const usage = usageById?.[itemId] || {};
  const useCount = Number.isFinite(usage.useCount) ? Math.max(0, usage.useCount) : 0;
  const lastUsedTime = Date.parse(usage.lastUsedAt || '') || 0;
  return { useCount, lastUsedTime };
}

function scoreItem(item, query) {
  const querySku = normalizeSku(query);
  const queryText = normalizeSearchText(query);
  const queryDimensions = normalizeDimensions(query);

  if (querySku && item.normalizedSku === querySku) return 1000;
  if (querySku && item.normalizedSku.startsWith(querySku)) return 850;
  if (querySku && item.normalizedSku.includes(querySku)) return 700;
  if (queryDimensions && item.normalizedDimensions === queryDimensions) return 650;
  if (queryText && item.normalizedName === queryText) return 600;
  if (queryText && item.normalizedName.startsWith(queryText)) return 550;
  if (queryText && item.normalizedName.includes(queryText)) return 450;
  if (queryText && item.normalizedDescription.includes(queryText)) return 300;
  return 0;
}

/**
 * Search standard and manual items with deterministic ranking. Source is not a
 * ranking factor: exact SKU and text relevance win, then usage, then stable
 * alphabetical/id tie-breakers.
 */
export function searchCatalog(items, query, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
  const usageById = options.usageById || {};
  const normalizedQuery = normalizeSearchText(query);

  return items
    .filter((item) => item && item.active !== false)
    .map(buildCatalogSearchFields)
    .map((item) => {
      const relevance = normalizedQuery ? scoreItem(item, query) : 0;
      const usage = getUsage(usageById, item.id);
      const recencyBonus = usage.lastUsedTime > 0 ? 20 : 0;
      const frequencyBonus = Math.min(20, usage.useCount);
      return {
        item,
        relevance,
        score: relevance + recencyBonus + frequencyBonus,
        ...usage
      };
    })
    .filter((result) => normalizedQuery ? result.relevance > 0 : result.lastUsedTime > 0)
    .sort((left, right) => {
      const primaryOrder = normalizedQuery
        ? right.score - left.score || right.lastUsedTime - left.lastUsedTime
        : right.lastUsedTime - left.lastUsedTime || right.useCount - left.useCount;

      return primaryOrder ||
        left.item.normalizedName.localeCompare(right.item.normalizedName) ||
        left.item.normalizedSku.localeCompare(right.item.normalizedSku) ||
        String(left.item.id).localeCompare(String(right.item.id));
    })
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, searchScore: score }));
}
