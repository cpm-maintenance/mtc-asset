# NOTE-D29 — Audit Trail tidak pernah terekam (v139)

## Status
FIXED, menunggu commit/push. Bukti: gate 1 `typecheck && lint && test:run` → 125 files / 2410 tests PASS.

## Root cause (2 bug)
1. **Ghost logger.** `src/js/modules/audit.js` hanya di-`import()` dinamis di dalam `loadAuditLogs()` (app.js:370) — yaitu saat halaman Audit Trail dibuka. Saat kerja normal `window.auditModule === undefined`, sementara semua pemanggil pakai `window.auditModule?.logAudit?.(...)` → no-op senyap. Hook login/logout (`setupAuditHooks`) juga belum terpasang karena itu.
2. **Tidak ada auto-fetch.** `navigateTo()` hanya set `this.currentPage`; tidak ada pemanggilan `loadAuditLogs()`. Data baru muncul setelah klik REFRESH manual.

## Perubahan
| File | Baris | Isi |
|---|---|---|
| `src/js/bootstrap.js` | 146-147 | `import('./modules/audit.js').catch(() => {})` di `onUser()` |
| `src/js/bootstrap.js` | 100-101 | watcher `currentPage`: `if (val === 'audit') this.loadAuditLogs()` |
| `sw.js` | 6 | `mtc-asset-v138` → `mtc-asset-v139` |

## Aturan keras yang tetap dipatuhi
- `src/js/modules/audit.js` TIDAK boleh impor statis `../db.js` — dikunci `tests/data-layer-lazy.test.js` (harus `await import('../db.js')`).
- Urutan boot di `main.js` tidak diubah.

## Verifikasi
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
curl.exe -s https://mtc-asset.web.app/sw.js
```

## TODO
- Entry `Login` baru tercatat pada login BERIKUTNYA (import terjadi di `onUser()`, sesudah sesi aktif). Kalau Login harus tercatat sejak percobaan pertama, pindahkan import ke `main.js` sebelum `onUser` — cek dulu `tests/data-layer-lazy.test.js`.
- `database.rules.json` tidak ikut ter-deploy oleh CI (deploy manual kalau rules berubah).
