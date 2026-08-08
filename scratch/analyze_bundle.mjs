import { readFileSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';

// 1. What does vendor import?
const v = readFileSync('dist/assets/vendor-2xEMJGZy.js', 'utf8');
const imports = [...new Set([...v.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map(m => m[1]))];
console.log('vendor imports:', imports.join(', '));

// 2. Is core-js/babel in vendor? measure by symbols
const coreRefs = (v.match(/core-js/g) || []).length;
console.log('vendor "core-js" refs:', coreRefs);

// 3. Which entry imports jspdf statically (preload but tree remains)?
const idx = readFileSync('dist/index.html', 'utf8');
const preloads = [...idx.matchAll(/modulepreload[^>]*href="\/(assets\/[^"]+)"/g)].map(m => m[1]);
console.log('preloads:', preloads.join(', '));

// 4. Measure each preload gzip
let total = 0;
for (const f of preloads) {
  const name = f.replace('assets/', '');
  const b = readFileSync('dist/assets/' + name);
  const g = gzipSync(b).length;
  total += g;
  console.log(name.padEnd(34), g.toString().padStart(7), 'gzip');
}
console.log('--- INITIAL gzip:', total, '(', (total / 1024).toFixed(1), 'KB )');
