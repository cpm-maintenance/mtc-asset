import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/SESSION_NOTES.md';
let s = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const add = [
  '### ⚡ Bundle < 300KB gzip ✅ (Phase 2 selesai)',
  '- Initial **351KB → 252KB gzip** (hemat 28%)',
  "- **qrcode → lazy** `await import('qrcode')` ([ui.js](file:///d:/Coding/MTC-Asset/src/js/modules/ui.js)) — tak lagi statis di initial",
  '- **modulePreload filter** ([vite.config.js](file:///d:/Coding/MTC-Asset/vite.config.js)): jspdf/qrcode/html2canvas/xlsx/sentry tak di-preload eager',
  "- **target: 'esnext'** — skip ES5 transpile, kurangi polyfill",
  '',
  '### 🔌 Split Listener (Phase 2) ✅',
  '- HistoryLog/SpareParts/Performance → `onChildAdded` incremental + `limitToLast` (500/500/200)',
  '- Delta sync — tak re-download penuh per tulis; WO detection tetap',
  '- saveCache debounce 250ms + JSON clone (fix `Proxy object could not be cloned` flood)',
  ''
].join('\n');

const anchor = '## 🔧 Fix\n- **backup.js** — `git diff --cached --quiet` exit code ditangkap';
if (!s.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

s = s.replace(anchor, '## 🔧 Fix (lanjutan)\n- **backup.js** (sebelumnya) — fix git diff exit code\n\n' + add + '## 🔧 Fix (bundling)');
writeFileSync(p, s.replace(/\n/g, '\r\n'));
console.log('OK SESSION_NOTES updated');
