# 📋 Catatan Sesi — MTC-Asset

**Tanggal:** 21 Juni 2026
**Commit terakhir:** `30ea84d` — fix: default dark theme, tailwind scan public/pages, fix chart import, hapus debug panel
**Dev server:** http://localhost:3000/ (Vite v8.0.8)
**Firebase backup:** `backups/backup-2026-06-21_16-11-06.json` (88 records, 781 KB)

---

## ✅ Yang Sudah Selesai Hari Ini

### 1. Restore Data Project
- `index.html` kosong (0 bytes) → restore dari git
- `REFACTORING_GUIDE.md` terhapus → restore
- File `public/pages/WorkOrders.html`, `src/js/app.js`, `src/js/modules/data.js` di-restore
- Firebase data aman (18 Equipment, 50 SpareParts, 4 Users, dll)

### 2. File Baru di-commit
- 7 file modal components di `public/components/modals/` (commit `cd36efa`)
- EquipmentModal, LogModal, PerformanceModal, QRScannerModal, QRPreviewModal, APISettingsModal, SparePartsModal

### 3. Fix Chart.js Error
- **Masalah:** Dynamic import `chart.js/auto` gagal karena race condition
- **Fix:** Static import — `import { Chart, registerables } from 'chart.js'`
- File: `src/js/app.js`, `vite.config.js`

### 4. Fix Dark Theme Default
- **Masalah:** localStorage masih `darkMode=false` dari sesi sebelumnya
- **Fix:** One-time migration di `index.html` + default darkMode = `true` di `app.js`
- File: `index.html`, `src/js/app.js`

### 5. Fix Status Badge Colors
- **Masalah:** Warna light mode tidak terlihat di dark background
- **Fix:** Ganti ke dark-compatible colors (text-emerald-400, bg-emerald-500/10, dll)
- File: `src/js/modules/ui.js`

### 6. Fix CSS Card Layout
- **Masalah:** Card putih solid karena `background: #ffffff !important`
- **Masalah:** Tailwind tidak scan `public/pages/*.html` → grid classes tidak tergenerate
- **Fix:** Ganti ke `rgba(255,255,255,0.8)` + tambah path ke `tailwind.config.js content`
- File: `src/css/style.css`, `tailwind.config.js`

### 7. Hapus Panel Diagnostik & Debug
- Panel merah DIAGNOSTIK di SpareParts.html dihapus
- Panel kuning DIAGNOSTIK di Performance.html dihapus
- Label `[debug: currentPage]` di header dihapus

### 8. Firebase Backup
- Backup file: `backups/backup-2026-06-21_16-11-06.json`
- Semua data aman

### 9. Commit & Push
- `30ea84d` — semua fix sudah di-commit dan di-push ke `origin/main`
- `077208b` — update DEVELOPMENT_LOG.md

---

## ⚠️ Masalah Belum Terpecahkan

### 🔴 PRIORITAS TINGGI

| # | Masalah | File Terkait |
|---|---------|--------------|
| 1 | **Work Orders list hilang setelah refresh** — List WO kosong setelah refresh halaman. Curiga race condition Firebase listener | `src/js/modules/data.js`, `src/js/app.js` |
| 2 | **Deploy ulang ke hosting** — Perlu `npm run build` + `npx firebase deploy --only hosting` setelah semua fix | - |

### 🟡 PRIORITAS SEDANG
| # | Masalah | File Terkait |
|---|---------|--------------|
| 3 | **Periksa 7 modal components** — Pastikan semua terintegrasi dengan Alpine (EquipmentModal, LogModal, PerformanceModal, QRScannerModal, QRPreviewModal, APISettingsModal, SparePartsModal) | `public/components/modals/*.html` |
| 4 | **Cleanup `app.js.temp`** — Cek apakah file temporary masih ada | `src/js/` |

### 🟢 PRIORITAS RENDAH
| # | Masalah | File Terkait |
|---|---------|--------------|
| 5 | **PDF Export Work Orders** | `src/js/modules/wo-pdf-template.js` |
| 6 | **Bulk Import Performance Data** | Performance page |
| 7 | **Export PDF untuk halaman lain** | - |

---

## 📁 File Penting untuk Diketahui

| File | Fungsi |
|------|--------|
| `src/js/app.js` | Main app — Alpine getters, filteredWorkOrders, filteredAllLogs |
| `src/js/modules/data.js` | Firebase listeners — setupFirebaseListeners(), loadMoreLogs() |
| `src/js/modules/ui.js` | Dark mode toggle, notification, status colors |
| `src/js/modules/logs.js` | Log management — safeProcessFirebaseData |
| `index.html` | Template utama — semua halaman via component-loader |
| `public/pages/*.html` | 10 halaman sudah di-extract (Dashboard, Equipment, dll) |
| `public/components/modals/*.html` | 7 modal components |
| `tailwind.config.js` | **PASTIKAN** content path mencakup `public/pages/` dan `public/components/` |
| `vite.config.js` | Build config — chart.js TIDAK di optimizeDeps exclude |
| `database.rules.json` | Firebase security rules |
| `backups/` | Folder backup Firebase JSON |

---

## 🚀 Command Cepat

```bash
# Dev server
npm run dev

# Build & deploy hosting
npm run build
npx firebase deploy --only hosting

# Deploy database rules
npx firebase deploy --only database

# Backup lengkap (Firebase + git)
npm run backup

# Backup Firebase saja
npm run backup:firebase

# Git commit + push
git add -A && git commit -m "pesan"
git push
```

**GIT:** Gunakan `&&` atau `;` untuk multi-command di PowerShell (jangan pipe `|`)

---

## 🧠 Pelajaran Penting (Jangan Dilupakan!)

1. **Chart.js** — Harus static import `import { Chart, registerables } from 'chart.js'`. JANGAN pakai `chart.js/auto` dynamic import.
2. **Tailwind content** — Jika nambah halaman baru di `public/pages/`, pastikan path-nya sudah ada di `tailwind.config.js content`.
3. **Dark mode** — Default sudah dark. One-time migration di `index.html` sudah jalan.
4. **Card layout** — Grid classes (`grid-cols-2`, `lg:grid-cols-3`) butuh Tailwind content scan.
5. **Component-loader** — Semua halaman dimuat via `x-page` Alpine directive. File ada di `public/pages/`.

---

## 🔗 Link Penting

- **Live site:** https://mtc-asset.web.app
- **GitHub repo:** https://github.com/cpm-maintenance/mtc-asset
- **Firebase Console:** https://console.firebase.google.com/project/mtc-asset/overview

---

*Dibuat: 21 Juni 2026 16:40 WIB*
*Next session: Fix Work Orders list → Build → Deploy*
