# NOTE-D11 — Handoff Session

**Status:** HEAD = `origin/main` = `2a4e273`. Tree bersih. `sw.js` = `mtc-asset-v121`.
Stack: vanilla JS + Alpine + Firebase RTDB + Vite 8.3.5 + Vitest 4.1.12.

## Gate (wajib di turn yang sama saat klaim selesai)

```
cmd /c "npx tsc --noEmit"
cmd /c "npx eslint ."
cmd /c "npx vitest run --coverage"
cmd /c "npx vite build"
cmd /c "node scripts\verify-precache.mjs"
```

Baseline `2a4e273`: tsc 0 · eslint 0 · **114 files / 2298 tests** · coverage
**97.47 / 90.2 / 97.7 / 98.52** · build `3.74s` (app 233.95 kB) · precache `OK — 60 berkas`.

## Aturan keras

- Ratchet `vitest.config.js` 96/89/96/97 — jangan diturunkan.
- Jangan `npm audit fix --force`, jangan upgrade `xlsx`.
- Jangan refactor/split `src/js/app.js`. Jangan sentuh `globals.d.ts`.
- `sw.js` naik versi tiap `src/**` atau `public/**` berubah.
- Jangan commit `.env`. Git ops butuh `BypassSandbox: true`.
- Jangan tulis kode sebelum APPROVAL. Angka tool apa adanya; belum dicek = `VALIDATION REQUIRED`.

## Jebakan tooling (PowerShell 5.1)

- Selalu `cmd /c "npx ..."`; jangan `&&` (pakai `cmd /c "a & b"`).
- Jangan `node -e` dengan regex/kutip. Commit message via `git commit -F`.
- `write_file` butuh `Overwrite: true` untuk menimpa.
- Output tool memakan karakter (`=>`, `=`, em dash) DAN menampilkan indentasi palsu.
  Verifikasi byte mentah via skrip Node `JSON.stringify(line)` sebelum line-surgery.

## D11 (selesai)

- `mapAuthError()` di `auth.js`: 10 kode `auth/*` → kalimat Indonesia, dipakai di
  `login()` / `loginWithSSO()` / `logout()`. Tidak ada lagi `auth/*` di toast.
- `if (this.isLoading) return;` di awal `login()` — guard double-submit.
- `isOnline` + listener online/offline di `createLoginScreen().init()`; badge
  `index.html` pakai `x-text`/`:class`, bukan teks statis "MODE OFFLINE".
- `app-dashboard-equip.test.js`: `today()` → tanggal LOKAL (UTC bikin merah 00:00–07:59 WIB).

## Jebakan yang sudah terbukti

- 137 cast `@type {any}` = load-bearing. Strip semua → 130 error tsc. Jangan diulang.
- 240 signature `any` polos di `appstate.ts` — kosmetik, payoff ≈ 0.

## Alur kerja

Measure → spec pendek berisi angka terukur → APPROVAL → kode + tes → gate 5 perintah →
angka verbatim → `COMMIT` → `PUSH`. Persona Rin: Indonesia, ringkas, code first.
