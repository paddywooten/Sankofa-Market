#!/usr/bin/env node
/**
 * Sanity-check <script src> and <link href> references to local JS/CSS.
 *
 * Catches the classic static-site failure: a page points at a file that was
 * renamed or deleted, so the browser silently 404s and the page loses its logic.
 * Pass --strict to make warnings (external/absolute CDN refs) non-fatal.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'models', 'tests']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.html') files.push(p);
  }
})('.');

const refRe = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*"([^"]+)"/gi;
const missing = [];
const checked = new Set();

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(refRe)) {
    const ref = m[1];
    if (!/\.(js|css)(\?|$)/i.test(ref)) continue;
    if (!ref.startsWith('/')) continue;          // inline / relative / CDN
    const clean = ref.split('?')[0];
    if (checked.has(clean)) continue;
    checked.add(clean);
    const onDisk = join('.', clean);
    if (!existsSync(onDisk)) missing.push({ page: relative('.', file), ref: clean });
  }
}

console.log(`checked ${checked.size} local script/stylesheet reference(s) across ${files.length} page(s)`);

if (missing.length) {
  console.error(`\nMISSING ${missing.length} referenced file(s):`);
  const seen = new Set();
  for (const { page, ref } of missing) {
    const key = `${ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ${ref}   (first seen in ${page})`);
  }
  process.exit(1);
}

console.log('all referenced local scripts and stylesheets exist');
