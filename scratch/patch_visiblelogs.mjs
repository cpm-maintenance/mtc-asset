import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');

// 1. Add detailLogLimit state next to filteredLogs getter
const oldGet = `        get filteredLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            return this.logs.filter(l => l.EquipmentID === this.selectedEquip?.EquipmentID);
        },`;
const newGet = `        detailLogLimit: 50,

        get filteredLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            return this.logs.filter(l => l.EquipmentID === this.selectedEquip?.EquipmentID);
        },

        get visibleEquipLogs() {
            const f = this.filteredLogs;
            return f.slice(0, this.detailLogLimit || 50);
        },

        get detailLogsHasMore() {
            return this.filteredLogs.length > (this.detailLogLimit || 50);
        },

        loadMoreDetailLogs() {
            this.detailLogLimit = (this.detailLogLimit || 50) + 50;
        },`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(oldGet)) { console.error('PATTERN filteredLogs NOT FOUND'); process.exit(1); }
t = t.replace(oldGet, newGet);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: visibleEquipLogs added');
