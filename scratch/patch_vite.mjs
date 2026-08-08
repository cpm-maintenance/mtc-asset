import { readFileSync, writeFileSync } from 'fs';

// --- 1. vite.config.js ---
const vp = 'd:/Coding/MTC-Asset/vite.config.js';
let vs = readFileSync(vp, 'utf8').replace(/\r\n/g, '\n');
const vOld = `  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,`;
if (!vs.includes(vOld)) { console.error('VITE PATTERN NOT FOUND'); process.exit(1); }
const vNew = `  build: {
    outDir: 'dist',
    // Modern browsers only: skip ES5 transpile & heavy core-js polyfills (keeps vendor slim)
    target: 'esnext',
    modulePreload: {
      // Don't eagerly preload lazy-only chunks (jspdf/qrcode load on demand)
      resolveDependencies: (filename, deps) => deps.filter(d => !/jspdf|qrcode|html2canvas|xlsx|sentry/.test(d)),
    },
    chunkSizeWarningLimit: 600,`;
vs = vs.replace(vOld, vNew);
writeFileSync(vp, vs.replace(/\n/g, '\r\n'));
console.log('OK vite.config.js');

// --- 2. ui.js: qrcode static → lazy ---
const up = 'd:/Coding/MTC-Asset/src/js/modules/ui.js';
let us = readFileSync(up, 'utf8').replace(/\r\n/g, '\n');
const uOldImport = `import QRCode from 'qrcode';`;
if (!us.includes(uOldImport)) { console.error('UI IMPORT NOT FOUND'); process.exit(1); }
us = us.replace(uOldImport, `// Lazy-load qrcode (only used for QR modal — keeps it out of initial bundle)`);
const uOldUse = `const url = await QRCode.toDataURL(id, {`;
if (!us.includes(uOldUse)) { console.error('UI QR USE NOT FOUND'); process.exit(1); }
us = us.replace(uOldUse, `const QRCode = (await import('qrcode')).default;
            const url = await QRCode.toDataURL(id, {`);
writeFileSync(up, us.replace(/\n/g, '\r\n'));
console.log('OK ui.js (qrcode lazy)');
