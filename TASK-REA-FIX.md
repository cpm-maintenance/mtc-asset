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

### [x] T-1 · Pindahkan upload gambar keluar dari bundle — ✅ **selesai & terverifikasi produksi** (14 Okt)

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

### [x] T-9 · Push notification tidak pernah aktif di produksi — ✅ **selesai & tuntas** (FCM aktif, OneSignal dibersihkan)

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

#### ✅ Tindak lanjut dikerjakan (14 Okt) — **tapi rekomendasinya sebagian SALAH**

> [!CAUTION]
> **Koreksi rekomendasi di atas.** Aku bilang "hapus `onesignal.js`, 101 baris mati". **Itu salah.** File itu berisi **3** fungsi; hanya **2** yang mati:
>
> | Fungsi | Status | Bukti |
> |---|---|---|
> | `initOneSignal` | ❌ mati | hanya dipanggil `subscribeOneSignal` |
> | `subscribeOneSignal` | ❌ mati | 0 pemanggil di seluruh `src/` |
> | `sendPushViaProxy` | ✅ **HIDUP** | dipakai [requisition.js:87,98,102,106](file:///d:/CODING/MTC-Asset/src/js/modules/requisition.js#L87-L106) + [data.js:295](file:///d:/CODING/MTC-Asset/src/js/modules/data.js#L295) — **5 pemanggilan** |
>
> Kalau aku benar-benar menghapus file itu seperti rekomendasi awal, **semua notifikasi Request Part & Work Order mati tanpa error**. Pelajaran: "tidak ada yang meng-import" hanya benar untuk `initOneSignal`/`subscribeOneSignal`, bukan untuk file-nya. **Periksa per-ekspor, bukan per-file.**

**Yang dilakukan**: ekstrak fungsi hidup ke modul baru [`push-client.js`](file:///d:/CODING/MTC-Asset/src/js/modules/push-client.js), buang 2 fungsi mati.

| File | Aksi |
|---|---|
| [`push-client.js`](file:///d:/CODING/MTC-Asset/src/js/modules/push-client.js) | **BARU** — hanya `sendPushViaProxy` + konstanta `PUSH_PROXY_URL` |
| [`onesignal.js`](file:///d:/CODING/MTC-Asset/src/js/modules/onesignal.js) | **DIHAPUS** (101 baris) |
| [`data.js:9`](file:///d:/CODING/MTC-Asset/src/js/modules/data.js#L9), [`requisition.js:28`](file:///d:/CODING/MTC-Asset/src/js/modules/requisition.js#L28) | import diarahkan ke `push-client.js` |
| [`tests/data.test.js:30`](file:///d:/CODING/MTC-Asset/tests/data.test.js#L30) | mock di-rename |
| `api/push.js` | **DIHAPUS** (proxy OneSignal, 0 pemanggil) |
| `onesignal-server/` (3 file) | **DIHAPUS** (backend Render mandiri) |
| `render.yaml` | **DIHAPUS** (blueprint menunjuk `onesignal-server`) |
| [`public/OneSignalSDKWorker.js`](file:///d:/CODING/MTC-Asset/public/OneSignalSDKWorker.js) | **DIHAPUS** — ternyata **ter-ship ke produksi** & menarik `cdn.onesignal.com` |
| [`globals.d.ts:34-36`](file:///d:/CODING/MTC-Asset/src/js/globals.d.ts#L34-L36) | `OneSignal` / `OneSignalDeferred` dibuang |
| [`eslint.config.js`](file:///d:/CODING/MTC-Asset/eslint.config.js) | global `OneSignal` + glob `onesignal-server/**` dibuang |
| [`tsconfig.json`](file:///d:/CODING/MTC-Asset/tsconfig.json) | `onesignal-server` dibuang dari `exclude` |
| [`.env.example`](file:///d:/CODING/MTC-Asset/.env.example) | `VITE_ONESIGNAL_APP_ID` + `ONESIGNAL_API_KEY` dibuang |
| [`deploy.yml:40`](file:///d:/CODING/MTC-Asset/.github/workflows/deploy.yml#L40), [`lighthouse.yml:38`](file:///d:/CODING/MTC-Asset/.github/workflows/lighthouse.yml#L38) | baris `VITE_ONESIGNAL_APP_ID` dibuang |
| [`README.md`](file:///d:/CODING/MTC-Asset/README.md) | tabel backend + tree + daftar modul dibetulkan |

**Kontrak wire tetap sama**: `sendPushViaProxy` masih mengirim field `headings`/`contents` karena [`api/fcm-push.js:33-34`](file:///d:/CODING/MTC-Asset/api/fcm-push.js#L33-L34) menerima kedua format. Field `app_id` dibuang — endpoint FCM mengabaikannya.

> [!NOTE]
> Ternyata ada **4 artefak OneSignal fisik**, bukan 1: modul client, worker di `public/`, proxy Vercel, backend Render. Tiga di antaranya masih ter-ship/ter-deploy padahal tidak dipakai.

**✅ Terverifikasi (lokal)**: `npm run typecheck` bersih · `lint` **0 error** / 81 warning · `test:run` **167/167** · `build` sukses → `main-Cu6avAPw.js`. `dist/`: `OneSignalSDKWorker.js` **tidak ada**, hit `onesignal` **0**, precache `sw.js` 67 → **66 entries**. Satu-satunya hit tersisa: `api/fcm-push` ×1 (URL di `PUSH_PROXY_URL`) — sesuai harapan.

**✅ Terverifikasi (produksi, `12bb005`, CI 3/3 success)**:

| Cek | Hasil |
|---|---|
| Bundle live `main-zD49JTGy.js` (226.468 byte) | `onesignal` **0** · `OneSignal` **0** · `OneSignalDeferred` **0** · `cdn.onesignal` **0** |
| `api/fcm-push` | **1** (jalur push masih hidup) |
| `mtc-asset-unsigned` / `upload_preset` | **1** / **1** (T-1 utuh) |
| `vapidKey` | **1** (FCM utuh) |
| `sw.js` live (6.411 byte) | `onesignal` **0** · `OneSignalSDKWorker` **0** · `flowchart` **0** · pola bug `caches.open(e).put(` **0** · pola benar **2** |
| Precache `sw.js` live | **66 entries** (dari 67) |
| `GET /OneSignalSDKWorker.js` | tidak lagi mengembalikan file OneSignal (jatuh ke rewrite SPA) |

> [!NOTE]
> `TASK-REA-FIX.md` dikeluarkan dari Git (`git rm --cached`) di commit ini — dokumen ini catatan kerja lokal, bukan bagian artifact produksi. Isinya **masih ada di history** (`f58130b`); history tidak ditulis ulang.

---

### [x] T-10 · Investigasi error CSP `file:///` — ✅ **SELESAI: bukan dari codebase**

**Temuan**: console produksi pernah menampilkan
```
Loading the script 'file:/C:/Users/.../cropper/cropper.min.js' violates the following
Content Security Policy directive: "script-src ...". The action has been blocked.
```

**Verdikt: sumbernya BUKAN aplikasi.** Semua jalur sudah dieliminasi dengan bukti langsung:

| # | Hipotesis | Bukti | Hasil |
|---|---|---|---|
| 1 | CSP header dari server | `curl -D -` ke `mtc-asset.web.app` (HTML **dan** `main-*.js`) | **tidak ada** `Content-Security-Policy` sama sekali |
| 2 | CSP `<meta http-equiv>` | cek `dist/index.html` + index live | **tidak ada** |
| 3 | Literal `file:///` di source | grep seluruh repo (exclude `dist/`, `node_modules`) | **0 hit** |
| 4 | File lokal `cropper/cropper.min.js` | recursive search `Desktop`/`Documents`/`Downloads`/`AppData\Local`/`d:\CODING` (depth 6) | **folder `cropper` tidak ada**, file `cropper.min.js` **tidak ada** |
| 5 | Kode pemuat cropperjs | [`app.js:1623`](file:///d:/CODING/MTC-Asset/src/js/app.js#L1623) | pakai **`https://cdnjs.cloudflare.com/...`**, bukan path lokal |
| 6 | URL cdnjs sehat? | `curl -I` | **200**, 37.369 byte |
| 7 | `/cropper/cropper.min.js` di produksi | `curl -D -` | `text/html` (rewrite SPA `**` → `/index.html`), **bukan file nyata** |

**Kesimpulan**: path `file:/C:/Users/.../cropper/cropper.min.js` **tidak pernah ada** di mesin ini. Aplikasi tidak mungkin memintanya — kode hanya tahu URL cdnjs. Sisa penyebab yang masuk akal: **DevTools Local Overrides**, **extension browser** yang menyuntik script, atau bookmarklet/userscript lama.

**✅ Bukti runtime (Playwright headless, Chromium, konteks bersih)** — dijalankan 14 Okt:

```
=== CONSOLE (6 msgs) ===
[log] [Sentry] Initialized, env: production
[log] Alpine App Registered
[log] Component Loader Ready
[log] Alpine Started
[log] [FCM] Permission not granted — skipping auto-register.
[log] [Notif] Permission denied

file:/// -> 0      file:/ -> 0
content security policy -> 0      cropper -> 0
failed requests: none
service worker: 1 registered, scope https://mtc-asset.web.app/
cropper probe: before=undefined  result=loaded  after=function
```

Artinya: memuat cropperjs dari cdnjs di produksi **berhasil** (`after=function`), **nol** error CSP, **nol** request gagal. Error `file:///` tidak bisa direproduksi di lingkungan bersih mana pun.

**Tindakan**: tidak ada perubahan kode — **tidak ada yang perlu diperbaiki**. Kalau error muncul lagi, tes di **jendela incognito** (tanpa extension). Kalau hilang → terbukti ulah extension. Kalau tetap muncul → cek **DevTools → Sources → Overrides** dan hapus mapping lama.

> [!WARNING]
> Jangan tulis "fix" untuk ini. Tidak ada bug di repo, dan menambah CSP atau mengubah loader cropperjs hanya menambah kode untuk memburu hantu.

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
| "zero duplication" | terlalu absolut; OneSignal punya 4 artefak fisik (client, worker SW, proxy Vercel, backend Render) yang nyaris tidak dipakai |

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
> **`public/OneSignalSDKWorker.js`** juga memuat script CDN tanpa SRI (`cdn.onesignal.com`) — **sudah dihapus** sebagai bagian dari tindak lanjut T-9.

---

## 🟡 P2 — Kelengkapan Analisa (opsional)

### [x] T-6 · Re-analisa REA dengan limit lebih besar — ✅ **TUNTAS: 0 heap, 0 budget** (14 Okt)

**Temuan awal**: 9 chunk gagal dianalisa — heap worker habis / result budget penuh. Termasuk `main-*.js` (kode aplikasi sendiri).

> [!CAUTION]
> **Rencana awal di dokumen ini SALAH dua kali.**
> 1. Flag `--snapshot .rea/snapshots/dist` **tidak ada** di REA 6.4.0 (dibuktikan `--help`).
> 2. Target `dist/` adalah bundle **terminifikasi** — nama jadi `e`/`t`/`We`. Target yang benar: **`src/js`** (kode asli).

**Percobaan 1 — `src/js` sekaligus** (14 Okt):
```bash
rea analyze-javascript-application "d:\CODING\MTC-Asset\src\js" `
  --artifact-format directory --max-heap-mb 4096 --analysis-timeout-ms 900000 --format json
```

Hasil: exit 0, 33 file diparse, `parse_failures` 0, 72.102 AST node, 354 findings. **`exhausted its heap` 5 → 0** ✅ tapi **`result budget` tetap 9** ⚠️.

**Akar masalah ditemukan**: cap `exceeds parent's remaining result budget` itu **per-run**, bukan per-file. Semakin besar scope, semakin cepat jatah habis — file belakangan kena potong.

**Percobaan 2 — pecah per subfolder** (14 Okt):
```bash
rea analyze-javascript-application "…\src\js\modules" --artifact-format directory --max-heap-mb 4096 --analysis-timeout-ms 900000 --format json
rea analyze-javascript-application "…\src\js\utils"   --artifact-format directory --max-heap-mb 4096 --analysis-timeout-ms 900000 --format json
# src/js root di-copy ke scratch/jsroot (REA tidak punya flag "file saja") lalu dianalisa
```

| Run | File | AST node | Findings | Parse fail | Limitations | `result budget` | `heap` |
|---|---|---|---|---|---|---|---|
| `src/js` sekaligus | 33 | 72.102 | 354 | 0 | 15 | **9** ⚠️ | **0** ✅ |
| `modules/` | 18 | 42.469 | 156 | 0 | 5 | **0** ✅ | **0** ✅ |
| `utils/` | 1 | 216 | 2 | 0 | 5 | **0** ✅ | **0** ✅ |
| `jsroot` (14 file root) | 14 | 29.417 | 233 | 0 | 5 | **0** ✅ | **0** ✅ |
| **Total** | **33** | 72.102 | **391** | **0** | — | **0** ✅ | **0** ✅ |

**Verdikt**: T-6 **tuntas**. 33/33 file terbaca, nol resource constraint, nol parse failure. 5 limitation yang tersisa di tiap run adalah **catatan metodologis** (bukan kegagalan): REA menganalisa statis, tidak mengeksekusi bootstrap, dan tidak mengklaim runtime.

> [!TIP]
> **Resep kalau REA mentok lagi**: jangan naikkan heap dulu — **pecah scope-nya**. `--max-heap-mb 4096` sudah lebih dari cukup (masalah heap nol). Yang mentok adalah budget hasil, dan itu di-reset tiap invokasi. Satu folder per run.

> [!NOTE]
> **Nol perubahan kode.** T-6 murni analisa. Hasilnya jadi rujukan graf call-flow lengkap untuk `src/js` (33 file).

## ⏭️ Housekeeping (bukan dari REA)

### [x] T-7 · Commit `package-lock.json` — ✅ selesai (`654f99d`)

Sudah dikerjakan (14 Okt): `caniuse-lite` → `1.0.30001816`, ter-commit di `654f99d`. **Selesai.**
```bash
git add package-lock.json
git commit -m "chore: update caniuse-lite via update-browserslist-db"
```

> [!WARNING]
> **JANGAN sentuh `.open/skills`** — anomali ` M` yang diketahui, lihat catatan lingkungan diary 13 Okt.

---

## 📋 Ringkasan Prioritas

| # | Task | Status | Effort | Dampak |
|---|---|---|---|---|
| **T-1** | Upload gambar → Cloudinary unsigned | ✅ produksi | 1 jam | 🔥 key bocor → hilang permanen |
| **T-2** | Hapus `flowchart.html` | ✅ | 5 menit | 🟢 artifact internal |
| ~~**T-3**~~ | ~~Dedupe `html2canvas`~~ | ❌ batal | — | tidak ada duplikasi (diukur) |
| **T-4** | Fix klaim `ANALISIS.md` | ✅ | 10 menit | 🟢 dokumen menyesatkan |
| **T-5** | Keputusan penyimpanan key AI | ✅ A (terima risiko) | — | ⚠️ keputusan user |
| **T-6** | Re-analisa REA (pecah per folder) | ✅ 0 heap / 0 budget | 30 menit | 🟢 graf lengkap 33 file |
| **T-7** | Commit `package-lock.json` | ✅ | 2 menit | 🟢 repo bersih |
| **T-8** | Bug cache di service worker | ✅ produksi | 20 menit | 🔥 modal crop rusak |
| **T-9** | Push notification + bersihkan OneSignal | ✅ produksi | 1 jam | 🔥 FCM mati → aktif |
| **T-10** | Error CSP `file:///` | ✅ bukan codebase | 15 menit | 🟢 bukan bug repo |

**Semua 10 task tuntas.** Nol perubahan kode tersisa; nol item terbuka.

## ✅ Definisi Selesai

- [x] `rg "sk-or-v1|sk-ant|sk-proj|api.imgbb.com|VITE_IMGBB" dist/` → **0 hit** ✅ (71 file di-scan)
- [x] Upload foto berhasil di produksi (Equipment form + log photo) → URL `res.cloudinary.com` ✅ (diverifikasi user 14 Okt)
- [x] `Test-Path dist\\flowchart.html` → **False** ✅
- ~~`html2canvas*` → 1 file~~ ❌ **targetnya salah**; 2 file itu normal (1 shim 65 B + 1 kode 199 KB)
- [x] `npm run build` sukses, `npm run test:run` hijau ✅ (167/167) · **catatan**: `dist/` = 3.69 MB, target < 3.6 MB **tidak tercapai dan tidak bisa dicapai lewat T-3**
- [x] CI hijau (`Test`, `Build and Deploy`, `Lighthouse CI`) ✅ — `12bb005` 3/3 success
- [x] Deploy + verifikasi bundle produksi ✅ — `main-zD49JTGy.js`: `onesignal` 0, `upload_preset` 1, `vapidKey` 1, `api.imgbb.com` 0
