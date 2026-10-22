import esbuild from 'esbuild';

const isProd = process.env.NODE_ENV === 'production';

// Bundle with ESM + tree-shaking — admin.js imports 4 split modules, bundled into single hashed file
const result = await esbuild.build({
  entryPoints: {
    'admin': 'js/admin.js',
    'main': 'js/main.js',
    'search': 'js/search.js',
    'product-detail': 'js/product-detail.js',
    'auction': 'js/auction.js',
  },
  bundle: true,
  // ⚠️ CRITICAL — DO NOT TURN identifier mangling back on.
  // These bundles are loaded as CLASSIC <script> tags (not ES modules), so every
  // top-level function becomes a property of `window`. If esbuild shortens names
  // (U, M, L, ...) two bundles can define the SAME short name and overwrite each
  // other — that caused the "Cannot read properties of undefined (reading
  // 'deliveryOption')" / "M is not a function" bugs. Keep real names, only strip
  // whitespace + simplify syntax.
  minify: false,
  minifyWhitespace: isProd,
  minifySyntax: isProd,
  minifyIdentifiers: false,
  sourcemap: true,
  target: 'es2018',
  outdir: 'dist',
  entryNames: '[name]-[hash]',
  metafile: true,
  logLevel: 'info',
  format: 'esm',
});

console.log('Build complete — admin bundled (4 modules tree-shaken) + hashed dist for immutable cache');
// Write metafile for debugging
import { writeFileSync } from 'fs';
writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
