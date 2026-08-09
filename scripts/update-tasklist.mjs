import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'TASK.md');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

s = s.replace(
  `### Phase B — Analitik (minggu ini)
- [ ] **Wire HM → MTBF** — kpi-engine _hmIntervalHours pakai delta HM (bukan kalender)
- [ ] Aktifkan **generateNextPM otomatis** saat data load → PM schedule tak kosong
- [ ] Chart **maintenance cost trend** per equipment/bulan (data Cost di logs sudah ada)`,
  `### Phase B — Analitik (minggu ini) ✅ SELESAI (88e2ea3)
- [x] **Wire HM → MTBF** — _breakdownEvents gabung logs+Performance, delta HM — 88e2ea3
- [x] **generateNextPM otomatis** saat load (PM completed 30 hari → next) — 88e2ea3
- [x] Chart **cost trend** — sudah ada (calcCostTrend + costTrendChart), kini terisi data riil`
);

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('TASK.md updated');
