# NOTE-D29 — Audit Trail kosong & CSS dangling (v141)

## Status
v140 DONE, live (commit `9fce952`). v141 IN PROGRESS: catat `Login` dari transisi sesi.
Gate 1 ✓ 126 files / 2418 tests PASS.

## Root cause (4 bug, berurutan)
1. **Ghost logger.** `src/js/modules/audit.js` hanya di-`import()` dinamis di dalam `loadAuditLogs()` (app.js:370). Saat kerja normal `window.auditModule === undefined`, sementara pemanggil pakai `window.auditModule?.logAudit?.(...)` → no-op senyap. (FIXED, v139)
2. **Tidak ada auto-fetch.** `navigateTo()` cuma set `this.currentPage`; `loadAuditLogs()` hanya dari tombol REFRESH. (FIXED, v139)
3. **CSS dangling.** Plugin `inline-critical-css` mengganti nama aset CSS setelah dedupe tapi hanya menambal `.html`. Chunk JS menyimpan URL CSS di `__vite__mapDeps`; URL lama balas `index.html` (`text/html`) → preload CSS gagal → `import()` dinamis REJECT → `[Audit] Load error: Unable to preload CSS`. Tiap lazy `import()` yang dep-nya memuat `.css` ikut mati. (FIXED, v140)
4. **`Login` tidak pernah tercatat.** `setupAuditHooks()` menambal `app.login`, tapi ia dipasang dari `bootstrap.js onUser()` — yaitu SESUDAH `signInWithEmailAndPassword` selesai. Tambalan itu kode mati untuk tiap login. (FIXED, v141)

## Perubahan (v141)
| File | Isi |
|---|---|
| `src/js/bootstrap.js` | `onUser()`: `const wasLoggedIn = this.isLoggedIn` sebelum set `true`; `await import('./modules/audit.js')` lalu `if (!wasLoggedIn) await audit.logAudit('Login')` |
| `tests/bootstrap-branches.test.js` | 4 tes: catat sekali, tidak dobel saat refresh token, catat lagi setelah logout, gagal load audit tidak menjatuhkan boot |
| `sw.js` | `v140` → `v141` |

## Jebakan
- **Jangan fire-and-forget di `onUser`.** `import().then()` bikin 3/4 tes baru merah — microtask belum jalan saat assertion. Pakai `await`.
- **`setupAuditHooks()` menangkap `window.app` di closure-nya**, lalu membaca `app.isLoggedIn` setiap panggilan. Saat login layar masih `loginScreen` (isLoggedIn-nya tak pernah jadi true) → tidak ada tulisan dobel dari tambalan itu. Aman.
- **`order: 'post'` itu inti fix v140.** `enforce: 'post'` mengurutkan *plugin*; `order` mengurutkan *hook*. Vite menyuntik `__vite__mapDeps` di generateBundle plugin import-analysis. Tanpa itu `ref ditambal: 0`.
- **Nama chunk tidak berubah walau isinya berubah.** Hash nama chunk dihitung sebelum `__vite__mapDeps` disuntik. Cache `immutable` bisa menyajikan versi lama; pemutusnya cuma bump `CACHE_NAME`.
- `git add/commit/push` butuh `BypassSandbox: true` (`.git/index.lock` ditolak di sandbox).
- `database.rules.json` tidak ikut ter-deploy CI.

## Verifikasi
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
node scratch/probe_prod6.mjs
```
Hasil v140: 126 files / 2414 tests PASS, build `ref ditambal: 4`, precache 60/60, prod `main-DBCxZmJf.css` → `200 text/css`, dirujuk `app-Ik1U72lm.js` + `audit-BLx3K7dm.js`.
Hasil v141: 126 files / 2418 tests PASS (gate 1).

## TODO uji manual (butuh user)
1. `Ctrl + Shift + R`.
2. **Logout lalu login** — baris `LOGIN` baru harus muncul (fix v141 hanya menyala pada transisi sesi).
3. Buat/ubah 1 data nyata → baris `Create/Update ...` + `DATA MUTATIONS` tidak lagi `0`.
