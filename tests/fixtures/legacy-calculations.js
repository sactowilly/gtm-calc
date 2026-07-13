export const legacyCalculationFixtures = [
  {
    name: 'per-item freight',
    input: {
      quantity: 10,
      unitCost: 2,
      price: 5,
      freight: 0.5,
      freightMode: 'perItem'
    },
    expected: {
      freightPerUnit: 0.5,
      landedUnitCost: 2.5,
      totalCost: 25,
      orderTotal: 50,
      gtmEachDollars: 2.5,
      gtmTotalDollars: 25,
      gtmEachPercent: 100,
      gtmTotalPercent: 100
    }
  },
  {
    name: 'total freight',
    input: {
      quantity: 3,
      unitCost: 10,
      price: 20,
      freight: 6,
      freightMode: 'total'
    },
    expected: {
      freightPerUnit: 2,
      landedUnitCost: 12,
      totalCost: 36,
      orderTotal: 60,
      gtmEachDollars: 8,
      gtmTotalDollars: 24,
      gtmEachPercent: 66.66666666666666,
      gtmTotalPercent: 66.66666666666666
    }
  },
  {
    name: 'negative margin',
    input: {
      quantity: 2,
      unitCost: 10,
      price: 8,
      freight: 0,
      freightMode: 'perItem'
    },
    expected: {
      freightPerUnit: 0,
      landedUnitCost: 10,
      totalCost: 20,
      orderTotal: 16,
      gtmEachDollars: -2,
      gtmTotalDollars: -4,
      gtmEachPercent: -20,
      gtmTotalPercent: -20
    }
  },
  {
    name: 'zero price',
    input: {
      quantity: 1,
      unitCost: 5,
      price: 0,
      freight: 0,
      freightMode: 'perItem'
    },
    expected: {
      freightPerUnit: 0,
      landedUnitCost: 5,
      totalCost: 5,
      orderTotal: 0,
      gtmEachDollars: -5,
      gtmTotalDollars: -5,
      gtmEachPercent: -100,
      gtmTotalPercent: -100
    }
  }
];
