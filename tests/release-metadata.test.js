import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BUILD_LABEL, APP_RELEASE_VERSION } from '../js/app-meta.js';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const buildLabel = `v2.5.0 ${String.fromCharCode(0x00b7)} release-closeout.6`;

describe('Version 2.5 development metadata', () => {
  it('keeps the Version 2.5 release-closeout marker and package version aligned', () => {
    const packageMetadata = JSON.parse(read('package.json'));
    expect(APP_BUILD_LABEL).toBe(buildLabel);
    expect(packageMetadata.version).toBe('2.5.0-alpha.6');
    expect(APP_RELEASE_VERSION).toBe(packageMetadata.version);
  });

  it('keeps the completed Version 2.5 and active Version 3 status consistent', () => {
    expect(read('README.md')).toContain('Version 2 is complete');
    expect(read('README.md')).toContain('Version 2.5 backup and restore is complete');
    expect(read('docs/CURRENT_STATE.md')).toContain(buildLabel);
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Version 2.0 is complete');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Status (2026-08-06): Complete.');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Status (2026-08-06): Active planning.');
    expect(read('docs/V2_IMPLEMENTATION_PLAN.md')).toContain('Status: complete.');
    expect(read('docs/V25_IMPLEMENTATION_PLAN.md')).toContain('Status: complete after owner acceptance');
    expect(read('build-docs/OPEN_ITEMS.md')).toContain('Version 2.5 backup and restore');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('CURRENT PHASE: V3.0 PWA PLANNING');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('ACTIVE PLAN');
  });
});
