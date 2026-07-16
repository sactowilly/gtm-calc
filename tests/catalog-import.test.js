import { describe, expect, it } from 'vitest';

import { importCatalogCsv } from '../js/catalog/catalog-import.js';

describe('catalog CSV import', () => {
  it('imports quoted fields, normalized search values, money, UOM, and active status', () => {
    const csv = [
      'SKU,Name,Description,Dimensions,UOM,Unit Cost,Unit Price,Active',
      'RSC-12108,"RSC Carton, Kraft","32 ECT, kraft",12 x 10 x 8,EA,$0.54321,1.25,yes',
      'TAPE-2,Two Inch Tape,Pressure sensitive tape,,CS,18.50,29.95,inactive'
    ].join('\r\n');

    const result = importCatalogCsv(csv);

    expect(result.report).toEqual({
      totalRows: 2,
      acceptedRows: 2,
      rejectedRows: 0,
      errors: [],
      warnings: []
    });
    expect(result.items[0]).toMatchObject({
      id: 'catalog:RSC-12108',
      sku: 'RSC-12108',
      normalizedSku: 'RSC-12108',
      name: 'RSC Carton, Kraft',
      description: '32 ECT, kraft',
      normalizedDimensions: '12x10x8',
      unitOfMeasure: 'EA',
      defaultUnitCost: 0.54321,
      defaultUnitPrice: 1.25,
      active: true,
      sourceRowNumber: 2
    });
    expect(result.items[1].active).toBe(false);
  });

  it('reports every rejected row and never silently drops invalid data', () => {
    const csv = [
      'SKU,Name,Cost,Price,Active',
      'A-1,Valid carton,1.00,2.00,yes',
      ',Missing SKU,1.00,2.00,yes',
      'A-1,Duplicate,1.00,2.00,yes',
      'A-3,Bad values,-1.00,not-money,sometimes'
    ].join('\n');

    const result = importCatalogCsv(csv);

    expect(result.items).toHaveLength(1);
    expect(result.report.totalRows).toBe(4);
    expect(result.report.acceptedRows).toBe(1);
    expect(result.report.rejectedRows).toBe(3);
    expect(result.report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 3, message: 'SKU is required.' }),
      expect.objectContaining({ row: 4, message: 'Duplicate SKU: A-1.' }),
      expect.objectContaining({ row: 5, message: 'Unit cost must be blank or a non-negative number.' }),
      expect.objectContaining({ row: 5, message: 'Unit price must be blank or a non-negative number.' }),
      expect.objectContaining({ row: 5, message: expect.stringContaining('Active must be') })
    ]));
  });

  it('reports missing headers and malformed quoted CSV as fatal import errors', () => {
    expect(importCatalogCsv('Description,Price\nCarton,2.00').report.errors[0])
      .toMatchObject({ row: 1, code: 'missing_required_header' });
    expect(importCatalogCsv('SKU,Name\nA-1,"Unclosed').report.errors[0])
      .toMatchObject({ row: 0, code: 'invalid_csv' });
  });

  it('preserves physical CSV row numbers when blank lines are present', () => {
    const result = importCatalogCsv('SKU,Name\nA-1,Valid\n\n,Missing SKU');

    expect(result.report).toMatchObject({ totalRows: 2, acceptedRows: 1, rejectedRows: 1 });
    expect(result.report.errors[0]).toMatchObject({ row: 4, message: 'SKU is required.' });
  });

  it('allows a caller-supplied header contract without changing the parser', () => {
    const result = importCatalogCsv('Part,Title\nP-1,Mailer', {
      headerAliases: {
        sku: ['part'],
        name: ['title'],
        description: [],
        dimensionsDisplay: [],
        unitOfMeasure: [],
        defaultUnitCost: [],
        defaultUnitPrice: [],
        active: []
      }
    });

    expect(result.report.acceptedRows).toBe(1);
    expect(result.items[0]).toMatchObject({ sku: 'P-1', name: 'Mailer' });
  });

  it('accepts a UTF-8 BOM and quoted multiline fields', () => {
    const result = importCatalogCsv('\uFEFFSKU,Name,Description\r\nA-1,Carton,"Line one\nLine two"');

    expect(result.report).toMatchObject({ totalRows: 1, acceptedRows: 1, rejectedRows: 0 });
    expect(result.items[0].description).toBe('Line one\nLine two');
  });

  it('rejects ambiguous duplicate aliases and oversized fields', () => {
    const duplicateHeaders = importCatalogCsv('SKU,Item Number,Name\nA-1,A-1,Carton');
    expect(duplicateHeaders.report.errors[0]).toMatchObject({ row: 1, code: 'ambiguous_header' });

    const oversized = importCatalogCsv(`SKU,Name\nA-1,${'x'.repeat(11)}`, { maxFieldLength: 10 });
    expect(oversized.report).toMatchObject({ totalRows: 1, acceptedRows: 0, rejectedRows: 1 });
    expect(oversized.report.errors[0].message).toContain('10-character');
  });
});
