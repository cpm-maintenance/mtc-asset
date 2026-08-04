# Session Notes — 2026-08-03 (Session 3 + 3b + 3c + 3d)

## Ringkasan

**Sidebar P1-P5** ✅ → **Mobile UX P0-P3** ✅ → **Visual Design V1-V4** ✅ → **Maintenance Intelligence R1-R7 (5/7 done)** ✅. Build pass + 96/96 tests + deploy live.

---

## Baru di Session Ini

### Mobile UX Fix (P0-P3) ✅
- **P0 Bottom nav overflow (KRITIS)**: 16 item → 5 slot grid (Dashboard, WO, Equipment, Parts + **More button** → `showMoreMenu`). Labels, safe-area inset.
- **P1 More modal**: terhubung, badge count tiap item, `max-h-[55vh]` scroll.
- **P2 Header mobile**: title truncate, compact actions, live pill hidden xs.
- **P3 Nav polish**: active indicator, slot badges rose-red.

### Visual Design (V1-V4) ✅
- **V1 Chart palette ikut tema**: `getChartPalette()` resolve CSS vars → semantic colors. No hardcode hex.
- **V2 Chart polish**: `getTooltipStyle()` glass tooltip, `centerTextPlugin` donut total, `lineGradient()`, legend point-style.
- **V3 Micro-interactions**: count-up stat cards, card lift, badge pop, empty fade.
- **V4 Typography**: `.font-display` Space Grotesk, `.glow-ring`, `:focus-visible`, WCAG AA pass.

### Maintenance Intelligence (R1-R7, 5/7 done) ✅
- **R1 WO Aging**: `woAgeDays/Bucket/Color` helpers, `backlogAging` + `topOverdueWO` computed. WO card badge `Nd` + OVERDUE. Dashboard **Backlog Aging** widget + **Top Overdue** list.
- **R2 Priority Score**: `backlogScore()` = WO prio (0.5-3) × criticality (1-3) × health risk (0-3) → 0-9. Score badge di WO card + "By priority" sort toggle.
- **R4 PM Effectiveness**: `pmEffectiveness(daysWindow=14)` — failure setelah PM → badge ⚠ INEFFECTIVE di PM Schedule.
- **R5 Predictive Date**: linear projection dari `firstUsedDate/installedDate` → ETA tanggal + confidence (70-95%). Dashboard widget upgrade.
- **R7 MTTR per Teknisi**: `mttrByTech()` — MTTR + breakdown count di TechnicianWorkload header.

## Fix Lain

- **CRLF quirk**: edit tools gagal di CRLF files → workaround script node `.mjs` + regex `\r?\n`. Grep rusak di CRLF — pakai node scan.
- **edit_* tools fail** ("No active credentials"): selalu pakai node script untuk edit index.html/app.js.

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| `mtc-asset.web.app` (hosting) | ✅ Live | R1+R2+R4+R5+R7, 69 files |

## Known Issues (Still Open)

- **R3 Part ↔ WO linkage** — belum (besar, butuh redesign flow requisition)
- **R6 Single source truth** — belum (rekonsiliasi Performance vs WO)

## Next Session (Besok)

- [ ] Lanjut **R3** — Part ↔ WO linkage (requisition → WO id, material availability, stock deduction)
- [ ] Lanjut **R6** — Single source truth (WO = golden source downtime)
- [ ] Bersihkan `scripts/*.mjs` helper lama (sudah tidak dipakai: regroup-menu, add-badges, p0-bottombar, p2-header, p3-nav, v1-palette, v2-chartpolish, v3-micro, v4-type, r1-aging, r2-score, r457, r5-pred, fix-notes, scan)
- [ ] Cek visual di device real (mobile nav, chart, widget baru)

---

# Session Notes — 2026-08-04 (Session 4)

## Ringkasan

**R3 Part ↔ WO Linkage ✅** — requisition kini terhubung ke Work Order + material availability check + UI badges. 101/101 tests pass, deploy live.

## Baru di Session Ini

