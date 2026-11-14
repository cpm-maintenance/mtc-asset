# NOTE-D28: All Modals Frame & Header Standardization (v138)

## Status & Bukti
- **Status**: Siap rilis / v138
- **Bukti**:
  - `tsc --noEmit`: 0 error
  - `eslint .`: 0 error
  - `vitest run`: 125 files / 2410 tests passed (100% green)
  - Precache: 60/60 precached

## Root Cause & Perubahan
1. **Frame Outer Radius Standardization (`app-shell.html`)**:
   - Ganti sisa radius balon `md:rounded-[2.5rem]` dan `md:rounded-[3rem]` pada modal *Asset Configuration* (`showEquipModal`), *Spare Part Registry* (`showPartModal`), dan *Performance Target* (`showPerformanceModal`) menjadi `rounded-2xl shadow-2xl`.
2. **Unified Header Squircle Badge**:
   - Samakan struktur header pada *Asset* dan *Spare Part* dengan badge squircle emas (`w-12 h-12 rounded-2xl bg-tac-primary-container`), judul uppercase tebal, dan subtitle monospaced tipis, serasi dengan modal Work Order.

## Perintah Verifikasi & Build
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```

## Aturan Keras
- Cache version wajib bump (`sw.js` -> `mtc-asset-v138`).
- Kontrak `tests/form-desktop-width.test.js` dan `tests/modal-scroll-contract.test.js` wajib tetap hijau.
