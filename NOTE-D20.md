# NOTE-D20 — Start/End Time (datetime-local) + downtime jam pecahan

**Status:** GREEN lokal. `tests/wo-dates-autocalc.test.js` 28/28. Full suite 123 files / 2375 passed.

## Yang berubah
- Input `Start Date`/`End Date` (D19, `type="date"`) → **`type="datetime-local"`**, label `Start Time`/`End Time`
  (`public/pages/WorkOrders.html`, `public/pages/app-shell.html`). ID: `woc-start-time`/`woc-end-time`.
- `computeDowntimeHours()` → **jam pecahan 1 desimal** (`Math.round(x*10)/10`), bukan kelipatan 24.
- Nama field `logForm.startDate`/`endDate` **tetap** (hanya label UI). `sw.js` `v129` → **`v130`**.

## Kontrak `computeDowntimeHours(start, end)`
```
0.1 jam  → 0.1      32 jam → 32      2026-11-01T00:00→2026-11-02T00:00 → 24
kosong / invalid / end < start → null      start === end → 0
'2026-11-01' (date-only, data lama) → dipaksa 00:00 lokal, tetap terbaca
```

## Jebakan utama (root cause 1 baris)
- **`new Date(a) - new Date(b)` salah untuk downtime** — selisih epoch ikut DST.
  Di `America/New_York` `2026-11-01T00:00`→`2026-11-02T08:00` jadi **33**, bukan 32 (fall-back 1 jam).
  Fix: hitung **wall-clock** — `Date.UTC(d.getFullYear(), getMonth(), getDate(), getHours(), getMinutes(), getSeconds())`.
  Helper `wallMs()` + JSDoc `/** @param {string} value @returns {number} */` (kalau tidak, `tsc` `TS7006`).
- `new Date('2026-11-01')` = **UTC** 00:00, bukan lokal → regex `^\d{4}-\d{2}-\d{2}$` ditambah `T00:00` dulu.
- **`cd` wajib kapital**: `D:\CODING\MTC-Asset`. Drive kecil (`d:`) → dua instance modul `@vitest/runner`
  → `runner` undefined → **semua 123 file gagal import** (`Cannot read properties of undefined (reading 'config')`).
  Baseline `HEAD` pun gagal → bukan akibat edit D20.

## Perintah verifikasi (semua hijau turn ini)
```bash
cmd /c "cd /d D:\CODING\MTC-Asset && npx tsc --noEmit"
cmd /c "cd /d D:\CODING\MTC-Asset && npx eslint ."
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run --coverage"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vite build"
cmd /c "cd /d D:\CODING\MTC-Asset && node scripts\verify-precache.mjs"
cmd /c "cd /d D:\CODING\MTC-Asset && node scratch\tz.mjs"
```
- coverage **97.45 / 90.23 / 97.71 / 98.53** (ratchet 96/89/96/97 — jangan diturunkan)
- build ✓, `verify-precache` **60 berkas**
- TZ **4/4 OK** (UTC, Asia/Jakarta, America/New_York, Pacific/Auckland) — lihat `scratch/tz.mjs`

## Aturan keras
- **JANGAN `edit_file`** di file repo — EOL campur (`utils.js`/`sw.js`/.yml CRLF; HTML LF). Pakai skrip Node
  anchor-based di `scratch/`, lalu verifikasi baris mentah (`scratch/b64.mjs`, `scratch/catb64.mjs`).
- `grid-cols-2` dilarang dalam `<form>` (`tests/form-controls.test.js`).
- Jangan sentuh `package.json`, `src/main.js`, `globals.d.ts`; jangan hapus 13 blob skeleton `app-shell.html`.
- Jangan stage `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx` / `scratch/`.
- `sw.js` naik versi hanya bila `src/**` / `public/**` berubah.
- Git write + network butuh `BypassSandbox: true`; `git push --dry-run --no-thin` dulu.
- Deploy hanya via CI (push `main`). Prod check: `scratch/prod.mjs` → `/` 200 + `cacheName=mtc-asset-v130`.

## TODO
- Verifikasi CI + prod (`gh run list --limit 3`, `scratch/prod.mjs`) setelah push.
