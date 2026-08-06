import { defineConfig } from 'vite';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

function copyRequiredStaticAssets() {
  return {
    name: 'copy-required-static-assets',
    writeBundle(options) {
      const buildDirectory = resolve(options.dir || 'dist');
      const vendorDirectory = resolve(buildDirectory, 'vendor');
      const pwaIconDirectory = resolve(buildDirectory, 'assets', 'pwa');
      mkdirSync(vendorDirectory, { recursive: true });
      mkdirSync(pwaIconDirectory, { recursive: true });

      ['html2canvas.min.js', 'jspdf.umd.min.js', 'jspdf.umd.min.js.map'].forEach((filename) => {
        copyFileSync(resolve('vendor', filename), resolve(vendorDirectory, filename));
      });

      ['gtm-calc-180.png', 'gtm-calc-192.png', 'gtm-calc-512.png', 'gtm-calc-maskable-512.png'].forEach((filename) => {
        copyFileSync(resolve('assets', 'pwa', filename), resolve(pwaIconDirectory, filename));
      });

      copyFileSync(resolve('manifest.webmanifest'), resolve(buildDirectory, 'manifest.webmanifest'));
    }
  };
}

export default defineConfig({
  base: '/gtm-calc/',
  plugins: [copyRequiredStaticAssets()]
});
