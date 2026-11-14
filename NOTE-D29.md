# NOTE-D29 — Audit Trail kosong & CSS dangling (v140)

## Status
IN PROGRESS, belum commit. Bukti: `npm run build` → `ref ditambal: 4`, `verify-precache` lulus.

## Root cause (3 bug, berurutan)
1. **Ghost logger.** `src/js/modules/audit.js` hanya di-`import()` dinamis di dalam `loadAuditLogs()` (app.js:370). Saat kerja normal `window.auditModule === undefined`, sementara pemanggil pakai `window.auditModule?.logAudit?.(...)` → no-op senyap. (FIXED, v139)
2. **Tidak ada auto-fetch.** `navigateTo()` cuma set `this.currentPage`; `loadAuditLogs()` hanya dari tombol REFRESH. (FIXED, v139)
3. **CSS dangling (bug sebenarnya yang bikin tetap kosong).** `vite.config.js` plugin `inline-critical-css` mengganti nama aset CSS (`main-CUVvVzhu.css` → `main-DznTAXno.css`) setelah dedupe, tapi hanya menambal `.html`. Chunk JS menyimpan URL CSS di `__vite__mapDeps`; URL lama 404 → Firebase balas `index.html` (`text/html`) → preload CSS gagal → `vite:preloadError` → `import()` dinamis REJECT → `[Audit] Load error: Unable to preload CSS`. Tiap lazy `import()` yang dep-nya memuat `.css` ikut mati.

## Perubahan
| File | Isi |
|---|---|
| `vite.config.js` | `generateBundle` → bentuk objek `{ order: 'post', handler }` — Vite menyuntik `__vite__mapDeps` di generateBundle plugin import-analysis, jadi hook kita harus jalan SESUDAHNYA |
| `scripts/patch-css-refs.mjs` | helper baru: tambal nama lama → baru di seluruh berkas teks bundel (chunk + `.html`/`.js`/`.json`/`.css`) |
| `scripts/verify-precache.mjs` | guard baru: deteksi tautan gantung `assets/*.(css|js)` di `dist`, exit 1 |
| `tests/patch-css-refs.test.js` | 3 tes regresi |
| `sw.js` | `v139` → `v140` |

## Jebakan
- `order: 'post'` itu inti fix. Tanpa itu `ref ditambal: 0` walau `enforce: 'post'` sudah ada di plugin — `enforce` mengurutkan plugin, `order` mengurutkan hook.
- Chunk code belum final saat `generateBundle` default; buktinya hitungan `ref ditambal` = 0.
- `git add/commit/push` butuh `BypassSandbox: true` (`.git/index.lock` ditolak di sandbox).

## Verifikasi
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
curl.exe -s https://mtc-asset.web.app/sw.js
```

## TODO
- `database.rules.json` tidak ikut ter-deploy CI (deploy manual kalau rules berubah).
- `ref ditambal: 4` (2 chunk + index.html/noscript) — kalau angka ini jadi 0 lagi, `order: 'post'` hilang.
