# MTC-Asset Development History

## Tanggal: 5 Mei 2026

---

## Progres Hari Ini

### ✅ Yang Sudah Selesai

1. **Firebase Security Rules**
   - File: `database.rules.json`
   - Diperbaiki dari strict validation ke simplified rules
   - Semua authenticated user bisa write ke HistoryLog

2. **Work Order PDF Template**
   - File: `src/js/modules/wo-pdf-template.js`
   - Design professional industrial standard
   - Ada signature boxes (Requested, Approved, Executed)

3. **Spare Parts Filtering**
   - Jika >20 items, sembunyikan list sampai ada filter
   - File: `src/js/app.js` (filteredAllParts getter)

4. **Fix Alpine Issues**
   - x-collapse dihapus (plugin tidak ada)
   - safeProcessFirebaseData di-export dari data.js ke logs.js

5. **Work Orders & All Logs Separation**
   - filteredWorkOrders getter - Work Orders menu
   - filteredAllLogs getter - All Logs menu
   - External equipment tidak muncul di All Logs

---

## Tanggal: 21 Juni 2026 — Sesi Restore & Fix Besar

### ✅ Yang Sudah Selesai

1. **Restore Data Project**
   - `index.html` kosong (0 bytes) → direstore dari git ✅
   - `REFACTORING_GUIDE.md` terhapus → direstore ✅
   - File `public/pages/WorkOrders.html`, `src/js/app.js`, `src/js/modules/data.js` di-restore ✅
   - Firebase data **aman** (18 Equipment, 50 SpareParts, 4 Users, dll)

2. **Commit File Baru**
   - 7 file modal components di `public/components/modals/` di-commit (commit `cd36efa`) ✅
   - Push ke `origin/main` ✅

3. **Fix Chart.js Error**
   - **Masalah:** Dynamic import `chart.js/auto` gagal karena race condition + di-exclude dari optimizeDeps
   - **Fix:** Ganti ke static import `import { Chart, registerables } from 'chart.js'`
   - File: `src/js/app.js`, `vite.config.js`

4. **Fix Dark Theme (Default)**
   - **Masalah:** Theme default ke light (card putih, text hitam) — tidak cocok untuk industrial app
   - **Fix:** 
     - `index.html` — theme script default ke DARK jika belum ada localStorage
     - `src/js/app.js` — `darkMode` default `true`
     - One-time migration: hapus `darkMode=false` lama dari localStorage
   - File: `index.html`, `src/js/app.js`

5. **Fix Status Badge Colors**
   - **Masalah:** `statusColor()` dan `critColor()` pakai warna light mode (bg-emerald-50, text-rose-600) — tidak terlihat di dark bg
   - **Fix:** Ganti ke dark colors (text-emerald-400, bg-emerald-500/10, dll)
   - File: `src/js/modules/ui.js`

6. **Fix CSS Card Layout**
   - **Masalah:** `.card-modern` di light theme punya `background: #ffffff !important` — bikin card putih solid
   - **Fix:** Ganti ke `rgba(255,255,255,0.8)` transparan
   - **Masalah:** Tailwind tidak scan `public/pages/*.html` — grid classes tidak tergenerate
   - **Fix:** Tambah path ke `tailwind.config.js content`
   - File: `src/css/style.css`, `tailwind.config.js`

7. **Hapus Panel Diagnostik & Debug**
   - Panel merah "DIAGNOSTIK Spare Parts" dihapus
   - Panel kuning "DIAGNOSTIK Performance" dihapus
   - Label `[debug: currentPage]` di header dihapus
   - File: `public/pages/SpareParts.html`, `public/pages/Performance.html`, `index.html`

8. **Commit & Push Semua Fix**
   - Commit: `30ea84d` ✅
   - 10 files changed, +1490 -81
   - Pushed ke `origin/main`

---

## ⚠️ Masalah Belum Terpecahkan

### 1. Work Orders List Hilang Setelah Refresh
- **Status:** BELUM DIFIX
- **Gejala:** Setelah refresh halaman, list Work Orders kosong
- **File terkait:** `src/js/modules/data.js`, `src/js/app.js`

### 2. Performance Input — Form belum accept untuk bulk import

### 3. Deploy ke hosting belum dijalankan ulang setelah fix

---

## 📋 Tugas Selanjutnya (Prioritas)

### 🔴 Priority High
1. **Fix Work Orders list hilang setelah refresh**
   - Cek Firebase listener `setupFirebaseListeners()` — mungkin belum siap
   - Cek pagination `loadMoreLogs()` di `data.js`
   - Cek Alpine reactivity dengan filteredWorkOrders getter

### 🟡 Priority Medium
2. **Deploy ke hosting**
   ```bash
   npm run build
   npx firebase deploy --only hosting
   ```

3. **Periksa semua modal di `public/components/modals/`**
   - APISettingsModal ✅, EquipmentModal ✅, LogModal ✅
   - PerformanceModal ✅, QRPreviewModal ✅, QRScannerModal ✅, SparePartsModal ✅
   - Pastikan semuanya terintegrasi dengan Alpine

### 🟢 Priority Low
4. **Refactor/WO fix: pdf export WO**
5. **Export to PDF untuk halaman lain**
6. **Bulk import performance data**

---

## Website URL
https://mtc-asset.web.app

## Command Penting
```bash
# Development
npm run dev

# Build & Deploy
npm run build
npx firebase deploy --only hosting
npx firebase deploy --only database

# Backup
npm run backup              # Firebase + git commit
npm run backup:firebase     # Firebase only
scripts/backup.bat          # Windows double-click

# Git
git add -A && git commit -m "message" && git push
```

## File Penting
- `src/js/app.js` — Main app dengan getters
- `src/js/modules/data.js` — Firebase listeners
- `src/js/modules/ui.js` — Dark mode, notifications, status colors
- `src/js/modules/logs.js` — Log management
- `index.html` — Template utama + modals
- `public/pages/*.html` — Halaman components (extracted)
- `public/components/modals/*.html` — Modal components
- `tailwind.config.js` — Tailwind config (content paths penting!)
- `database.rules.json` — Firebase rules
- `vite.config.js` — Build config

---

*Last backup: 21 Juni 2026 — backups/backup-2026-06-21_16-11-06.json*
*Commit terakhir: `30ea84d` — push ke origin/main*

## 📝 Catatan Sesi Dibuat

File `SESSION_NOTES.md` dibuat untuk membantu melanjutkan tugas besok. Berisi:
- Ringkasan semua yang sudah dikerjakan hari ini
- Daftar masalah yang belum terpecahkan (dengan prioritas)
- File-file penting
- Command cepat
- Pelajaran penting (jangan dilupakan!)

**Commit:** `077208b` — update DEVELOPMENT_LOG.md
