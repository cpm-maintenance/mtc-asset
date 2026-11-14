# NOTE-D27: Card-Based Form Template & Modal Polish (v137)

## Status & Bukti
- **Status**: Siap rilis / v137
- **Bukti**:
  - `tsc --noEmit`: 0 error
  - `eslint .`: 0 error
  - `vitest run`: 125 files / 2410 tests passed (100% green)
  - Precache: 60/60 precached

## Root Cause & Perubahan
1. **Card-Based Sectioning (`app-shell.html`)**:
   - Seksi *Asset & Activity*, *Work Order Settings*, *Diagnosis & Briefing*, dan *Visual Documentation* dibungkus sub-card tipis (`bg-tac-surface-card/40 border border-tac-border-tactical/70 p-4 sm:p-6 rounded-2xl shadow-sm`).
   - Seksi *Department Request* `<details>` memakai styling card serasi (`bg-tac-surface-card/30 border border-tac-border-tactical/60 rounded-2xl`).
   - Seluruh bagian modal kini memiliki hierarki visual modular yang konsisten dengan *Components Linked*.
2. **Modal Frame & Sticky Action Bar Polish**:
   - Pangkas sudut luar `rounded-2xl md:rounded-[3rem]` menjadi `rounded-2xl` serasi enterprise.
   - Sticky action bar di bawah disesuaikan agar flush di desktop (`lg:-mx-10 lg:px-10`) ditambah elevasi bayangan pemisah (`shadow-[0_-4px_16px_rgba(0,0,0,0.3)]`).

## Perintah Verifikasi & Build
```bash
cmd /c "npm run typecheck && npm run lint && npm run test:run"
cmd /c "npm run test:coverage && npm run build && npm run verify:precache"
```

## Aturan Keras
- Cache version wajib bump (`sw.js` -> `mtc-asset-v137`).
- Kontrak `tests/log-form-layout.test.js`, `tests/form-desktop-width.test.js`, dan `tests/modal-scroll-contract.test.js` wajib tetap hijau.
