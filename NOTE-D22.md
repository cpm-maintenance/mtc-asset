# NOTE-D22: GANTT v2 (Window 1 Bulan, Kolom Kiri Asset/HM, Bar Permanen)

## Status & Bukti
- Versi: `sw.js` naik ke `mtc-asset-v132`. Commit: `467df77`.
- Test suite: **125 files / 2403 passed** (tambah `tests/pm-gantt-v2.test.js`, 12 tests).
- Coverage: Statements **98.56%**, Branches **90.18%**, Functions **97.76%**, Lines **98.56%** (ratchet: 96/89/96/97 — utuh).
- Precache: **60 berkas** build ter-precache penuh (`verify-precache.mjs` OK).
- TZ matrix: **4/4** OK (UTC, Asia/Jakarta, America/New_York, Pacific/Auckland).
- Typecheck & Lint: `tsc --noEmit` clean, `eslint .` clean.
- Build: `vite build` 636 modules built in 5.21s.
- CI GitHub Actions (push `467df77`): **3/3 success**
  - Test: 3m42s (ID: 43180904154)
  - Build and Deploy: 1m29s (ID: 43180904255)
  - Lighthouse CI: 1m1s (ID: 43180904261)
- Prod Probe (`https://mtc-asset.web.app`):
  - `GET / -> 200 OK`
  - `GET /sw.js -> 200 cache=mtc-asset-v132`
  - `PROD OK`

## Ringkasan Perubahan
1. `src/js/modules/pm-schedule.js`:
   - `pmGanttMonthWindow()`: filter slice 1 bulan aktif dari timeline absolut (~181 hari) berbasis `pmGanttScroll`.
   - `pmGanttVisible(evt)` & `pmGanttBarLeft(evt)`: kalkulasi posisi & visibilitas relatif window aktif.
   - `pmGetGanttRows()`: return field `tipe`, `hm`, `hmLabel` (`250h`), `icon`, `critical`, `statusLabel` (`SCHEDULED`/`OVERDUE`/`DUE SOON`).
   - Anti circular recursion: re-entrancy guard `_inGanttRows` memutus loop `pmGetGanttRows` ↔ `pmGetCriticalPath`.
2. `public/pages/PMSchedule.html`:
   - Kolom kiri: Type icon + Nama + EquipmentID + CP badge (`>CP<`) + HM badge (`row.hmLabel`) + status pill.
   - Day strip: window bulan aktif via `pmGanttMonthWindow().days`, width responsif per zoom.
   - Bar: label selalu tampak (`min-w-[96px]`, `h-7`, tanpa `opacity-0 hover:opacity-100`).
   - Navigasi: tombol `>TODAY<` (`pmGanttScroll = 0`), tab bulan (`pmGanttScroll = idx - 2`).
   - Status bar / Footer: `SHOWING x OF y SCHEDULED UNITS`.
3. `src/js/appstate.ts`: deklarasi method baru & state guard.
4. `tests/pm-gantt-v2.test.js`: test suite verifikasi 12 poin kontrak v2.

## Jebakan (Root Cause 1 Baris)
- `pmGetGanttRows` memanggil `pmGanttIsCritical` yang memanggil `pmGetCriticalPath` yang memanggil `pmGetGanttRows`: stack overflow jika tanpa `_inGanttRows` re-entrancy guard.
- `iso(0)` jatuh pada jendela `nextWeekStr` sehingga status awal adalah `'Due Soon'`, bukan `'Scheduled'` — gunakan offset `> 7d` untuk fixture scheduled murni.

## Perintah Verifikasi
```bash
cmd /c "cd /d D:\CODING\MTC-Asset && npx tsc --noEmit && npx eslint ."
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run --coverage"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vite build"
cmd /c "cd /d D:\CODING\MTC-Asset && node scripts\verify-precache.mjs"
cmd /c "cd /d D:\CODING\MTC-Asset && node scratch\tz.mjs"
```

## Aturan Keras & Kontrak Terjaga
- Tidak menurunkan ratchet coverage di `vitest.config.js`.
- Tidak ada `cdn.tailwindcss` atau `grid-cols-2` di dalam `<form>`.
- Koordinat absolut event dipertahankan (kompatibel penuh dengan D21).
- Dependency lintas-equipment dan Copilot ditolak sesuai persetujuan spec D22.
