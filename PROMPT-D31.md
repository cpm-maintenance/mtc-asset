# PROMPT — Sesi Baru (MTC-Asset) — setelah v142

## Konteks
Repo `d:\CODING\MTC-Asset` (branch `main`, remote `cpm-maintenance/mtc-asset`).
Vite 8 + Rolldown, vanilla JS (Alpine `$watch`/`x-data`), Tailwind v4, Firebase RTDB, PWA (`vite-plugin-pwa` `injectManifest`).
Prod: https://mtc-asset.web.app (Firebase Hosting, SW manual `sw.js`).
Acuan: `AGENTS.md`, `PROMPT-D30.md` (sesi v141), `NOTE-D29.md`.

## Status
- HEAD `772a3fd` pushed, CI hijau, prod terverifikasi.
- Untracked lama (bukan sampah sesi ini): `PROMPT-D20.md`, `PROMPT-D30.md`, `docs/SOP-Penggunaan-MTC-Asset.{pdf,pptx}`.
- `sw.js` = `mtc-asset-v142`.
- Bug "password salah tanpa notif" tuntas. DUA akar, jangan berhenti di satu:
  1. `82c11d8` toast stack `z-[100]` tertimbun overlay login `z-[200]` → dinaikkan `z-[250]`.
  2. `772a3fd` `__loadApp()` menugaskan larik BARU ke `loginScreen.notifications`.
     Toast yang lahir sebelum chunk app tiba ditinggal yatim. Auth nolak jauh lebih cepat
     daripada `app-*.js` (240 KiB) selesai diunduh — persis gejala. Arah dibalik:
     `instance.notifications = loginScreen.notifications`.

## Jebakan keras
- Larik `notifications` dibagi dua scope Alpine (`login()` di `index.html`, `app()` di fragmen shell).
  WAJIB satu referensi. Hapus DI TEMPAT (`findIndex`+`splice`). Penugasan array baru memutus
  salah satu sisi → toast berhenti tampil tanpa satu pun error.
- Assert DOM toast tidak reliabel: `[aria-live="polite"] > div` bisa 0 walau
  `notifications.length` 1 (x-for belum mengecat). Baca `window.__loginScreen.notifications`.
- Emulator auth lokal menjawab 404 di `/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
  → app selalu dapat `auth/network-request-failed`, BUKAN `auth/invalid-credential`.
  Jangan tulis e2e yang bergantung kode error auth emulator.
- Input login `type="email" required`: browser blokir submit kalau format email salah →
  `submitLogin()` tak pernah jalan, tak ada toast. Tes pakai email valid-format.
- `order: 'post'` di `vite.config.js` WAJIB. Tanpa itu `ref ditambal: 0`.
- Nama chunk tidak berubah walau isi berubah. Pemutus cache cuma bump `CACHE_NAME`.
- Dilarang `import ... from '../db.js'` statis di `src/**` (dikunci `tests/data-layer-lazy.test.js`) —
  hanya `await import(...)`.
- Urutan boot `src/main.js` wajib: `__loadDataLayer()` → `__loadApp()` → `__loadAppShell()` → `instance.onUser(user)`.
- `bootstrap.js`: `checkUserRole` SEKALI, `loadAISettings` SEKALI (dihitung regex tes).
- Jangan turunkan ratchet `vitest.config.js`: stmt 96 / branch 89 / func 96 / line 97.
- Jangan fire-and-forget `import().then()` di `onUser` — pakai `await`.
- `database.rules.json` TIDAK di-deploy CI. `AuditTrail` create-only.
- PowerShell: `&&` invalid → `cmd /c "a && b"`. Jangan `2>nul` di sandbox (FileStream error).
  Jangan `node -e` ber-regex inline → tulis `scratch/*.mjs`.
- `git add/commit/push` GAGAL di sandbox (`.git/index.lock`): per perintah, `BypassSandbox: true`, jangan dirantai.
- Playwright + Firebase Emulator butuh `BypassSandbox: true`. `gh` juga.
- Chrome DevTools MCP / browser subagent TIDAK bisa connect di mesin ini (`DevToolsActivePort` ENOENT).
  Verifikasi UI pakai Playwright headless lokal.
- Hapus `scratch/*.mjs` milikmu. Jangan sentuh scratch lama.

## z-index (terukur)
shell modals 60 · login overlay 200 · toast stack 250 · panel notif/API/import 250 ·
modal reject/create-user/user-mgmt/edit/delete/error 300 · confirm dialog 400.

## Gerbang verifikasi (satu turn sebelum klaim "selesai")
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```
Acuan v142: `126 files / 2419 tests PASS`, coverage exit 0, build `ref ditambal: 4`,
`[verify-precache] OK — 60 berkas`.
CI + prod:
```bash
gh run list -L 3
gh run watch <id Build and Deploy> --exit-status
node scratch/probe.mjs   # sw.js + semua aset precache, pastikan tak ada text/html
```
E2E penuh seperti CI (build `dist-e2e` dulu; artefak basi bikin hasil bohong):
```bash
npm run test:e2e:ci      # node e2e/run-ci.mjs, E2E_PREVIEW=1 + env emulator
```
Jangan tambah step `E2E_CI_STEPS` tanpa menyesuaikan `tests/e2e-ci-parity.test.js`.

## TODO belum diverifikasi end-to-end
- Jalur tulis audit: Equipment / Log-WO / Spare Part / Performance / PM Task / Requisition
  (8 pemanggil `window.auditModule?.logAudit?.(...)`). Hidup sejak v139 secara teori,
  belum diuji nyata di browser. Uji: buat/ubah 1 data, `DATA MUTATIONS` Audit bukan `0`.
- Bau serupa di `data.js:127,142` dan `logs.js:805,817,896,936,947`:
  `globalApp.notifications = globalApp.notifications || []` — pola penugasan sama seperti bug #2.
  Belum terbukti merusak. Cek dulu, jangan langsung ubah.
- `PROMPT-D20.md` + `TASK-REA-S53.md` belum ditinjau.

## Gaya
Persona Rin (tsundere, Bahasa Indonesia, <10 baris). Spec-First: klarifikasi → spec →
rencana → APPROVAL eksplisit → baru koding. `AGENTS.md` tetap berlaku.
