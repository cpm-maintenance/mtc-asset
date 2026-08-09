import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'TASK.md');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

const section = `## 🎯 Task List — Analisis Maintenance Planner (2026-08-09)

> Referensi lengkap: analysis_results.md (brain dir)

### Phase A — Data & Cleanup (hari ini)
- [ ] **Seed data riil** — script node: WO historis 6-12 bln, PM schedule, breakdown events → semua KPI hidup
- [ ] **Migrasi FotoURL base64 → ImgBB** (12/18 equip) — hemat cost RTD + load
- [ ] Hapus public/components/modals/PerformanceModal.html duplikat (modal asli di index.html)

### Phase B — Analitik (minggu ini)
- [ ] **Wire HM → MTBF** — kpi-engine _hmIntervalHours pakai delta HM (bukan kalender)
- [ ] Aktifkan **generateNextPM otomatis** saat data load → PM schedule tak kosong
- [ ] Chart **maintenance cost trend** per equipment/bulan (data Cost di logs sudah ada)

### Phase C — Operasional (bulan ini)
- [ ] **WO aging + SLA alert** — WO > X hari → FCM push + badge
- [ ] **Spare reorder** — MinStock tercapai → auto buat requisition
- [ ] **Audit trail aktif** — panggil logAudit di semua aksi CRUD (ISO 14224/SMRP)
- [ ] **Normalisasi field** equipmentId vs EquipmentID — satu konvensi + migrasi

### Phase D — Skala (nanti)
- [ ] Equipment hierarchy (plant → area → unit → komponen)
- [ ] Offline sync conflict resolution (last-write-wins + audit)
- [ ] Export Excel multi-sheet lengkap
- [ ] Warranty & lifespan tracker (TglInstalasi + avgLifetime → overdue)

`;

const anchor = '## 📊 Isi Data Nyata';
if (s.includes(section)) { console.log('sudah ada, skip'); }
else if (s.includes(anchor)) {
  s = s.replace(anchor, section + anchor);
  fs.writeFileSync(fp, s.split('\n').join(eol));
  console.log('TASK.md: task list analisis ditambahkan');
} else {
  s = s + '\n' + section;
  fs.writeFileSync(fp, s.split('\n').join(eol));
  console.log('TASK.md: task list appended');
}
