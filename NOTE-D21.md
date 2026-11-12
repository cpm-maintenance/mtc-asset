# NOTE-D21 — Tab GANTT PM Schedule (Tactical Slate)

## Status
Selesai. Tab GANTT disamakan dengan prototipe + dependency/critical path heuristik.
Keputusan user: "pakai usulanmu semua beri yang terbaik" (3 usulan disetujui penuh).

## Yang berubah
| Berkas | Isi |
|---|---|
| `public/pages/PMSchedule.html` | blok tab GANTT diganti (L498-631), KPI kartu 3 `UPCOMING 30D`, checklist prosedur di modal detail |
| `src/js/modules/pm-schedule.js` | +3 state, `dayWidth` baca zoom, +11 metode (L712-836) |
| `src/js/appstate.ts` | deklarasi 3 field + 11 metode |
| `tests/pm-schedule-module.test.js` | `width: 38` -> `62` |
| `tests/pm-gantt-view.test.js` | BARU, 16 tes |
| `sw.js` | `mtc-asset-v130` -> `v131` |

## Kontrak yang dikunci
- Zoom: DAY=32, WEEK=20, MONTH=10 px. `pmGetGanttDayWidth()` fallback 32.
- Bar: `evt.width === dayWidth * 2 - 2` -> 62 saat DAY.
- Dependency = heuristik, **tanpa field `dependsOn`**: PM se-`equipmentId` berurutan tanggal.
- Critical path = chain dengan >=2 PM, ada `isOverdue`, PM terakhir <= hari+7.
- `pmGanttRowSvg()` -> `''` kalau `pmGanttShowDeps === false`.

## Jebakan (root cause 1 baris)
- `--tac-*` adalah **triplet RGB** (`239 68 68`), bukan warna -> di JS wajib `rgb(var(--tac-status-emergency))`; menulis `var(--tac-...)` saja bikin atribut `stroke` invalid.
- Ikon baru (`view_timeline`, `insights`, `check_box_outline_blank`) TIDAK ada di `src/css/icon-subset.txt` -> pakai yang sudah ada (`table_rows`, `monitoring`, `check`).
- `docs/SOP-*.pdf|pptx` dan `scratch/` jangan pernah di-stage.

## Perintah verifikasi (verbatim, drive kapital)
```
cmd /c "cd /d D:\CODING\MTC-Asset && npx tsc --noEmit"
cmd /c "cd /d D:\CODING\MTC-Asset && npx eslint ."
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run --coverage"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vite build"
cmd /c "cd /d D:\CODING\MTC-Asset && node scripts\verify-precache.mjs"
cmd /c "cd /d D:\CODING\MTC-Asset && node scratch\tz.mjs"
```

## TODO
- Kalau data nyata punya field `dependsOn`, ganti heuristik `pmGanttEventPairs()`.

