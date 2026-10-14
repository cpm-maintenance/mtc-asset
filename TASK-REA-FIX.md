# 🔧 TASK — REA Remediation — MTC-Asset

> **Sumber**: analisis REA v6.4.0 terhadap artifact produksi `dist/`
> **Artifact ID**: `jag_63383f7bb5d32d179d32b40c030694ed14feaf0e82c31236246a60c811fdcc71`
> **Subject SHA-256**: `ed84b18588a3cd8ef4a49369f0a49305985583103877e6c959f043c6bae71989`
> **Tanggal dibuat**: 2026-10-14
> **Baseline bundle**: 3.7 MB / 73 file · initial ~252 KB gzip

> [!NOTE]
> Semua temuan di bawah **sudah diverifikasi silang** ke source code & `database.rules.json`.
> Setiap task punya **kriteria verifikasi** — jangan centang sebelum dibuktikan.

---

## 🔴 P0 — Keamanan (kerjakan hari ini)

### [x] T-1 · Pindahkan upload gambar keluar dari bundle — ✅ **KODE SELESAI (revisi)** (14 Okt)

**Temuan awal**: `VITE_IMGBB_API_KEY` (32 char) ter-inline **plaintext 4×** ke bundle produksi.

#### Percobaan 1 — serverless proxy `/api/imgbb` → **GAGAL, key diblokir ImgBB**

Proxy-nya sendiri benar (GET→405, CORS lengkap, error upstream diteruskan apa adanya). Yang bermasalah key-nya:

```
POST https://mtc-asset.vercel.app/api/imgbb
-> {"status_code":400,"error":{"message":"You have been forbidden to use this website.","code":103},"status_txt":"Bad Request"}
```

Direproduksi **langsung** ke `api.imgbb.com` (bypass proxy) → kode **103** sama. Artinya key valid format tapi **diblokir ImgBB** — hampir pasti karena pernah publik di bundle. Key pengganti akan kena nasib sama: pola "sembunyikan key rahasia di server" rapuh untuk layanan gratis tanpa SLA.

> [!IMPORTANT]
> Key tidak lagi bocor, tapi pendekatan "key rahasia" yang dibuang — bukan cuma key-nya.

#### Keputusan: Cloudinary unsigned upload preset (disetujui user)

`upload_preset` unsigned memang **dirancang** dipakai dari browser. Tidak ada API secret di mana pun → tidak ada yang bisa bocor, tidak ada yang bisa diblokir.

| Sifat | ImgBB + proxy | Cloudinary unsigned |
|---|---|---|
| Rahasia di client | ada | **tidak ada** |
| Bisa diblokir/dicabut | ya | tidak |
| Butuh env di Vercel | ya | **tidak** |

