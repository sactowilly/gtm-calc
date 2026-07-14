const FOOTER_CATEGORIES = [
  ['Custom & Stock Boxes', 'Tapes', 'Mattress Bags', 'Dispensers', 'HT Crates & Pallets', 'Box & Can Liners'],
  ['Mailers', 'Rubber Bands', 'Produce Rolls', 'Tools & Accessories', 'Custom Design/Printing', 'Newsprint'],
  ['Slip Sheets & Pads', 'Steel & Plastic Strapping', 'Pallet Covers', 'Foam', 'Loose Fill', 'Twine & Rope'],
  ['Stretch Film', 'Poly Bags', 'Labels', 'Bubble Wrap', 'Kraft Rolls', 'Chipboard']
];

function element(tagName, className, textContent) {
  const node = document.createElement(tagName);

  if (className) {
    node.className = className;
  }

  if (textContent !== undefined) {
    node.textContent = textContent;
  }

  return node;
}

function valueOrSpace(value) {
  return value || '\u00a0';
}

function createHeader(documentData, logoUrl, continuation) {
  const header = element('header', continuation ? 'quote-print-header quote-print-header--continuation' : 'quote-print-header');
  const brand = element('div', 'quote-print-brand');
  const logo = element('img', 'quote-print-logo');
  logo.src = logoUrl;
  logo.alt = 'Vision Industrial Packaging';
  brand.append(
    logo,
    element('p', 'quote-print-address', documentData.company.address),
    element('p', 'quote-print-website', documentData.company.website)
  );

  const title = element('div', 'quote-print-title');
  title.append(
    element('p', 'quote-print-title__name', continuation ? 'QUOTATION - CONTINUED' : 'QUOTATION'),
    element('p', 'quote-print-title__phone', documentData.company.telephone),
    element('p', 'quote-print-title__fax', documentData.company.fax ? `Fax: ${documentData.company.fax}` : '\u00a0')
  );
  header.append(brand, title);
  return header;
}

function createLabeledValue(label, value) {
  const row = element('div', 'quote-print-field');
  row.append(
    element('div', 'quote-print-field__label', label),
    element('div', 'quote-print-field__value', valueOrSpace(value))
  );
  return row;
}

function createCustomerBlock(documentData) {
  const block = element('section', 'quote-print-customer');
  const left = element('div', 'quote-print-customer__left');
  const address = element('div', 'quote-print-address-value');
  const addressLines = [documentData.customer.name, ...documentData.customer.addressLines];

  if (addressLines.filter(Boolean).length === 0) {
    address.append(element('div', '', '\u00a0'));
  } else {
    addressLines.forEach((line) => address.append(element('div', '', valueOrSpace(line))));
  }

  left.append(element('div', 'quote-print-field__label', 'TO:'), address);

  const right = element('div', 'quote-print-customer__right');
  right.append(
    createLabeledValue('ATTENTION:', documentData.customer.attention),
    createLabeledValue('EMAIL:', documentData.customer.email),
    createLabeledValue('PHONE:', documentData.customer.phone)
  );
  block.append(left, right);
  return block;
}

function createSalesBand(documentData) {
  const band = element('section', 'quote-print-sales');
  const fields = [
    ['SALES REP', documentData.sales.salesRep],
    ['DATE', documentData.sales.date],
    ['SHIP VIA', documentData.sales.shipVia],
    ['F.O.B. POINT', documentData.sales.fobPoint],
    ['TERMS', documentData.sales.terms]
  ];

  fields.forEach(([label, value]) => {
    const field = element('div', 'quote-print-sales__field');
    field.append(
      element('div', 'quote-print-sales__heading', label),
      element('div', 'quote-print-sales__value', valueOrSpace(value))
    );
    band.append(field);
  });
  return band;
}

function createItemTable() {
  const table = element('table', 'quote-print-items');
  const colgroup = document.createElement('colgroup');
  ['10', '50', '12', '14', '14'].forEach((width) => {
    const col = document.createElement('col');
    col.style.width = `${width}%`;
    colgroup.append(col);
  });
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['MIN', 'DESCRIPTION', 'UNIT', 'UNIT PRICE', 'LEAD TIME'].forEach((label) => {
    headerRow.append(element('th', '', label));
  });
  thead.append(headerRow);
  table.append(colgroup, thead, document.createElement('tbody'));
  return table;
}

function createItemRow(item) {
  const row = document.createElement('tr');
  [item.minimum, item.description, item.unit, item.unitPrice, item.leadTime].forEach((value, index) => {
    const cell = element('td', `quote-print-items__cell quote-print-items__cell--${index + 1}`, valueOrSpace(value));
    row.append(cell);
  });
  return row;
}

