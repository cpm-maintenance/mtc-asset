# NOTE-D19 — Start/End Date + downtime & cost otomatis

**Status:** GREEN lokal. Tes `tests/wo-dates-autocalc.test.js` 22/22.

## Apa yang berubah
- `logForm` dapat `startDate`/`endDate` (opsional, `type="date"`).
- `downtime` = selisih hari x 24 jam, prefill otomatis saat tanggal berubah.
- `cost` = Σ(qty x Harga) dari baris part di form itu; dihitung ulang saat part/qty berubah.
- Keduanya **prefill, bukan read-only** — angka manual tidak dihapus selama rentang belum lengkap.
- Disimpan sebagai `StartDate`/`EndDate` (PascalCase, ikut `Tanggal`/`Downtime`/`Cost`).

## Helper (murni, di `src/js/utils.js`)
```
computeDowntimeHours(start, end) // null bila kosong/invalid/terbalik; 0 bila tanggal sama
computePartsCost(parts, catalog) // qty '' → 1; part tak dikenal → 0; non-array → 0
```

## Perintah verifikasi
```bash
npx tsc --noEmit
npx eslint .
npx vitest run --coverage
npx vite build
node scripts\verify-precache.mjs
node scratch\tz.mjs
```

## Jebakan (root cause 1 baris)
- **tsc `TS2362/2363`** di `utils.js`: aritmetika `Date` (`end - start`, `end < start`) tidak diterima `checkJs` → pakai `getTime()`.
- `@change` pada `<select x-model="part.id">` + `<input x-model="part.qty">` wajib ikut memicu recalc, bukan hanya tanggal.
- **`grid-cols-2` dilarang di dalam `<form>`** (`tests/form-controls.test.js`). Wrapper `md:grid-cols-2` untuk dua field tanggal menggagalkan suite → field ditumpangkan ke grid `md:grid-cols-3` yang sudah ada di WorkOrders, dan ke `form-grid--two` di modal.
- Patch markup berurutan rawan menyisakan baris yatim; verifikasi keseimbangan `<div>` per `<form>` sebelum commit.
- Jangan patch berkas repo ini dengan `edit_file` (EOL campur: `utils.js`/`logs.js`/`constants.ts`/`sw.js` CRLF, HTML LF) — pakai skrip Node anchor-based.

## Aturan keras
- `sw.js` v128 → **v129** (`src/**` + `public/**` berubah).
- Jangan turunkan ratchet `vitest.config.js` (96/89/96/97).
- Jangan stage `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx`.
- `filterDateFrom`/`filterDateTo` = filter `Tanggal`, **bukan** rentang WO.
