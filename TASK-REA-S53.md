# TASK — Remediasi Analisa REA (S53)

> Baseline: commit `6af949d` (main). Gate hijau: tsc 0, eslint 0, 2292 test, coverage 97.27/90.01/98.50, build OK, precache 66/66.
> Sumber: `ANALISA-REA-DEEP-2026-11-01.md`.

---

## T1 — `fetch` tanpa timeout (Medium)

**Bukti:** `grep AbortController|AbortSignal src/` → 0 file. 6 `fetch` tanpa `signal`.

- [x] Buat `fetchWithTimeout(url, opts, ms = 15000)` di `src/js/utils.js` — `AbortController` + `setTimeout` + `finally clearTimeout`
- [x] Pakai di [ai.js:508](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L508) OpenAI
- [x] Pakai di [ai.js:533](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L533) Anthropic
- [x] Pakai di [ai.js:558](file:///d:/CODING/MTC-Asset/src/js/modules/ai.js#L558) OpenRouter
- [x] Pakai di [push-client.js:24](file:///d:/CODING/MTC-Asset/src/js/modules/push-client.js#L24)
- [x] Pakai di [ui.js:514](file:///d:/CODING/MTC-Asset/src/js/modules/ui.js#L514) Cloudinary
- [x] Pakai di [component-loader.js:55](file:///d:/CODING/MTC-Asset/src/js/utils/component-loader.js#L55)
- [x] Test: abort memicu error yang tertangkap (bukan menggantung)
- [x] Test: `isLoading` kembali `false` saat timeout

**Terima:** AI/upload/template gagal cepat dengan pesan jelas, bukan beku.
**Batal jika:** semua endpoint sudah dijamin punya timeout di lapisan lain (belum ada bukti).

---

## T2 — `XLSX.read()` file user tanpa batas (Medium-High)

**Bukti:** `xlsx` punya GHSA-4r6h-8v6p-xvw6 (prototype pollution) + GHSA-5pgg-2g8v-p4x9 (ReDoS), **no fix**. [export.js:661](file:///d:/CODING/MTC-Asset/src/js/modules/export.js#L661) membaca file unggahan user.

- [x] Tolak file > 5 MB sebelum `FileReader`
- [x] Batasi jumlah baris (mis. 5000) setelah `sheet_to_json`
- [x] Tampilkan notifikasi spesifik saat ditolak
- [x] Test: file kebesaran ditolak, tidak memanggil `XLSX.read`
- [x] Test: baris melebihi batas dipotong + notifikasi

**Terima:** jalur ReDoS tertutup tanpa mengganti library.
**Lanjutan (opsional):** parser CSV sendiri untuk impor — `templates/*.csv` sudah CSV.

---

## T3 — `npm audit fix` (Info)

**Bukti:** 24 vuln (13 moderate, 10 high, 1 critical). Yang benar-benar terekspos hanya `xlsx`. `websocket-driver`/`uuid` transitif `firebase-tools`; `firebase-admin` server-only (`api/fcm-push.js`).

- [x] `npm audit fix` (tanpa `--force`) — 72 → 47 vuln
- [x] Verifikasi gate penuh setelahnya
- [x] Cek `api/fcm-push.js` masih jalan
- [x] Catat sisa vuln di `NOTE` bila ada yang tak terhindarkan

**Hasil terukur:** `72 → 47` (critical `1 → 0`, high `30 → 18`, moderate `36 → 25`, low `5 → 4`). Hanya `package-lock.json` berubah; `package.json` tidak.

Naik: `vite 8.0.8→8.3.5`, `vitest 4.1.5→4.1.12`, `dompurify 3.4.1→3.4.17`, `firebase-admin 14.2.0→14.5.0`, `firebase-tools 15.33→15.34.2`, `vite-plugin-pwa 1.2.0→1.3.0`, `undici 6.29.0→6.29.1`, `@grpc/grpc-js 1.9.15→1.9.16`.
Turun 29 advisory termasuk `websocket-driver` (satu-satunya critical), `undici`, `vite`, `dompurify`, `serialize-javascript`, `body-parser`, `brace-expansion`.

Sisa 47 — semua butuh `--force` (mayor) atau tidak ada fix:
| Paket | Sebab |
|---|---|
| `xlsx` | Tidak ada versi fix; dimitigasi T2 |
| `@lhci/cli` + 13 turunan (`basic-ftp`, `puppeteer-core`, `chromium-bidi`, `proxy-agent`, …) | Dev-only, fix = `@lhci/cli@0.1.0` (downgrade mayor) |
| `firebase-tools` + 12 turunan (`@google-cloud/pubsub`, `archiver`, `minimatch`, …) | Dev-only CLI, fix = `3.18.2` (downgrade mayor) |
| `firebase`/`@firebase/firestore` | Fix = `firebase@9.14.0` (downgrade mayor); `@grpc/grpc-js` tidak terpakai jalur browser (Firestore web pakai WebChannel) |
| `vite-plugin-pwa`/`workbox-build` | Fix = `vite-plugin-pwa@1.1.0` (downgrade) |
| `@eslint/*` | Fix = `firebase-tools@3.18.2` (downgrade mayor) |

Catatan: `@firebase/rules-unit-testing@6.0.0` minta `firebase@^13`, terpasang `12.12.0`. **Sudah begitu di `HEAD`** — bukan akibat T3 (diverifikasi lewat `git show HEAD:package-lock.json`).

**Jangan:** `npm audit fix --force` — bisa turunkan/ganti mayor.
**Jangan:** upgrade `xlsx` — tidak ada versi fix.

---

## T4 — `.env` drift (Info)

**Bukti:** `VITE_PUSH_PROXY_URL` dipakai [push-client.js:14](file:///d:/CODING/MTC-Asset/src/js/modules/push-client.js#L14) tapi **tidak ada** di `.env`. `VITE_ONESIGNAL_APP_ID` ada di `.env` tapi tidak terdokumentasi.

- [x] Tambah `VITE_PUSH_PROXY_URL` ke `.env` lokal (nilai = default produksi)
- [x] Buang `VITE_ONESIGNAL_APP_ID` dari `.env` — *bukan* didokumentasikan
- [x] Dokumentasikan `VITE_USE_EMULATORS` di `.env.example` (dipakai `data-layer.js` + `firebase-core.js`, sebelumnya tidak tercatat)
- [x] Pastikan `.env*` tetap di `.gitignore`
- [x] Kunci dengan tes dua arah: `tests/env-contract.test.js`

**Koreksi rencana:** butir semula "Tambah `VITE_ONESIGNAL_APP_ID` ke `.env.example`" **dibatalkan**. Modulnya sudah tidak ada:
- `src/js/modules/onesignal.js` → **tidak ada** (`dir` = File Not Found)
- `VITE_ONESIGNAL_APP_ID` → **0** kemunculan di `src/**` (pindai `import.meta.env.*` atas seluruh `src/**`)
- Komentar `push-client.js:9-10` menyatakan SDK OneSignal sudah dibuang, FCM jalur aktif

Mendokumentasikan key mati justru mengundang developer baru mengisinya tanpa efek. Yang dilakukan: hapus dari `.env` lokal (gitignored).

**Hasil:** `.env` 11 key (OneSignal hilang, `VITE_PUSH_PROXY_URL` masuk). `.env.example` 12 key (+ `VITE_USE_EMULATORS`). `git check-ignore` → `.env` dan `.env.local` IGNORED, `.env.example` satu-satunya yang dilacak.

**Tes baru** `tests/env-contract.test.js` (5 kasus, dua arah):
1. setiap `VITE_*` di `src/**` wajib ada di `.env.example`
2. setiap `VITE_*` di `.env.example` wajib dipakai `src/**` (cegah key mati)
3. tidak ada sisa key OneSignal di keduanya
4. `VITE_PUSH_PROXY_URL` terdokumentasi
5. `VITE_USE_EMULATORS` terdokumentasi

---

## T5 — Coverage cabang (Opsional)

- [ ] `logger.js` func 40% / branch 50% (baris 33-35)
- [ ] `rum.js` branch 88.88% (baris 27, 35, 50)

**Celah:** `logger.js` rendah karena hanya dipakai jalur error; `rum.js` fallback `PerformanceObserver` tak teruji.

---

## Verifikasi Wajib Tiap Task

```bash
npx tsc --noEmit && npx eslint . && npx vitest run --coverage
npx vite build && node scripts/verify-precache.mjs
```

`sw.js` **wajib** naik versi jika `src/**` atau `public/**` berubah.

---

## Yang TIDAK Dikerjakan

| Item | Alasan |
|---|---|
| Pecah `app.js` | REA: 0 duplikasi method vs modul. Ia composition root, bukan monolit. |
| Kejar 26 "unknown" REA | Batas budget tool, bukan cacat kode. |
| Naikkan `xlsx` | Tidak ada versi fix. |
| Ganti `html5-qrcode`/`jspdf` | Tidak ada CVE terbuka. |
| Tambah interface/abstraksi | Tidak ada modul dengan satu implementasi tiruan. |
