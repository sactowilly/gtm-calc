import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url));
}

function pngDimensions(path) {
  const bytes = read(path);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

describe('Version 3 install metadata', () => {
  it('keeps the manifest inside the GitHub Pages repository scope', () => {
    const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'));

    expect(manifest.id).toBe('/gtm-calc/');
    expect(manifest.start_url).toBe('/gtm-calc/');
    expect(manifest.scope).toBe('/gtm-calc/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#062b4c');
    expect(manifest.background_color).toBe('#f4f2ed');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any', src: 'assets/pwa/gtm-calc-192.png?v=2' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any', src: 'assets/pwa/gtm-calc-512.png?v=2' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable', src: 'assets/pwa/gtm-calc-maskable-512.png?v=2' })
    ]));
  });

  it.each([
    ['assets/pwa/gtm-calc-180.png', 180],
    ['assets/pwa/gtm-calc-192.png', 192],
    ['assets/pwa/gtm-calc-512.png', 512],
    ['assets/pwa/gtm-calc-maskable-512.png', 512]
  ])('commits a correctly sized PNG at %s', (path, size) => {
    expect(pngDimensions(path)).toEqual({ width: size, height: size });
  });

  it('links the manifest, theme color, favicon, and Apple touch icon from source HTML', () => {
    const html = read('index.html').toString('utf8');
    expect(html).toContain('<link rel="manifest" href="/gtm-calc/manifest.webmanifest?v=2">');
    expect(html).toContain('<meta name="theme-color" content="#062b4c">');
    expect(html).toContain('href="/gtm-calc/assets/pwa/gtm-calc-192.png?v=2"');
    expect(html).toContain('href="/gtm-calc/assets/pwa/gtm-calc-180.png?v=2"');
  });
});
