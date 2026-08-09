import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── 1. performance.js: tambah filter equipment/area di getFilteredPerfData ──
const perfFile = path.join(ROOT, 'src', 'js', 'modules', 'performance.js');
let p = fs.readFileSync(perfFile, 'utf8');
const eolP = p.includes('\r\n') ? '\r\n' : '\n';
p = p.replace(/\r\n/g, '\n');

const oldGet = `    getFilteredPerfData() {
        // Guard - return empty array safely
        const perfData = this.performanceData;
        if (!perfData || !Array.isArray(perfData)) return [];

        // If no filter date, return all data
        const ref = this.kpiFilterDate;
        if (!ref) return perfData;`;

const newGet = `    getFilteredPerfData() {
        // Guard - return empty array safely
        const perfData = this.performanceData;
        if (!perfData || !Array.isArray(perfData)) return [];

        // Filter equipment + area (dari page Performance)
        const eq = this.perfFilterEquip;
        const area = this.perfFilterArea;
        let data = perfData;
        if (eq) data = data.filter(p => p && (p.equipmentId || p.EquipmentID) === eq);
        if (area) data = data.filter(p => p && (p.area || '') === area);

        // If no filter date, return all data
        const ref = this.kpiFilterDate;
        if (!ref) return data;`;

if (p.includes(oldGet)) {
  p = p.replace(oldGet, newGet);
  // update referensi perfData di bawah (sudah jadi `data`)
  p = p.replace(/return perfData\.filter/g, 'return data.filter');
  p = p.replace(/perfData\.filter\(p => \{/g, 'data.filter(p => {');
  console.log('✓ performance.js: filter equip/area added');
} else {
  console.log('✗ performance.js pattern NOT found');
}

fs.writeFileSync(perfFile, p.split('\n').join(eolP));

// ── 2. app.js: state perfFilterEquip/perfFilterArea ──
const appFile = path.join(ROOT, 'src', 'js', 'app.js');
let a = fs.readFileSync(appFile, 'utf8');
const eolA = a.includes('\r\n') ? '\r\n' : '\n';
a = a.replace(/\r\n/g, '\n');

const oldState = `        kpiFilter: 'yearly',
        kpiFilterDate: new Date().getFullYear().toString(),`;

const newState = `        kpiFilter: 'yearly',
        kpiFilterDate: new Date().getFullYear().toString(),
        perfFilterEquip: '',
        perfFilterArea: '',`;

if (a.includes(oldState)) {
  a = a.replace(oldState, newState);
  console.log('✓ app.js: state perfFilter added');
} else {
  console.log('✗ app.js state pattern NOT found');
}

fs.writeFileSync(appFile, a.split('\n').join(eolA));

console.log('done');