### R3 Part ↔ WO Linkage ✅
- **Link requisition→WO**: field woId/woNumber di Requisitions, backlink reqIds[] di HistoryLog (WO). Dropdown WO picker di modal RequestPart (list open WOs).
- **Material availability**: checkPartAvailability(items, allParts) pure helper (utils.js, testable). Badge "⚠ -N parts" / "✓ Stock ok" di WO card. Live badge per line item di RequestPart form. Guard di approveWO — konfirmasi bila stok kurang.
- **Refactor**: parsePartsUsed() shared (dedup inline JSON.parse di approveWO), woAvailability()/woShortageSummary() methods, itemAvail().
- **Restock auto-reflect**: markArrived sudah update part.Stok live → availability WO hijau otomatis setelah barang tiba.
- **UI**: Linked Requests count di WO detail.

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| mtc-asset.web.app (hosting) | ✅ Live (R3) | R1+R2+R3+R4+R5+R7, 68 files |

## Commits

| Hash | Deskripsi |
|------|-----------|
| e4edd78 | pure helpers availability + stock deduction + 5 tests |
| 23a8877 | requisition↔WO data layer (woId/woNumber + reqIds backlink) |
| dc46edf | availability check + approve guard + WO badges |
| 8ca6c39 | WO picker + live availability + link badge RequestPart UI |
| f5342d0 | docs: R3 complete + session notes |

## Known Issues (Still Open)

- **R6 Single source truth** — belum (WO = golden source downtime, rekonsiliasi Performance vs WO)

## Next Session

- [ ] Lanjut **R6** — Single source truth (WO = golden source downtime)
- [ ] Bersihkan scripts/*.mjs helper lama
- [ ] Cek visual R3 di device real (badge availability, WO picker, linked requests)

---

# Session Notes — 2026-08-04 (Session 4, part 2)

## Ringkasan

**R6 Single Source Truth ✅** — WO (HistoryLog) kini golden source downtime. Performance.bd otomatis dari WO breakdown; wh/stb tetap manual. Bug calcDowntime fixed. 103/103 tests pass, deploy live.

## Baru di Session Ini (part 2)

### R6 Single Source Truth ✅
- **computeBDFromLogs(logs, equipId, date)** — pure helper: sum Downtime dari log Jenis=Breakdown per equipment+date (utils.js, 2 tests).
- **Auto-sync**: submitLog (Jenis=Breakdown) & completeWO → syncPerformanceBD() update Performance.bd + freq + bdSource='wo'.
- **recomputeBD()** — button "Sync BD" di Performance page: hitung ulang semua record dari WO.
- **UI**: badge cyan "auto" di sel BD bila bdSource='wo'.
- **Fix bug**: calcDowntime jumlah bd+stb (stb = standing time) → bd saja.

### Fix Runtime (dev)
- **sortByScore undefined** (3053b87) — state hilang, WO view crash.
- **log.reqIds undefined** (1607172) — guard (log.reqIds || []).

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| mtc-asset.web.app (hosting) | ✅ Live (R3+R6) | R1-R7 complete, 68 files |

## Commits (session 4)

| Hash | Deskripsi |
|------|-----------|
| e4edd78 | R3: pure helpers availability + tests |
| 23a8877 | R3: requisition↔WO data layer |
| dc46edf | R3: availability check + approve guard + badges |
| 8ca6c39 | R3: WO picker + live availability RequestPart UI |
| 11dae31 | docs: R3 |
| 3053b87 | fix: sortByScore |
| 1607172 | fix: reqIds guard |
| d48265b | R6: computeBDFromLogs + calcDowntime fix |
| 8e899a9 | R6: auto-sync Performance.bd |
| 74f3833 | R6: UI sync indicator + recompute button |

## Known Issues (Still Open)

- Semua R1-R7 ✅ complete — roadmap maintenance intelligence selesai.

## Next Session

- [ ] Housekeeping: hapus scripts/*.mjs helper lama (15 files)
- [ ] QA visual device real (mobile nav, charts, R3/R6 badges)
- [ ] Optional: R8 ideas dari planner/analyst feedback
