import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');
const old = `        historyGetPartNumber(partId) {
            if (!partId || !this.allParts) return '';
            const p = this.allParts.find(a => a.PartID === partId);
            return p ? (p.PartNumber || '') : '';
        },`;
const repl = `        historyGetPartNumber(partId) {
            if (!partId) return '';
            const p = this._partMap().get(partId);
            return p ? (p.PartNumber || '') : '';
        },`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: historyGetPartNumber patched');
