# NOTE-D26: Premium Form Field Glow & Modal Compact Layout (v136)

## Status & Bukti
- **Status**: Siap rilis / v136
- **Bukti**:
  - `tsc --noEmit`: 0 error
  - `eslint .`: 0 error
  - `vitest run`: 125 files / 2410 tests passed (100% green)
  - Coverage: Stmt 97.43% (>=96%), Branch 89.96% (>=89%), Func 97.77% (>=96%), Line 98.54% (>=97%)
  - Precache: 60/60 precached

## Root Cause & Perubahan
1. **Refined Field Depth & Micro-Glow (`style.css`)**:
   - Ganti bevel berat `--field-well` menjadi flat-depth halus: `inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)`.
   - Tambah micro-glow pada `:focus` ring: `0 0 0 2px rgb(var(--tac-primary)/0.5), 0 0 12px -2px rgb(var(--tac-primary)/0.35)`.
   - Hover state pada semua input non-disabled di-highlight halus `rgb(var(--tac-gold-bright) / 0.45)`.
2. **Modal Section Layout Rapi (`app-shell.html`)**:
   - Buang radius berlebih `rounded-[3rem]` dan padding kembung pada kontainer Components Linked, ganti ke `rounded-2xl p-5 sm:p-6 shadow-lg`.
   - Seluruh form terasa lebih compact, ringan, dan tactile.

## Perintah Verifikasi & Build
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```

## Aturan Keras
- Cache version wajib bump (`sw.js` -> `mtc-asset-v136`).
- `--field-ring` wajib mempertahankan substring `0 0 0 2px` (`tests/form-controls.test.js`).
- Jangan turunkan threshold ratchet `vitest.config.js`.
