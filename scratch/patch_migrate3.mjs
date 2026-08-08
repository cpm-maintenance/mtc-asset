import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');

const old = `            const uploads = snap.val() || {};
            const ids = Object.keys(uploads);
            if (!ids.length) { console.log('[Migrate] No ImageUploads found'); return results; }
            console.log('[Migrate] Found', ids.length, 'legacy images');`;

const repl = `            const uploads = snap.val() || {};
            const ids = Object.keys(uploads);
            if (!ids.length) {
                console.log('[Migrate] No ImageUploads — continuing with inline base64 (Equipment/Logs)');
            } else {
                console.log('[Migrate] Found', ids.length, 'legacy images');
            }`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: removed early return — migration continues to Equipment/Logs');
