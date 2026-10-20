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
│   └── ... (retensi 7 hari; maks 30 berkas, terlama dibuang)
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
- **`backups/`** folder **TIDAK** di-commit (ada di `.gitignore`) — backup hanya di disk lokal + artifact GitHub Actions
- **Firebase Token** disimpan di GitHub Secrets, bukan di code
- File backup JSON hanya berisi **data aplikasi** (Equipment, Logs, dll), **tidak** berisi user password

---

## ⏰ Jadwal Backup Otomatis

GitHub Actions backup otomatis berjalan (`.github/workflows/backup.yml`):
- **Setiap hari**: Jam 02:00 WIB (cron `0 19 * * *` UTC)
- **Artifact**: `firebase-backup-<run_id>`, retensi **7 hari**
- **Lokal**: `backups/` retensi **7 hari**, maksimum 30 berkas
- **Notifikasi**: email dari GitHub bila gagal (plus ringkasan SMTP bila secret mail di-set)

**Bukti pernah jalan** (19 Okt 2026): 124 run, tiga run terjadwal terakhir `completed/success`.
Cek cepat tanpa `gh` login:

```bash
curl -s "https://api.github.com/repos/cpm-maintenance/mtc-asset/actions/workflows/backup.yml/runs?per_page=3" \
  | jq -r '.workflow_runs[] | "\(.created_at) \(.status) \(.conclusion)"'
```

---

## 🔄 Restore Data (5 langkah)

⚠️ `database:set` **menimpa seluruh node** (bukan merge). Tanpa `--force` CLI minta konfirmasi.

**1. Ambil berkas backup**
- GitHub: Actions → "🔄 Auto Backup Firebase Data" → run terakhir → artifact `firebase-backup-<run_id>` (retensi 7 hari), ekstrak `backup-YYYY-MM-DD_HH-mm-ss.json`.
- Lokal: `cat backups/LATEST.txt` lalu pakai berkas itu dari `backups/`.

**2. Validasi isi berkas** (jangan restore JSON korup)
```bash
jq -e . backups/backup-XXXX.json > /dev/null && echo "JSON valid"
jq -r '._metadata.exportedAt' backups/backup-XXXX.json
```

**3. Amankan keadaan sekarang dulu**
```bash
npm run backup:firebase
```

**4. Restore satu node** (ulangi per node yang rusak)
```bash
jq '.Equipment' backups/backup-XXXX.json \
  | firebase database:set /Equipment --project mtc-asset --force
```

**5. Verifikasi jumlah record**
```bash
firebase database:get /Equipment --shallow --project mtc-asset | jq 'keys | length'
jq '.Equipment | keys | length' backups/backup-XXXX.json
```
Angka harus sama. Kalau restore salah node, ulangi langkah 4 dengan berkas dari langkah 3.

**Cakupan**: backup GitHub Actions memuat `Equipment`, `SpareParts`, `HistoryLog`, `Performance`, `Stats`, `ImageUploads`. `Users` dan `AI_Settings` **sengaja tidak** ikut ke artifact (PII + API key) — keduanya hanya ada di backup lokal `npm run backup:firebase`.

---

## 📊 Monitoring

Cek status backup:
1. Buka https://github.com/USERNAME/mtc-asset/actions
2. Lihat workflow "🔄 Auto Backup Firebase Data"
3. Klik run terakhir untuk detail

---
