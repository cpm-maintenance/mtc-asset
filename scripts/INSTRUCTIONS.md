# Cara Setup GitHub & Push

## 1️⃣ Buat Repository di GitHub

1. Buka https://github.com/new
2. Isi:
   - **Repository name**: `mtc-asset`
   - **Description**: `Industrial Maintenance Management System with Firebase`
   - **Visibility**: Public (atau Private kalau mau)
3. **JANGAN centang** "Add a README" atau ".gitignore" (sudah ada)
4. Klik **Create repository**

## 2️⃣ Push ke GitHub

Buka terminal di `D:\Coding\MTC-Asset` lalu jalankan:

```bash
git remote add origin https://github.com/NAMA_USER/mtc-asset.git
git branch -M main
git push -u origin main
```

Ganti `NAMA_USER` dengan username GitHub kamu.

## 3️⃣ Setup GitHub Secrets (untuk Auto Backup)

Setelah push berhasil:

1. Buka https://github.com/NAMA_USER/mtc-asset/settings/secrets/actions
2. Klik **New repository secret**
3. Buat secret **`FIREBASE_TOKEN`** dengan nilai:
   ```
   firebase login:ci
   ```
   (jalankan perintah itu di terminal, login, lalu copy token yang dihasilkan)

## 4️⃣ Setup Secrets untuk Deploy

Tambahkan juga secrets ini (bisa copy dari `.env`):
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID` → `mtc-asset`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `FIREBASE_TOKEN` → token dari `firebase login:ci`

## ✅ Selesai!

Setelah setup, backup akan otomatis:
- **Manual**: `npm run backup` → backup Firebase + git push
- **Otomatis**: GitHub Actions setiap hari jam 02:00 WIB

---

## 🧹 Catatan Script (2026-08-04)

Helper satu-kali-pakai (`.mjs`) sudah DIHAPUS dari folder ini (v1-palette, r1-aging, r2-score, r3, r5-pred, dll) — kode sudah di-merge permanen ke `src/js` & `public/pages/*.html`.

**Yang disimpan** (dipakai buat backup):
- `backup-firebase.js` — backup data Firebase (dijalankan via `npm run backup:firebase`)
- `backup.js` — backup + git push (`npm run backup`)
- `backup.bat` — quick backup (`npm run backup:quick`)

> Note CRLF: file proyek (html/js) pakai CRLF → edit tools konvensional gagal. Kalau perlu edit sebentar, pakai node `.mjs` + regex \r?\n, lalu hapus.
