# PROMPT — D20: Start/End Time (datetime-local, downtime pecahan jam)

Salin ke session baru. Ringkas, <80 baris.

## Tugas

Ganti input `Start Date` / `End Date` (D19, `type="date"`) jadi **`type="datetime-local"`**
berlabel **`Start Time`** / **`End Time`**, dan `computeDowntimeHours()` mengembalikan
**jam pecahan** (1 desimal), bukan kelipatan 24.

Alasan: data prod sudah jam-jaman (`DOWNtime tercatat 32 H`, `UMUR 7d 12h`,
input downtime `step="0.1"`), sedangkan `type="date"` memaksa kelipatan 24.

User sudah **APPROVE** opsi A. Jangan tanya ulang; langsung RED → GREEN.

## Kontrak baru `computeDowntimeHours(start, end)`

```
0.1 jam        → 0.1      (6 menit)
32 jam         → 32
2026-11-01T00:00 → 2026-11-02T00:00  → 24
kosong / invalid / end < start       → null
start === end  → 0
```
Pembulatan 1 desimal (`Math.round(ms / 3600000 * 10) / 10`). `null` tetap dipakai
supaya `recalcLogAuto()` tidak menimpa angka manual.

## File & anchor (nomor baris HEAD `90eb796`)

| File | Baris | Ubah |
|---|---|---|
| `src/js/utils.js` | 206 | `computeDowntimeHours` → jam pecahan |
| `src/js/utils.js` | 378 | `validateLogForm` rentang: bandingkan string masih OK untuk ISO |
| `src/js/modules/logs.js` | 337, 356 | getter `logAutoDowntime`, `recalcLogAuto()` (TIDAK perlu ubah bila helper sudah benar) |
| `src/js/modules/logs.js` | 203 | `startDate: data.StartDate \|\| ''` — nilai lama `YYYY-MM-DD` harus tetap terbaca |
| `src/js/modules/logs.js` | 103 | `syncLogFormErrors` aturan `endDate < startDate` (string compare tetap valid) |
| `public/pages/WorkOrders.html` | 408, 410, 416, 418 | `for`/`id` `woc-start-time`/`woc-end-time`, label `Start Time`/`End Time`, `type="datetime-local"` |
| `public/pages/app-shell.html` | 1522, 1527 | idem, aria-label `Waktu mulai`/`Waktu selesai` |
| `tests/wo-dates-autocalc.test.js` | semua | update ekspektasi + tambah kasus pecahan |
| `sw.js` | 6 | `mtc-asset-v129` → **v130** |

Nama field `logForm.startDate` / `logForm.endDate` **jangan diganti** (churn tak perlu);
hanya label UI jadi "Time".

## Kompatibilitas data lama

Record tersimpan `StartDate: '2026-11-01'` (date-only) → `new Date('2026-11-01')` valid
(00:00 lokal). **Jangan tambah migrasi**; cukup pastikan `computeDowntimeHours` tidak
mengembalikan `NaN`.

## Tes yang harus ditambah (RED dulu)

- `computeDowntimeHours('2026-11-01T08:00', '2026-11-01T08:06')` → `0.1`
- `computeDowntimeHours('2026-11-01T00:00', '2026-11-02T08:00')` → `32`
- `computeDowntimeHours('2026-11-01', '2026-11-02')` → `24` (format lama)
- `computeDowntimeHours(undefined, '2026-11-01T00:00')` → `null`
- markup: `x-model="logForm.startDate"` diikuti `type="datetime-local"` dalam 200 char

## Gerbang (turn yang sama, output verbatim)

```bash
npx tsc --noEmit
npx eslint .
npx vitest run --coverage
npx vite build
node scripts\verify-precache.mjs
node scratch\tz.mjs
gh run list --limit 3
```

Ratchet `vitest.config.js` 96/89/96/97 **jangan diturunkan**. Baseline D19:
123 files / 2369 passed, coverage 97.45 / 90.22 / 97.71 / 98.53, precache 60.

## Aturan keras repo

- **JANGAN pakai `edit_file`** — EOL campur (`utils.js`/`logs.js`/`constants.ts`/`sw.js` CRLF,
  HTML LF). Tulis skrip Node anchor-based di `scratch/`, verifikasi baris mentah.
- **`grid-cols-2` dilarang di dalam `<form>`** (`tests/form-controls.test.js`).
- Jangan sentuh `package.json`, `src/main.js`, `globals.d.ts`. `src/js/app.js` minimal.
- Jangan hapus 13 blob skeleton di `app-shell.html`.
- Jangan stage `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx`.
- Git write ops butuh `BypassSandbox: true`; `git push --dry-run --no-thin` dulu.
- `npx`/git butuh `cmd /c "..."`; git/`gh`/network butuh bypass sandbox.
- Deploy hanya lewat CI (push ke `main`). Verifikasi prod via `scratch\prod.mjs`
  → `/` 200 + `cacheName=mtc-asset-v130`.

## Konteks yang sudah ada

- `NOTE-D19.md` — jebakan D19 (tsc `Date` aritmetika wajib `getTime()`, dll).
- `SESSION-2026-11-12.md` — handoff hari ini, commit `90eb796` = D19, CI 3/3 success.
- `tests/wo-dates-autocalc.test.js` — 22 tes D19, semua hijau.

