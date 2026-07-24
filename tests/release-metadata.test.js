import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BUILD_LABEL } from '../js/app-meta.js';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('Version 2 release metadata', () => {
  it('keeps the release-candidate marker and package version aligned', () => {
    const packageMetadata = JSON.parse(read('package.json'));
    expect(APP_BUILD_LABEL).toBe('v2.0.0 · release-candidate.1');
    expect(packageMetadata.version).toBe('2.0.0-rc.1');
  });

  it('keeps the release-hardening status consistent across release-facing documents', () => {
    expect(read('README.md')).toContain('Version 2 release candidate');
    expect(read('docs/CURRENT_STATE.md')).toContain('v2.0.0 · release-candidate.1');
    expect(read('docs/PRODUCT_ROADMAP.md')).toContain('Release hardening in progress');
    expect(read('docs/V2_IMPLEMENTATION_PLAN.md')).toContain('Status: current release-hardening candidate.');
    expect(read('build-docs/OPEN_ITEMS.md')).toContain('Version 2 release hardening');
    expect(read('docs/assets/gtm-quote-tool-roadmap.svg')).toContain('Release hardening and owner acceptance');
  });
});
