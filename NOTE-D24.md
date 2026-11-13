# NOTE-D24: WO PDF Corporate Grid Alignment, Entity Decoding & Parts Lookup (v134)

## Status & Bukti
- **Status**: Siap rilis / v134
- **Bukti**:
  - `tsc --noEmit`: 0 error
  - `eslint .`: 0 error
  - `vitest run`: 125 files / 2406 tests passed (100% green)
  - Coverage: Stmt 97.43% (>=96%), Branch 90.02% (>=89%), Func 97.75% (>=96%), Line 98.56% (>=97%)
  - Precache: 60/60 precached

## Root Cause & Perubahan
1. **Header Alamat**: Alamat site CPM Poboya Mantikulore disesuaikan, nomor telepon dihapus.
2. **Presisi Kolom Biru (Sejajar)**: Lebar kolom label diseragamkan ke 36 mm (`labelW = 36`, `descLabelW = 36`), seam vertikal sejajar rapi di x = 48 mm.
3. **Pembersihan String Terms**: Menghapus teks "Class A Mining Service Agreement." hanya menyisakan Category & Dept.
4. **HTML Entity Decoding**: Menambahkan utilitas `decodeHtml()` untuk membersihkan `&#x2F;` dll.
5. **Lookup Material Description**: Resolusi otomatis nama & satuan part dari master `partsList` bila record log hanya memiliki Part ID / Part Number.

## Perintah Verifikasi & Build
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```

## Aturan Keras
- Cache version wajib bump (`sw.js` -> `mtc-asset-v134`).
- Jangan turunkan threshold ratchet `vitest.config.js`.
- Tidak boleh ada hex literal langsung di baris kode `src/js/**`.