function createClosing(documentData) {
  const closing = element('section', 'quote-print-closing');
  closing.append(element('p', 'quote-print-thanks', 'Thanks for the opportunity to quote your packaging supplies!'));

  const notes = element('section', 'quote-print-notes');
  notes.append(
    element('div', 'quote-print-notes__label', 'NOTES:'),
    element('div', 'quote-print-notes__value', valueOrSpace(documentData.customerNotes))
  );
  closing.append(notes);

  const footer = element('footer', 'quote-print-footer');
  footer.append(element('p', 'quote-print-validity', 'PRICING IS VALID 30 DAYS FROM THE DATE OF THIS QUOTATION'));
  const categories = element('div', 'quote-print-categories');
  FOOTER_CATEGORIES.forEach((column) => {
    const columnNode = element('div', 'quote-print-categories__column');
    column.forEach((category) => columnNode.append(element('div', '', category)));
    categories.append(columnNode);
  });
  categories.append(element('div', 'quote-print-categories__more', 'AND MORE!'));
  footer.append(categories);
  closing.append(footer);
  return closing;
}

function createPage(documentData, logoUrl, pageNumber, firstPage) {
  const page = element('section', 'quote-print-page');
  page.dataset.pageNumber = String(pageNumber);
  const inner = element('div', 'quote-print-page__inner');
  inner.append(createHeader(documentData, logoUrl, !firstPage));

  if (firstPage) {
    inner.append(createCustomerBlock(documentData), createSalesBand(documentData));
  }

  const tableWrap = element('section', 'quote-print-table-wrap');
  const table = createItemTable();
  tableWrap.append(table);
  inner.append(tableWrap);
  page.append(inner);
  return page;
}

function pageOverflows(page) {
  const inner = page.querySelector('.quote-print-page__inner');
  return inner.scrollHeight > inner.clientHeight + 1;
}

function appendRow(page, item) {
  const row = createItemRow(item);
  page.querySelector('tbody').append(row);
  return row;
}

function addPage(host, pages, documentData, logoUrl, firstPage) {
  const page = createPage(documentData, logoUrl, pages.length + 1, firstPage);
  host.append(page);
  pages.push(page);
  return page;
}

function addClosingWithOverflowProtection(host, pages, documentData, logoUrl) {
  let lastPage = pages.at(-1);
  const closing = createClosing(documentData);
  lastPage.querySelector('.quote-print-page__inner').append(closing);

  if (!pageOverflows(lastPage)) {
    return;
  }

  closing.remove();
  const lastRow = lastPage.querySelector('tbody tr:last-child');
  const finalPage = addPage(host, pages, documentData, logoUrl, false);

  if (lastRow) {
    finalPage.querySelector('tbody').append(lastRow);
  }

  finalPage.querySelector('.quote-print-page__inner').append(closing);

  if (pageOverflows(finalPage)) {
    closing.remove();
    const footerOnlyPage = addPage(host, pages, documentData, logoUrl, false);
    footerOnlyPage.querySelector('.quote-print-table-wrap').remove();
    footerOnlyPage.querySelector('.quote-print-page__inner').append(closing);
  }
}

function addPageLabels(pages) {
  const total = pages.length;

  pages.forEach((page, index) => {
    if (index === 0 && total === 1) {
      return;
    }

    const label = element('p', 'quote-print-page-label', `Page ${index + 1} of ${total}`);
    page.querySelector('.quote-print-title').append(label);
  });
}

async function waitForImages(host) {
  await Promise.all(Array.from(host.querySelectorAll('img')).map((image) => {
    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error(`Could not load PDF asset: ${image.src}`)), { once: true });
    });
  }));
}

export async function createQuotePrintPages(documentData, logoUrl) {
  const host = element('div', 'quote-print-render-host');
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  const pages = [];
  let currentPage = addPage(host, pages, documentData, logoUrl, true);

  await waitForImages(host);
  await document.fonts?.ready;

  if (documentData.items.length === 0) {
    const emptyRow = document.createElement('tr');
    const cell = element('td', 'quote-print-items__empty', 'No items added.');
    cell.colSpan = 5;
    emptyRow.append(cell);
    currentPage.querySelector('tbody').append(emptyRow);
  } else {
    documentData.items.forEach((item) => {
      const row = appendRow(currentPage, item);

      if (pageOverflows(currentPage) && currentPage.querySelectorAll('tbody tr').length > 1) {
        row.remove();
        currentPage = addPage(host, pages, documentData, logoUrl, false);
        appendRow(currentPage, item);
      }
    });
  }

  addClosingWithOverflowProtection(host, pages, documentData, logoUrl);
  addPageLabels(pages);

  return {
    host,
    pages,
    dispose() {
      host.remove();
    }
  };
}
