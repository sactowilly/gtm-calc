import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BUILD_LABEL, APP_RELEASE_VERSION } from '../js/app-meta.js';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const buildLabel = `v3.5.0 ${String.fromCharCode(0x00b7)} inline-search.1`;

describe('Version 3.5 inline-search metadata', () => {
  it('keeps the Version 3.5 inline-search marker and package version aligned', () => {
    const packageMetadata = JSON.parse(read('package.json'));
    expect(APP_BUILD_LABEL).toBe(buildLabel);
    expect(packageMetadata.version).toBe('3.5.0-alpha.1');
    expect(APP_RELEASE_VERSION).toBe(packageMetadata.version);
  });

  it('keeps completed Version 3 and in-progress Version 3.5 status consistent', () => {
    expect(read('README.md')).toContain('Version 2 is complete');
    expect(read('README.md')).toContain('Version 2.5 backup and restore is complete');
    expect(read('docs/CURRENT_STATE.md')).toContain(buildLabel);
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Version 2.0 is complete');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Status (2026-08-06): Complete.');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Status (2026-09-08): Complete.');
    expect(read('docs/V2_IMPLEMENTATION_PLAN.md')).toContain('Status: complete.');
    expect(read('docs/V25_IMPLEMENTATION_PLAN.md')).toContain('Status: complete after owner acceptance');
    expect(read('build-docs/OPEN_ITEMS.md')).toContain('Version 2.5 backup and restore');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Status (2026-09-08): In progress.');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('CURRENT PHASE: V3.5 MOBILE WORKFLOW');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('ACTIVE PLAN');
  });
});
