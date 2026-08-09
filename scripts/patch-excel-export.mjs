import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const fp = path.join(ROOT, 'src', 'js', 'modules', 'export.js');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

// D1: exportExcelFull — workbook multi-sheet
const method = `
    // D1: Export Excel lengkap — multi-sheet (Equipment, SpareParts, Logs, Performance, PM, Requisitions)
    async exportExcelFull() {
        const XLSX = await loadXLSX();
        const raw = (arr) => window.Alpine?.raw ? window.Alpine.raw(arr || []) : (arr || []);
        const wb = XLSX.utils.book_new();

        const sheets = [
            ['Equipment', raw(this.equipment)],
            ['SpareParts', raw(this.allParts).map(p => ({ ...p, EquipmentIDs: Array.isArray(p.EquipmentIDs) ? p.EquipmentIDs.join(', ') : p.EquipmentIDs }))],
            ['HistoryLog', raw(this.logs).map(l => ({ ...l, PartsUsed: typeof l.PartsUsed === 'string' ? l.PartsUsed : JSON.stringify(l.PartsUsed || []) }))],
            ['Performance', raw(this.performanceData).map(p => ({ ...p, events: typeof p.events === 'string' ? p.events : JSON.stringify(p.events || []) }))],
            ['PM_Schedule', raw(this.pmList)],
            ['Requisitions', raw(this.requisitions)],
        ];

        for (const [name, data] of sheets) {
            const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
        }

        // Summary sheet
        const logs = raw(this.logs);
        const totalCost = logs.reduce((s, l) => s + (Number(l.Cost) || 0), 0);
        const totalDowntime = logs.reduce((s, l) => s + (Number(l.Downtime) || 0), 0);
        const summary = [
            ['MTC-Asset Export', new Date().toISOString()],
            [],
            ['Total Equipment', raw(this.equipment).length],
            ['Total SpareParts', raw(this.allParts).length],
            ['Total Logs/WO', logs.length],
            ['Total Performance', raw(this.performanceData).length],
            ['Total PM Schedule', raw(this.pmList).length],
            ['Total Requisitions', raw(this.requisitions).length],
            [],
            ['Total Maintenance Cost', totalCost],
            ['Total Downtime (hrs)', totalDowntime],
        ];
        const wsSum = XLSX.utils.aoa_to_sheet(summary);
        XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'MTC_Asset_Full_' + new Date().toISOString().split('T')[0] + '.xlsx';
        a.click();
        this.showNotification?.('Excel lengkap diekspor');
    },
`;

const anchor = '    async downloadTemplate(type) {';
if (s.includes(anchor)) {
  s = s.replace(anchor, method + '\n' + anchor);
  console.log('✓ exportExcelFull added');
} else {
  console.log('✗ anchor NOT found');
}

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('export.js saved');
