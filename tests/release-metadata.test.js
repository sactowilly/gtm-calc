import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BUILD_LABEL } from '../js/app-meta.js';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('Version 2 release metadata', () => {
  it('keeps the stable marker and package version aligned', () => {
    const packageMetadata = JSON.parse(read('package.json'));
    expect(APP_BUILD_LABEL).toBe('v2.0.0 · stable');
    expect(packageMetadata.version).toBe('2.0.0');
  });

  it('keeps the stable status and next phase consistent across release-facing documents', () => {
    expect(read('README.md')).toContain('Version 2 is complete');
    expect(read('docs/CURRENT_STATE.md')).toContain('v2.0.0 · stable');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Version 2.0 is complete');
    expect(read('docs/V2_IMPLEMENTATION_PLAN.md')).toContain('Status: complete.');
    expect(read('build-docs/OPEN_ITEMS.md')).toContain('Version 2.5 backup and restore');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('CURRENT PHASE: V2.5 BACKUP AND RESTORE');
  });
});
