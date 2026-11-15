# PROMPT — Sesi Baru (MTC-Asset) — setelah v141

## Konteks proyek
Repo: `d:\CODING\MTC-Asset` (branch `main`, remote `cpm-maintenance/mtc-asset`).
Stack: Vite 8 + Rolldown, vanilla JS (Alpine-style `$watch`), Tailwind v4, Firebase RTDB, PWA (vite-plugin-pwa `injectManifest`).
App: https://mtc-asset.web.app — Firebase Hosting, SW `sw.js` manual.
Dokumen acuan: `AGENTS.md` (aturan repo), `NOTE-D29.md` (audit trail + CSS dangling).

## Status sekarang
- HEAD `9531a2e` (pushed). Tree bersih kecuali 3 file untracked lama (bukan milik sesi ini): `PROMPT-D20.md`, `docs/SOP-Penggunaan-MTC-Asset.pdf`, `docs/SOP-Penggunaan-MTC-Asset.pptx`.
- Audit Trail SUDAH BERJALAN (diverifikasi user). Empat bug berurutan tuntas:
  1. v139 `fc8d2f4` — ghost logger: modul audit hanya di-`import()` di `loadAuditLogs()`; sekarang dimuat di `onUser()`.
  2. v139 — auto-fetch: `$watch('currentPage')` memanggil `loadAuditLogs()`.
  3. v140 `9fce952` — CSS dangling: plugin `inline-critical-css` ganti nama aset CSS tapi hanya menambal `.html`; `__vite__mapDeps` di JS chunk masih menunjuk nama lama → `200 text/html` → preload CSS gagal → semua `import()` dinamis mati.
  4. v141 `4713489` — `Login` tak pernah tercatat: `setupAuditHooks()` menambal `app.login` dari `onUser()`, yaitu SESUDAH login selesai → kode mati. Fix: `onUser()` deteksi transisi `isLoggedIn` false→true lalu `await audit.logAudit('Login')`.
- `sw.js` = `mtc-asset-v141`. Versi SW NAIK tiap `src/**` atau `public/**` berubah — tidak bisa dinegosiasi.

## Jebakan keras (baca sebelum ngoding)
- **`order: 'post'` di `vite.config.js` itu WAJIB.** `enforce` mengurutkan plugin; `order` mengurutkan hook. Vite menyuntik `__vite__mapDeps` di `generateBundle` plugin import-analysis. Tanpa `order: 'post'` hasilnya `ref ditambal: 0`.
- **Nama chunk tidak berubah walau isinya berubah** (`__vite__mapDeps` disuntik setelah hash nama dihitung). Cache `immutable` bisa menyajikan versi lama; satu-satunya pemutus = bump `CACHE_NAME`.
- **Jangan** pakai `import ... from '../db.js'` statis di `src/**` — dilarang `tests/data-layer-lazy.test.js`; hanya `await import(...)`.
- Urutan boot `src/main.js` wajib: `__loadDataLayer()` → `__loadApp()` → `__loadAppShell()` → `instance.onUser(user)`.
- `bootstrap.js` wajib memanggil `checkUserRole` SEKALI dan `loadAISettings` SEKALI (dihitung regex tes).
- Jangan turunkan ratchet `vitest.config.js` (stmt 96 / branch 89 / func 96 / line 97).
- Jangan fire-and-forget `import().then()` di `onUser` — microtask belum jalan saat assertion tes; pakai `await`.
- `database.rules.json` TIDAK di-deploy CI. `AuditTrail` = create-only (tanpa update/delete).
- PowerShell: `&&` tidak valid → pakai `cmd /c "a && b"`. Jangan `Select-Object` di dalam `cmd /c`. Jangan `node -e` dengan regex/`||`/`["` inline → tulis berkas `scratch/*.mjs`.
- `edit_file` sering gagal karena CRLF → periksa dulu dengan `node -e "fs.readFileSync(p,'utf8').split(/\r?\n/)..."`.
- `git add/commit/push` GAGAL di sandbox (`.git/index.lock` ditolak) → jalankan per perintah dengan `BypassSandbox: true`, jangan dirantai `&&`.
- CLI Firebase gagal auth di environment ini → jangan pakai untuk cek RTDB. Pakai probe `fetch` di `scratch/*.mjs`.
- Hapus berkas `scratch/*.mjs` milikmu setelah selesai. Jangan sentuh scratch lama.

## Gerbang verifikasi (WAJIB satu turn sebelum klaim "selesai")
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```
Angka acuan v141: `126 files / 2418 tests PASS`, coverage exit 0, build `ref ditambal: 4`, `[verify-precache] OK — 60 berkas`.
Lalu cek prod:
```bash
gh run list -L 3
gh run watch <id Build and Deploy> --exit-status
node scratch/probe.mjs   # fetch sw.js + semua aset precache, pastikan tak ada text/html
```

## TODO yang belum diverifikasi end-to-end
- Jalur tulis audit untuk Equipment / Log-WO / Spare Part / Performance / PM Task / Requisition (8 pemanggil `window.auditModule?.logAudit?.(...)`). Secara teori sudah hidup sejak v139 karena `onUser()` meng-`await` modulnya — **tetapi belum diuji nyata di browser**. Uji: buat/ubah 1 data, pastikan `DATA MUTATIONS` di Audit Trail tidak `0`.
- `PROMPT-D20.md` dan `TASK-REA-S53.md` belum ditinjau — cek dulu apakah masih relevan sebelum dihapus.

## Aturan gaya
Persona Rin (tsundere, Bahasa Indonesia, ringkas <10 baris). Alur Spec-First: klarifikasi → spec → rencana → APPROVAL eksplisit → baru koding. Aturan `AGENTS.md` repo tetap berlaku.
