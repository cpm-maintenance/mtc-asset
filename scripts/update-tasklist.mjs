import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'TASK.md');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

s = s.replace(
  `### Phase C — Operasional (bulan ini)
- [ ] **WO aging + SLA alert** — WO > X hari → FCM push + badge
- [ ] **Spare reorder** — MinStock tercapai → auto buat requisition
- [ ] **Audit trail aktif** — panggil logAudit di semua aksi CRUD (ISO 14224/SMRP)
- [ ] **Normalisasi field** equipmentId vs EquipmentID — satu konvensi + migrasi`,
  `### Phase C — Operasional (bulan ini) ✅ SELESAI (5e805b9)
- [x] **WO aging + SLA alert** — notif WO pending > 3 hari (badge umur sudah ada) — 5e805b9
- [x] **Spare reorder** — autoReorderLowStock: Stok<=MinStock → requisition otomatis (skip yg pending) — 5e805b9
- [x] **Audit trail aktif** — logAudit di Equipment, Logs/WO, Parts, PM, Performance, Requisition + rules AuditTrail — 5e805b9
- [x] **Normalisasi field** — helper equipIdOf() + fix rules PM .indexOn (EquipmentID→equipmentId) — 5e805b9`
);

s = s.replace(
  `### Phase D — Skala (nanti)
- [ ] Equipment hierarchy (plant → area → unit → komponen)
- [ ] Offline sync conflict resolution (last-write-wins + audit)
- [ ] Export Excel multi-sheet lengkap
- [ ] Warranty & lifespan tracker (TglInstalasi + avgLifetime → overdue)`,
  `### Phase D — Skala (nanti) ✅ SELESAI (2ca2b79)
- [x] Equipment hierarchy — tree view Area → Tipe → Asset (toggle di Equipment page) — 2ca2b79
- [x] Offline sync conflict — last-write-wins (skip overwrite server lebih baru) — 2ca2b79
- [x] Export Excel multi-sheet — 6 sheet + Summary, tombol header — 2ca2b79
- [x] Warranty & lifespan — notif part melewati avgLifetimeDays — 2ca2b79`
);

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('TASK.md updated');
