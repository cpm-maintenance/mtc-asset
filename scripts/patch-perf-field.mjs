import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'src', 'js', 'modules', 'enterprise-kpi.js');
let src = fs.readFileSync(fp, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
src = src.replace(/\r\n/g, '\n');

const before = src;
// Performance pakai equipmentId (lowercase) — ganti SEMUA filter perf .EquipmentID
// (l.* = HistoryLog, e.* = Equipment — keduanya pakai EquipmentID, biarkan)
src = src.replace(/p\.EquipmentID/g, '(p.equipmentId || p.EquipmentID)');

const count = (before.match(/p\.EquipmentID/g) || []).length;
fs.writeFileSync(fp, src.split('\n').join(eol));
console.log(`enterprise-kpi.js: ${count} replacement p.EquipmentID → (p.equipmentId || p.EquipmentID)`);
