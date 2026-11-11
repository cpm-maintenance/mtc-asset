# NOTE-D13 — SpareParts hidup lagi dari cache setelah reload

**Status:** `deleteItem('SpareParts')` tidak memangkas cache IndexedDB & listener
SpareParts tidak merekonsiliasi snapshot → part terhapus hidup lagi saat boot/refresh.
Patch 3 titik di `src/js/modules/data.js`. `sw.js` = `mtc-asset-v123`.

## Akar masalah (1 baris)

Cache ditulis **upsert** (`putBulk`, [indexeddb.js:204](file:///d:/CODING/MTC-Asset/src/js/modules/indexeddb.js#L204))
tapi dibaca sebagai **kebenaran penuh** (`getAll` → `this.allParts = parts`) — baris
lama tak pernah terhapus, jadi cache "menang" atas server.

## Yang diubah (`data.js`, 3 titik)

1. Jalur hapus **offline** & **online** (`SpareParts`): + `this._cacheWriter?.('allParts', this.allParts)`
   + `idbManager.delete('parts', id)`.
2. `onChildRemoved(spRef, ...)`: + `idbManager.delete('parts', id)`.
3. Blok rekonsiliasi `onValue(spRef, …, { onlyOnce: true })` setelah `onChildRemoved`
   (cermin pola HistoryLog S39c/S45c): buang part yang tidak ada di snapshot server,
   guard `ids.size < 500`, tulis ulang cache. Push unsub ke `this._listeners`.

Sengaja **tidak** diubah: `putBulk` (kontrak "daftar kosong = tidak menyentuh store"),
`indexeddb.js`, `parts.js`, markup `[parts]`, `globals.d.ts`, `app.js`, `package.json`.

## Bukti (verbatim)

| Jalankan | Hasil |
|---|---|
| RED sebelum patch (`spareparts-cache-delete`, `--pool=vmThreads`) | 3 gagal **pada asersi** (`AssertionError`) |
| GREEN setelah patch | **3 passed** |
| Terkait (data, indexeddb, bulk-delete, delete-stock-restore, spareparts) | **5 files / 180 passed** |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 (0/0) |
| `npx vitest run` (116 files) | **2308 passed** |
| `npx vitest run --coverage` | **2308 passed**; cov **97.48 / 90.15 / 97.7 / 98.53** (ratchet 96/89/96/97) |
| `npx vite build` | exit 0, 3.43s; `dist/sw.mjs` **2.25 kB** (gzip 1.00); precache **63 entries (3259.39 KiB)** |
| `node scripts\verify-precache.mjs` | `OK — 60 berkas build semuanya ter-precache` |
| `dist/sw.js` | `CACHE_NAME = mtc-asset-v123` |
| TZ Asia/Jakarta (full suite) | **116 files / 2308 passed** |
| TZ UTC (full suite) | **116 files / 2308 passed** |
| TZ Pacific/Kiritimati (full suite) | **116 files / 2308 passed** |
| TZ America/Los_Angeles (full suite) | **116 files / 2308 passed** |

## Jebakan (sesi ini — penting)

1. **`vi.mock` mati total kalau cwd pakai huruf drive kecil**: `cd /d d:\CODING\MTC-Asset`
   → semua `vi.mock` diabaikan (factory tak pernah dipanggil), `tests/data.test.js` 93 gagal.
   `cd /d D:\CODING\MTC-Asset` → normal. Vitest 4.1.12 + Windows menormalkan path berbeda
   antara registry mocker dan import specifier. **Selalu pakai huruf drive kapital.**
2. **`--pool=vmThreads` merusak `ui-module.test.js`** (58 gagal `Cannot redefine property:
   location`) — pre-existing, terbukti sama pada baseline `7572ad4` yang di-stash.
   Pakai pool default (`forks`); jangan `--pool=vmThreads` untuk suite penuh.
3. `spareparts-cache-delete` tes #3: `setupFirebaseListeners()` menugaskan ulang
   `this._cacheWriter = saveCache`, menimpa stub `makeCtx`. Spy harus dipasang **setelah**
   `setupFirebaseListeners()`, bukan lewat `makeCtx`.
4. Dua listener kini pakai `limitToLast(500)` (SpareParts & HistoryLog) — `tests/data.test.js`
   dulu memilih listener lewat constraint `"n":500`. Ganti ke pencocokan path `HistoryLog`.
5. `tests/data.test.js` mock `idbManager` perlu `delete: vi.fn()` (data.js kini memanggilnya).
6. Patch file CRLF: `edit_file`/template-literal `\n` gagal (match 0). Pakai skrip Node yang
   split `/\r?\n/` lalu join EOL asli; anchor lewat nomor baris untuk blok multi-baris.
7. Jangan percaya tampilan `read_file` untuk file JS ber-backtick — verifikasi via
   `node scratch\ln2.mjs <file> <start> <end>`.
8. Git write ops & `npm install` butuh `BypassSandbox: true`.

## Perintah

```
cmd /c "cd /d D:\CODING\MTC-Asset && npx tsc --noEmit"
cmd /c "cd /d D:\CODING\MTC-Asset && npx eslint ."
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run --coverage"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vite build"
cmd /c "cd /d D:\CODING\MTC-Asset && node scripts\verify-precache.mjs"
```

## Aturan keras

- Ratchet `vitest.config.js` 96/89/96/97 — jangan diturunkan.
- Jangan `npm audit fix --force`, jangan upgrade `xlsx`.
- Jangan refactor/split `src/js/app.js`. Jangan sentuh `globals.d.ts`.
- `sw.js` naik versi tiap `src/**`/`public/**` berubah.
- Jangan commit `.env`. Jangan stage `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx`.
- Perubahan `package.json` butuh izin user.

## TODO

- [x] RED → patch → GREEN (3 tes baru hijau, 180 tes terkait hijau).
- [x] Gate 5 → angka di tabel atas.
- [x] Commit + push `9c6db17` (deploy via CI). CI: Test, Build and Deploy, Lighthouse CI = success.
- [x] Verifikasi produksi `mtc-asset-v123` (status 200, 6721 byte).
- [ ] (laten, di luar scope) `saveCache` menulis `cache_allParts` tapi `loadFromIndexedDB`
      membaca `cache_parts` — key mismatch, fallback localStorage tidak pernah kena.
