# 🔄 MTC-Asset Backup System

## 📋 Overview

Sistem backup terdiri dari 3 lapisan:

| Lapisan | Metode | Frekuensi | Menyimpan |
|---------|--------|-----------|-----------|
| **1. Source Code** | Git commit + push ke GitHub | Manual / otomatis | Semua file project |
| **2. Firebase Data** | Script `backup-firebase.js` | Setiap backup | JSON dump database |
| **3. GitHub Actions** | Cron workflow `.github/workflows/backup.yml` | **Setiap hari jam 02:00 WIB** | Source + Firebase data |

---

## 🚀 Cara Backup

### 1. Backup Cepat (Source Code Only)
```bash
# Commit & push semua perubahan source code
git add -A
git commit -m "update: deskripsi perubahan"
git push
```

### 2. Backup Lengkap (Source + Firebase Data)
```bash
# Backup Firebase database + commit + push
npm run backup
```

### 3. Backup Firebase Saja
```bash
# Backup data Firebase Realtime Database ke file JSON
npm run backup:firebase
```

### 4. Windows Batch (Double-click)
Jalankan `scripts/backup.bat` — tinggal double-click.

---

## 🔧 Setup Awal (Pertama Kali)

### Prasyarat
1. **Firebase CLI** terinstall:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **GitHub CLI** (opsional):
   ```bash
   winget install GitHub.cli
   gh auth login
   ```

3. **GitHub Repository**:
   Buat repository baru di GitHub, lalu:
   ```bash
   git remote add origin https://github.com/USERNAME/mtc-asset.git
   git branch -M main
   git push -u origin main
   ```

### Setup GitHub Actions (Auto Backup)

1. **Generate Firebase Token**:
   ```bash
   firebase login:ci
   ```
   Copy token yang dihasilkan.

2. **Tambahkan ke GitHub Secrets**:
   - Buka repo → Settings → Secrets and variables → Actions
   - Tambah secret: `FIREBASE_TOKEN` dengan value token di atas

3. **Trigger workflow pertama**:
   - Buka GitHub → Actions → "🔄 Auto Backup Firebase Data"
   - Klik "Run workflow"

---

## 📁 Struktur Backup

```
mtc-asset/
├── backups/
│   ├── backup-2026-06-20_02-00-01.json    # Hasil backup harian
│   ├── backup-2026-06-19_02-00-01.json
│   ├── LATEST.txt                          # Menunjuk backup terbaru
│   └── ... (max 30 file, oldest auto-deleted)
├── scripts/
│   ├── backup-firebase.js                  # Backup Firebase data
│   ├── backup.js                           # Backup lengkap (firebase + git)
│   └── backup.bat                          # Windows double-click backup
└── .github/workflows/
    └── backup.yml                          # Auto backup setiap hari
```

---

## 🔐 Security

- **`.env`** tidak ikut git (API keys aman)
- **`backups/`** folder di-commit karena berisi data aplikasi
- **Firebase Token** disimpan di GitHub Secrets, bukan di code
- File backup JSON hanya berisi **data aplikasi** (Equipment, Logs, dll), **tidak** berisi user password

---

## ⏰ Jadwal Backup Otomatis

GitHub Actions backup otomatis berjalan:
- **Setiap hari**: Jam 02:00 WIB (19:00 UTC)
- **Menjaga**: 30 backup terakhir
- **Notifikasi**: Email dari GitHub jika gagal

---

## 🔄 Restore Data

Jika perlu mengembalikan data dari backup:

```bash
# Restore satu node
firebase database:set /Equipment backups/backup-XXXX.json --project mtc-asset

# Atau via script restore (TODO)
```

---

## 📊 Monitoring

Cek status backup:
1. Buka https://github.com/USERNAME/mtc-asset/actions
2. Lihat workflow "🔄 Auto Backup Firebase Data"
3. Klik run terakhir untuk detail

---
