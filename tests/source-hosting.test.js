import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const repositoryRoot = new URL('../', import.meta.url);
const runtimeRoot = new URL('../js/', import.meta.url);

function listJavaScriptFiles(directoryUrl) {
  return readdirSync(directoryUrl, { withFileTypes: true }).flatMap((entry) => {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);
    if (entry.isDirectory()) return listJavaScriptFiles(childUrl);
    return extname(entry.name) === '.js' ? [childUrl] : [];
  });
}

function browserImportSpecifiers(source) {
  const specifiers = [];
  const staticImport = /(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g;
  const dynamicImport = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

  for (const expression of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(expression)) specifiers.push(match[1]);
  }
  return specifiers;
}

describe('direct GitHub Pages source hosting', () => {
  test('runtime modules use browser-resolvable import paths', () => {
    const unresolvedImports = [];

    for (const fileUrl of listJavaScriptFiles(runtimeRoot)) {
      const source = readFileSync(fileUrl, 'utf8');
      for (const specifier of browserImportSpecifiers(source)) {
        if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('https://')) continue;
        unresolvedImports.push({
          file: relative(repositoryRoot.pathname, fileUrl.pathname),
          specifier
        });
      }
    }

    expect(unresolvedImports).toEqual([]);
  });

  test('the vendored IndexedDB helper and license are committed', () => {
    expect(readFileSync(new URL('../vendor/idb.js', import.meta.url), 'utf8')).toContain('function openDB');
    expect(readFileSync(new URL('../vendor/idb.LICENSE.txt', import.meta.url), 'utf8')).toContain('ISC License');
  });
});
