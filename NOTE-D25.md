# NOTE-D25: Dual Part Input (Link & Manual) + Performance Listener Auth Cleanup (v135)

## Status & Bukti
- **Status**: Siap rilis / v135
- **Bukti**:
  - `tsc --noEmit`: 0 error
  - `eslint .`: 0 error
  - `vitest run`: 125 files / 2410 tests passed (100% green)
  - Coverage: Stmt 97.43% (>=96%), Branch 89.96% (>=89%), Func 97.77% (>=96%), Line 98.54% (>=97%)
  - Precache: 60/60 precached

## Root Cause & Perubahan
1. **Performance Listener Cleanup & Permission**:
   - `data.js`: Abaikan PERMISSION_DENIED pada listener `Performance` jika user bukan supervisor / token refresh lag.
   - `auth.js` & `main.js`: Panggil `_cleanupFirebaseListeners()` saat logout / unauthenticated agar listener RTDB tidak tertinggal.
2. **Dual Part Input (Link Master & Manual Text)**:
   - UI `app-shell.html` & `WorkOrders.html`: Tambah tombol `+ Link Part` dan `+ Manual Part`.
   - Baris Link: Dropdown komponen database master `allParts` + Qty.
   - Baris Manual: Input text `Nama/Deskripsi Part` + `No. Part (opsional)` + Qty.
   - `logs.js`: `addPartToLog(type = 'link'|'manual')`, simpan `{ type: 'manual', name, partNumber, qty, uom }` ke `PartsUsed`.
   - Potong stok & availability check: Part manual dilewati (tidak potong stok database).
   - WO PDF: Cetak part manual secara rapi di tabel Parts Used.

## Perintah Verifikasi & Build
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```

## Aturan Keras
- Cache version wajib bump (`sw.js` -> `mtc-asset-v135`).
- Tidak boleh ada teks di bawah 12px (`text-[8px]`, `text-[9px]`) di modal input log (`tests/log-form-layout.test.js`).
- Jangan turunkan threshold ratchet `vitest.config.js`.
