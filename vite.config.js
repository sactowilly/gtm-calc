import { defineConfig } from 'vite';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function copyRequiredStaticAssets() {
  return {
    name: 'copy-required-static-assets',
    writeBundle(options, bundle) {
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

      const publicAssets = [
        '/gtm-calc/',
        '/gtm-calc/manifest.webmanifest',
        '/gtm-calc/vendor/html2canvas.min.js',
        '/gtm-calc/vendor/jspdf.umd.min.js',
        '/gtm-calc/assets/pwa/gtm-calc-180.png',
        '/gtm-calc/assets/pwa/gtm-calc-192.png',
        '/gtm-calc/assets/pwa/gtm-calc-512.png',
        '/gtm-calc/assets/pwa/gtm-calc-maskable-512.png',
        ...Object.keys(bundle)
          .filter((filename) => filename !== 'index.html')
          .map((filename) => `/gtm-calc/${filename}`)
      ];
      const workerSource = readFileSync(resolve('sw.js'), 'utf8').replace(
        /const SHELL_ASSETS = \[[\s\S]*?\];/,
        `const SHELL_ASSETS = ${JSON.stringify([...new Set(publicAssets)].sort(), null, 2)};`
      );
      writeFileSync(resolve(buildDirectory, 'sw.js'), workerSource);
    }
  };
}

export default defineConfig({
  base: '/gtm-calc/',
  plugins: [copyRequiredStaticAssets()]
});
