# TASK LIST — MTC-Asset — Form Planner + Performa (S6, 2026-08-07)

> **Baseline**: S5 (63b6d86). 103/103 tests. Tema gold diubah → perpaduan orange.

---

## 🎨 Gold → Orange ✅

- [x] `--nexus-accent` #f5c542 → #ff8c1a, `--nexus-accent-2` → #ffb74d (style.css)
- [x] charts.js accent night → orange, swatch dropdown gold → orange

## 🔐 Login Fields ✅

- [x] ID + Secure Key input text hitam (override `.glass`, `!important`)

## 📊 Flowchart ✅
- [x] docs/FLOWCHART.md (4 diagram mermaid)
- [x] public/flowchart.html (5 section render live, tema orange)

## 📝 Form Improvement (Maintenance Planner) ✅
- [x] LogModal: Actual Hours + Completed Date (auto-fill saat Completed)
- [x] LogModal: Running Hours (HM) field (grid 4 kolom)
- [x] Equipment: Current HM (Meter) + equipment.js save `CurrentHM`
- [x] EquipmentDetail: Current HM + Last Log HM + HM chip di log
- [x] MTBF/MTTR HM-aware (`_hmIntervalHours`, fallback kalender)
- [x] PM Schedule: basis (`calendar`/`hours`) + intervalHours + targetHM + overdue HM-aware
- [x] Spare: `avgLifetimeHours` (init/save/default/UI grid 3→4)

## 🚀 PERFORMANCE (Task List Jangka Panjang)

### Phase 1 — Quick Win (< 1 hari)
- [ ] Precompute Map `equipById`/`partById` — hilangkan `find()` O(n²) di render loop
- [ ] Cache hasil filter/calc (`logsForEquip`, `healthScores`) — render tak ulang per baris
- [ ] Font: `preload` + `display=swap` + subset utk LCP 3G
- [ ] Batasi render: `x-for` > 50 baris pakai slice/chunk
- [ ] Verifikasi `jspdf` lazy (dynamic import)

### Phase 2 — Menenga (1-2 hari)
- [ ] Split HistoryLog/SpareParts/Performance → query Terbatas / fetch periodik
- [ ] Foto base64 → URL Storage/ImgBB (node hemat)
- [ ] Patch node per tulis (bukan resubmit dataset)
- [ ] Cache-Control immutable (aset PWA)
- [ ] Bundle < 300KB gzip

### Phase 3 — Arsitektur
- [ ] Time-series (HistoryLog, Performance) ke Firestore
- [ ] AI/key card ke server function
- [ ] RUM web-vitals → Analytics/Sentry
- [ ] IndexedDB source-of-truth + sync bg
- [ ] Perf budget CI

## Deploy Status

| Item | Status |
|------|--------|
| S5 (63b6d86) | ✅ live |
| S6 form+orange+HM+MTBF+PM+spare | ✅ live (73 files) |

## Known Issues

- CRLF quirk tetap — edit tools gagal di CRLF files → node `.mjs` + regex `\r?\n`
- 9 realtime listener muat seluruh dataset (Equipment/HistoryLog/SpareParts/Performance) → target utama Phase 2
- Data dev minim → beberapa page empty state

## Next Session
- [ ] Eksekusi Phase 1 performa
- [ ] Isi data nyata (WO teknik, PM schedule)
