# TASK LIST — MTC-Asset — Session 7 (2026-08-08)

> **Baseline**: S6 (form+orange+HM+MTBF+PM+spare) live 73 files. 103/103 tests.
> Hari ini: full backup ✅ + review histori ✅ → lanjut task pending.

---

## ✅ Selesai Hari Ini (S7)

- [x] Full backup (Firebase dump + commit `7d24aeb` + push GitHub) — 89 records
- [x] Fix bug [scripts/backup.js](file:///d:/Coding/MTC-Asset/scripts/backup.js) — `git diff --cached --quiet` exit 1 salah dianggap error → commit/push skip
- [x] Review histori project (kemarin: S5 themes + bottom nav, S6 form planner + performa)

## 🚀 Phase 1 — Quick Win Performa ✅ (< 1 hari)

- [x] Precompute Map `equipById`/`partById` — `_partMap()` (app.js), `_critMap`, `_ganttEqMap` (pm-schedule) — hilangkan `find()` O(n²)
- [x] Cache hasil filter/calc — `getLastHM` (logs.js), `calculateHealthScore`/`calculateMTBF` (kpi-engine, `_kpiCache`), `mttrByTech` (app.js), `pmCurrentHM` (pm-schedule) — invalidasi via array ref
- [x] Font: preload + preconnect Google Fonts di index.html, hapus `@import` render-blocking di style.css
- [x] Batasi render: `visibleEquipLogs` (EquipmentDetail, cap 50 + load more lokal `detailLogLimit`)
- [x] Verifikasi `jspdf` lazy — ✅ sudah `await import('jspdf')` (chunk 421KB terpisah, tidak di main)

## Phase 2 — Menengah ✅ (selesai)

- [x] **Foto base64 → URL ImgBB** — `uploadToImgBB` di-fix (upload beneran ke api.imgbb.com), log photos di-upload (fix bug blob URL), `migrateLegacyImages()` pindahkan 12 base64 → URL (12/12 sukses)
- [x] Patch node per tulis — ✅ sudah (`set`/`update` per-id, bukan resubmit dataset)
- [x] Cache-Control immutable — firebase.json: `/assets/**`+`/icons/**` cache 1 tahun, sw.js/index no-cache
- [x] **Split HistoryLog/SpareParts/Performance → query Terbatas** — ✅ `onChildAdded` incremental + `limitToLast` (HistoryLog 500, SpareParts 500, Performance 200); delta sync, tak re-download penuh per tulis; WO detection tetap; saveCache debounce 250ms + JSON clone (fix Proxy clone flood)
- [x] **Bundle < 300KB gzip** — ✅ initial 351KB → **252KB gzip** (qrcode lazy, jspdf/qrcode/html2canvas/xlsx/sentry tak di-preload, `target: esnext` + `modulePreload.resolveDependencies` filter)

## Deploy Status

| Item | Status |
|------|--------|
| S5 (63b6d86) | ✅ live |
| S6 form+orange+HM+MTBF+PM+spare | ✅ live (73 files) |
| S7 P1+P2 (split listener, bundle 252KB, cache fix) | ✅ live (74 files, c97a03b) |
| S8 fix (PDF export, SW fallback, QR All) | ✅ live (74 files, 2654119) |

## 📋 Progress Hari Ini (S8, 2026-08-08)

- [x] Backup full + push (d5712ae) — Firebase 77 records
- [x] Fix PDF export — `structuredClone` → JSON clone (Proxy error) — 5dda807
- [x] Fix SW navigation fallback — page miss → index.html — 2654119
- [x] Fitur QR All — PDF A4 landscape grid 3×5 semua equipment — 3cc6992
- [x] Analisa performa mendalam (desktop + mobile) — PERFORMANCE_ANALYSIS_2.md
- [x] Task list Quick Win P0/P1/P2 dibuat

## 🎯 Quick Win Performa (Analisa S7 — desktop & mobile)

> Baseline: initial 252KB gzip, chart/jspdf/qrcode lazy, listener split. Analisa penuh: `PERFORMANCE_ANALYSIS_2.md`.

### P0 (30 min) — Mobile image + render-blocking ✅ (selesai, ab6db7b)
- [x] Lazy-load foto equipment: `loading="lazy"` + `decoding="async"` (Equipment.html, EquipmentDetail.html, AllLogs.html)
- [x] CropperJS CDN sinkron → dynamic load on-demand (hapus script render-blocking di index.html) — main gzip tetap 56.6KB

### P1 (2 jam) — Page cache + render scale ✅ (selesai, 35ba9fa)
- [x] SW cache page fragments `pages/**` stale-while-revalidate (switch page tanpa network round-trip)
- [x] `filteredEquip`/`searchPart`/`searchWO` + Alpine `x-model.debounce.150ms` (hindari full-filter per keystroke)

### P2 (nanti) — Cost/robustness
- [x] ~~Belah index.html shell~~ — **skipped** (template = modal shells + navigasi, bukan page fragment; splitting = risiko tinggi, benefit kecil — 104KB di-cache SW)
- [x] RUM web-vitals — PerformanceObserver → Sentry (LCP/FID/CLS/INP/TTFB, produksi only) — 3b786fa
- [x] Pisah canvg+dompurify ke chunk `pdfdeps` lazy — vendor 151.5→104.7KB gzip, initial ~212KB — d89e4a4

## 📊 Isi Data Nyata

- [ ] Assign teknisi ke WO (Workload page)
- [ ] Input PM schedule (Monthly Plan) — 0 PM saat ini
- [ ] Tambah HistoryLog riil (baru 2 log)

## 🔧 Perbaikan Lainnya

- [ ] Audit trail capture (AuditTrail masih kosong — helper `logAudit`, page, hook login/logout SUDAH ada; kurang call di aksi CRUD)
- [ ] Cek deploy workflow .github (line-ending modified)
- [ ] Backup otomatis harian 02:00 WIB — verifikasi GitHub Actions jalan
