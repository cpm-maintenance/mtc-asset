# Session Notes — 2026-08-09 (Session 10: Fix Batch + Data Linking + KPI Charts)

## Ringkasan

**Batch fix bug: MTBF/MTTR chart missing, FotoURL invalid (SW error), Performance field linking (equipmentId lowercase), Enterprise KPI data riil, KPI chart canvas sync + modern style, deploy config (Spark plan), Performance form standby/WH auto.**

---

## Baru di Session Ini

### 🐛 Fix: MTBF/MTTR page (06a2e54)
- renderMTBFMTTRChart() + _monthKey() hilang — page referensi fungsi tak ada → tambah di charts.js (trend 6-bulan, lazy chart.js)
- calcMTBFMTTR() getter (mtbfDays/mttrHours/totalEvents)
- cleanUrl() validasi ketat — reject non-http/data/blob + bracket → cegah request invalid

### 🖼️ Fix: FotoURL cleanup (5219f93, b6d2153)
- Scan DB: 17 FotoURL → 12 valid (data URI base64 + i.ibb.co), **5 kosong dihapus**
- Bug database:remove butuh --force (tanpa itu CLI prompt & silent fail)
- Script reusable: scripts/fix-clean-fotourl.mjs

### 🔗 Fix: Performance field linking (1fd984f, 3ed48de)
- **Root cause**: Performance node pakai equipmentId (lowercase), kode filter p.EquipmentID → tak pernah match → data diabaikan
- Fix: (p.equipmentId || p.EquipmentID) di app.js calcMTBFMTTR, charts.js, enterprise-kpi.js (8 refs)
- MTBF/MTTR kini: sum(wh)/sum(freq) atau events dari Performance, fallback HistoryLog

### 📊 KPI Chart kosong (2b54760)
- **Root cause**: KPI.html pakai ID canvas lama (kpiPaVsActual, kpiAreaPa...), renderer cari mtbfChart, mttrChart → tak match → semua Canvas not found
- Fix: page disinkronkan 1:1 ke renderer (9 canvas)
- charts.js: 12 refs p.EquipmentID → (p.equipmentId || p.EquipmentID)

### 🎨 KPI Chart modern + label nama (4a24f35)
- Label pakai getEquipName: "Jaw Crusher" bukan 2220-CR-001
- Style: _gradFill gradient, rounded bars, tension 0.45, point hover radius 6

### 📝 Form Performance (f856589)
- Standby manual dihormati (sebelumnya di-overwrite event)
- WH auto = 24 - bd - stb
- Event Operational = sumber stb otomatis; bd/freq = non-Operational only

### 🚀 Deploy config (4ee333f)
- Hapus functions dari firebase.json — project Spark plan → deploy gagal butuh Blaze

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S10 full batch | ✅ live | 74 files |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 06a2e54 | fix: MTBFMTTR chart + calc + cleanUrl |
| 5219f93 | fix(data): cleanup FotoURL + script |
| b6d2153 | fix(data): --force flag verified |
| 1fd984f | fix: MTBF/MTTR dari Performance |
| 3ed48de | fix: enterprise-kpi 8 refs |
| 4ee333f | chore: hapus functions (deploy) |
| 2b54760 | fix: sync KPI canvas |
| 4a24f35 | style: label nama + chart modern |
| f856589 | fix: perf form standby manual |

## Known Issues

- Data dev minimal: 18 equip, 2 logs, 4 Performance (1 freq>0)
- Browser subagent tak jalan (provider credential) — test manual di browser user

## Next Session

- Isi data nyata (WO, PM schedule, Log breakdown, Performance freq)
- Assign teknisi ke WO

---

# Session Notes — 2026-08-08 (Session 7: Performa P1 + P2 partial + Backup fix)

## Ringkasan

**Eksekusi Phase 1 performa (precompute Map, cache KPI, font preload, render cap) + Phase 2 partial (ImgBB real upload, Cache-Control immutable, migrate base64→URL). Fix backup.js (git diff exit code). Backup + push lengkap.**

---

## Baru di Session Ini

