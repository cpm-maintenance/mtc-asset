# NOTE-D23: Work Order PDF Korporat CPM (Grid TemplateLab, v133)

## Status & Bukti
- Versi: `sw.js` naik ke `mtc-asset-v133`. Commit: `4239d40`.
- Test suite: **125 files / 2403 passed** (100% hijau).
- Coverage: Statements **97.44%**, Branches **90.20%**, Functions **97.75%**, Lines **98.56%** (ratchet: 96/89/96/97 — utuh).
- Precache: **60 berkas** build ter-precache (`verify-precache.mjs` OK).
- Typecheck & Lint: `tsc --noEmit` clean, `eslint .` clean.
- CI GitHub Actions (push `4239d40`): **3/3 success**
  - Build and Deploy: 1m30s (ID: 43439863427)
  - Test: 3m12s (ID: 43439863238)
  - Lighthouse CI: 1m2s (ID: 43439863233)
- Prod Probe (`https://mtc-asset.web.app`):
  - `GET / -> 200 OK`
  - `GET /sw.js -> 200 cache=mtc-asset-v133`
  - `PROD LIVE & VERIFIED`

## Ringkasan Perubahan
1. `src/js/modules/wo-pdf-template.js`:
   - Rombak total ke layout grid tabular formal TemplateLab / Mining Standard.
   - Header kop CPM + banner MAINTENANCE WORK ORDER.
   - 2-kolom metadata grid berbingkai (label solid biru, data putih, badge status/priority).
   - Terms of Service & Brief Work Description terbingkai dengan wrap aman tanpa clipping.
   - Tabel Parts Used: Header biru, zebra striping, dan baris subtotal TOTAL ITEMS.
   - Blok bawah sejajar: 3 kolom tanda tangan basah di kiri, rekap jam & biaya di kanan.
2. `tests/wo-pdf-template.test.js`:
   - Sinkronisasi lebar sel wrap deskripsi (140 mm).
3. `sw.js`:
   - Naik versi cache ke `mtc-asset-v133`.

## Jebakan & Catatan
- Trailing hex code dalam komentar JS (misal `// #1B559B`) akan ditangkap regex `legacy-palette.test.js` sebagai pelanggaran tema. Gunakan deskripsi nama warna tanpa karakter `#`.

## Perintah Verifikasi
```bash
cmd /c "npx tsc --noEmit && npx eslint ."
cmd /c "npm run test:run"
cmd /c "npm run test:coverage"
cmd /c "npm run build && npm run verify:precache"
```
