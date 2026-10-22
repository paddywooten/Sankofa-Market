#!/usr/bin/env node
/**
 * Rewrite /dist/<entry>-<hash>.js references in HTML after an esbuild run.
 *
 * esbuild emits content-hashed filenames, so the hash changes whenever an entry
 * bundle changes. The HTML files reference those bundles with a hard-coded hash,
 * which would break the moment we rebuild. This script reads dist/meta.json
 * (written by esbuild.config.js) and repoints every reference at the new name.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

const metaPath = 'dist/meta.json';
let meta;
try {
  meta = JSON.parse(readFileSync(metaPath, 'utf8'));
} catch (err) {
  console.error(`Cannot read ${metaPath} — run "node esbuild.config.js" first.`);
  process.exit(1);
}

// entryPoint "js/main.js" -> output "main-TOATJ45B.js"
const mapping = new Map();
for (const [outFile, info] of Object.entries(meta.outputs || {})) {
  if (!info.entryPoint || !outFile.endsWith('.js')) continue;
  const entryName = basename(info.entryPoint, extname(info.entryPoint));
  mapping.set(entryName, basename(outFile));
}

if (mapping.size === 0) {
  console.error('No entry bundles found in dist/meta.json');
  process.exit(1);
}

const SKIP = new Set(['node_modules', '.git', 'dist']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.html') files.push(p);
  }
})('.');

let changedFiles = 0;
let changedRefs = 0;

for (const file of files) {
  let html = readFileSync(file, 'utf8');
  const before = html;
  for (const [entry, newName] of mapping) {
    const pattern = new RegExp(`/dist/${entry}-[A-Za-z0-9_]+\\.js`, 'g');
    html = html.replace(pattern, (match) => {
      if (match === `/dist/${newName}`) return match; // already correct
      changedRefs += 1;
      return `/dist/${newName}`;
    });
  }
  if (html !== before) {
    writeFileSync(file, html);
    changedFiles += 1;
    console.log(`  updated ${relative('.', file)}`);
  }
}

console.log(`dist refs rewritten: ${mapping.size} bundles, ${changedRefs} references in ${changedFiles} HTML file(s)`);
for (const [entry, name] of mapping) console.log(`  ${entry.padEnd(16)} -> dist/${name}`);
