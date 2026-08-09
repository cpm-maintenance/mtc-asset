import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'src', 'js', 'charts.js');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

const before = s;
// Ganti p.EquipmentID → (p.equipmentId || p.EquipmentID) di seluruh renderKPICharts
// (renderMTBFMTTRChart line 66 sudah benar)
s = s.replace(/p\.EquipmentID/g, '(p.equipmentId || p.EquipmentID)');

const count = (before.match(/p\.EquipmentID/g) || []).length;
fs.writeFileSync(fp, s.split('\n').join(eol));
console.log(`charts.js: ${count} p.EquipmentID → (p.equipmentId || p.EquipmentID)`);
