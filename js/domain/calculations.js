/**
 * Parse an optional money input using the legacy calculator rule: blank is zero.
 * Validation of finite and non-negative values happens at the quote-item boundary.
 */
export function parseNumber(value) {
  if (String(value).trim() === '') {
    return 0;
  }

  return Number.parseFloat(value);
}

/**
 * Quantity is intentionally strict. Number.parseInt("1.5") truncates to 1, so it
 * cannot be used for the product rule that quantities must be positive integers.
 */
export function parseQuantity(value) {
  if (String(value).trim() === '') {
    return Number.NaN;
  }

  return Number(value);
}

/**
 * Calculate the legacy derived values without rounding intermediate results.
 *
 * GTM percentage is mathematically markup because landed cost is the denominator:
 *   (selling price - landed cost) / landed cost * 100
 * The existing GTM label and formula remain unchanged in this foundation PR.
 */
export function calculateItemValues({ quantity, unitCost, price, freight, freightMode }) {
  const freightPerUnit = freightMode === 'total' ? freight / quantity : freight;
  const landedUnitCost = unitCost + freightPerUnit;
  const totalCost = landedUnitCost * quantity;
  const orderTotal = price * quantity;
  const gtmEachDollars = price - landedUnitCost;
  const gtmTotalDollars = gtmEachDollars * quantity;
  const gtmEachPercent = landedUnitCost > 0 ? (gtmEachDollars / landedUnitCost) * 100 : 0;
  const gtmTotalPercent = totalCost > 0 ? (gtmTotalDollars / totalCost) * 100 : 0;

  return {
    freightPerUnit,
    landedUnitCost,
    totalCost,
    orderTotal,
    gtmEachDollars,
    gtmTotalDollars,
    gtmEachPercent,
    gtmTotalPercent
  };
}

/**
 * Validate raw form values and produce the same persisted item shape as v0.1.0.
 */
export function buildQuoteItem(input, id) {
  const name = String(input.name ?? '').trim();
  const quantity = parseQuantity(input.quantity);
  const unitCost = parseNumber(input.unitCost);
  const price = parseNumber(input.price);
  const freight = parseNumber(input.freight);
  const freightMode = input.freightMode === 'total' ? 'total' : 'perItem';

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

  const values = calculateItemValues({ quantity, unitCost, price, freight, freightMode });

  if (values.landedUnitCost <= 0) {
    return { error: 'Landed cost must be greater than $0.00 to calculate GTM%.' };
  }

  return {
    item: {
      id,
      name,
      quantity,
      unitCost,
      price,
      freight,
      freightMode,
      ...values
    }
  };
}

/**
 * Fill missing derived fields in saved v1 items while preserving every finite
 * value already persisted by the legacy application.
 */
export function normalizeItem(item) {
  const quantity = item.quantity;
  const unitCost = item.unitCost;
  const price = item.price;
  const freight = Number.isFinite(item.freight) ? item.freight : 0;
  const freightMode = item.freightMode === 'total' ? 'total' : 'perItem';
  const calculatedFreightPerUnit = freightMode === 'total' && quantity > 0
    ? freight / quantity
    : freight;
  const freightPerUnit = Number.isFinite(item.freightPerUnit)
    ? item.freightPerUnit
    : calculatedFreightPerUnit;
  const landedUnitCost = Number.isFinite(item.landedUnitCost)
    ? item.landedUnitCost
    : unitCost + freightPerUnit;
  const totalCost = Number.isFinite(item.totalCost)
    ? item.totalCost
    : landedUnitCost * quantity;
  const orderTotal = Number.isFinite(item.orderTotal)
    ? item.orderTotal
    : price * quantity;
  const gtmEachDollars = Number.isFinite(item.gtmEachDollars)
    ? item.gtmEachDollars
    : price - landedUnitCost;
  const gtmTotalDollars = Number.isFinite(item.gtmTotalDollars)
    ? item.gtmTotalDollars
    : orderTotal - totalCost;
  const gtmEachPercent = Number.isFinite(item.gtmEachPercent)
    ? item.gtmEachPercent
    : (landedUnitCost > 0 ? (gtmEachDollars / landedUnitCost) * 100 : 0);
  const gtmTotalPercent = Number.isFinite(item.gtmTotalPercent)
    ? item.gtmTotalPercent
    : (totalCost > 0 ? (gtmTotalDollars / totalCost) * 100 : 0);

  return {
    ...item,
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
  };
}

export function getQuoteTotals(items) {
  return items.reduce((totals, item) => {
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
