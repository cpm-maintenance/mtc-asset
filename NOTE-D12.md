# NOTE-D12 — Sapuan Tanggal Lokal (hari kalender)

**Status:** sapuan 25 situs "hari ini" UTC → `localDateStr()` + 2 bug ikutan. `sw.js` = `mtc-asset-v122`.
Gate 5 hijau. 4 TZ hijau. Siap commit/push.

## Yang dikerjakan

- `src/js/constants.ts`: helper privat `localDateStr()` + `DEFAULT_LOG_FORM.date/requestDate`,
  `DEFAULT_DUE_DATE()` (+7 hari), `DEFAULT_PERF_FORM.date`, `DEFAULT_PM_FORM.date`.
- `logs.js` (5), `performance.js` (1), `enterprise-kpi.js` (4), `export.js` (5),
  `notification.js` (3), `wo-pdf-template.js` (1 helper `localDay`).
- Bonus ditemukan saat uji TZ: `performance.js getFilteredPerfData()` — `yearly` &
  `monthly` pakai `new Date(p.date).getFullYear()/getMonth()`; `new Date('2026-10-01')`
  = UTC midnight → di zona barat jatuh ke Sept. Diganti perbandingan prefix string.
- Bonus 2: `enterprise-kpi.js calcHealthScore()` — PM overdue pakai `new Date(NextPMDate)`
  + `Math.floor`, meleset 1 hari di zona barat. Diganti konstruksi lokal + `Math.round`.

## Sengaja TIDAK diubah

- `utils.js:450 formatDate()` — `toISOString().split('T')[0]`. Untuk string tanggal polos
  (`'2025-01-15'`) → UTC midnight → round-trip persis. Diganti = `'2025-01-14'` di UTC−7.
  Dikunci `tests/utils.test.js` ("di-guard, jangan diubah").
- `charts.js:_monthKey()` — alasan round-trip yang sama (prefix bulan).

## Bukti (verbatim)

| Jalankan | Hasil |
|---|---|
| `TZ=America/Los_Angeles npx vitest run` (setelah patch) | **115 files / 2302 passed**, exit 0 |
| `TZ=Asia/Jakarta npx vitest run` | **115 files / 2305 passed**, exit 0 |
| `TZ=UTC npx vitest run` | **115 files / 2305 passed**, exit 0 |
| `TZ=Pacific/Kiritimati npx vitest run` | **115 files / 2305 passed**, exit 0 |
| `TZ=America/Los_Angeles npx vitest run` (ulang, 4 helper) | **115 files / 2305 passed**, exit 0 |
| TDD merah: revert `performance.js:18` → UTC | `expected '2026-10-17' to be '2026-10-18'` (Jakarta) |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 (0 error, 0 warning) |
| `npx vitest run --coverage` | **115 files / 2305 passed**; cov **97.47 / 90.2 / 97.7 / 98.52** |
| `npx vite build` | exit 0, built 3.85s; `dist/sw.mjs` **2.25 kB** (gzip 1.00); precache **63 entries (3258.85 KiB)** |
| `node scripts\verify-precache.mjs` | `OK — 60 berkas build semuanya ter-precache` |

## Jebakan (dari sesi ini)

1. **Patch CRLF**: file campur CRLF/LF. Skrip `patch()` harus deteksi EOL file dan
   normalisasi `\n` pola sebelum match — kalau tidak, `match=0`.
2. **`read_file` merusak tanda kutip/backtick** pada beberapa file JS (backtick hilang,
   `=>` jadi kosong). Verifikasi isi file lewat `node -e` + `JSON.stringify(line)`,
   jangan percaya tampilan `read_file` untuk file ber-backtick.
3. **PowerShell 5.1 mengutak-atik `$` dan kutip** di `node -e` inline. Tulis `.mjs` ke
   scratch, jangan inline.
4. **`.cmd` wrapper merusak vitest**: `set TZ=... && npx vitest run` di dalam file `.cmd`
   → 115 suite "Vitest failed to find the runner" (0 test). Pakai bentuk langsung
   `cmd /c "set TZ=...&& npx vitest run"`.
5. `edit_file` dengan `\n` gagal di file CRLF — pakai skrip patch, bukan `edit_file`.

## Perintah

```
cmd /c "npx tsc --noEmit"
cmd /c "npx eslint ."
cmd /c "npx vitest run --coverage"
cmd /c "npx vite build"
cmd /c "node scripts\verify-precache.mjs"
```

## Aturan keras

- Ratchet `vitest.config.js` 96/89/96/97 — jangan diturunkan.
- Jangan `npm audit fix --force`, jangan upgrade `xlsx`.
- Jangan refactor/split `src/js/app.js`. Jangan sentuh `globals.d.ts`.
- `sw.js` naik versi tiap `src/**`/`public/**` berubah.
- Jangan commit `.env`. Git ops butuh `BypassSandbox: true`.
- `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx` untracked — JANGAN di-stage.

## TODO

- [x] Gate 5 perintah → angka verbatim di tabel atas.
- [x] Commit + push → `f1e4e53` (`a88716b..f1e4e53 main -> main`), 18 berkas.
- [ ] (opsional) `curl -s 'https://mtc-asset.web.app/sw.js?cb=1' | grep -o 'mtc-asset-v[0-9]*'` → `v122`.

