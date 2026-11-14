# NOTE-D29 — Audit Trail kosong & CSS dangling (v140)

## Status
DONE, live. Commit `9fce952`. CI: Test ✓ 2m53s, Build and Deploy ✓ 1m46s, Lighthouse ✓ 1m0s.
Bukti live: `sw.js` = `mtc-asset-v140`; audit 21 aset, `staleOldName=0 bad=0`, semua `.css` → `200 text/css`.

## Root cause (3 bug, berurutan)
1. **Ghost logger.** `src/js/modules/audit.js` hanya di-`import()` dinamis di dalam `loadAuditLogs()` (app.js:370). Saat kerja normal `window.auditModule === undefined`, sementara pemanggil pakai `window.auditModule?.logAudit?.(...)` → no-op senyap. (FIXED, v139)
2. **Tidak ada auto-fetch.** `navigateTo()` cuma set `this.currentPage`; `loadAuditLogs()` hanya dari tombol REFRESH. (FIXED, v139)
3. **CSS dangling (bug sebenarnya yang bikin tetap kosong).** Plugin `inline-critical-css` mengganti nama aset CSS setelah dedupe tapi hanya menambal `.html`. Chunk JS menyimpan URL CSS di `__vite__mapDeps`; URL lama balas `index.html` (`text/html`) → preload CSS gagal → `import()` dinamis REJECT → `[Audit] Load error: Unable to preload CSS`. Tiap lazy `import()` yang dep-nya memuat `.css` ikut mati. (FIXED, v140)

## Perubahan (v140)
| File | Isi |
|---|---|
| `vite.config.js` | `generateBundle` → bentuk objek `{ order: 'post', handler }` |
| `scripts/patch-css-refs.mjs` | helper: tambal nama lama → baru di seluruh berkas teks bundel (chunk + `.html`/`.js`/`.json`/`.css`) |
| `scripts/verify-precache.mjs` | guard tautan gantung `assets/*.(css\|js)` di `dist`, exit 1 |
| `tests/patch-css-refs.test.js` | 3 tes regresi |
| `sw.js` | `v139` → `v140` |

## Jebakan
- **`order: 'post'` itu inti fix.** `enforce: 'post'` mengurutkan *plugin*; `order` mengurutkan *hook*. Vite menyuntik `__vite__mapDeps` di generateBundle plugin import-analysis, jadi hook kita harus sesudahnya. Tanpa itu `ref ditambal: 0`.
- **Nama chunk tidak berubah walau isinya berubah.** `__vite__mapDeps` disuntik *setelah* hash nama chunk dihitung — bukti: `app-Ik1U72lm.js` dan `audit-BLx3K7dm.js` tetap bernama sama sebelum & sesudah fix, padahal isinya berubah. Konsekuensi: cache `immutable` untuk chunk bisa menyajikan versi lama; satu-satunya pemutusnya bump `CACHE_NAME`. Kalau nanti CSS di-rename lagi tanpa bump versi → bug ini kembali.
- `git add/commit/push` butuh `BypassSandbox: true` (`.git/index.lock` ditolak di sandbox).
- `database.rules.json` tidak ikut ter-deploy CI.

## Verifikasi
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
curl.exe -s https://mtc-asset.web.app/sw.js
```
Hasil: 126 files / 2414 tests PASS, build `ref ditambal: 4`, precache 60/60.
