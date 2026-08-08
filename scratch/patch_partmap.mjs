import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');
// CRLF-aware: normalize to \n, patch, restore \r\n
const old = `historyGetPartName(partId) {
            if (!partId || !this.allParts) return partId;
            const p = this.allParts.find(a => a.PartID === partId);
            return p ? (p.NamaPart || partId) : partId;
        },`;
const repl = `_partMap() {
            if (!this._partLookup || this._partLookupRef !== this.allParts) {
                const byId = new Map();
                (this.allParts || []).forEach(p => { if (p) byId.set(p.PartID, p); });
                this._partLookup = byId;
                this._partLookupRef = this.allParts;
            }
            return this._partLookup;
        },
        historyGetPartName(partId) {
            if (!partId) return partId;
            const p = this._partMap().get(partId);
            return p ? (p.NamaPart || partId) : partId;
        },`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: historyGetPartName patched');
