import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function upsert(fp, prepend, anchor) {
  let s = fs.readFileSync(fp, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  if (anchor && s.includes(anchor)) {
    s = s.replace(anchor, prepend + anchor);
  } else {
    s = prepend + s;
  }
  fs.writeFileSync(fp, s.split('\n').join(eol));
  console.log('updated:', fp);
}

// ── 1. SESSION_NOTES.md ──
const notesLines = [
'# Session Notes — 2026-08-09 (Session 10: Fix Batch + Data Linking + KPI Charts)',
'',
'## Ringkasan',
'',
'**Batch fix bug: MTBF/MTTR chart missing, FotoURL invalid (SW error), Performance field linking (equipmentId lowercase), Enterprise KPI data riil, KPI chart canvas sync + modern style, deploy config (Spark plan), Performance form standby/WH auto.**',
'',
'---',
'',
'## Baru di Session Ini',
'',
'### 🐛 Fix: MTBF/MTTR page (06a2e54)',
'- renderMTBFMTTRChart() + _monthKey() hilang — page referensi fungsi tak ada → tambah di charts.js (trend 6-bulan, lazy chart.js)',
'- calcMTBFMTTR() getter (mtbfDays/mttrHours/totalEvents)',
'- cleanUrl() validasi ketat — reject non-http/data/blob + bracket → cegah request invalid',
'',
'### 🖼️ Fix: FotoURL cleanup (5219f93, b6d2153)',
'- Scan DB: 17 FotoURL → 12 valid (data URI base64 + i.ibb.co), **5 kosong dihapus**',
'- Bug database:remove butuh --force (tanpa itu CLI prompt & silent fail)',
'- Script reusable: scripts/fix-clean-fotourl.mjs',
'',
'### 🔗 Fix: Performance field linking (1fd984f, 3ed48de)',
'- **Root cause**: Performance node pakai equipmentId (lowercase), kode filter p.EquipmentID → tak pernah match → data diabaikan',
'- Fix: (p.equipmentId || p.EquipmentID) di app.js calcMTBFMTTR, charts.js, enterprise-kpi.js (8 refs)',
'- MTBF/MTTR kini: sum(wh)/sum(freq) atau events dari Performance, fallback HistoryLog',
'',
'### 📊 KPI Chart kosong (a5e0b37)',
'- **Root cause**: KPI.html pakai ID canvas lama (kpiPaVsActual, kpiAreaPa...), renderer cari mtbfChart, mttrChart → tak match → semua Canvas not found',
'- Fix: page disinkronkan 1:1 ke renderer (9 canvas)', 
'- charts.js: 12 refs p.EquipmentID → (p.equipmentId || p.EquipmentID)',
'',
'### 🎨 KPI Chart modern + label nama (4135dcc)',
'- Label pakai getEquipName: "Jaw Crusher" bukan 2220-CR-001',
'- Style: _gradFill gradient, rounded bars, tension 0.45, point hover radius 6',
'',
'### 📝 Form Performance (27a6c87)',
'- Standby manual dihormati (sebelumnya di-overwrite event)',
'- WH auto = 24 - bd - stb',
'- Event Operational = sumber stb otomatis; bd/freq = non-Operational only',
'',
'### 🚀 Deploy config (eb6cc30)',
'- Hapus functions dari firebase.json — project Spark plan → deploy gagal butuh Blaze',
'',
'## Deploy Status',
'',
'| Deploy | Status | Catatan |',
'|--------|--------|---------|',
'| S10 full batch | ✅ live | 74 files |',
'',
'## Commits',
'',
'| Hash | Deskripsi |',
'|------|-----------|',
'| 06a2e54 | fix: MTBFMTTR chart + calc + cleanUrl |',
'| 5219f93 | fix(data): cleanup FotoURL + script |',
'| b6d2153 | fix(data): --force flag verified |',
'| 1fd984f | fix: MTBF/MTTR dari Performance |',
'| 3ed48de | fix: enterprise-kpi 8 refs |',
'| 4ee333f | chore: hapus functions (deploy) |',
'| 2b54760 | fix: sync KPI canvas |',
'| 4a24f35 | style: label nama + chart modern |',
'| f856589 | fix: perf form standby manual |',
'',
'## Known Issues',
'',
'- Data dev minimal: 18 equip, 2 logs, 4 Performance (1 freq>0)',
'- Browser subagent tak jalan (provider credential) — test manual di browser user',
'',
'## Next Session',
'',
'- Isi data nyata (WO, PM schedule, Log breakdown, Performance freq)',
'- Assign teknisi ke WO',
'',
'---',
'',
''
];

upsert(
  path.join(ROOT, 'SESSION_NOTES.md'),
  notesLines.join('\n'),
  '# Session Notes — 2026-08-08'
);

// ── 2. TASK.md ──
const taskLines = [
'## ✅ Selesai Hari Ini (S10, 2026-08-09)',
'',
'- [x] Fix MTBF/MTTR page (chart missing, calc missing) — 06a2e54',
'- [x] Cleanup FotoURL invalid (5 kosong, script reuse) — b6d2153',
'- [x] Performance field linking equipmentId — 1fd984f, 3ed48de',
'- [x] KPI canvas sync (kosong → render) — 2b54760',
'- [x] KPI chart modern + label nama — 4a24f35',
'- [x] firebase.json functions removal (Spark) — 4ee333f',
'- [x] Perf form: standby manual + WH auto — f856589',
'- [x] Deploy batch live ✅',
'',
];

upsert(path.join(ROOT, 'TASK.md'), taskLines.join('\n'), '## 📊 Isi Data Nyata');

console.log('SESSION_NOTES.md + TASK.md updated');
