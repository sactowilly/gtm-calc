import { defineConfig } from 'vite';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

function copyVendoredPdfLibraries() {
  return {
    name: 'copy-vendored-pdf-libraries',
    writeBundle(options) {
      const outputDirectory = resolve(options.dir || 'dist', 'vendor');
      mkdirSync(outputDirectory, { recursive: true });

      ['html2canvas.min.js', 'jspdf.umd.min.js', 'jspdf.umd.min.js.map'].forEach((filename) => {
        copyFileSync(resolve('vendor', filename), resolve(outputDirectory, filename));
      });
    }
  };
}

export default defineConfig({
  base: '/gtm-calc/',
  plugins: [copyVendoredPdfLibraries()]
});
