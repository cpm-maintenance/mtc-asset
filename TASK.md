# TASK LIST — MTC-Asset — Session 4 (2026-08-04)

> **Baseline**: Session 3d selesai — Visual V1-V4 ✅ + Maintenance Inteligence R1,R2,R4,R5,R7 ✅. Deploy live `mtc-asset.web.app`. Build pass + 96/96 tests.
> **Fokus hari ini**: tuntaskan gap R3 + R6 + housekeeping scripts + QA device real.

---

## 🎯 R3 — Part ↔ WO Linkage ✅

- [x] `requisitions` terhubung ke WO id (flow: requisition → WO) — field `woId`/`woNumber` + backlink `reqIds` di WO
- [x] Material availability check sebelum WO dijadwalkan / part di-assign — `checkPartAvailability` + guard approveWO
- [x] Stock deduction otomatis — sudah ada di approveWO (WO) & saveLog (non-WO); dedup jadi `parsePartsUsed` shared
- [x] UI: availability badge di WO card + live badge per item di RequestPart + WO picker + link badge

## 🎯 R6 — Single Source Truth ✅

- [x] Jadikan WO = golden source downtime — `Performance.bd` auto-sync dari WO breakdown (computeBDFromLogs) saat submitLog/completeWO
- [x] Rekonsiliasi — `wh`/`stb` tetap manual (produksi), `bd`+`freq` otomatis dari WO; badge `auto` + tombol Sync BD di Performance; fix bug calcDowntime (bd+stb → bd)

## 🧹 Housekeeping — Bersihkan scripts/*.mjs ✅

- [x] Hapus helper lama: 15 file .mjs (regroup-menu s/d scan) — commit ed653dc
- [x] Keep: backup-firebase.js, backup.js, backup.bat
- [x] Update `scripts/INSTRUCTIONS.md` — tambah section catatan script + CRLF note

## 📱 QA — Visual di Device Real

- [ ] Cek mobile bottom nav (5 slot + More modal) di device real
- [ ] Cek chart palette (getChartPalette) + tooltip glass
- [ ] Cek widget baru: Backlog Aging, Top Overdue, Predictive Date, PM Effectiveness
- [ ] Cek WO card badge aging + priority score

---

## Deploy Status

| Item | Status |
|------|--------|
| Session 1-3d (R1,R2,R4,R5,R7 + V1-V4 + Mobile UX) | ✅ live `mtc-asset.web.app` |
| R3 Part↔WO linkage | ✅ done (commit dc46edf) |
| R6 Single source truth | ✅ done (commit 74f3833) |
| Housekeeping scripts | ✅ done (commit ed653dc) |

## Known Issues

- **R3** & **R6** = satu-satunya gap fitur tersisa dari roadmap maintenance intelligence.
- Script CRLF quirk: edit tools gagal di CRLF files → pakai node `.mjs` + regex `\r?\n`.
