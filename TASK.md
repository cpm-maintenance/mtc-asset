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

## 📊 Isi Data Nyata

- [ ] Assign teknisi ke WO (Workload page)
- [ ] Input PM schedule (Monthly Plan) — 0 PM saat ini
- [ ] Tambah HistoryLog riil (baru 2 log)

## 🔧 Opsional / Perbaikan

- [ ] Audit trail capture (AuditTrail node Firebase masih kosong)
- [ ] Cek deploy workflow .github (line-ending modified)
- [ ] Backup otomatis harian 02:00 WIB — verifikasi GitHub Actions jalan

## Phase 2 — Menenga ✅ (sebagian)

- [x] **Foto base64 → URL ImgBB** — `uploadToImgBB` di-fix (upload beneran ke api.imgbb.com), log photos di-upload (fix bug blob URL), `migrateLegacyImages()` pindahkan 12 base64 → URL (12/12 sukses)
- [x] Patch node per tulis — ✅ sudah (`set`/`update` per-id, bukan resubmit dataset)
- [x] Cache-Control immutable — firebase.json: `/assets/**`+`/icons/**` cache 1 tahun, sw.js/index no-cache
- [ ] Split HistoryLog/SpareParts/Performance → query Terbatas / fetch periodik — **belum** (data kecil, risiko tinggi; target berikutnya)
- [ ] Bundle < 300KB gzip — initial ~300KB (vendor 508K + firebase 286K + main 202K); lazy chunks jspdf/xlsx/sentry/chart sudah terpisah. Sisa optimasi vendor

## Phase 3 — Arsitektur

- [ ] Time-series (HistoryLog, Performance) ke Firestore
- [ ] AI/key card ke server function
- [ ] RUM web-vitals → Analytics/Sentry
- [ ] IndexedDB source-of-truth + sync bg
- [ ] Perf budget CI

---

## Deploy Status

| Item | Status |
|------|--------|
| S5 (63b6d86) | ✅ live |
| S6 form+orange+HM+MTBF+PM+spare | ✅ live (73 files) |

## Known Issues

- CRLF quirk tetap — edit tools gagal di CRLF files → node `.mjs` + regex `\r?\n`
- 9 realtime listener muat seluruh dataset → target utama Phase 2
- Data dev minim → beberapa page empty state
- `.open/skills` = submodule dirty — skip saat commit
