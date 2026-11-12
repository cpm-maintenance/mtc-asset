# NOTE-D18 — CI: pisahkan unduhan Playwright dari apt system deps

Status: **selesai**, terverifikasi lokal. Belum commit/push.

## Masalah

`test.yml` langkah `Install Playwright browsers` menjalankan
`npx playwright install --with-deps chromium`. Flag `--with-deps` mencampur
dua operasi berbeda dalam satu langkah:

1. unduh biner browser dari CDN Playwright — jarang gagal;
2. `apt-get install` font/lib dari mirror Ubuntu — **gagal DNS dua kali berturut**:

```
Temporary failure resolving 'archive.ubuntu.com'
E: Unable to fetch some archives, maybe run apt update or try with --fix-missing?
Failed to install browsers / Installation process exited with code: 100
```

Akibatnya seluruh job `Test` merah, padahal langkah kode sebelumnya
(Lint, Typecheck, Unit, Coverage ratchet, Build project) hijau semua.

## Perbaikan

`.github/workflows/test.yml` — satu langkah jadi dua:

```yaml
- name: Install Playwright browser
  run: npx playwright install chromium

- name: Install Playwright system deps
  run: |
    for i in 1 2 3; do
      npx playwright install-deps chromium && exit 0
      echo "::warning::install-deps percobaan $i gagal, ulangi dalam 15s"
      sleep 15
    done
    echo "::error::install-deps gagal 3x berturut-turut"
    exit 1
```

Unduhan browser tidak lagi bergantung pada jaringan apt. Kalau apt tetap
flaky, pemasangan deps dicoba 3x dengan jeda 15 detik; kalau habis 3x baru
job benar-benar gagal (bukan langsung menyerah di percobaan pertama).

## Tes

`tests/ci-playwright-install.test.js` (3 tes): tidak ada flag deps bawaan di
`install`; step unduh & step deps terpisah; step deps punya retry ≥3x + sleep.
RED 3/3 → GREEN 3/3.

## Gerbang

```
npx tsc --noEmit                     exit 0
npx eslint .                         exit 0
npx vitest run --coverage            122 files / 2347 passed
coverage                             97.48 / 90.24 / 97.7 / 98.53
npx vite build                       ✓ built in 8.86s
node scripts\verify-precache.mjs     OK — 60 berkas
```

YAML ter-parse bersih (13 step terbaca) — bukan cuma dicek via regex.

`sw.js` **tidak** naik versi: hanya `.github/workflows/test.yml` + `tests/**`.

