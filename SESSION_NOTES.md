# SESSION NOTES — MTC-Asset

## Session: 3 Juli 2026

### ✅ Completed
1. **Fix Work Orders list hilang setelah refresh**
   - Mengubah wrapper dynamic page components di `index.html` dari `x-show` menjadi `<template x-if="...">`.
2. **Fix Concurrency Bug di Bulk Complete PM**
   - Menggunakan suffix acak unik (`Math.random()`) pada `pmId` di `pm-schedule.js` untuk mencegah overwrite saat eksekusi paralel.
   - Menambahkan unit test keunikan ID di `tests/utils.test.js`.
3. **Fix DOMException Proxy Cloning**
   - Menggunakan `window.Alpine.raw(data)` sebelum `structuredClone()` di `saveCache()` (`data.js`).
4. **Fix Permission Denied SpareParts**
   - Mengoreksi nama node `"Parts"` menjadi `"SpareParts"` di `firebase-database.rules.example.json`.
   - Mendeploy aturan database terbaru dari `database.rules.json` ke Firebase Console.
5. **Alarm Stok & BOM (Bill of Materials) Integration**
   - Mengintegrasikan deteksi stok suku cadang di bawah batas minimal (`Stok <= MinStock`) untuk peralatan terkait PM.
   - Menambahkan label alarm `⚠️ LOW STOCK` di halaman PM Schedule (desktop & mobile) dan Dashboard PM Widget.
   - Menambahkan tabel detail status ketersediaan suku cadang BOM di dalam PM Detail Modal.
   - Melakukan build & deploy produksi terbaru ke Firebase Hosting.
6. **Request Part & General Material (New Feature)**
   - Membuat menu navigasi baru di sidebar dan halaman baru `RequestPart.html` untuk pengajuan permintaan suku cadang / material umum.
   - Membuat modul `requisition.js` dengan alur workflow: Pending → Approved/Ordered → Arrived → Closed.
   - Saat barang tiba (`status = arrived`), stok spare part terkait otomatis bertambah di Firebase.
   - Menambahkan aturan Firebase database untuk node `Requisitions` & deploy ulang.
   - Build & deploy terakhir (database + hosting) sukses.
7. **Multi-Item Request Batch (Enhancement)**
   - Mengubah modal input dari single form menjadi multi-item dynamic list.
   - Setiap item dalam satu batch menjadi 1 record Firebase terpisah dengan `batchGroup` yang sama.
   - Tombol `+ Tambah Item Lain`, `Hapus`, validasi minimal 1 item valid.
   - Priority & Notes global diisi sekali untuk semua item.
   - Memperbesar ukuran form (max-w-3xl, p-8, text-sm, p-3) agar lebih nyaman.
   - Build & deploy hosting sukses.

## Session: 10 Juli 2026

### ✅ Completed
1. **Edit & Delete tombol di Request Part**
   - `RequestPart.html` — tombol Edit (cyan) dan Delete (rose) per baris, hanya muncul untuk `isAdmin` + status `pending`
   - `requisition.js` — `openRequisitionModal(req)` untuk edit mode, guard status di `submitRequisition()` dan `deleteRequisition()`
   - Guard `x-show="isAdmin"` di tombol New Request dan action buttons

2. **Realtime Listener Requisitions**
   - `requisition.js` — ganti `loadRequisitions()` (one-shot `get()`) ke `setupRequisitionsListener()` (`onValue()` realtime)
   - `bootstrap.js` — panggil `setupRequisitionsListener()` ganti `loadRequisitions()`

3. **Skeleton Loading RequestPart**
   - `index.html` — shimmer skeleton cards untuk RequestPart (konsisten dengan equip/parts pages)

4. **Firebase Rules Hardening**
   - `database.rules.json` — tambah `.validate` untuk Equipment (`hasChildren`), SpareParts (`hasChildren`), Requisitions (status enum + pending-only update)
   - Tambah `role` write guard di Users node

5. **Deploy**
   - Build & deploy hosting + database ke Firebase
   - Live di https://mtc-asset.web.app

### 📂 Files Changed
- `public/pages/RequestPart.html` — edit/delete buttons, admin guards, modal edit mode
- `src/js/modules/requisition.js` — realtime listener, edit CRUD, status guards
- `src/js/bootstrap.js` — call `setupRequisitionsListener()`
- `index.html` — skeleton loading request page
- `database.rules.json` — hardened validation rules
- `SESSION_NOTES.md` — catatan sesi ini (file ini)

### 📌 Commit
`cbe6146` — "feat: edit/delete request part + skeleton + realtime listener + rules hardening"

### ⚠️ Noted
- Dark Reader / similar extension cause `cssRules getter: Not allowed to access cross-origin stylesheet` — bukan error dari app, disable extension on localhost
