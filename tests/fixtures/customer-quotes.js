function quoteItem({
  id,
  name,
  quantity,
  uom = 'EA',
  price,
  unitCost = price * 0.6,
  freight = 0,
  freightMode = 'perItem',
  leadTime = ''
}) {
  const freightPerUnit = freightMode === 'total' ? freight / quantity : freight;
  const landedUnitCost = unitCost + freightPerUnit;
  const totalCost = landedUnitCost * quantity;
  const orderTotal = price * quantity;
  const gtmEachDollars = price - landedUnitCost;
  const gtmTotalDollars = gtmEachDollars * quantity;
  const gtmEachPercent = landedUnitCost > 0 ? (gtmEachDollars / landedUnitCost) * 100 : 0;

  return {
    id,
    name,
    quantity,
    uom,
    price,
    unitCost,
    freight,
    freightMode,
    freightPerUnit,
    landedUnitCost,
    totalCost,
    orderTotal,
    gtmEachDollars,
    gtmTotalDollars,
    gtmEachPercent,
    gtmTotalPercent: gtmEachPercent,
    leadTime
  };
}

const baseQuote = {
  customerName: 'North River Packaging Test Company',
  customerAddress: '1250 Market Street, Suite 400\nSacramento, CA 95814',
  buyerName: 'Jordan Rivera',
  buyerEmail: 'jordan.rivera@example.test',
  buyerPhone: '916-555-0137',
  salesRep: 'Alex Morgan',
  date: '2026-07-14',
  shipVia: 'Our Truck',
  fobPoint: 'Sacramento',
  terms: 'NET30',
  customerNotes: '',
  items: []
};

export const onePageQuote = {
  ...baseQuote,
  items: [
    quoteItem({ id: 'one-1', name: 'Single Wall Corrugated Carton 12 x 10 x 8', quantity: 250, uom: 'EA', price: 1.24, leadTime: '2 weeks' }),
    quoteItem({ id: 'one-2', name: '48 inch Single Face B Flute Roll', quantity: 12, uom: 'RL', price: 46.27, leadTime: '6 weeks' }),
    quoteItem({ id: 'one-3', name: 'Printed Poly Mailer - Two Color', quantity: 5, uom: 'CS', price: 89.5, leadTime: '3-4 weeks' })
  ]
};

export const multiPageQuote = {
  ...baseQuote,
  customerName: 'Pacific Northwest Distribution and Manufacturing Cooperative',
  customerNotes: 'Pricing includes the customer-approved specifications listed above. Please confirm final artwork before production.',
  items: Array.from({ length: 32 }, (_, index) => quoteItem({
    id: `multi-${index + 1}`,
    name: `Packaging supply line ${index + 1} with a descriptive specification that wraps cleanly in the customer quotation`,
    quantity: (index + 1) * 10,
    uom: index % 2 === 0 ? 'EA' : 'CS',
    price: 10.25 + (index * 0.75),
    leadTime: index % 3 === 0 ? 'Approximately 4-6 weeks after final approval' : '2 weeks'
  }))
};

export const customerQuoteFixtures = {
  normalOnePageThreeItems: onePageQuote,
  longCustomerName: {
    ...onePageQuote,
    customerName: 'The North American Sustainable Packaging Materials and Distribution Company, Incorporated'
  },
  twoLineStreetAddress: {
    ...onePageQuote,
    customerAddress: 'Building 14, Receiving Entrance C\n9876 Industrial Parkway\nSacramento, CA 95828'
  },
  longAttentionName: {
    ...onePageQuote,
    buyerName: 'Alexandria Montgomery-Washington, Senior Strategic Procurement Manager'
  },
  longEmailAddress: {
    ...onePageQuote,
    buyerEmail: 'alexandria.montgomery-washington+packaging-quotes@example-corporation.test'
  },
  multiplePhoneNumbers: {
    ...onePageQuote,
    buyerPhone: 'Office 916-555-0137 / Mobile 916-555-0199 / Receiving 916-555-0122'
  },
  blankOptionalValues: {
    ...onePageQuote,
    shipVia: '',
    fobPoint: '',
    terms: '',
    customerNotes: '',
    items: onePageQuote.items.map((item) => ({ ...item, leadTime: '' }))
  },
  longDescription: {
    ...onePageQuote,
    items: [quoteItem({
      id: 'long-description',
      name: 'Custom printed regular slotted container manufactured from 44 ECT double-wall kraft board with full-overlap bottom, reinforced hand holes, and customer-approved two-color graphics',
      quantity: 500,
      price: 4.75,
      leadTime: '4 weeks'
    })]
  },
  longLeadTime: {
    ...onePageQuote,
    items: [quoteItem({
      id: 'long-lead-time',
      name: 'Custom Foam Insert',
      quantity: 100,
      price: 8.2,
      leadTime: 'Approximately 8-10 weeks after receipt of approved production sample and signed artwork proof'
    })]
  },
  multiPage: multiPageQuote,
  customerFacingNotes: {
    ...onePageQuote,
    customerNotes: 'Deliver to receiving door 4. Contact the buyer at least 24 hours before the first delivery.'
  },
  twoDecimalCurrency: {
    ...onePageQuote,
    items: [quoteItem({ id: 'currency', name: 'Currency Fixture', quantity: 10, price: 12.34, leadTime: '' })]
  }
};