| File | Aksi |
|---|---|
| [`ui.js`](file:///d:/CODING/MTC-Asset/src/js/modules/ui.js#L284-L343) | `uploadBase64Image()` + `uploadImage()` → POST `api.cloudinary.com/v1_1/<cloud>/image/upload` |
| [`api/imgbb.js`](file:///d:/CODING/MTC-Asset/api/imgbb.js) | **DIHAPUS** |
| `scripts/migrate-images.js`, `scripts/migrate-imgbb.mjs` | **DIHAPUS** (key mati; migrasi legacy sudah ada in-app di `app.js`) |
| [`equipment.js`](file:///d:/CODING/MTC-Asset/src/js/modules/equipment.js#L56-L58) | buang `decodeURIComponent` — Cloudinary kirim URL bersih, decode malah bisa merusak |
| [`logs.js`](file:///d:/CODING/MTC-Asset/src/js/modules/logs.js#L341-L345), [`app.js`](file:///d:/CODING/MTC-Asset/src/js/app.js#L990) | rename pemanggil |
| [`.env.example`](file:///d:/CODING/MTC-Asset/.env.example) + `.env` | buang `IMGBB_API_KEY` |
| [`tests/components.test.js`](file:///d:/CODING/MTC-Asset/tests/components.test.js#L78) | rename mock |

> [!NOTE]
> Cloud name + preset **hardcoded sebagai konstanta**, bukan env var. Alasan: `VITE_*` tetap di-inline ke bundle, jadi env tidak menambah keamanan — cuma menambah kerumitan. Efek samping: **tidak perlu set env apa pun di Vercel**, dua blocker lama hilang.

#### ⚠️ Jebakan verifikasi esbuild (SUDAH terkonfirmasi)

Saat konstanta masih kosong, `rg upload_preset dist/` → **0 hit** walau build hijau. Penyebab: esbuild meng-constant-fold `if (!CLOUDINARY_CLOUD || ...) return null` → seluruh isi fungsi jadi dead code dan terhapus. **Build sukses bukan bukti kode ter-bundle.** Setelah konstanta diisi, hit jadi 1 dan baru sah dipakai sebagai bukti. Tidak ada verifikasi yang hancur karena ini — tapi jangan ulangi pola "verifikasi via grep" sebelum konstanta terisi.

#### ✅ Terbukti

| Verifikasi | Hasil |
|---|---|
| `npm run lint` | **0 error** (81 warning lama) |
| `npm run test:run` | **167/167 passed** |
| `npm run build` | sukses (`main-BqXgp4eR.js`, 221 KB) |
| `rg imgbb\|api.imgbb.com dist/` | **0 hit** |
| `rg g3lkh1pu\|upload_preset\|secure_url dist/` | **1 hit** masing-masing (kode benar-benar ter-bundle) |

#### ✅ Kredensial + tes live (14 Okt)

- `CLOUDINARY_CLOUD` = `g3lkh1pu` · `CLOUDINARY_PRESET` = `mtc-asset-unsigned` (mode **Unsigned**)
- Upload file PNG nyata → `secure_url` ada, `asset_folder=mtc-asset` ✓
- Upload **data-URI** (kontrak yang dipakai browser, `file=@-` dengan isi `data:image/png;base64,...`) → `secure_url` ada ✓ ← inilah path yang benar-benar dipakai app, jadi fakta penting
- `public_id` auto-generated → terbukti tidak ada prefix ganda (`mtc-asset/mtc-asset/`), membenarkan keputusan membuang `public_id`

#### ✅ Deploy (14 Okt)

- `76e1627` uploader Cloudinary → `80755cf` (perbaikan `AppState`)
- CI: `Build and Deploy` **success** · `Lighthouse CI` **success** · `Test` **success**
- Bundle produksi live `main-DqxkGbwG.js`: `g3lkh1pu` → 1, `mtc-asset-unsigned` → 1, `upload_preset` → 1, `api.imgbb.com` → **0**

> [!TIP]
> Pelajaran: CI menjalankan `npm run typecheck`, lokal belum. `AppState` (`appstate.ts`) itu interface manual — kalau method di-rename, deklarasinya harus ikut, atau `tsc` gagal. Masukkan `typecheck` ke gate lokal sebelum push.

> [!CAUTION]
> Fallback base64 sudah dihapus dari kode **sebelum** ini. Kalau upload Cloudinary gagal (kuota/preset dihapus), foto baru akan hilang tanpa disimpan ke DB — caller cuma memberi warning dan mempertahankan foto lama. Itu keputusan sadar: base64 di DB membengkakkan sync semua klien. Kalau mau toleransi lebih tinggi, naikkan kuota Cloudinary, jangan kembalikan base64.

---

## 🔴 P1 — Temuan dari console produksi (14 Okt, setelah Fase 1)

Ditemukan saat user menempel log console produksi setelah upload Cloudinary berhasil. **Ketiganya belum ada di daftar awal.**

### [x] T-8 · Bug cache di service worker — ✅ kode selesai

**Temuan**: `caches.open()` mengembalikan **Promise**, bukan objek Cache. Jadi `.put()` di atasnya = `TypeError`.

```
Failed to load 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js'
A ServiceWorker passed a promise to FetchEvent.respondWith() that rejected with
'TypeError: caches.open(...).put is not a function'.
```

**Bukti ter-deploy**: pola `caches.open(e).put(` ada di `dist/sw.js` dan `sw.js` live (keduanya 6534 byte, identik).
**Dampak**: setiap request cdnjs yang **cache-miss** gagal → modal crop foto rusak (cropperjs tidak termuat).

**Fix** ([sw.js:41-46](file:///d:/CODING/MTC-Asset/sw.js#L41-L46)): `.then(cache => cache.put(...))`.

**✅ Terverifikasi di produksi** (`3212a83`, CI 3/3 success): `sw.js` live 6560 byte (sebelumnya 6534) · pola bug **0 hit** · pola benar **2 hit** · clone sinkron **1**.

> [!NOTE]
> Efeknya baru terasa setelah browser mengambil service worker baru. `registerType: autoUpdate` sudah aktif, tapi user mungkin perlu reload sekali lagi — kalau tidak, SW lama masih pegang kendali.

> [!NOTE]
> Jebakan kedua yang sekalian dibetulkan: `response.clone()` harus dipanggil **sinkron** di dalam callback fetch, bukan di dalam `.then` bersarang — kalau tidak, body bisa sudah dikonsumsi halaman saat `put()` jalan.

---

### [x] T-9 · Push notification tidak pernah aktif di produksi — ✅ kode selesai, ⏳ butuh secret

**Temuan**: `deploy.yml` dan `lighthouse.yml` **tidak** meneruskan `VITE_FIREBASE_VAPID_KEY` maupun `VITE_ONESIGNAL_APP_ID` ke build. Lokal punya (`.env`), CI tidak → keduanya jadi string kosong di bundle produksi.

**Bukti**:
- Console produksi: `[FCM] VITE_FIREBASE_VAPID_KEY belum diset — push notification dinonaktifkan` (dari [notification.js:27](file:///d:/CODING/MTC-Asset/src/js/modules/notification.js#L27))
- Bundle live `main-DqxkGbwG.js`: fingerprint VAPID → **0 hit**, fingerprint OneSignal → **0 hit**
- `deploy.yml` memang tidak punya baris VAPID/OneSignal (dibuktikan grep)

**Konsekuensi**: `getToken()` tidak pernah dapat token, `OneSignal.init({appId: ''})` jalan tanpa guard.

**Fix**: tambahkan 2 env ke kedua workflow.

> [!IMPORTANT]
> Perubahan workflow ini **belum berefek** sampai GitHub Actions secrets `VITE_FIREBASE_VAPID_KEY` dan `VITE_ONESIGNAL_APP_ID` dibuat. Kalau secret tidak ada, `${{ secrets.X }}` = string kosong — hasilnya sama seperti sekarang.

#### ✅ Hasil setelah secret dibuat (`654f99d`) — separuh berhasil

Bundle live `main-DjB8C8j1.js`: fingerprint VAPID → **1** (dari 0), fingerprint OneSignal → **1** (dari 0).

**FCM — BEKERJA.** VAPID value benar-benar ter-bundle dan dipakai:
```js
<var> = <VAPID value ter-bundle>, {vapidKey: <var>}
```
`registerFCMToken()` dipanggil dari [main.js:156](file:///d:/CODING/MTC-Asset/src/main.js#L156) dan `index.html:489`. Secret VAPID berhasil → token FCM bisa didapat.

**OneSignal — KODE MATI, secret-nya sia-sia.**
```
OneSignal -> 0   OneSignalDeferred -> 0   cdn.onesignal -> 0
```
`initOneSignal` hanya dipanggil oleh `subscribeOneSignal`, dan itu hanya di dalam file yang sama — tidak ada yang meng-import keduanya → **tree-shaken habis**. Yang tersisa cuma konstanta app ID dan `new Promise(e=>{})` yang tidak pernah resolve (`_initResolve` ikut terbuang). OneSignal memang sudah mati sebelum perubahan ini.

> [!WARNING]
> **Jangan tarik kesimpulan dari hitungan string mentah.** `getToken -> 0` sempat terlihat seperti bukti FCM juga mati, padahal itu cuma nama binding yang diminifikasi. Yang menentukan adalah `vapidKey -> 1`. Kalau ragu, cek konteks sekitar nilai yang diketahui, jangan hitung nama fungsi.

**Tindak lanjut yang disarankan**: hapus [`onesignal.js`](file:///d:/CODING/MTC-Asset/src/js/modules/onesignal.js) (101 baris mati) + secret `VITE_ONESIGNAL_APP_ID`. FCM sudah jadi jalur push yang jalan.

---

### [ ] T-10 · Investigasi error CSP `file:///`

**Temuan**: console produksi menampilkan
```
Loading the script 'file:/C:/Users/.../cropper/cropper.min.js' violates the following
Content Security Policy directive: "script-src ...". The action has been blocked.
```

**Status**: ⚠️ **BELUM DIKETAHUI** — jangan menebak.

Yang **sudah** dieliminasi:
- tidak ada CSP header di response live (`curl -D -` → no `Content-Security-Policy`)
- tidak ada CSP `<meta http-equiv>` di `dist/index.html` (0 hit)
- tidak ada literal `file:///` di `src/` maupun `public/`

Jadi sumbernya entah extension browser, DevTools mapping, atau service worker. **Perlu langkah diagnosa terpisah** — bukan bagian dari T-8/T-9.

---

### Catatan tambahan

- `flowchart.html` muncul di precache manifest `sw.js` (`"url":"flowchart.html"`) → konfirmasi T-2: file ini tidak hanya ter-ship tapi juga ikut ter-cache.

---

## 🟢 P1 — Kebersihan Artifact (hari ini, cepat)

### [x] T-2 · Hapus `flowchart.html` dari build produksi — ✅ selesai

**Temuan**: `public/flowchart.html` (7.1 KB) ikut ter-deploy, dan **terbukti ter-precode** di `sw.js` (`"url":"flowchart.html"`). Menarik Mermaid dari CDN eksternal.

**Keputusan**: **HAPUS**, bukan pindah.
- Tidak ada satu pun referensi ke `flowchart.html` (hanya barisnya sendiri) — diverifikasi dengan grep
- Isinya sudah ada di [`docs/FLOWCHART.md`](file:///d:/CODING/MTC-Asset/docs/FLOWCHART.md) (3.291 byte, mermaid + lebih lengkap)
- Memindahkannya berarti memelihara 2 salinan diagram yang akan saling menyimpang

**✅ Verifikasi**: `Test-Path dist/flowchart.html` → **False** · precache `sw.js` 68 → **67 entries** · `flowchart` di `sw.js` → **0 hit**

---

### [x] T-3 · Dedupe `html2canvas` — ❌ **BATAL: tidak ada yang perlu di-dedupe**

**Temuan awal (SALAH)**: diklaim dua salinan `html2canvas` (~195 KB terbuang).
**Akar kesalahan**: REA melaporkan 2 *file*, lalu **disimpulkan** sebagai duplikasi — tanpa mengukur.

Pengukuran sebenarnya:
```
html2canvas-roNKrZqI.js      65 byte  → CJS interop shim: import{t as e}from"./html2canvas-uIM9l0oW.js";export default e();
html2canvas-uIM9l0oW.js  199570 byte  → implementasi asli (SATU copy)
total                    199635 byte  ≈ 1x, bukan 2x
```

Kalau benar duplikat, totalnya ~399 KB. Nyatanya ~199 KB. Angka 199570 **identik sebelum dan sesudah** `resolve.dedupe` ditambahkan → dedupe nol efek.

**Aksi**: percobaan `resolve.dedupe: ['html2canvas']` **di-revert** (menambah konfigurasi tanpa manfaat).

> [!WARNING]
> **Jangan buka lagi tanpa pengukuran baru.** Kalau ada yang menemukan 2 file dan mengira itu duplikasi, ukur dulu total byte-nya. Dua file ≠ dua salinan; bundler memakai shim interop CJS yang normal.

---

### [x] T-4 · Perbaiki klaim basi di `ANALISIS.md` — ✅ selesai

**Temuan**: dokumen berisi angka snapshot 11 Okt yang sudah jauh menyimpang. Yang terbukti salah dan sudah dibetulkan:

| Klaim lama | Kenyataan (diukur) |
|---|---|
| "Total JS files 30" | **32** (18 modul + 14 root) |
| `app.js` **1.635** baris | **1653** |
| `export.js` **1.073** | **735** |
| `utils.js` **407** | **654** |
| `ai.js` **834** | **839** |
| `logs.js` **792** | **800** |
| `kpi-engine.js` **199** | **258** |
| `store.js` 54 baris | **file tidak ada** |
| "no TypeScript, no JSDoc" | **sudah ada** 5 file `.ts`/`.d.ts` + `// @ts-check` + JSDoc |
| "zero duplication" | terlalu absolut; `onesignal.js` justru kode mati |

**Aksi**: semua angka di atas dibetulkan + ditambah banner **DOKUMEN ARSIP** di kepala file, karena bagian skor/kualitatif tetap snapshot 11 Okt dan tidak diukur ulang.

---

## 🟡 P2 — Keputusan Arsitektur (butuh persetujuan)

### [x] T-5 · KEPUTUSAN — Penyimpanan API key AI → ✅ **Opsi A: terima risiko** (14 Okt)

**Temuan**: key AI disimpan plaintext di **dua** tempat:
1. Firebase `AI_Settings/admin` — [ai.js:796-805](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L796-L805) menulis `apiKey` + `apiKeys` mentah. **Ini sumber utama.**
2. `localStorage` — [ai.js:809](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L809) baca `ai_api_key_0..9`. **Ini hanya cache**, bukan sumber utama ([ai.js:420](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L420) baca dari app/Firebase dulu).

Rules [database.rules.json:97-102](file:///d:/CODING/MTC-Asset/database.rules.json#L97-L102) sudah gate **admin-only** ✅ benar.

> [!CAUTION]
> **KOREKSI nota awal.** Nota lama bilang "key juga ikut backup harian ke repo". **Itu SALAH.**
> [backup.yml](file:///d:/CODING/MTC-Asset/.github/workflows/backup.yml) **mengecualikan** `AI_Settings` secara eksplisit (ada komentar `ponytail:` + alasan push protection), dan `backups/` ada di [.gitignore](file:///d:/CODING/MTC-Asset/.gitignore#L75). **Tidak ada kebocoran key ke repo.**

**Fakta penentu**: browser memanggil provider AI **langsung** ([callOpenAI](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L461) / callOpenRouter). Jadi key **wajib ada di browser** — itu desain, bukan bug.

**Dampak sebenarnya**: satu XSS → key AI bisa dicuri **selama sesi admin aktif**. Tidak ada dampak di luar itu.

**KEPUTUSAN (14 Okt): Opsi A — terima risiko.**

| Opsi | Keputusan |
|---|---|
| **A. Terima risiko** | ✅ **DIPILIH** |
| B. Proxy AI lewat serverless | ❌ tidak diambil — 4–6 jam melindungi key yang bisa di-rotate dalam 1 menit |
| C. Enkripsi at-rest | ❌ **tidak layak** — key harus didekripsi di browser, XSS tetap bisa mengambilnya |

> [!NOTE]
> **Rasional A**: yang terekspos hanya admin, key murah & cepat di-rotate, dan tidak ada kebocoran ke repo. Naik ke **B** kalau key dipakai bersama sistem lain atau mahal.

> [!WARNING]
> **Temuan SRI — DISERAHKAN tapi TIDAK diambil (di luar scope keputusan A).**
> `cropperjs` dimuat dari `cdnjs.cloudflare.com` **tanpa atribut `integrity`** ([app.js:1622-1623](file:///d:/CODING/MTC-Asset/src/js/app.js#L1622-L1623)). Ini **jalur XSS nyata** yang bisa membaca key AI — artinya risiko A sedikit lebih besar dari yang terlihat.
> Perbaikan yang diusulkan (2 baris): `script.integrity = '<sha384-...>'` + `script.crossOrigin = 'anonymous'`.
> **Relevansi**: insiden polyfill.io 2024 menunjukkan CDN bisa disusupi. Selama SRI belum dipasang, asumsi "risiko kecil" bergantung pada cdnjs tidak pernah disusupi.
> Perlu diingat juga: SRI mengunci hash — kalau cdnjs mengubah file di URL pinned, crop modal akan mati (ketahuan langsung, bukan diam-diam).

> [!NOTE]
> **`onesignal.js` juga memuat script CDN tanpa SRI** (`cdn.onesignal.com`) — tapi modulnya **kode mati** (tree-shaken), jadi tidak dieksekusi. Lihat T-9.

---

## 🟡 P2 — Kelengkapan Analisa (opsional)

### [ ] T-6 · Re-analisa REA dengan limit lebih besar

**Temuan**: 9 chunk besar gagal dianalisa (worker heap habis / result budget penuh) — termasuk `main-*.js` (223 KB, kode aplikasi sendiri). Akibatnya call-flow/data-flow logika inti **tidak terbaca**.

**Rencana**:
```bash
rea analyze-javascript-application "d:\CODING\MTC-Asset\dist" `
  --max-heap-mb 4096 --analysis-timeout-ms 900000 `
  --snapshot .rea/snapshots/dist --format json
```

**Verifikasi**: `limitations[]` tidak lagi memuat `Resource constraint ... owns heap` untuk `main-*.js`.

---

## ⏭️ Housekeeping (bukan dari REA)

### [ ] T-7 · Commit `package-lock.json`

Dari `npx update-browserslist-db@latest` (14 Okt): `caniuse-lite` → `1.0.30001816`. Masih **uncommitted**.
```bash
git add package-lock.json
git commit -m "chore: update caniuse-lite via update-browserslist-db"
```

> [!WARNING]
> **JANGAN sentuh `.open/skills`** — anomali ` M` yang diketahui, lihat catatan lingkungan diary 13 Okt.

---

## 📋 Ringkasan Prioritas

| # | Task | Effort | Dampak |
|---|---|---|---|
| **T-1** | Upload gambar → Cloudinary unsigned | 1 jam | 🔥 key bocor → hilang permanen |
| **T-2** | Hapus `flowchart.html` | 5 menit | 🟢 artifact internal |
| ~~**T-3**~~ | ~~Dedupe `html2canvas`~~ | — | ❌ batal, tidak ada duplikasi |
| **T-4** | Fix klaim `ANALISIS.md` | 10 menit | 🟢 dokumen menyesatkan |
| **T-5** | Keputusan penyimpanan key AI | — | ⚠️ butuh persetujuan (rekomendasi: A) |
| **T-6** | Re-analisa REA (limit naik) | 30 menit | 🟡 graf lengkap |
| **T-7** | Commit `package-lock.json` | 2 menit | 🟢 repo bersih |

**Total P0+P1**: ±2 jam → menutup 1 kebocoran nyata + 2 sampah produksi (T-3 ternyata bukan masalah).

---

## ✅ Definisi Selesai

- [ ] `rg "sk-or-v1|sk-ant|sk-proj|api.imgbb.com|VITE_IMGBB" dist/` → **0 hit**
- [ ] Upload foto berhasil di produksi (Equipment form + log photo) → dapat URL `res.cloudinary.com`
- [x] `Test-Path dist\flowchart.html` → **False** ✅
- ~~`html2canvas*` → 1 file~~ → ❌ **targetnya salah**; 2 file itu normal (1 shim 65 B + 1 kode 199 KB)
- [ ] `npm run build` sukses, `npm run test:run` hijau · **catatan**: `dist/` = 3.69 MB, target < 3.6 MB **tidak tercapai dan tidak bisa dicapai lewat T-3**
- [ ] CI hijau (`Test`, `Build and Deploy`, `Lighthouse CI`)
- [ ] Deploy + verifikasi upload foto & AI chat masih jalan di produksi
