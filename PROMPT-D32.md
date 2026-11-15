# PROMPT — Sesi Baru (MTC-Asset) — setelah v144

## Konteks
Repo `d:\CODING\MTC-Asset` (branch `main`, remote `cpm-maintenance/mtc-asset`).
Vite 8 + Rolldown, vanilla JS (Alpine `$watch`/`x-data`), Tailwind v4, Firebase RTDB, PWA (`vite-plugin-pwa` `injectManifest`).
Prod: https://mtc-asset.web.app (Firebase Hosting, SW manual `sw.js`).
Acuan: `AGENTS.md`, `PROMPT-D31.md` (sesi v142), `NOTE-D29.md`.

## Status
- HEAD `d7a0c0d` pushed, CI hijau, prod terverifikasi (deploy live).
- `sw.js` = `mtc-asset-v144`.
- Sesi ini (v143→v144) tuntas — WO **time opsional**:
  1. `bb8e1af` — pecah `startDate`/`endDate` jadi 4 input `date`+`time` (time opsional).
     Helper `splitDateTime`/`joinDateTime` (log.js); downgrade & validasi pakai gabungan,
     date-only tetap kompatibel; bump `sw.js` v143→v144.
  2. `d7a0c0d` — add `PROMPT-D20/D30/D31.md` + `docs/SOP-Penggunaan-MTC-Asset.{pdf,pptx}`.
- Utang sebelumnya masih berdiri (lihat PROMPT-D31 TODO): audit jalur tulis, cek
  `globalApp.notifications = globalApp.notifications || []` di `data.js:127,142`
  & `logs.js:805,817,896,936,947`, tinjau PROMPT-D20 + `TASK-REA-S53.md`.

## Jebakan keras (rekam dari PROMPT-D31, tetap berlaku)
- Git tulis (add/commit/push) GAGAL di sandbox `.git/index.lock` → per perintah `BypassSandbox: true`, jangan dirantai.
- Nama chunk tidak berubah walau isi berubah. Pemutus cache cuma bump `CACHE_NAME`.
- Dilarang `import ... from '../db.js'` statis di `src/**` — hanya `await import(...)`.
- Urutan boot `src/main.js`: `__loadDataLayer()` → `__loadApp()` → `__loadAppShell()` → `instance.onUser(user)`.
- Jangan turunkan ratchet `vitest.config.js`: stmt 96 / branch 89 / func 96 / line 97.
- PowerShell: `&&` invalid → `cmd /c "a && b"`. Jangan `2>nul` di sandbox (FileStream error).
- Jangan `node -e` ber-regex inline → tulis `scratch/*.mjs`. Hapus scratch milikmu.
- Playwright + Firebase Emulator + `gh` butuh `BypassSandbox: true`.
- Chrome DevTools MCP / browser subagent TIDAK connect di mesin ini. Verifikasi UI via Playwright headless lokal.
- Larik `notifications` dibagi dua scope Alpine — WAJIB satu referensi, hapus DI TEMPAT (`findIndex`+`splice`).
- Assert DOM toast tak reliabel — baca `window.__loginScreen.notifications`.
- Emulator auth lokal selalu `auth/network-request-failed` (bukan `invalid-credential`).
- `database.rules.json` TIDAK di-deploy CI. `AuditTrail` create-only.

## z-index (terukur)
shell modals 60 · login overlay 200 · toast stack 250 · panel notif/API/import 250 ·
modal reject/create-user/user-mgmt/edit/delete/error 300 · confirm dialog 400.

## Gerbang verifikasi (satu turn sebelum klaim "selesai")
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```
Acuan v144: `126 files / 2419 tests PASS`, build ok, `[verify-precache] OK — 60 berkas`.
CI + prod:
```bash
gh run list -L 3
gh run watch <id Build and Deploy> --exit-status
node scratch/probe.mjs   # sw.js + semua aset precache, pastikan tak ada text/html
```
E2E penuh seperti CI (build `dist-e2e` dulu):
```bash
npm run test:e2e:ci      # node e2e/run-ci.mjs, E2E_PREVIEW=1 + env emulator
```
Jangan tambah step `E2E_CI_STEPS` tanpa menyesuaikan `tests/e2e-ci-parity.test.js`.

## TODO belum diverifikasi end-to-end
- Jalur tulis audit (8 pemanggil `window.auditModule?.logAudit?.(...)`). Uji: buat/ubah 1 data,
  `DATA MUTATIONS` Audit bukan `0`.
- `globalApp.notifications = globalApp.notifications || []` di `data.js:127,142`
  & `logs.js:805,817,896,936,947` — pola sama dengan bug toast. Cek dulu, jangan langsung ubah.
- `PROMPT-D20.md` + `TASK-REA-S53.md` belum ditinjau.

## Gaya
Persona Rin (tsundere, Bahasa Indonesia, <10 baris). Spec-First: klarifikasi → spec →
rencana → APPROVAL eksplisit → baru koding. `AGENTS.md` tetap berlaku.