### ⚡ Phase 1 — Performa Quick Win ✅
- **Precompute Map** `equipById`/`partById` — hilangkan `find()` O(n²) di render loop ([src/js/app.js](file:///d:/Coding/MTC-Asset/src/js/app.js), store.js)
- **Cache KPI/HM/MTTR lookup** — kpi-engine.js + logs.js (tak re-calc per baris)
- **Font preload** — index.html (`preload` + `display=swap`)
- **Render cap** — EquipmentDetail log list dibatasi (visibleLogs, default 30)
- PM schedule: targetHM/HM-aware overdue dirapikan

### 🖼️ Phase 2 — Foto + Cache (sebagian ✅)
- **ImgBB real upload** — fix bug blob URL: `uploadToImgBB` kirim ke api.imgbb.com beneran; log photos di-upload ([src/js/modules/logs.js](file:///d:/Coding/MTC-Asset/src/js/modules/logs.js), ui.js)
- **`migrateLegacyImages()`** — pindahkan 12 base64 ImageUploads → URL ImgBB (12/12 sukses); diperluas ke Equipment.FotoURL + HistoryLog.PhotoURLs inline base64; early-return dihapus
- **Cache-Control immutable** — [firebase.json](file:///d:/Coding/MTC-Asset/firebase.json): `/assets/**`+`/icons/**` 1 tahun, sw.js/index no-cache
- Bundle: lazy chunks jspdf/xlsx/sentry/chart terpisah; initial ~300KB gzip

### 🔧 Fix (lanjutan)
- **backup.js** (sebelumnya) — fix git diff exit code

### ⚡ Bundle < 300KB gzip ✅ (Phase 2 selesai)
- Initial **351KB → 252KB gzip** (hemat 28%)
- **qrcode → lazy** `await import('qrcode')` ([ui.js](file:///d:/Coding/MTC-Asset/src/js/modules/ui.js)) — tak lagi statis di initial
- **modulePreload filter** ([vite.config.js](file:///d:/Coding/MTC-Asset/vite.config.js)): jspdf/qrcode/html2canvas/xlsx/sentry tak di-preload eager
- **target: 'esnext'** — skip ES5 transpile, kurangi polyfill

### 🔌 Split Listener (Phase 2) ✅
- HistoryLog/SpareParts/Performance → `onChildAdded` incremental + `limitToLast` (500/500/200)
- Delta sync — tak re-download penuh per tulis; WO detection tetap
- saveCache debounce 250ms + JSON clone (fix `Proxy object could not be cloned` flood)


## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S6 (form+orange+HM+MTBF+PM+spare) | ✅ Live | 73 files |
| S7 P1+P2 (split listener, bundle 252KB, cache fix) | ✅ Live | 74 files, release complete |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 1889346 | perf(P1): precompute Maps + cache KPI/HM/MTTR, font preload, cap render |
| 2dc8398 | perf(P2): ImgBB real upload, Cache-Control immutable, migrate helper |
| d41c22d | feat(P2): migrate extended ke Equipment/Logs base64 |
| 40d8749 | 📦 Backup + push |
| cbed5d9 | perf(P2): split listener onChildAdded + limitToLast + saveCache debounce |
| c97a03b | perf(P2): bundle 351→252KB gzip (qrcode lazy, modulePreload filter, target esnext) |

## Known Issues / Catatan

- Data dev minim (18 equip, 50 parts, 2 logs, 0 PM) — empty state normal
- `.open/skills` submodule dirty — skip commit
- CRLF quirk tetap — edit tools gagal → node script + regex

## Next Session

- [ ] Split HistoryLog/SpareParts/Performance → query Terbatas / bundling
- [ ] Bundle < 300KB gzip (optimasi vendor)
- [ ] Isi data nyata (WO, PM schedule, teknisi)

---

# Session Notes — 2026-08-07 (Session 6: Form Planner + Performa)

## Ringkasan

**Form maintenance planner upgrade (Actual Hours, Completed Date, HM logging, HM-aware MTBF, PM usage-based, spare lifetime hours) + tema gold→orange + flowchart + login fix + analisis performa jangka panjang.** Build pass, 103/103 tests, deploy live (73 files).

---

## Baru di Session Ini

### 🎨 Gold → Orange
- `--nexus-accent` `#f5c542` → `#ff8c1a`, `--nexus-accent-2` `#c9a227` → `#ffb74d` ([style.css](file:///d:/Coding/MTC-Asset/src/css/style.css))
- charts.js night accent → orange, swatch dropdown → orange

### 🔐 Login
- Input ID + Secure Key teks hitam (`#login-id`/`#login-key`, `!important` override `.glass`)

### 📊 Flowchart
- [docs/FLOWCHART.md](file:///d:/Coding/MTC-Asset/docs/FLOWCHART.md) (4 mermaid diagrams)
- [public/flowchart.html](file:///d:/Coding/MTC-Asset/public/flowchart.html) (5 section render via mermaid CDN, tema orange)

### 📝 Form Improvement (Maintenance Planner)
- **LogModal**: `Actual Hours` + `Completed Date` (auto-fill saat status → Completed, max=today)
- **LogModal**: `Running Hours (HM)` field (grid 3→4 kolom) — `logForm.hm` sudah persist (`HM:`)
- **Equipment**: `Current HM (Meter)` + equipment.js save `CurrentHM`; `current` di DEFAULT + edit-init
- **EquipmentDetail**: header Current HM + Last Log HM (`getLastHM()` di logs.js), chip HM per log row
- **MTBF/MTTR**: `_hmIntervalHours()` di kpi-engine — pakai delta HM antar breakdown bila ada, fallback kalender
- **PM Schedule usage-based**: `basis` (`calendar`/`hours`) + `intervalHours`; `generateNextPM()` hitung `targetHM` (max(lastLog.HM, equip.CurrentHM) + interval); `isPMOverdue` HM-aware (`pmCurrentHM()`); detail modal tampil Trigger/Target HM/Now HM; DEFAULT_PM_FORM + save payload
- **Spare**: `avgLifetimeHours` (init/edit/save/default, grid 3→4) — [SparePartsModal](file:///d:/Coding/MTC-Asset/public/components/modals/SparePartsModal.html) + index

### 🚀 Analisis Performa (skill: performance-engineer + web-performance-optimization)
- Bundle 1.48MB raw / ~440KB gzip (vendor 508K, jspdf 421K, firebase 286K, main 200K)
- **Akar masalah**: 9 realtime listener muat SELURUH dataset (Equipment/HistoryLog/SpareParts/Performance) — tiap 1 tulis → full re-download + sort 5000+ logs
- **Render O(n²)**: `filter`/`find`/`calc` di dalam `x-for` (EquipmentDetail dll)
- Laporan lengkap: `PERFORMANCE_ANALYSIS.md` (brain dir)
- Task list 3 phase di TASK.md (Quick Win / Menengah / Arsitektur)

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S5 (63b6d86) | ✅ Live | 72 files |
| S6 (form+orange+HM+MTBF+PM+spare) | ✅ Live | 73 files |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 63b6d86 | S5: themes, fonts, bottom nav |

## Known Issues / Catatan

- CRLF quirk tetap — edit tools gagal di CRLF files → node `.mjs` + regex `\r?\n`
- 9 realtime listener global = bottleneck utama jangka panjang → Phase 2
- `hmStart`/`hmEnd` delta **SKIP** — bertabrakan dengan semantik HM absolut (MTBF/targetHM/CurrentHM butuh meter utuh)
- Data dev minim (18 equip, 50 parts, 2 logs, 0 PM) — empty state normal

## Next Session

- [ ] Eksekusi Phase 1 performa (precompute Map, font preload, limit render)
- [ ] Phase 2: split listener, base64 foto → URL, patch node
- [ ] Isi data nyata (WO teknik, PM schedule, assign teknisi)

---

# Session Notes — 2026-08-07 (Session 5)

## Ringkasan

**4 tema (Gold/Navy/Purple/Light) + form font themed + mobile bottom nav fix + deploy live.** Build pass + 103/103 tests. Commit `63b6d86`.

---

## Baru di Session Ini

### 🎨 Multi-Theme (4 tema) ✅
- **Dropdown theme** di header (icon moon/sun) → menu 4 pilihan: Gold, Navy, Purple, Light (swatch warna)
- **CSS vars per tema**: `--nexus-accent`, `--nexus-accent-2`, `--nexus-accent-glow`, `--nexus-border`, `--text-main`, `--text-muted`, `--nexus-bg`, `--nexus-card`
- **ui.js**: `toggleDarkMode()` → `setTheme(t)`; `applyTheme()` set `data-theme` (night→dark mapping) + sync `darkMode` untuk charts
- **charts.js**: helper `themeAccent()`/`themeAccentSoft()`/`themeGrid()` — chart warna ikut tema (gold/navy/purple/blue)
- **Tema palette**:
  - Gold (`night`): accent `#f5c542`, bg `#05070a`
  - Navy: accent `#3b82f6`, bg `#0a0f1e`
  - Purple: accent `#a855f7`, bg `#0d0714`
  - Light: accent `#0061ff` (tetap)

### 🔤 Form Font Themed ✅
- Input/select/textarea: override `text-white`/`text-slate-400` hardcoded → `var(--text-main)`
- Placeholder → `var(--text-muted)`
- `select option` → bg `var(--nexus-card)` + text `var(--text-main)`
- `color-scheme: dark/light` per tema (dropdown arrow, date picker native)

### 📱 Mobile Bottom Nav Fix ✅
- **Masalah**: 15 item render di nav 390px (sempit, tanpa label) — P0 5-slot hilang/ke-revert
- **Fix**: grid 5 kolom (Home, WO, Assets, Parts + More) + **More modal** (bottom sheet, grid 4 kolom, 15 item)
- Getter `mobilePrimaryItems` + field `short` label per menu item
- Safe-area-inset untuk notch iPhone

### 🧹 Housekeeping
- Hapus scratch/ (32 file script patch + screenshots)
- Commit file untracked lama yang belum pernah di-commit (5 pages HTML, db.js, icons.js, lucide-icons.js, audit.js) — diverifikasi DIPAKAI via component-loader fetch `/pages/{name}.html`

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| mtc-asset.web.app (hosting) | ✅ Live (S5) | 72 files, release complete |




## Session 9 — Performa P0-P2 (2026-08-08)

### Analisa Mendalam (desktop + mobile)
- Baseline: initial 252KB gzip; chart/jspdf/qrcode/sentry/all lazy; listener split (Phase 2)
- Laporan lengkap: PERFORMANCE_ANALYSIS_2.md
- Temuan: foto equipment eager (mobile data), cropper CDN render-blocking, page fragments network-first, search full-filter per keystroke

### P0 ✅ (ab6db7b) — Mobile image + render-blocking
- Lazy-load foto: `loading="lazy"` + `decoding="async"` (Equipment.html, EquipmentDetail.html, AllLogs.html)
- CropperJS CDN sinkron → dynamic load on-demand di showCropModal (hapus render-blocking dari head index.html)

### P1 ✅ (35ba9fa) — Page cache + render scale
- SW stale-while-revalidate untuk /pages/** (component-loader) — switch page instan
- Alpine `x-model.debounce.150ms` di search equip/parts/WO — full-filter tak per keystroke

### P2 ✅ (d89e4a4, 3b786fa) — Cost/robustness
- Split jspdf SVG chain (canvg+dompurify) → chunk lazy `pdfdeps` — **vendor 151.5→104.7KB gzip, initial ~212KB**
- RUM: PerformanceObserver → Sentry (LCP/FID/CLS/INP/TTFB, produksi only, passive, 0 dep)
- index.html shell split — **skipped** (YAGNI: modal shells + navigasi, bukan page fragment; 104KB di-cache SW)

### Deploy
| Deploy | Status | Catatan |
|--------|--------|---------|
| S8 fix (PDF, SW fallback, QR All) | ✅ Live | 74 files |
| S9 P0-P2 (lazy img, SW page cache, vendor 104K, RUM) | ✅ Live | 74 files |

### Commits
| Hash | Deskripsi |
|------|-----------|
| 5dda807 | fix: structuredClone → JSON clone (Proxy error, PDF export) |
| 3cc6992 | feat: QR All PDF |
| 2654119 | fix(sw): navigation fallback |
| ca1997c | chore: remove scratch/ |
| ab6db7b | perf(P0): lazy images + cropper async |
| 35ba9fa | perf(P1): SW page SWR + search debounce |
| d89e4a4 | perf(P2): pdfdeps chunk, vendor 151→105KB |
| 3b786fa | feat(P2): RUM web-vitals → Sentry |
| 21955d1 | docs: mark P0 done |

### Catatan
- Initial gzip: **252 → 212KB** (sesudah P2)
- Verify RUM: Sentry → event "web-vitals" (extra: LCP/FID/CLS/INP/TTFB)
- Data dev minim tetap (18 equip, 50 parts, 2 logs, 0 PM)
