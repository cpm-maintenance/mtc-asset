## 📝 Session 33 (S33, 2026-10-20) — sisa `app.js` habis: **74,54% → 97,57% lines**, total **96,69% lines**

### Apa yang dikerjakan
Lanjutan S32: 325 baris merah `app.js` (61 klaster) ditutup lewat **6 berkas tes baru, 116 tes** — tanpa menyentuh `src/**` sama sekali (⇒ `CACHE_NAME` tetap `mtc-asset-v21`, tidak di-bump).

| Berkas tes baru | Tes | Klaster yang ditutup |
|---|---|---|
| `tests/app-auth-menu.test.js` | 16 | `installApp` 62-67 · `login` 512-527 · `logout` 531-543 · `showUID` 548-550 · `filteredMenuGroups` 638-644 · `mobilePrimaryItems` 648-650 · `isSupervisor` 1211 |
| `tests/app-wo-views.test.js` | 28 | `backlogAging` 800-805 · `woSectorOf`/`woSectorOptions` 810-822 · `woFiltered` 825-838 · `woVisible`/`canLoadMoreWO`/`loadMoreWO` 850-858 · `woSelected` 868-873 · `woNextInQueue` 876-879 · `woCounts` 882-893 · `woKpi` 896-933 · `woDowntimeSpark` 1006-1014 |
| `tests/app-dashboard-equip.test.js` | 31 | `pmEffectiveness` 1101-1123 · `sortedByPriority`/`topOverdueWO` 1126-1137 · `dashAlerts` 1311-1318 · `dashKPIs` 1326-1344 · `calculatedStats` 1347-1367 · `predictiveAlerts` 1378-1413 · `filteredEquip` 1417-1456 · `canLoadMoreEquip` 1459-1464 · `equipCounts` 1468-1477 · `equipKpi` 1480-1491 · `equipmentTree` 1511-1522 |
| `tests/app-migrate-images.test.js` | 10 | `migrateLegacyImages` 1620-1714 (bucket ImageUploads, Equipment.FotoURL inline, HistoryLog.PhotoURLs array/string JSON, semua cabang gagal) |
| `tests/app-parts-planning-tw.test.js` | 26 | `filteredAllLogsAll` 1998-2022 · `filteredParts` 2100-2103 · `filteredPartsForLog` 2105-2121 · `planningTechList` 2135-2139 · `twActiveWOs`/`twTechList`/`twTotalHours`/`twOverloadCount`/`twFilteredTechs` 2305-2349 |
| `tests/app-mp-export-pdf.test.js` | 5 | `mpExportPDF` 2395-2476 (`vi.mock('jspdf')` + `vi.mock('jspdf-autotable')`, kelas MockJsPDF) |

### Angka riil (dari tool, bukan perkiraan)
| Metrik | S32 | S33 |
|---|---|---|
| Coverage total (stmt/branch/func/lines) | 90,05 / 79,19 / 87,86 / 91,45 | **95,57 / 84,67 / 96,00 / 96,69** |
| `app.js` (stmt/branch/func/lines) | 73,98 / 66,41 / 72,09 / 74,54 | **96,53 / 85,51 / 96,74 / 97,57** |
| Threshold `vitest.config.js` | 88 / 77 / 85 / 89 | **95 / 84 / 95 / 96** |
| Suite unit | 1527 tes / 54 berkas | **1643 tes / 60 berkas** |
| `tsc --noEmit` | 0 error | 0 error |
| eslint | 0 error / 79 warning | **0 error / 79 warning** |
| Build + `verify:precache` | ok · 50/50 | ok · **50/50** |

### Jebakan baru (tambahan dari S32)
1. **`makeApp()` memberi default `isAdmin: true` + `userRole: 'admin'` sebagai nilai statis** (defineProperty) — jadi `canAccess({allowedRole:'admin'})` selalu `true` walau `userRole` di-override. Uji rantai peran: set `isAdmin: false` eksplisit, lalu andalkan getter asli `isAdminOrSupervisor`.
2. **Getter dashboard/equipment tidak menjaga entri `null`**: `dashKPIs`, `calculatedStats`, `equipKpi`, `equipmentTree` memanggil `e.EquipmentID` langsung → fixture berisi `null` membuat getter melempar. `filteredEquip`/`equipCounts` justru aman (punya guard sendiri). Sediakan `EQUIP_VALID = EQUIP.filter(Boolean)` untuk klaster dashboard.
3. **`dashKPIs` default wh = 24**: `Number(p.wh) || 24` membuat `wh: 0` mustahil; cabang nol hanya tercapai lewat `bd + stb` penuh.
4. **`woKpi.mttr` menghitung `repairs` dari SELURUH `logs`**, bukan hanya yang ber-`woNumber` — satu log tanpa WO ikut jadi pembagi (9 jam / 4 = 2,3).
5. **`migrateLegacyImages` menulis referensi di dua fase** sehingga satu entri base64 bisa menaikkan `migrated` lebih dari sekali (bucket + fase HistoryLog) — hitung ekspektasi dari seluruh fase, bukan dari bucket saja.
6. **`vi.mock('jspdf')` + `vi.mock('jspdf-autotable')`** cukup: `doc.autoTable` dipanggil di instance, jadi kelas mock tinggal menyediakan `autoTable()` yang mengisi `lastAutoTable.finalY`.
7. **`npx playwright test` default 4 worker = flake** setelah cache Vite dingin: 4 smoke test gagal `page.goto` timeout 30 s (dev server masih mengompilasi), sedangkan 1 tes lolos. `npx playwright test --workers=1` → **5 passed, 49,1 s**. Jalankan serial kalau bukan CI.
8. **Parallel subagent kena HTTP 429** (6 anak sekaligus di provider yang sama) — 4 dari 6 gagal total dan tidak menulis berkas. Pelajaran: batasi fan-out ke 2–3 anak, atau kerjakan inline (yang akhirnya dilakukan untuk 4 klaster sisa).

### CI (temuan terbuka)
Job **`Test` gagal di langkah "E2E tests (smoke)"** — sudah gagal sejak S32 (`5024f6c`), **bukan regresi S33**. Langkah lint/typecheck/unit/coverage/build di runner **hijau semua**; `Build and Deploy` + `Lighthouse CI` **success** untuk `4f176b8` maupun `d3c1df4`. Percobaan `--workers=1` di workflow (commit `d3c1df4`) belum menyelesaikan; simulasi CI lokal (`CI=true npx playwright test e2e/smoke.spec.js --workers=1`) → **4 passed, 23,9 s**. Diagnosa lanjut butuh log runner (`gh run view --log-failed` setelah `gh auth login`) — jangan menebak.

### Status
Tidak ada kartu kanban terbuka. Sisa temuan non-kartu masih seperti S32: font-size mobile (a11y 96), chip filter `WorkOrders.html:224-240` tanpa label statis, unused JS 137 KiB, Playwright belum masuk CI.

---
## 📝 Session 32 (S32, 2026-10-20) — Harness Alpine `app.js`: **20,9% → 74,54% lines**

### Apa yang dikerjakan
Kartu `t_30aa9581` (Harness Alpine + tes `app.js` >=70%), dikerjakan manual — kartu `blocked`, tanpa `unblock`, tanpa worker kanban. `src/**` **tidak disentuh sama sekali** (bukti: `git show --name-only 04ee492 | grep -c '^src/'` → 0), jadi `CACHE_NAME` di `sw.js` **tidak** di-bump (tetap `mtc-asset-v21`).

Pendekatan: `app()` dipanggil langsung di jsdom (tanpa Alpine), Firebase di-stub di `window` (`ref/get/set/update/remove/db/auth`) — pola "mock LIBRARY, bukan modul". Helper bersama: `tests/helpers/app-harness.js` (`makeApp()`, `stubFirebase()`).

### Angka riil (dari tool, bukan perkiraan)
| Metrik | S31 | S32 |
|---|---|---|
| Coverage total (stmt/branch/func/lines) | 77,18 / 65,48 / 74,11 / 79,27 | **90,05 / 79,19 / 87,86 / 91,45** |
| `app.js` lines | 20,9% | **74,54%** (stmt 73,98 · branch 66,41 · func 72,09) |
| Threshold `vitest.config.js` | 76 / 64 / 73 / 78 | **88 / 77 / 85 / 89** |
| Suite unit | 1195 tes / 44 berkas | **1527 tes / 54 berkas** |
| `tsc --noEmit` | 0 error | 0 error |
| eslint | 0 error / 79 warning | **0 error / 79 warning** |
| Build + `verify:precache` | ok · 50/50 | ok · **50/50** |
| E2E Playwright | 5 passed | **5 passed** (53,6 s) |

### Berkas baru (13 di commit `04ee492`)
- `tests/helpers/app-harness.js` — `makeApp()` (defineProperty, karena getter modul tak punya setter) + `stubFirebase()`
- `tests/app-module.test.js` (1) · `app-history-audit` (39) · `app-workorders` (47) · `app-health-badges` (72) · `app-dashboard-data` (42) · `app-logs-tac` (30) · `app-planning` (35) · `app-mtbf` (33) · `app-photo-lifetime` (16) · `app-parts-telemetry` (17) → **332 tes baru**
- `docs/superpowers/plans/2026-10-20-app-js-test-harness.md` — rencana pembagian rentang baris

### Jebakan yang ditemukan
1. **Getter modul tidak punya setter** — `s.isAdmin = false` melempar `Cannot set property ... which has only a getter`. Override wajib lewat `makeApp({ isAdmin: false })` (defineProperty). Karena itu harness memberi default `isAdmin`/`userRole`.
2. **Di jsdom `globalThis === window`** — men-set `globalThis.Cropper` langsung memicu jalur "Cropper sudah tersedia" di `showCropModal`, sehingga jalur lazy-load CSS/script tak pernah jalan. Set `globalThis.Cropper` **setelah** `showCropModal()` dipanggil, baru panggil `script.onload()`.
3. **`$nextTick` adalah magic Alpine**, bukan milik `app()`. Override `$nextTick: fn => fn()` untuk menguji `showCropModal`/`mtbfRefresh`.
4. **`formatAuditTime` jalur catch tak terjangkau lewat input biasa** — `new Date('bogus')` tidak melempar (hasilnya `Invalid Date`). Untuk menutup cabang catch, spy `Date.prototype.toLocaleDateString` agar melempar.
5. **Output tool panjang dipotong proxy kompresi (headroom)** jadi placeholder/`<<ccr:...>>`. Baca per ~40-60 baris dan/atau `headroom_retrieve` dengan hash; jangan menebak isi kode.
6. **Fixture `part()` dengan default `EquipmentIDs: ['EQ-1']`** menutupi cabang `EquipmentID` tunggal di `filteredAllParts` — set `EquipmentIDs: undefined` agar cabang ketiga tercapai.

### Sisa yang belum ditutup di `app.js` (439 → ~330 baris merah)
- `mpExportPDF` (`2396-2474`) + blok `2306-2348` — butuh mock `jspdf`/`jspdf-autotable` + canvas/download.
- `migrateLegacyImages` cabang upload gagal (`1655-1687`), `installApp` (`62-67`), `loadMoreWO`/`woParts` sisa cabang (`801-933`), `badgeCount` sisa (`1103-1137`), blok dashboard/equipment (`1317-1522`).

---

## 📝 Session 31 (S31, 2026-10-19) — C-3: Lighthouse diukur ulang, **seo 91 → 100**

### Apa yang dikerjakan
Kartu `t_c6d1c766` (C-3), dikerjakan manual (kartu `blocked`, tanpa `unblock`). Alat: **Lighthouse 12.6.1** lokal (`npx --no-install lighthouse`), Chrome headless, preset **desktop** + **mobile** default, diukur di **preview build** (`vite preview :4173`) **dan** live.

### Angka riil (dari JSON Lighthouse, bukan perkiraan)
| Target | perf | a11y | best-practices | seo |
|---|---|---|---|---|
| live **sebelum** | 92 | 100 | 100 | 91 |
| live **sesudah** | **96** | **100** | **100** | **100** |
| preview desktop sesudah | 96 | 100 | 100 | 100 |
| preview mobile sesudah | 71 | 100 | 96 | 100 |

Metrik preview desktop: FCP 0,5 s · LCP 0,9 s · TBT 20 ms · CLS **0,119**. Mobile: FCP 2,2 s · LCP 3,6 s · TBT 240 ms · CLS **0,251**.
Fragmen `/pages/WorkOrders.html` + `/pages/EnterpriseDashboard.html`: perf **100** · CLS **0** · TBT **0 ms** keduanya.

### Satu perbaikan nyata
`/robots.txt` **tidak ada** di `public/`, jadi Firebase Hosting menyajikan `index.html` (200 `text/html`) untuk path itu → audit `robots-txt` gagal → seo tertahan 91. Ditambah `public/robots.txt` (23 byte: `User-agent: *` / `Allow: /`), commit **`7dee035`**, live terverifikasi: `curl -sI` → `Content-Type: text/plain`, body benar. Ini satu-satunya kegagalan biner di desktop.

### E2E alur kritis login → WO → PDF (kartu `t_f40464ef`, selesai — tidak lagi skip)
**Sebelum**: spec butuh `E2E_EMAIL`/`E2E_PASSWORD` produksi (jadi selalu `skip`), dan membaca `window.app.logs` secara instan padahal listener RTDB belum terisi.
**Sekarang**: jalan penuh di **Firebase Emulator** — `npx playwright test` → **5 passed** (4 smoke + 1 alur kritis) **7,9 s**, nol skip.
- `e2e/firebase.e2e.json` + `e2e/database.e2e.rules.json` — emulator auth `9099` + database `9000`, rules allow-all **khusus E2E**.
- `e2e/seed-emulator.mjs` — buat user uji (`e2e@mtc.local`, role admin) + seed `Users`/`Equipment`/`HistoryLog`; menunggu auth siap (≤30 s); idempoten (fallback `signInWithPassword` bila email sudah ada).
- `playwright.config.js` — `webServer` jadi array: emulator + `vite dev` dengan `VITE_USE_EMULATORS=1`.
- `src/js/db.js` — `connectDatabaseEmulator`/`connectAuthEmulator` hanya bila `VITE_USE_EMULATORS === '1'`; build produksi tidak berubah.
**Jebakan yang ditemukan**:
1. **Namespace RTDB emulator = host `databaseURL`** (`mtc-asset-default-rtdb`), **bukan** `projectId`. Salah namespace → `Users/{uid}/role` terbaca `null`, role jatuh ke `user`, listener data tidak jalan, `logs` kosong. Ini akar kegagalan yang paling lama dicari.
2. Readiness URL database (9000) **tidak** menjamin auth (9099) siap → seed harus menunggu sendiri.
3. Role harus di-seed `admin` supaya alur data berjalan.
4. Ganti baca instan → `expect.poll` pada jumlah `logs` ber-`woNumber`.
**Gate**: `tsc` 0 · lint **0 error** / 79 warning (butuh `/* global fetch, setTimeout, URL, process */` di berkas `.mjs` baru) · **1195** tes / 44 berkas · coverage **77,18 / 65,48 / 74,11 / 79,27** (turun 0,04 karena cabang emulator di `db.js` tak tercakup unit test; masih di atas ratchet 76/64/73/78) · build + precache OK · `sw.js` → **`mtc-asset-v21`** · commit **`ff8aafe`**, live terverifikasi.
**Belum**: workflow CI belum menjalankan Playwright (butuh Java + emulator di runner) — kandidat kartu berikutnya.

### Backup RTDB terjadwal + retensi 7 hari (kartu `t_004f45c4`, selesai)
**Premis kartu keliru** — backup terjadwal sudah ada di cloud: `.github/workflows/backup.yml` cron `0 19 * * *` (= 02:00 WIB), **124 run**, tiga run terjadwal terakhir (17/18/19 Okt) semuanya `completed/success` (dicek lewat API GitHub, `gh` belum login).
- **Windows Scheduled Task TIDAK dibuat** — redundan dengan cron cloud dan bergantung laptop menyala. Kalau nanti mau backup lokal terjadwal, tinggal `schtasks /create` + wrapper `.cmd` (± 5 menit).
- **Retensi 7 hari** di dua tempat: artifact workflow `retention-days: 90 → 7`; `scripts/backup-firebase.js` sekarang membuang berkas berumur > 7 hari (`selectExpiredBackups`, `RETENTION_DAYS = 7`) di samping cap `MAX_BACKUPS = 30`.
- **Retensi dibuktikan**: 2 berkas dummy di-`touch -d "10 days ago"` → keduanya `Removed` saat run; run menghasilkan `backup-2026-10-20_08-23-31.json` dan `LATEST.txt` diperbarui.
- **`BACKUP.md` dibetulkan**: `backups/` **tidak** di-commit (gitignored), angka retensi, dan prosedur **restore 5 langkah** yang benar — `database:set` menimpa seluruh node, tanpa `--force` minta konfirmasi, cakupan artifact cloud tidak memuat `Users`/`AI_Settings`.
- **Tes**: `tests/backup-retention.test.js` (5 tes, RED dulu — modul di-guard `invokedDirectly` supaya import tidak menjalankan backup).
- **Commit** `c02b8f8`. Gate: `tsc` 0 · lint 0/79 · **1195** tes / 44 berkas · coverage 77,22/65,50/74,11/79,27 · build + precache OK. Tanpa bump `sw.js` (tidak ada `src/**`/`public/**` berubah).

### Migrasi data legacy URL di RTDB (kartu `t_576f26ea`, selesai)
Fix `9038829` hanya menutup tulisan baru; baris lama masih menyimpan `https:&#x2F;&#x2F;...`.
- **Backup dulu**: `npm run backup:firebase` → 7 node berisi data, berkas di `backups/` (gitignored).
- **Skrip baru** `scripts/migrate-fotourl.mjs`: default **dry-run**, `--apply` untuk menulis, `--node A,B` untuk membatasi. Menelusuri rekursif, hanya field berakhiran `URL`/`Url`/`URLs` (string **dan** array `PhotoURLs`). Menulis lewat `firebase database:update … --force` yang dipanggil dengan `execFile` + argumen array (tanpa shell) — nilai dari RTDB tidak pernah diinterpretasi sebagai perintah.
- **Hasil**: Equipment **16 field URL / 3 legacy** → `2220-CR-001`, `5060-FP-03` (i.ibb.co), `5060-PU-13` (cloudinary). HistoryLog 4 / 0 · Performance, Users, logs 0. Total **20 diperiksa, 3 legacy**.
- **Temuan**: node **`SpareParts` tidak ada** di RTDB produksi (kosong) — kartu menyebutnya, tapi tidak ada data untuk dimigrasi.
- **Apply**: 3 field ditulis. **Verifikasi**: dry-run ulang → **0 legacy** (idempoten terbukti) + baca langsung 3 record → semuanya `https://…` bersih.
- **Tes**: `tests/migrate-fotourl.test.js` (11 tes) — decode entitas, filter kunci, array `PhotoURLs`, idempotensi, `chunkUpdates`.
- **Commit** `2690914` (tanpa bump `sw.js` — tidak ada `src/**`/`public/**` yang berubah). Gate: `tsc` 0 · lint 0/79 · **1190** tes / 43 berkas · coverage 77,22/65,50/74,11/79,27.

### C-4 — CLS login + perf mobile (kartu `t_81c2005f`, selesai)
**Akar masalah (dibuktikan, bukan ditebak)**: probe CDP dengan CPU 4x + slow 4G merekam rect tiap 50 ms — section kanan login **839 px → 572 px pada ~2,2 s**. Sebabnya tiga blok mode (`email`, `pin`, `sso`) semuanya `x-show` **tanpa `x-cloak`**: ketiganya ter-render sebelum Alpine boot, lalu dua disembunyikan.
**Fix**: `x-cloak` pada blok PIN + SSO + spinner `isLoading`; blok `email` (default) sengaja TIDAK di-cloak supaya form langsung terlihat. Dikunci `tests/login-cloak.test.js` (3 tes).
**Gambar**: `<picture>` + `<source type="image/webp">` srcset 800w/1600w, `sizes="(min-width:1024px) 58vw, 100vw"`, `<img>` fallback JPG dengan `width="1600" height="795"`. Generator `scripts/build-login-image.mjs` (sharp, devDependency baru): `login-mill-1600.jpg` 220.136 B → `login-mill-1600.webp` 154.932 B · `login-mill-800.webp` 62.610 B. `includeAssets` + `img/*.webp` → precache 51 → 53 entri.
**Angka live**: mobile perf **71 → 91**, CLS **0,251 → 0,011**, LCP 3,6 → 2,8 s; desktop perf 96 → **99**, CLS **0,119 → 0**. best-practices mobile tetap 96 (audit `font-size` = kartu C-9, bukan kartu ini).
**Commit**: `bd79f3a` (cloak) + `efbb690` (gambar), `sw.js` → **`mtc-asset-v20`**. Gate: `tsc` 0 · lint 0/79 · **1179** tes / 42 berkas · coverage 77,22/65,50/74,11/79,27 · precache 50/50.

### Tindak lanjut (a) — BUG `FotoURL`: **opsi 1** (dipilih Manuel)
`sanitizeDataForFirebase()` sekarang **melewati** kunci yang berakhiran `URL`/`Url`/`URLs` (`/urls?$/i`) dan menyimpan nilainya mentah; semua kunci lain tetap lewat `sanitizeInput()`. Akibatnya `equipment.js:77` dan `parts.js:100` menulis `https://res.cloudinary.com/...` utuh, dan migrasi `app.js:1650` (`includes('https://res.cloudinary.com')`) hidup lagi untuk record baru.
TDD: RED dulu — 1 tes baru di `tests/utils.test.js` (`tidak meng-escape field berakhiran URL/Url/URLs`) + 2 assertion `tests/equipment-module.test.js` diubah dari bentuk ter-escape ke URL mentah; ketiganya gagal karena escaping, baru implementasi 4 baris. Hijau: **1176** tes, coverage **77,22 / 65,50 / 74,11 / 79,27**, `sw.js` → **`mtc-asset-v18`**, commit **`9038829`**, live bundle `main-Cpwr_4nU.js` memuat pola `urls?$`.
Catatan: baris lama di RTDB **masih** ter-escape; jalur baca `data.js → cleanFirebaseUrl()` sudah mereparasinya saat load, jadi tidak ada migrasi data yang dijalankan.

### Sisa temuan — SENGAJA tidak dikerjakan (kartu: "catat temuan saja")
1. **CLS 0,119 desktop / 0,251 mobile** — culprit tunggal: container grid login `index.html:125` (`max-w-7xl mx-auto grid ... items-stretch`). `main` memakai `justify-center`, jadi saat font display swap mengubah tinggi konten, seluruh grid bergeser.
2. **`public/img/login-mill-1600.jpg` 220 KB**, tanpa `srcset`, tanpa WebP → estimasi Lighthouse 140 KiB (responsive) + 82 KiB (format). Mesin ini **tidak punya** `sharp` / ImageMagick / `cwebp` (`convert` yang ada = tool filesystem Windows, bukan IM).
3. **Unused JS 137 KiB** — `main-*.js` 69 KiB + `db-*.js` 68 KiB (Firebase SDK).
4. **Mobile best-practices 96** — audit `font-size`: hanya **52,96%** teks legibel; `.text-label-mono-sm` **10 px**, tombol **11 px**, `.text-label-mono-md` **11 px**. Mengubah token tipografi = keputusan desain lintas 18 halaman, bukan tugas pengukuran.
5. **Dua sinyal a11y nyata di fragmen** (sisanya artefak: tanpa `doctype`/`html-lang`/`title`/`meta`/`viewport`, jadi a11y 77 & seo 82 fragmen **bukan** temuan app):
   - chip filter `WorkOrders.html:224-240` nama tombolnya **hanya** dari `x-text` → kosong kalau Alpine tidak jalan. Perbaikan: taruh label statis di dalam `<button>` (`ALL`, `Pending`, …) dan biarkan `x-text` menimpanya.
   - `target-size` < 24 px pada chip filter (`px-space-sm py-1`) dan tombol view toggle.

### Gate (dijalankan di sesi ini)
`tsc --noEmit` 0 error · `eslint` **0 error / 79 warning** · **1175/1175** tes, 41 berkas · coverage **77,21 / 65,49 / 74,11 / 79,26** (ratchet 76/64/73/78 — tidak diturunkan) · `vite build` ok · `verify:precache` **50/50** · `sw.js` **tetap `mtc-asset-v17`** (robots.txt tidak di-precache; tidak ada aset cache yang berubah).

### Catatan alat (jebakan baru)
- `npx lighthouse ... >/dev/null 2>&1` **tidak** menulis JSON. Alihkan ke berkas log (`>test-results/lh/x.log 2>&1`), baru JSON-nya muncul.
- Output terminal sesi ini melewati proxy kompresi (headroom) → pembacaan berkas panjang terpotong jadi placeholder. Pakai `grep -o`, `awk '{print substr($0,1,70)}'`, atau `node -e` dengan keluaran pendek.

---

## 📝 Session 30 (S30, 2026-10-18) — coverage `ui.js` 32,98% → 98,96% lines

### Kenapa `ui.js`
Kartu (a) di handoff: modul terbesar yang belum tersentuh setelah `app.js`. 419
baris, 419 → mayoritas DOM-lewat-state, jadi jsdom + mock LIBRARY cukup — tidak
butuh harness Alpine seperti `app.js`. `tests/ui-qr.test.js` sudah menutup jalur
QR (generateQR/downloadQR/downloadAllQRs/handleScanResult/submitManualScan),
sisanya 130 baris merah: tema, notifikasi, kamera, helper warna, kompresi,
Cloudinary, reset.

### `tests/ui-module.test.js` baru — 51 tes · 32,98% → **98,96%** lines
Harness `makeCtx(overrides)` dengan `Object.assign(default, overrides)` — override
diterapkan **setelah** default (jebakan S29). Mock: `html5-qrcode` + `qrcode` +
`../src/js/logger.js`; state mock lewat `vi.hoisted` karena factory `vi.mock`
di-hoist ke atas import.

- **`setTheme` / `applyTheme`**: tema valid → `localStorage.themeMode` +
  `applyTheme()` · tema asing jatuh ke `night` · `night` → `data-theme="dark"` +
  kelas `dark` + `darkMode true` · `navy` → atribut `navy` tetap gelap ·
  `light` → kelas `dark` dilepas.
- **`showNotification`**: konfigurasi per tipe (icon/bar/glow) · tipe asing →
  fallback `info` · durasi default 4500 · progress menyusut (50% di tengah) →
  `exiting` → dibuang 400 ms kemudian · interval berhenti saat entri hilang atau
  sudah `exiting` · auto-remove aman saat entri sudah dibuang.
- **`openQR` / `stopScanner`**: `$nextTick` menangkap promise agar pekerjaan async
  bisa di-`await` · instance `Html5Qrcode('reader')` + `start({facingMode})` +
  config `fps/qrbox` · callback decode diteruskan ke `handleScanResult`, callback
  error tidak melempar · konstruktor melempar dan `start()` menolak sama-sama →
  notifikasi "Failed to access camera" + panel ditutup · `stopScanner` tanpa
  instance / dengan instance / `stop()` melempar (instance sengaja **tidak**
  dilepas di jalur gagal — perilaku apa adanya, dikunci tes).
- **Helper warna**: `statusColor` (3 status + fallback emergency) · `critColor`
  (High/Medium/lainnya) · `logColor` (4 tipe + fallback) · `logStatusColor`
  (6 status + fallback) · `woPriorityColor` (4 prioritas + fallback) ·
  `getStatColor` (6 token + fallback gold).
- **`compressImage`**: file null / `size 0` → null · landscape 1200×600 → 600×300 ·
  landscape 500×250 apa adanya · portrait 300×1200 → 150×600 · portrait 200×400
  apa adanya · `img.onerror` → null · `reader.onerror` → null · `toBlob` dipanggil
  `'image/jpeg', 0.5`.
- **`uploadBase64Image`**: base64 kosong → null tanpa `fetch` · sukses →
  `secure_url`, endpoint `g3lkh1pu`, `FormData` berisi `upload_preset` +
  `file` · respons tanpa `secure_url` → null · HTTP gagal → pesan dari
  `j.error.message` atau `HTTP 500` · jaringan melempar → null.
- **`uploadImage`**: tanpa file → null tanpa notifikasi · jalur sukses
  (compress → base64 → upload) mengembalikan URL · kompresi gagal → notifikasi
  error · upload ditolak → "Image upload failed — coba lagi" (tanpa fallback
  base64) · exception → notifikasi warning + null.
- **`blobToBase64`**: null → `''` · sukses · `onerror` → `''`.
- **`systemReset`**: konfirmasi ditolak → tidak terjadi apa pun · sukses →
  `localStorage`/`sessionStorage` bersih, notifikasi info, `location.reload(true)`
  setelah 1500 ms · registrasi SW di-`unregister` + tiap nama cache dihapus ·
  `getRegistrations` melempar → dicatat, tetap reload langsung.
- **`generateQR` (jalur gagal)**: encoder melempar → notifikasi "Failed to
  generate QR Code", modal tidak dibuka, `isLoading` balik `false`.

### Jebakan yang ditemukan (masuk HANDOFF S31)
1. **`window.location.reload` tidak bisa di-`spyOn`** — properti anak `location`
   non-configurable. Yang configurable adalah `window.location` itu sendiri:
   `Object.defineProperty(window, 'location', { value: { reload }, configurable: true, writable: true })`,
   lalu pulihkan objek asli di `afterEach`.
2. **`img.onload` dipasang SETELAH `img.src = …`** — setter `src` pada stub harus
   menunda callback ke `queueMicrotask`, kalau tidak handler belum terpasang dan
   promise `compressImage` menggantung sampai timeout 5 dtk. Sama untuk
   `FileReader.readAsDataURL` → `onload`/`onerror`/`onloadend`.
3. **jsdom tidak punya `caches` maupun `navigator.serviceWorker`** — `'caches' in
   window` bernilai `false` di sana; pakai `vi.stubGlobal('caches', …)` dan
   `Object.defineProperty(navigator, 'serviceWorker', …)`, bersihkan dengan
   `vi.unstubAllGlobals()`.
4. **`vi.mock` di-hoist** — array/flag yang dipakai factory harus dari
   `vi.hoisted(() => …)`, bukan `const` di body modul (TDZ).

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `ui.js` | 32,98% | **98,96%** (stmt 99,12 · branch 90,19 · func 100) |

Sisa 2 baris merah = `319-320` (guard `CLOUDINARY_CLOUD`/`CLOUDINARY_PRESET`
kosong) — konstanta hardcoded non-kosong, cabang tak bisa dijangkau tanpa
mengubah sumber. Dibiarkan.

### Lanjutan S30 — `ai.js` 76,31% → **100%** lines (+27 tes di `tests/ai-module.test.js`)
Sisa 81 baris merah semuanya jalur yang belum pernah dieksekusi: catch luar,
rotasi key di rekomendasi, error HTTP Claude, body OpenRouter bukan JSON,
`generatePPT` + laporan cetak, dan siklus simpan/muat Firebase.

- **`analyzeKPI`** catch luar: `getKPIContext` melempar → `console.error` +
  `Error: <msg>`, `isAnalyzing` tetap balik `false`.
- **`generateRecommendations`**: rate limit → `rotateApiKey` 5× lalu `[]` ·
  app tanpa `rotateApiKey` → tidak crash · hasil `'{}'` (bukan array berisi) →
  loop 5× lalu `[]` · `rotateApiKey` melempar → catch luar, `[]`.
- **`callAI`** key eksplisit tanpa `window.app` → provider dari `localStorage`.
- **`callClaude`** HTTP gagal → pesan dari `error.message`.
- **`callOpenRouter`** body sukses bukan JSON → `Invalid response: <100 char>`.
- **`generatePPT`**: tanpa `analysisResult` → notifikasi error · delegasi ke
  `exportModule.generateKPIPPT` · fallback `generateSimpleReport` · export
  melempar → `Failed to generate PPT`, `isGenerating` balik `false`.
- **`generateSimpleReport`**: `window.open('', '_blank')` → `document.write`
  (HTML memuat metrik + hasil AI) → `close` → `onload` memanggil `print`.
- **`loadAIFromFirebase`**: guard admin/db · `apiKeys` array (5 input terisi) ·
  satu key tunggal dibungkus array · snapshot kosong · RTDB melempar.
- **`saveAIToFirebase`**: payload lengkap (`updatedAt`/`updatedBy`) ·
  `updatedBy` jatuh ke `'admin'` · guard tanpa db/admin · RTDB melempar.
- **`saveAIWithCustomModel`**: input kosong disaring, model `__custom__` →
  `customModelInput` di-trim, semua kunci `localStorage` ditulis, model
  non-custom dibiarkan.
- **setter `aiApiKey`**: isi slot pertama bila kosong, tidak menimpa yang ada.

Sisa yang **tidak** dikejar: 41 cabang parsial (`||` default, optional
chaining) — branch 87,42%, lines sudah 100%.

### Hasil akhir S30 (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `ui.js` | 32,98% | **98,96%** (stmt 99,12 · branch 90,19 · func 100) |
| `ai.js` | 76,31% | **100%** (stmt 98,46 · branch 87,42 · func 100) |

Total **72,66% → 76,42%** lines · 74,68% stmt · 63,59% branch · 72,01% func.
Suite **999 → 1077** tes (36 berkas). Ratchet `vitest.config.js`
**69/59/66/70 → 71/60/69/72 → 72/61/70/74** (margin ~2 poin).

### Lanjutan S30 — layar login "Secure Gateway" (redesign)
Login lama: kartu `max-w-md` di tengah, email + password, tanpa identitas visual.
Sekarang: shell penuh (header + grid 7/5 + footer) bergaya HUD SCADA, semuanya dari
token `tac-*` — jadi ikut 4 tema.

- **Struktur** (`index.html`): header "MTC ASSET SECURE GATEWAY" + pill
  "CHALLENGE ENCRYPTED"; panel kiri (HUD, `hidden lg:flex`) dengan latar
  **CSS murni** (grid 48px + dua radial glow) — bukan foto/CDN, supaya layar login
  tidak bergantung jaringan; panel kanan konsol akses; footer TLS/instansi.
- **Form tetap fungsional**: `x-model="loginForm.email"` / `.password`,
  `@submit.prevent="login()"`, tombol `:disabled="isLoading"` + spinner `x-html`
  lama dipertahankan. Ditambah **toggle secure key** (`showLoginKey`, ikon
  `visibility`/`visibility_off`, `aria-pressed`) dan **centang simpan sesi**.
- **Centang "simpan sesi" itu nyata**, bukan hiasan: `auth.js` memilih
  `browserLocalPersistence` saat dicentang, `browserSessionPersistence` saat tidak
  (default lama). Butuh plumbing baru: `browserLocalPersistence` diekspor
  `db.js` → `firebase-config.js` (`window.browserLocalPersistence`) →
  `globals.d.ts`.
- **Latar panel kiri = foto mill asli** (`public/img/login-mill-1600.jpg`,
  1925×956 → 1600×795, JPEG q78, **215 KB**), `filter:brightness(.42)` +
  overlay `rgba(8,12,18)` bertingkat + grid 48px di atasnya. Overlay sengaja
  **tetap gelap di semua tema** supaya teks di atas foto selalu terbaca.
  Masuk precache lewat `includeAssets: ['img/*.jpg']` → **51** entri.
- **Mode strip EMAIL / PIN / SSO — ketiganya nyata**:
  - `EMAIL` — jalur lama (email + password Firebase), default.
  - `PIN` — kiosk cepat: email operator yang **terakhir sukses** disimpan di
    `localStorage.mtc_last_login_email`, lalu PIN 4–6 digit dipakai sebagai
    password Firebase. Tanpa email tersimpan → peringatan + balik ke EMAIL
    (tidak pernah menebak email). Input PIN `inputmode=numeric`, `maxlength=6`.
  - `SSO` — `signInWithPopup(auth, new GoogleAuthProvider())`; role tetap dari
    RTDB `Users/{uid}/role`, jadi SSO tidak menambah hak akses. Provider Google
    sudah **Enabled** di Firebase Console (diverifikasi Manuel), jadi banner
    peringatan statis di panel SSO **dihapus** — ia muncul tiap kali tab dibuka
    dan terbaca sebagai error padahal bukan. Kegagalan nyata tetap tampil lewat
    notifikasi (`SSO gagal: <message>`).
- **Label CTA mengikuti mode** (`AUTHENTICATE & ENTER COMMAND CENTER` /
  `MASUK DENGAN PIN` / `LANJUTKAN DENGAN GOOGLE`). `x-html` + string ber-escape
  dibuang; spinner dan label sekarang dua `<span>` dengan `x-show`, jadi teks
  tombol tidak lagi membawa nama ligatur ikon di `textContent`.
- **Input non-aktif di-`disabled`**, bukan cuma disembunyikan: field `required`
  yang `display:none` tetap memblokir submit, jadi `:disabled="loginMode !==
  'email'"` / `'pin'` wajib.
- **Yang dibuang dari desain sumber**: angka telemetri palsu (SAG Mill / Ball
  Mill), kredensial contoh ("TECH-7402-RC"), tombol profil role palsu, dan klaim
  sertifikasi yang tidak dipegang app ini (FIPS 140-3 / ISO 27001). Diganti
  kartu modul statis + status yang benar.
- **Ikon**: 4 ligatur baru (`lock`, `login`, `visibility`, `visibility_off`) →
  `icon-subset.txt` 82 → **86** entri, font diregenerasi
  `node scripts/download-material-symbols.mjs` → **10.0 KB** (plafon 50 KB).
- **`sw.js` naik `v15` → `v16`** karena `src/**` dan `public/**` berubah.

Diukur di browser (build produksi, `vite preview`):
- desktop 1264×569 → panel kiri 697×600, kanan 491×600, **0 clipping**
  (blok kiri berakhir 306 / 704 di dalam 104–704), tanpa overflow horizontal.
- mobile 390×844 → panel kiri `display:none`, kanan 342×548, tanpa clipping,
  tanpa overflow-X.
- ikon: 15 ligatur terpasang semua 24×24 (tidak ada yang jatuh jadi teks).
- kontras AA per tema (teks utama / label / checkbox / wordmark):
  dark 10,15–15,01 · light 5,97–17,85 · navy 10,17–15,74 · purple 10,87–17,08.

### Lanjutan S30 — login dirombak dengan antislop (mode DURING)
Layar "Secure Gateway" sebelumnya lolos build tapi penuh slop. Audit menemukan 13
pelanggaran, mayoritas di Hard Gate. Yang dibuang:

| Temuan | Rule | Kenapa |
|---|---|---|
| 2 em dash di teks | R-02 | karakter terlarang di teks yang ditulis agen |
| `KIOSK-NODE-01`, `TERMINAL NODE ID`, `CHALLENGE ENCRYPTED`, `DEFENSE MATRIX ACTIVE`, `TLS 1.3 HARDWARE TUNNEL` | R-36, R-38 | klaim keamanan dan ID karangan, tidak ada yang bisa diverifikasi |
| grid 48px di atas foto | R-07 | tekstur "biar teknis" tanpa fungsi; foto sudah jadi identitas |
| radial gold orb | R-01 | orb warna = default AI, bukan keputusan |
| 3 dot ber-glow + `animate-pulse` | R-13, R-19 | menandai status yang tidak ada; MOTION 1 dilarang loop |
| `backdrop-blur` di 6 permukaan | R-10 | dose cap 1-2; sekarang 0 |
| 4 pill capsule (PWA READY, TELEMETRY LINK, dll) | R-09 | kombinasi capsule+border+dot+uppercase tanpa fungsi |
| "CORE TELEMETRY OS", "GATEWAY v4.2" | R-16, R-17 | buzzword + nomor versi karangan |
| mode tab bentuk pill + isi emas penuh | R-11 | pill di semua elemen; sekarang tab garis bawah 2px |

Yang ditambahkan supaya tidak jatuh ke steril (R-37: arah sudah ada, `design/DESIGN-TACTICAL.md`):

- **Design Read**: login gate untuk staf maintenance di tablet lapangan, bahasa
  Tactical Slate, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.
- **Aksen tunggal = emas**, dua tempat saja: garis bawah tab aktif dan tombol
  utama (R-13: glow 0, shadow hanya di 4 input recessed milik design system).
- **Identitas dari foto mill asli** milik Manuel, bukan dekorasi.
- **Satu titik fokus**: tombol masuk. Semua label lain turun satu tingkat warna.
- **Copy faktual**: "Registry aset, jadwal perawatan, dan riwayat work order",
  "Tetap bisa dibuka tanpa sinyal. Perubahan tersinkron saat koneksi kembali"
  (benar: precache SW + antrean RTDB), "Butuh akun atau reset password? Hubungi admin."

Perbaikan yang ditemukan saat uji, bukan saat menulis:
- **Tap target < 44px** (R-03): tab 34px, tombol mata 36px, link `ganti` 16px.
  Sekarang tab `min-h-[44px]`, tombol mata `w-11 h-11`, `ganti` `min-h-[44px]`,
  input `py-3` (46px), baris checkbox 44px.
- **Checkbox tanpa indikator fokus** (R-32): `focus-visible:outline-2` hanya
  menulis lebar, `outline-style` tetap `none`. Wajib `focus-visible:outline`
  (style solid) **plus** `outline-2`.
- **Kontras tema terang sempat terbaca 1,67:1** — itu artefak ukur: `transition-colors`
  masih berjalan saat dibaca. Dengan transisi dimatikan, terendah **5,97:1**.

**Delivery Gate (PASS):**
- Hard Gate: em dash 0 · overflow mobile 0 (390×844, panel 342×466, tanpa clip) ·
  angka/testimoni/klaim karangan 0 · kontrol mati 0 (3 tab, toggle mata, checkbox,
  submit, PIN, SSO semua bereaksi) · state kosong/loading/error ada · keyboard
  lengkap (9 elemen, semua punya indikator fokus) · 4 tema lolos AA
  (terendah 5,97:1) · tidak ada patch via script.
- Purpose-Gate: glow 0 · blur 0 · grid 0 · orb 0 · pill badge 0 · shadow hanya
  input recessed · motion hanya spinner saat memuat · ikon hanya `visibility`
  (fungsional) · tipe huruf dari DESIGN-TACTICAL (Inter + JetBrains Mono, alasan
  tertulis di spec: keterbacaan tablet lapangan).
- Liveliness: dial eksplisit, fokus tunggal, aksen tunggal, whitespace struktural,
  motif identitas = foto mill + garis emas.
- Bukti klik: tab EMAIL/PIN/SSO berpindah · PIN tanpa email tersimpan →
  peringatan dan tetap di EMAIL · PIN dengan email → operator tampil ·
  toggle mata `password`↔`text` + `aria-pressed` · checkbox false→true ·
  submit kosong → validasi browser · PIN `12` → "PIN harus 4–6 digit angka".

### Koreksi S30: tampilan dikembalikan, antislop hanya pada teks
Instruksi Manuel: "balikin ke tampilan semula, teksnya saja yang di antislop".
Jadi seluruh markup visual dikembalikan ke `9083a82` (`git checkout 9083a82 --
index.html`), lalu **hanya simpul teks** yang diubah.

Bukti tidak ada perubahan visual (dibandingkan `9083a82`, blok login):
- **139 atribut `class` identik**, urutan tag identik, 19 baris berubah semua berisi teks.
- Struktur yang dipertahankan: grid 48px, radial glow, 3 dot ber-glow + pulse,
  `backdrop-blur` di 6 permukaan, pill capsule, tab pill isi emas, kartu modul,
  strip footer.

Teks yang diganti (19 penggantian, 0 em dash tersisa):

| Sebelum | Sesudah | Alasan |
|---|---|---|
| `TERMINAL NODE ID: MTC-CORE-01` | `PT CITRA PALU MINERALS` | R-38 ID karangan |
| `CHALLENGE ENCRYPTED` | `KONEKSI TERENKRIPSI` | R-36 klaim tanpa bukti |
| `TLS 1.3 HARDWARE TUNNEL` | `KONEKSI TERENKRIPSI` | R-36 "hardware tunnel" tidak ada |
| `DEFENSE MATRIX ACTIVE` | `AKSES DIBATASI ADMIN` | R-36 klaim fiktif |
| `KIOSK-NODE-01` | `PANEL MASUK` | R-38 ID karangan |
| `CORE TELEMETRY OS` | `MAINTENANCE PLANNING` | R-16 buzzword |
| `... SCADA TELEMETRY GATEWAY v4.2` | `REGISTRY ASET · JADWAL PERAWATAN · RIWAYAT WORK ORDER` | R-16 + R-17 versi karangan |
| `PWA TELEMETRY LINK` | `MODE OFFLINE` | tidak ada telemetri |
| `ACTIVE` / `SYNC` (kartu) | `MODUL` | status palsu |
| `LOCAL CACHE ACTIVE` | `CACHE LOKAL AKTIF` | benar, tapi diseragamkan |
| `RESTRICTED — AUTHORIZED PERSONNEL ONLY` | `AKSES HANYA UNTUK AKUN TERDAFTAR` | R-02 em dash |
| `... Users/{uid}/role — SSO tidak menambah hak akses.` | `..., jadi SSO tidak menambah hak akses.` | R-02 em dash |
| `x-text="rememberedEmail \|\| '—'"` | `'Belum ada email tersimpan'` | R-02 em dash |
| `ADMIN-MANAGED` | `DIBUAT ADMIN` | bahasa |
| `MIN 6 CHARS` | `MINIMAL 6 KARAKTER` | bahasa |

**Gate diukur pada build produksi (`vite preview`):**
- Text PASS: em dash **0** di teks yang dirender.
- Kontras PASS: terendah **5,48:1** (light, footer), 4 tema, semua ≥ 4.5.
- Layout PASS: desktop 1264×569 tanpa overflow, 2 panel tanpa clip; mobile
  390×844 panel 342×393, `leftHidden`, tanpa overflow.
- Form PASS: submit kosong diblokir (`checkValidity()` false, pesan browser).
- Klik PASS: PIN tanpa email tersimpan → peringatan dan tetap EMAIL · PIN dengan
  email → operator tampil · SSO → teks baru tanpa em dash.
- **Tap target FAIL (sengaja):** 7 elemen < 44px (tab 32, input 38, tombol mata 30,
  checkbox 16). Ini ukuran asli desain yang diminta dikembalikan.
- **Motion FAIL (sengaja):** 1 `animate-pulse` pada dot dekoratif.
- **Focus PARTIAL (sengaja):** checkbox tanpa indikator fokus; sisanya punya
  (tab/tombol mata/tombol masuk = outline sendiri, input = ring `.tac-well`).

Tiga yang merah itu visual, bukan teks. Perbaikannya 3 baris kalau diminta:
`min-h-[44px]` di tab, `w-11 h-11` di tombol mata, dan
`focus-visible:outline focus-visible:outline-2` di checkbox.

### S30 opsi 0: tutup 3 gate merah login (tanpa mengubah tampilan)
Hanya ukuran area klik + indikator fokus. Kelas visual lain tidak disentuh.

| Perubahan | Sebelum | Sesudah |
|---|---|---|
| tab mode | 32px | **44px** (`min-h-[44px]`) |
| tombol mata | 30px | **44px** (`w-11 h-11`) |
| input email/key/pin | 38px | **44px** (`min-h-[44px] py-3`) |
| baris checkbox | 20px | **44px** (`min-h-[44px]`), kotak 16→20px |
| checkbox | tanpa indikator | `focus-visible:outline focus-visible:outline-2` |

**Gate terukur (build produksi, `vite preview`):**
- Tap target PASS: 8 kontrol, semua ≥ 44 (tab 44, input 44, mata 44, CTA 46).
  Satu-satunya di bawah 44 adalah kotak checkbox native 20px, dan ia berada di
  dalam baris klik 441×44.
- Focus PASS: 8/8 elemen fokus punya indikator (tab/mata/CTA/checkbox = outline
  emas sendiri, input = ring `.tac-well`).
- Layout PASS: desktop 1264×569 tanpa overflow/clip; mobile 390×844 panel
  342×580, tanpa clip/overflow.
- Teks PASS: em dash 0. Form PASS: submit kosong diblokir.
- Motion masih FAIL 1: `animate-pulse` pada dot dekoratif (di luar scope 0).

**Temuan baru saat menyapu seluruh simpul teks (bukan dari perubahan ini):**
label kecil berwarna `text-tac-status-standby` (`#64748b`) di atas
`surface-card` hanya **3,56:1**, di bawah AA 4,5. Ini bukan regresi sesi ini:
`DESIGN-TACTICAL.md` sendiri menetapkan `#64748b` untuk label, jadi berlaku di
18 halaman. Ini tepatnya wilayah kartu **D-5 (gap AA tema gelap)** yang masih
menunggu keputusan Manuel. 136 simpul teks lain ≥ 4,5; CTA emas 6,11–7,87:1
(dihitung dari dua stop gradien, bukan dari `backgroundColor`).

### D-5: gap AA tema gelap ditutup (keputusan: opsi a, naikkan token)
`KNOWN_DARK_GAPS` kosong. Dua token di `:root` dinaikkan; light tidak disentuh.

| Token | Sebelum | Sesudah | Rasio terendah (3 tema gelap) |
|---|---|---|---|
| `--tac-status-standby` | `100 116 139` slate-500 | **`148 163 184` slate-400** | 3,03 → **5,63** |
| `--tac-gold-dim` | `180 83 9` amber-700 | **`217 119 6` amber-600** | 2,88 → **4,53** |

Dihitung terhadap 6 latar: `surface-card` + `surface-container-high` ×
dark/navy/purple. Keduanya inherit dari `:root` (navy/purple tidak override),
jadi satu perubahan menutup ketiga tema.

Berkas yang ikut:
- `src/css/tactical.css` — dua nilai token.
- `tests/tac-theme.test.js` — `KNOWN_DARK_GAPS` jadi `new Set([])`; tes tema gelap
  dinaikkan dari **≥3** (ambang komponen) ke **≥4,5** (AA penuh). Set kosong
  dipertahankan sebagai jaring: entri baru = regresi.
- `design/DESIGN-TACTICAL.md` — `status-standby: '#94a3b8'`,
  `gold-dim: '#d97706'`, dan prosa `#64748b` → `#94a3b8`.
- `public/offline.html` — 2× `color: #64748b` → `#94a3b8` (4,24 → **7,87** di
  atas `#05070a`). Halaman ini hardcode, tidak ikut token.
- `sw.js` — `mtc-asset-v16` → **`v17`** (`src/**` + `public/**` berubah).

`tailwind.config.js` tidak perlu diubah: semua warna `tac-*` sudah
`rgb(var(--tac-xxx) / <alpha-value>)`, jadi 18 halaman ikut otomatis.

**Bukti terukur (build produksi):**
- Login, 28 simpul teks × 3 tema gelap: **0 di bawah 4,5**; terendah 6,61
  (dark/navy) dan 7,08 (purple). Sebelumnya `DIBUAT ADMIN` 3,56.
- `offline.html`: `p`/`li` 7,87 · `h1` 9,39.
- Tes: `tac-theme.test.js` 12/12 · suite **1092/1092** · `tsc` 0 ·
  eslint **0 error / 79 warning** · build ok · precache 50/50 (51 entri).

### Gate motion login: `animate-pulse` dibuang
Satu-satunya animasi tanpa akhir di layar login: dot hijau di strip atas
(`bg-tac-status-operational` + `animate-pulse`). Kelas `animate-pulse` dihapus;
dot, warna, dan glow `shadow-[0_0_10px_rgba(16,185,129,0.7)]` tetap, jadi tampilan
tidak berubah selain berhenti berdenyut.

`animate-spin` pada spinner tombol masuk **sengaja dipertahankan**: itu umpan
balik saat request berjalan, bukan hiasan, dan elemennya `x-show` tersembunyi
saat idle.

**Gate terukur (build produksi):**
- Animasi tak berujung yang **terlihat** di layar login: **0** (sebelumnya 1).
- Total elemen beranimasi: 1, yaitu spinner, `hidden: true` (lebar 0).
- Dot: `animation-name: none`, `background: rgb(16,185,129)`, glow utuh.
- `tsc` 0 · eslint 0 error / 79 warning · suite **1092/1092** · build ok ·
  precache 50/50 (51 entri).

### Opsi 1: paket murah coverage — 5 modul, suite 1092 → 1175
Empat berkas tes baru + satu berkas tambahan. **`src/js/**` tidak disentuh.**

| Modul | Sebelum (lines) | Sesudah | Berkas tes |
|---|---|---|---|
| `equipment.js` | 46,57% | **100%** | `tests/equipment-module.test.js` (24) |
| `parts.js` | 54,83% | **100%** | `tests/parts-module.test.js` (24) |
| `notification.js` | 77,02% | **100%** | `tests/notification-fcm.test.js` (17) |
| `push-client.js` | 25% | **100%** | `tests/push-client-module.test.js` (6) |
| `requisition.js` | 67,16% | **89,55%** | `tests/requisition-listener.test.js` (13) |

Total: **74,85 / 63,74 / 72,11 / 76,60** → **77,21 / 65,49 / 74,11 / 79,26**
(stmt/branch/func/lines). Threshold `72/61/70/74` → **`76/64/73/78`**.

Yang ditutup:
- `equipment.js` — seluruh `submitEquipment` (validasi, unggah foto + fallback,
  `createdBy` create/edit, jalur offline antrean sukses/gagal, `runTransaction`
  hanya saat create, audit trail + audit melempar, `withRetry` 3× + notifikasi
  "Network error, retrying...", catch, `finally`), `openEquipModal`,
  `handleEquipPhoto` (termasuk callback crop), `goToDetail`.
- `parts.js` — hal yang sama untuk spare part + guard `!partForm`, cek `isAdmin`,
  `isLowStock`, legacy `EquipmentID` vs `EquipmentIDs` array, riwayat pemakaian.
- `notification.js` — jalur FCM penuh: `registerFCMToken` (izin belum granted,
  token kosong, SDK melempar, tanpa `window.db`/user), `saveFCMToken` (2 path,
  gagal ditelan), `removeFCMToken`, `setupForegroundListener` (payload notif /
  tanpa notif / tanpa `showNotification` / `getMessaging` melempar),
  auto-reorder admin vs non-admin vs reject.
- `push-client.js` — bentuk badan request (`headings`/`contents`/segmen `All`/
  ikon), `data` diteruskan apa adanya, tanpa `app_id`, fetch gagal ditelan,
  HTTP 500 tidak dilempar.
- `requisition.js` — `setupRequisitionsListener` (seed snapshot pertama tanpa
  notifikasi, request baru + label `+N others`, requester fallback
  `createdBy`→`Someone`, tiga transisi status, transisi tak resmi, snapshot
  rusak, callback error, unsub listener lama).

**Catatan bug yang ketemu saat menulis tes (belum diperbaiki, perlu keputusan):**
`sanitizeDataForFirebase` menjalankan `sanitizeInput` ke SEMUA string, dan
`sanitizeInput` meng-escape `/` jadi `&#x2F;`. Akibatnya `FotoURL` tersimpan
sebagai `https:&#x2F;&#x2F;...` di `equipment.js` dan `parts.js` — URL gambar
Cloudinary rusak. Tes mengunci perilaku saat ini apa adanya; perbaikannya
(kecualikan field URL dari sanitasi, atau escape saat render saja) menyentuh
semantik data lintas modul, jadi menunggu keputusan.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline tetap) · `vitest`
  **1175/1175** · `test:coverage` lolos threshold (74,85 / 63,74 / 72,11 / 76,60) ·
  `build` ok · `verify:precache` **50/50** berkas build (precache **51** entri,
  3445 KiB — foto mill ikut).
- **`src/**` tidak disentuh** → bundle identik, `sw.js` tetap `mtc-asset-v15`
  (tidak naik versi).

---



## 📝 Session 29 (S29, 2026-10-18) — coverage `kpi-engine.js` + `export.js` → 100% lines

### Kenapa `kpi-engine.js` duluan
Modul ini murni aritmetika (health score, MTBF, prediksi kegagalan) tanpa DOM —
paling murah per poin. Yang belum diuji justru bagian yang dipakai halaman KPI:
cache `_kpiCache`, pemilihan interval HM vs kalender, dan penggabungan event
`HistoryLog` + `Performance`. Sebelumnya hanya 3 guard yang tersentuh lewat
`tests/utils.test.js`.

### `tests/kpi-engine-module.test.js` baru — 49 tes · 43,92% → **100%** lines
Harness `Object.create(kpiEngineModule)` per tes (bukan spread — spread membekukan
getter), `makeEngine(overrides)` menerapkan override **setelah** default.

- **`_raw`**: `Alpine.raw` dipakai · fallback `__v_raw` · nilai non-objek lewat
  apa adanya · `Alpine.raw` melempar → array disalin, objek dikembalikan apa adanya.
- **`calculateHealthScore`**: default untuk id kosong / equipment bukan array /
  aset tak ditemukan · −15 per breakdown 90 hari (breakdown tua, tanpa `Tanggal`,
  jenis lain, dan log aset lain diabaikan) · −2/hari PM terlambat, dibatasi −30 ·
  PM belum jatuh tempo & tanggal invalid tanpa denda · MTBF < 168 jam → −10 ·
  clamp 0 + `Critical` · band `Warning` (70) dan `Critical` (30) · hit cache
  lewat entri yang sudah ada.
- **`_hmIntervalHours`**: delta HM bila keduanya > 0 · HM mundur → 0 · fallback
  jam kalender · tanggal invalid/null → 0.
- **`_breakdownEvents`**: event dari log dinormalkan (`HM` string → angka) ·
  `Performance.events` dipecah per kegagalan · `freq` numerik · `freq` 0 dilewati ·
  record aset lain & `null` dilewati · urut naik untuk event bertanggal ·
  state `null` → array kosong.
- **`calculateMTBF`**: 0 untuk id kosong / logs bukan array / < 2 event · delta HM
  (`'168.0'`) · rata-rata campuran HM dan kalender (`'48.0'`) · cache `m` terisi ·
  cache dibangun ulang saat key berubah.
- **`predictNextFailure`**: `'N/A'` · `'Insufficient Data'` (MTBF 0, dan logs
  bukan array walau MTBF ter-cache) · `'No failures recorded'` (MTBF dari
  Performance saja; breakdown tanpa `Tanggal`) · `'Invalid date data'` · jalur
  sukses = tanggal breakdown terakhir + MTBF.
- **`getEquipName`**: id kosong → `'Unknown Asset'` · equipment bukan array → `id` ·
  exact match menang atas case-insensitive · case-insensitive · tidak ketemu.

### `export.js` 45,5% → **100%** lines (+12 tes di `tests/export-module.test.js`)
Tiga jalur ekspor sebelumnya tidak tersentuh sama sekali karena menabrak
jsPDF/DOM. Harness lama dipakai ulang (`makeCtx` + mock `xlsx`/`jspdf`), cuma
ditambah `book_new`/`book_append_sheet`/`aoa_to_sheet`/`write` ke mock xlsx,
`setFont`/`setDrawColor`/`autoTable`/`lastAutoTable`/`internal.getNumberOfPages`
ke mock jsPDF, dan `vi.mock('jspdf-autotable')`.

- **`exportExcelFull`**: 7 sheet (`Equipment`, `SpareParts`, `HistoryLog`,
  `Performance`, `PM_Schedule`, `Requisitions`, `Summary`) · `EquipmentIDs`
  array → `'EQ-1, EQ-2'`, string dibiarkan · `PartsUsed` objek → JSON, string
  apa adanya, `null` → `'[]'` · `events` sama · Summary menjumlah `Cost` +
  `Downtime` (string di-`Number`, `null` → 0) · state kosong → sheet `[{}]` ·
  `Alpine.raw` dipakai bila ada · nama unduhan `MTC_Asset_Full_<tanggal>.xlsx`.
- **`exportPMSchedulePDF`**: `pmList` kosong → notifikasi warning, jsPDF tidak
  dibuat · sort overdue dulu lalu tanggal · `frequency: 'none'` → `'—'` ·
  equipment tak dikenal → `equipmentId` apa adanya · warna status
  Overdue/completed/pending/lainnya · 30 baris → `addPage` + header diulang
  (label `Task` muncul 2×) · error → `Failed to export PDF: <msg>` · `isLoading`
  selalu balik `false`.
- **`exportToPDF`**: guard tanpa `EquipmentID` · 3 tabel (log/PM/parts) ·
  deskripsi dipotong 40 char, taskName 35, nama part 25 · parts lewat
  `EquipmentIDs` **atau** `EquipmentID` · `Stok <= MinStock` → `⚠️ LOW` ·
  placeholder `No maintenance logs recorded` / `No PM schedule…` /
  `No parts linked…` · tanpa helper KPI → `N/A% - -`, `N/A hrs` · field panjang
  → dipotong 25 char + `…` (butuh `getTextWidth` besar) · error → notifikasi
  + `isLoading` balik `false`.

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `kpi-engine.js` | 43,92% | **100%** (stmt 100 · branch 96,87 · func 100) |
| `export.js` | 45,5% | **100%** (stmt 99,07 · branch 79,65 · func 96) |

Total **68,08% → 72,66%** lines · 71,2% stmt · 61,59% branch · 68,92% func.
Suite **938 → 999** tes (35 berkas). Ratchet `vitest.config.js`
**65/56/65/66 → 69/59/66/70** (margin ~2 poin di semua kategori).

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline tetap) · `vitest`
  **999/999** · `test:coverage` lolos threshold baru · `build` ok ·
  `verify:precache` **50/50**.
- **`src/js/**` tidak disentuh** (`git show --name-only 0c9c798` dan `9335deb`
  = hanya berkas tes + `vitest.config.js`) → bundle identik, `sw.js` tetap
  **`mtc-asset-v15`**.

### Temuan perilaku (bukan diperbaiki — di luar cakupan kartu)
- **`_kpiCache` cuma punya satu slot `key`.** `calculateHealthScore` memanggil
  `calculateMTBF` di tengah jalan, dan `calculateMTBF` menulis ulang `key` jadi
  `'m<id>'` → cache health score **tidak pernah kena**; setiap panggilan menghitung
  ulang. Dikunci tes `menghitung ulang pada panggilan kedua…`. Perbaikan butuh
  memisahkan slot (`hKey`/`mKey`) — menyentuh `src/js/**`, jadi ditunda.
- **`_breakdownEvents` berhenti mengurutkan kalau ada event tanpa `Tanggal`.**
  Comparator mengembalikan 0 saat salah satu sisi kosong, sehingga pasangan
  bertanggal di sekitarnya tak pernah dibandingkan. Dikunci tes
  `berhenti mengurutkan begitu ada event tanpa tanggal`.
- Cabang yang masih merah di modul ini (`58-63`, `144`, `170`) hanya sisi lain dari
  ternary/`||` — bukan jalur logika yang hilang.

### Sisa
- Kandidat berikutnya: `ui.js` 32,98% (130 baris merah) · `ai.js` 76,31% (81) ·
  `requisition.js` 67,16% (66) · `equipment.js` 46,57% (39) · `notification.js`
  77,02% (34) · `parts.js` 54,83% (28) · `push-client.js` 25% (14) ·
  `app.js` 20,9% (1010 baris, butuh harness Alpine — paling mahal, paling besar).
- Kartu C-3 (Lighthouse) & D-5 (gap AA tema gelap) tetap terbuka; D-5 butuh
  keputusan user.

---



### Kenapa `submitLog` duluan
`logs.js` 68,62% dan hampir semua sisa merahnya ada di satu fungsi: `submitLog`
(305–517). Itu fungsi yang **menulis data permanen** — bukan render, bukan tampilan.
Yang belum diuji justru bagian yang paling mahal kalau salah: foto yang hilang, stok
yang terpotong dua kali, diff downtime yang salah ke `Stats/totalDowntime`, dan jalur
offline yang diam-diam menulis ke RTDB saat koneksi mati.

### `tests/logs-module.test.js` 47 → 89 tes (42 baru) — 68,62% → **97,65%** lines
Harness lama dipakai ulang (`stubFirebase` + `makeCtx`), cuma ditambah `set` (Firebase
`set`) ke stub. Tambahan helper: `baseForm()`, `submitCtx()`, `runSubmit()` (memutar
timer sampai promise `submitLog` settle), `writtenPayload()`, `refPaths()`.

- **Jalur online**: payload `HistoryLog/LOG-*` lengkap (termasuk `createdBy`/`updatedBy`
  /`createdAt`), `Stats/totalDowntime` hanya saat diff ≠ 0 (`curr||0`, `Math.max(0, …)`),
  Equipment → `Active` kalau `Status === 'Completed'` (plus `LastHM`) atau `In Maintenance`,
  `EXTERNAL` tidak menyentuh Equipment, potong stok **sekali per part ber-id**
  (`SpareParts/<id>/Stok`), dilewati kalau `woNumber` ada atau saat edit, satu transaksi
  stok gagal tidak menghentikan part berikutnya, `syncPerformanceBD` hanya untuk `Breakdown`.
- **Sanitasi**: `Deskripsi` di-escape (`< > " ' /` → entitas, kata `script` dibuang),
  sementara `PartsUsed` & `PhotoURLs` **dikembalikan mentah** — dikunci eksak
  (`'[{"id":"P1","qty":2}]'`) supaya regresi `&quot;` langsung merah.
- **Metadata edit**: `createdBy`/`createdAt` lama dipertahankan, log lama tak ada →
  `createdBy` tidak ditulis sama sekali, `updatedBy` selalu diisi (`unknown` tanpa user).
- **Foto**: URL remote dilewatkan tanpa upload · `blob:` + `file` → `uploadImage` →
  URL hasilnya · base64 legacy tanpa file disimpan apa adanya · upload melempar atau
  mengembalikan `''` → foto dibuang + notifikasi warning (log tetap tersimpan) ·
  `uploadImage` bukan fungsi → dibuang · entri `null` dilewati · `photos` berupa objek
  Alpine di-unwrap lewat `Alpine.raw`, tanpa `Alpine` → daftar kosong.
- **Offline**: `isOnline=false` + queue sukses → RTDB **tidak** disentuh, `saveToIndexedDB`
  sekali, log masuk daftar lokal (unshift atau ganti di tempat saat edit), notifikasi
  "Log saved offline"; queue gagal → jatuh ke jalur online; `saveToIndexedDB` melempar →
  ditangkap `catch` luar.
- **Retry/audit/refresh**: gagal sekali karena jaringan → notifikasi "Network error,
  retrying..." lalu sukses; error non-jaringan → tanpa notifikasi itu; 3× gagal →
  `Error: <msg>`, modal tetap terbuka; audit `Create Log/WO` / `Update Log/WO` dengan
  `{id, equip, jenis}`, audit melempar diabaikan, `auditModule` tak ada tidak melempar;
  refresh 500 ms mengganti `logs` hasil RTDB terurut menurun, snapshot kosong tidak
  mengubah apa pun, `get` melempar diabaikan.

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `logs.js` | 68,62% | **97,65%** (stmt 95,97 · branch 86,6 · func 96,49) |

Total **66,3% → 68,08%** lines · 66,47% stmt · 58,03% branch · 66,22% func.
Suite **896 → 938** tes (34 berkas). Ratchet `vitest.config.js` **63/55/63/64 → 65/56/65/66**.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (turun 1 dari baseline 80) ·
  `vitest` **938/938** · `test:coverage` lolos threshold baru · `build` ok ·
  `verify:precache` **50/50**.
- **`src/js/**` tidak disentuh** → bundle identik, `sw.js` tetap **`mtc-asset-v15`**.

### Sisa merah di `logs.js` (sengaja, di luar cakupan kartu)
- `313` — `catch` luar ekstraksi `parts`; tak bisa dicapai karena semua jalur yang
  melempar sudah ditangkap `try` di dalamnya.
- `57`, `63`, `232` — `openLogModal` cabang diagnostik/parse.
- `790–793` — sinkronisasi `window.app.logs` di **`completeWO`**, bukan `submitLog`.

### Jebakan baru (catat biar tidak diulang)
- **`submitCtx` menimpa override-nya sendiri.** `ctx.isOnline = true` setelah
  `Object.assign(ctx, overrides)` membuat tes jalur offline **diam-diam** jalan di jalur
  online (gejalanya `window.ref is not a function`). Pakai
  `ctx.isOnline = overrides.isOnline ?? true`.
- **`withRetry` memakai `setTimeout` asli** (1.000 ms lalu 2.000 ms) dan `submitLog`
  menjadwalkan refresh 500 ms. Tanpa fake timer, callback refresh jalan **setelah** tes
  selesai dan `window.get` sudah di-unstub → TypeError di promise yatim. Selalu
  `vi.useFakeTimers()` + helper `runSubmit()` yang memutar timer sampai promise settle.
- **Lupa `stubFirebase()` = tes palsu hijau.** Tanpa stub, `window.set` undefined →
  `submitLog` masuk `catch` dan tetap "sukses" tanpa menulis apa pun. Tes `syncPerformanceBD`
  sempat 0 panggilan karena ini.
- **`sanitizeInput` membuang kata `script`** (bukan cuma meng-escape `<`/`>`), jadi
  assertion `toContain('&lt;script&gt;')` salah. Hasil nyata: `&lt;&gt;alert(1)&lt;&#x2F;&gt;`.
- **`makeCtx` tidak menyetel `isAdminOrSupervisor`** selain `true`; `submitCtx` juga
  menyetel `queueOfflineOperation`/`saveToIndexedDB`/`syncPerformanceBD` sebagai `vi.fn()`,
  jadi tes yang butuh perilaku asli harus menimpanya setelah `submitCtx`.

### Sisa
- Kandidat berikutnya: `ui.js` 32,98% · `equipment.js` 46,57% · `kpi-engine.js` 43,92% ·
  `export.js` 45,5% · `parts.js` 54,83% · `requisition.js` 67,16% · `app.js` 20,9%
  (butuh harness Alpine).
- Kartu C-3 (Lighthouse) & D-5 (gap AA tema gelap) tetap terbuka; D-5 butuh keputusan user.

---

## 📝 Session 27 (S27, 2026-10-18) — coverage `charts.js` 8,5% → 97,36% (kartu C-1)

### Kenapa `charts.js` terakhir
S26 menutup lapisan persistensi/listener/aritmetika PM. `charts.js` (576 baris) sengaja
ditinggal sampai akhir karena butuh `vi.mock('chart.js')` — dan karena seluruh isinya
**perhitungan data**, bukan sekadar pemanggilan library. Yang diuji di sini bukan "chart
terbentuk", tapi angka yang masuk ke chart: MTBF/MTTR per bulan, availability, reliability
`e^(-t/MTBF)`, Pareto kumulatif, cost per bulan, health/WO/PM trend.

### `tests/charts-module.test.js` (48 tes) — 8,5% → **97,36%** lines
Chart.js di-mock di level **library** (`vi.hoisted` + `vi.mock('chart.js')` dengan
`Chart`/`registerables` palsu), jadi modulnya dieksekusi apa adanya. `Object.create(chartModule)`
untuk isolasi state (spread `{...chartModule}` membekukan method lewat getter).

- **Helper murni**: `safeDeepClone` (salinan dalam, jalur `catch` untuk objek sirkular/`toJSON`
  yang melempar), `_monthKey` (valid/invalid/null), `_rgba` (hex 6 & 3 digit), `_gradFill`
  (dua stop alpha, `createLinearGradient(0,0,0,300)`), `_equipLabel` (nama → fallback id →
  fallback `Unknown Asset`), `_chartIdleKind` (offline/empty).
- **`loadChartJS`**: `Chart.register(...registerables)` sekali, lalu cache `window._chartJS`.
  `safeCreateChart`: instance baru · destroy chart lama di kanvas sama · `null` kalau Chart.js
  tidak ada · `catch` → `console.error` + `showNotification('Chart render failed','error')`.
- **`setChartState`/`clearChartState`**: tiga preset ikon (`wifi_off`/`warning`/`show_chart`)
  + tone token, jenis tak dikenal jatuh ke `empty`, kanvas hilang tidak melempar.
- **`renderMTBFMTTRChart`**: 4 guard (tanpa filter, tanpa kanvas, tanpa log, error `_raw`),
  agregasi per bulan (`wh/freq`, fallback `events.length`, fallback jumlah log `Breakdown`),
  MTTR hanya saat ada `Repair` **dan** downtime.
- **`renderDashboardCharts`**: guard halaman/login, destroy chart sisa (termasuk yang
  `destroy()`-nya melempar), `dashboardStats` (overduePM/lowStock/totalDowntime), 4 overlay
  saat equipment kosong, render 4 chart (PA harian → 7 hari terakhir, PM overdue/pending/
  completed/cancelled, WO completion, cost trend), filter rentang tanggal WO, dan **4 cabang
  "halaman berpindah di tengah render"** (satu tes per chart).
- **`renderKPICharts`**: 9 chart. MTBF = `hari × 24 / kegagalan` (equipment dengan <2 titik
  dibuang), MTTR diurut menurun, availability per bulan, reliability `e^(-t/avgMTBF)`,
  top-5 komponen, scheduled vs unscheduled, failure type dari `equipment.Tipe`, cost
  `Rp M`, Pareto kumulatif berakhir di 100%.
- **`renderEnterpriseCharts`**: 6 chart (health dist, WO status, PM trend, downtime trend,
  cost trend, ABC), `tooltipStyle` bersama, dan nilai netral `[1]` saat semua kalkulasi kosong.

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `charts.js` | 8,5% | **97,36%** (stmt 94,77 · branch 88,68 · func 93,22) |

Total **60,6% → 66,3%** lines · 64,8% stmt · 56,14% branch · 65,38% func.
Suite **848 → 896** tes (34 berkas). Ratchet `vitest.config.js` **57/50/57/60 → 63/55/63/64**.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 80 warning** (baseline 79 → 80, satu-satunya warning baru
  sudah dibersihkan: `const charts` yang tak dipakai di tes fallback) · `vitest` **896/896** ·
  `test:coverage` lolos threshold baru · `build` ok · `verify:precache` **50/50**.
- **`src/js/**` tidak disentuh** → bundle identik, `sw.js` tetap **`mtc-asset-v15`**.

### Dua temuan (sengaja TIDAK diperbaiki — sesi ini hanya tes)
1. **Tiga guard destroy di `renderDashboardCharts` tidak pernah tercapai.** Baris 179 menimpa
   `window._appCharts` dengan `{reliability: null, woCompletion: null, costTrend: null, …}`
   tepat sebelum `renderCharts()` jalan, jadi `if (window._appCharts.reliability)` (baris 251),
   `.woCompletion` (302), dan `.costTrend` (318) **selalu false** — termasuk blok `catch`
   `console.warn('Chart destroy failed')` di dalamnya. Hanya `safeCreateChart` yang benar-benar
   menghancurkan chart lama. Ini yang membuat 3 baris itu tetap merah di laporan coverage.
2. **`renderMTBFMTTRChart` menghancurkan chart yang sama dua kali**: guard lokal
   (`Chart.getChart(canvas)` → `destroy()`, baris 100–101) lalu `safeCreateChart` melakukan
   hal yang sama lagi. Tidak berbahaya (Chart.js mengabaikan destroy kedua), tapi satu
   pemanggilan `getChart` + `destroy` bisa dihapus. Dikunci tes dengan ekspektasi **2**.

### Jebakan baru (catat biar tidak diulang)
- **jsdom tidak punya layout**: `offsetParent` **selalu null** dan `clientHeight` **0**, jadi
  `waitForCanvas()` tidak pernah resolve lewat jalur sukses. Obatnya kanvas palsu lewat
  `vi.spyOn(document,'getElementById')` yang mengembalikan
  `{offsetParent:{}, clientHeight:120, parentElement:null, style:{}}`.
- **`JSON.stringify(undefined)` tidak melempar** — yang melempar adalah `JSON.parse(undefined)`
  di dalam `try` yang sama. Jadi `safeDeepClone(undefined)` = `{}` sedangkan
  `safeDeepClone(null)` = **`null`** (jalur sukses, bukan fallback).
- **`renderDashboardCharts` tidak mengembalikan promise render-nya** — ia hanya menjadwalkan
  lewat `$nextTick` → `requestAnimationFrame`. Untuk menunggu, stub `$nextTick` jadi
  `fn => fn()`, stub `requestAnimationFrame` jadi penangkap (`scheduled = fn()`), lalu
  `await scheduled`.
- **`vi.useFakeTimers()` + `advanceTimersByTimeAsync` harus menutup anggaran retry SEMUA
  kanvas**, bukan satu. Dashboard 4 × 1.500 ms, KPI 8 × 5.500 ms (= 44 s) — angka 20.000
  membuat tes menggantung sampai timeout 5 s (bukan gagal assertion).
- **`vi.restoreAllMocks()` juga me-reset implementasi `vi.fn()`**, jadi `Chart.getChart` dan
  `Chart.register` (dibuat di `vi.hoisted`) harus dipasang ulang di `beforeEach`.
- **Jangan meng-assert method pada objek yang propertinya ditimpa chart baru** —
  `window._appCharts.woStatus` diganti instance Chart, jadi `prev.woStatus.destroy` bukan spy
  lagi saat assertion. Pegang `vi.fn()`-nya di variabel dulu.

### Sisa
- `charts.js` 97,36%: yang merah hanya 3 guard mati di atas + beberapa cabang parsial.
- Kandidat berikutnya: badan `submitLog` (`logs.js` 305–517, kartu C-2) · `ui.js` 32,98% ·
  `equipment.js` 46,57% · `parts.js` 54,83% · `kpi-engine.js` 43,92% · `export.js` 45,5% ·
  `app.js` 20,9% (2591 baris, butuh harness Alpine).
- Kartu C-3 (Lighthouse) & D-5 (gap AA tema gelap) tetap terbuka; D-5 butuh keputusan user.

---

## 📝 Session 26 (S26, 2026-10-18) — lanjutan coverage: `indexeddb.js` · `data.js` · `pm-schedule.js`

### Titik awal
S25 menutup `enterprise-kpi.js`/`logs.js`/`performance.js` (37,47% → 47,84% lines).
Sisa terbesar: `bootstrap.js` 1,06% · `pm-schedule.js` 7,9% · `charts.js` 8,5% ·
`indexeddb.js` 9,49% · `data.js` 48,68%. Urutan diambil dari **risiko data hilang**,
bukan dari angka: lapisan persistensi offline dulu, lalu sinkronisasi listener, lalu
aritmetika tanggal PM. `charts.js` (butuh `vi.mock('chart.js')`) tetap terakhir.

### `tests/indexeddb-module.test.js` (32 tes) — 9,49% → **88,6%** lines
jsdom tidak punya IndexedDB, jadi harness kecil meniru `open → request`, `db.transaction →
tx`, `store.* → request` dengan **injeksi gagal per operasi** (`faults.getAll = 'error'`,
`faults.transaction = 'throw' | 'null' | 'error'`). `CAN_USE_IDB` dihitung sekali saat
import → tiap kelompok tes memakai `vi.resetModules()` + `import()` dinamis.
- **Tanpa IDB**: `CAN_USE_IDB` false, `initDB` → null, `ensureReady` memperingatkan,
  semua baca mengembalikan kosong, semua tulis jadi no-op, dan `localStorage` yang
  melempar tidak menjatuhkan modul.
- **Skema**: `open('mtc-nexus-db', 1)`; 5 store dengan keyPath benar (`equipment.EquipmentID`,
  `parts.PartID`, `logs.LogID`, `performance.id`, `pendingOps.id` autoIncrement) + 3 index
  (`logs.EquipmentID`, `pendingOps.type`, `pendingOps.timestamp`); store yang sudah ada
  tidak dibuat ulang; `open` gagal → `dbReady` menolak dengan error aslinya.
- **CRUD & antrean**: `getAll`/`get`/`put`/`putBulk`/`delete`/`clear` di jalur sukses,
  request-error, transaksi `null`, dan `addPendingOp` menambah `timestamp` + `retries: 0`;
  `getPendingOps` membaca **index `timestamp`**; `getPendingOpsCount` = panjang antrean.

### `tests/data.test.js` (20 → 79 tes) — 48,68% → **93,79%** lines
Harness lama (mock `indexeddb.js`/`notification.js`/`push-client.js` + `window.*` Firebase)
dipakai ulang; ditambah `captureListeners()` yang merekam `onValue`/`onChildAdded` supaya
callback-nya bisa dipanggil manual.
- **`setupFirebaseListeners()`**: guard `isLoggedIn`, reset pagination, panggil
  `checkPendingWorkOrders` + `loadFromIndexedDB` + `checkPendingOperations`, timeout 10 s
  memaksa `isLoading=false`, dan urutan listener yang terdaftar
  (`Users/…`, `.info/connected`, `Equipment`, `HistoryLog` onlyOnce, `Stats`, overdue
  `Equipment`, low-stock `SpareParts`; children: `SpareParts`, `HistoryLog`, `Performance`).
- **Payload tiap listener**: role dari RTDB (fallback `user`), status koneksi, mapping
  Equipment (`EquipmentID` dari key, `FotoURL` dibersihkan, `selectedEquip` disegarkan,
  `_firebaseReadyResolve` dipanggil sekali), SpareParts (prepend/update di tempat/fallback
  `snapshot.key`), HistoryLog (sort desc, `_woSeenIds`, notifikasi WO baru **hanya** setelah
  load awal, error → `logs=[]`), Performance (`events` string → array, cap 200), Stats,
  overdue PM, low stock.
- **`saveCache` debounce 250 ms**: `putBulk` dipanggil sekali; kalau `putBulk` menolak
  **atau** melempar sinkron → fallback `localStorage.setItem('cache_<key>')`.
- **`deleteItem`**: pembersihan lokal untuk 4 node, `currentPage` kembali ke `equip`,
  jalur offline yang gagal menulis antrean tetap menurunkan ke jalur online, snapshot log
  gagal dibaca tetap menghapus, **7 bentuk `PartsUsed`** (string `'[]'`, kosong, bukan JSON,
  array, double-encoded `\"`, entitas `&quot;`, JSON rusak) memulihkan stok 0/1 kali,
  `Stats/totalDowntime` ikut dikurangi, dan `remove` yang terus gagal → notifikasi error.
- **Sinkronisasi antrean**: `logs`/`performance`/tipe tak dikenal, satu op gagal tidak
  menghentikan sisanya (tapi op itu **tidak** ditulis dan **tidak** dihapus dari antrean).

### `tests/pm-schedule-module.test.js` (36 tes) — 7,9% → **62,61%** lines
Waktu dibekukan (`vi.setSystemTime`) supaya tanggal deterministik; `Object.create(module)`
untuk isolasi state.
- `openPMModal` (form kosong bertanggal hari ini + pemetaan 13 field dengan fallback),
  `loadPMSchedule` (tanpa `window.db` → return, mapping `pmId`, auto-generate PM berikutnya
  untuk task completed berfrekuensi **recent 30 hari**, skip kalau pending sudah ada,
  skip `none`/frekuensi tak dikenal/lebih tua dari 30 hari/tanpa `user.uid`, error
  auto-generate & error baca hanya `console.warn`).
- Filter: pencarian 4 kolom, filter equipment/status/priority (priority kosong = `Medium`),
  sort **overdue pending dulu** lalu tanggal; `pmUpcomingList`, `pmOverdueCount`.
- Overdue: basis `hours` (meter ≥ `targetHM`) dan basis tanggal; `isPMDueSoon` = hari ini..+3.
- `_pmHMMap`/`pmCurrentHM`: meter menang atas log, log terbaru menang antar-log, cache
  dibuang saat referensi `logs`/`equipment` berubah.
- Kalender: label bulan ikut `pmMonthOffset`, event per tanggal dengan flag
  overdue/dueSoon/completed + filter equipment, grid selalu kelipatan 7 dengan penanda
  hari ini/akhir pekan/bulan lain.
- Statistik & Gantt: `pmGetStats` (overdue/this month/30 hari/completed), 7 bulan Gantt
  (-2..+4), hari Gantt (geser oleh `pmGanttScroll`), baris Gantt dikelompokkan per
  equipment dengan rollup status `Overdue`→`Due Soon`→`Scheduled`, nama dari
  `window.app.equipment` (fallback id) dan cache `_ganttEqMap`.

### Lanjutan di sesi yang sama — `pm-schedule.js` lengkap + `bootstrap.js`
- **`pm-schedule.js` 62,61% → 99,69%** (65 tes di berkas ini). Ditambah: `submitPM`
  (3 guard validasi, id `PM_<ts>_<rand>`, default field, `createdBy` dari `user.uid` /
  `'unknown'`, `createdAt` dipertahankan saat edit, audit `Create/Update PM Task` yang
  gagal senyap, `Missing PM ID`, error tulis), `completePM` (+ auto-generate bila
  berfrekuensi), `generateNextPM` (`targetHM = max(HM log terakhir, meter) + intervalHours`,
  skip frekuensi tak dikenal & duplikat), `deletePM` (confirm), `pmToggleSelect`/
  `pmToggleSelectAll`, `bulkCompletePM` (lewati yang sudah completed & id tak dikenal,
  regenerasi yang berfrekuensi, `pmSelectedIds` dikosongkan, referensi `pmList` diganti),
  dan `logPMFromSchedule` (pre-fill `logForm`).
- **`bootstrap.js` 1,06% → 100%**: handler global `error`/`unhandledrejection`
  (JSON ditelan, masalah Alpine/proxy → notifikasi), auth state (logout membersihkan sesi;
  login mengisi Sentry + 5 loader + sweep notifikasi 3 s→6 s), `$watch` lengkap
  (debounce 500 ms dashboard/KPI, guard halaman terlarang, destroy chart saat pindah
  halaman, compute enterprise + render 800 ms), `loadModalsCSS` idempoten, `checkUserRole`.

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `indexeddb.js` | 9,49% | **88,6%** |
| `data.js` | 48,68% | **93,79%** |
| `pm-schedule.js` | 7,9% | **99,69%** |
| `bootstrap.js` | 1,06% | **100%** |

Total **47,84% → 60,6%** lines · 57,97% stmt · 50,08% branch · 57,13% func.
Suite **683 → 848** tes (30 → 34 berkas). Ratchet `vitest.config.js` **45/40/43/47 → 57/50/57/60**.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline, tidak naik) · `vitest` **848/848** ·
  `test:coverage` lolos threshold baru · `build` ok · `verify:precache` **50/50**.
- **`src/js/**` tidak disentuh** → bundle identik, `sw.js` tetap **`mtc-asset-v15`**
  (deploy hanya karena dokumentasi berubah).

### Dua temuan (sengaja TIDAK diperbaiki — sesi ini hanya tes)
1. **`catch` mati di 6 method `indexeddb.js`.** `db.transaction()` dipanggil **di dalam**
   executor `new Promise`, jadi lemparannya berubah menjadi *rejection promise*; blok
   `catch` di sekelilingnya tidak pernah tercapai. Perilaku nyata: `getAll`/`get`/`put`/
   `putBulk`/`delete`/`clear` **menolak** kalau transaksi melempar (bukan menelan). Aman
   untuk saat ini karena `loadFromIndexedDB()` membungkus `Promise.all` dengan try/catch,
   tapi `catch` itu menipu pembaca.
2. **Cabang `else` `loadMoreEquipment` praktis mati.** `filteredEquip.slice(currentLength,
   currentLength + equipLimit)` selalu kosong karena `currentLength = filteredEquip.length`
   → `nextPage.length < equipLimit` selalu benar untuk `equipLimit ≥ 1`. Dikunci lewat
   `equipLimit: 0` supaya perilakunya tetap teruji kalau nanti diperbaiki.

### Jebakan baru (catat biar tidak diulang)
- **`// @vitest-environment jsdom` wajib per berkas** — `vitest.config.js` tidak menyetel
  `environment`, default-nya **node** (tidak ada `window`). 31 tes langsung gagal
  `ReferenceError: window is not defined`.
- **Di jsdom vitest, `window` BUKAN `globalThis`** (environment menyalin properti ke
  `globalThis`, `window` tetap objek jsdom). Modul yang membaca `window.indexedDB` lalu
  memanggil `indexedDB.open` polos butuh stub di **keduanya**:
  `vi.stubGlobal(name, v)` + `Object.defineProperty(window, name, {value, configurable:true})`.
- **`vi.restoreAllMocks()` juga me-reset implementasi `vi.fn()`** (bukan cuma `vi.spyOn`),
  jadi mock modul yang di-set di `beforeEach` harus dipasang ulang sesudahnya.
- **Stub di `makeCtx()` menutupi method yang sedang diuji** — `checkUserRole`/`loadModalsCSS`
  yang di-stub sebagai `vi.fn()` membuat tes "hijau" tanpa mengeksekusi apa pun. Untuk menguji
  method aslinya: `delete ctx.namaMethod` (properti prototype kembali terlihat).
- **`vi.waitFor` tidak jalan di bawah `vi.useFakeTimers()`** (ia menunggu timer) — pakai
  `await Promise.resolve()` dua kali untuk promise chain pendek.
- Request palsu harus **async** (`queueMicrotask`) karena kode memasang `onsuccess`
  *setelah* memanggil `store.getAll()`; kalau dipanggil sinkron, promise menggantung.
- `window._firebaseReadyResolve` **di-null-kan** setelah dipanggil — pegang referensi
  `vi.fn()`-nya dulu kalau mau di-assert.

### Sisa
- **Board kanban dirapikan di sesi ini**: 22 kartu `done` diarsip + purge permanen; dibuat 4 kartu `blocked` baru — C-1 `t_4dc085bd` (`charts.js`), C-2 `t_f5bf046e` (`submitLog`), C-3 `t_c6d1c766` (Lighthouse), D-5 `t_369342cd` (gap AA, butuh keputusan). Jangan `unblock`; kerjakan manual lalu `complete --force`.
- Kandidat berikutnya: `charts.js` 8,5% (576 baris, `vi.mock('chart.js')`), badan `submitLog` (`logs.js` 305–517).
- Gap AA tema gelap (`KNOWN_DARK_GAPS`) masih **menunggu keputusan user**.
- **Dev server**: `server.watch.ignored` ditambahkan (`coverage/`, `test-results/`, `.lighthouseci/`) karena `vitest --coverage` memicu badai reload (commit `66e3e3e`). Dev-only, build tidak berubah.

---

## 📝 Session 25 (S25, 2026-10-18) — lanjutan coverage: `enterprise-kpi.js` · `logs.js` · `performance.js`

### Titik awal
S24 menutup `auth.js`/`audit.js`/`wo-pdf-template.js` (29,62% → 37,47% lines). Sisa kandidat
menurut angka: `enterprise-kpi.js` 4,08% · `pm-schedule.js` 7,9% · `charts.js` 8,5% ·
`logs.js` 9,09% · `indexeddb.js` 9,49% · `performance.js` 10,19% · `bootstrap.js` 1,06%.
Tiga yang diambil adalah yang **logikanya menentukan angka di layar atau menentukan data
tersimpan**: metrik enterprise, transisi status WO, dan aritmetika KPI performance.

### `tests/enterprise-kpi-module.test.js` (59 tes)
Seluruh modul murni terhadap state — cukup `_raw: (x) => x`. Yang dikunci:
- **ambang tiap metrik** (Optimal/Good/Warning/Critical + warna) untuk availability,
  reliability, OEE, PM compliance, dan health score;
- **definisi availability**: `(wh − bd − stb) / wh`, dengan `wh` kosong dihitung 24 jam —
  bukan `(total − down)/total` seperti dugaan awal (dua percobaan pertama tes ini gagal
  karena asumsi itu, bukan karena kode);
- **downtime R6**: hanya `bd`; `stb` tidak dihitung breakdown (diuji terpisah);
- **`mtbf`/`mttr` null** saat data kurang (bukan 0 — 0 akan lolos ke rata-rata summary);
- **health score**: −15 per breakdown 90 hari, −2/hari PM overdue (maks 30), −10 bila MTBF < 168,
  dijepit 0..100;
- **OEE**: quality = (completed − rework)/completed, dan `toneColor` **wajib** token
  `rgb(var(--tac-chart-…))` — bukan hex (S23);
- **`computeEnterpriseData()`**: 8 kartu KPI berurutan, `due` relatif (`today`/`tomorrow`),
  WO kritis diurut Emergency → Urgent, low stock ≤ MinStock, dan **tidak menghitung apa pun
  kalau `currentPage !== 'enterprise'`**.

### `tests/logs-module.test.js` (47 tes)
`data.js` di-mock (ia menarik `indexeddb.js` + `db.js`); `utils.js` dipakai **asli** karena
`checkPartAvailability`/`computeBDFromLogs` adalah kontraknya.
- **`parsePartsUsed`** tiga bentuk: string JSON, array (referensi sama), JSON rusak → `[]`.
- **`openLogModal`**: nomor WO berikutnya dari `MTC-xxx` yang ada (`MTC-007` → `MTC-008`,
  `MTC-abc` → diabaikan), `fromDetail` mengisi equipment dari `selectedEquip`; mode edit
  memetakan 20+ field, mem-parse `PartsUsed` (string/array/**objek hasil RTDB**/rusak),
  dan menormalkan foto (JSON string, array, `PhotoURL` tunggal, string bukan-JSON).
  `oldLogParts` adalah **salinan** (bukan referensi) — itu yang membuat diff part saat edit benar.
- **`handleLogPhoto`**: >4 file ditolak; hanya file **pertama** yang membuka crop; callback crop
  berhenti di 4; `photos` non-array direset dulu.
- **`getLastHM`**: HM terbaru menurut `Tanggal`, diformat ribuan, dan cache-nya **dibuang saat
  referensi `this.logs` berubah** (mutasi array tidak membuang cache — perilaku ini yang diuji).
- **`syncPerformanceBD`**: tanpa record Performance untuk tanggal itu → **tidak menulis**
  (entri manual tidak boleh ditimpa); kalau ada, `bd`/`freq`/`bdSource: 'wo'` ditulis + objek
  lokal di-`Object.assign`.
- **Transisi WO**: `approveWO` (guard `isAdminOrSupervisor`, shortage → `confirm`, pemotongan
  stok per part via `runTransaction` **melewati part tanpa id**, sinkron `window.app`),
  `rejectWO` (alasan wajib, status `Rejected`), `startWO` (`In Progress`), `completeWO`
  (**Cost = Downtime × DowntimeCostPerHour**, fallback Cost lama bila tarif 0/tidak ada,
  `actualHours` dari `estimatedHours`).
- **`submitLog` guard**: validasi form dulu, lalu hak akses — dua jalur yang tidak boleh menulis.

### `tests/performance-module.test.js` (38 tes)
- **`updatePerfHours`**: `wh = 24 − bd − stb`; event `Operational` masuk **stb**, sisanya bd;
  `freq` hanya event non-Operational; `field === 'stb'` menghormati input manual; total >24 jam
  dijepit (`wh = 0`, stb disisakan).
- **`calculateKPI`**: MA/PA/UA/MTBF/MTTR/gap + `events` lebih diutamakan daripada `freq`
  tersimpan; nol semua → tidak ada NaN.
- **`getFilteredPerfData`**: filter equipment/area, lalu `daily`/`weekly` (Senin–Minggu)/
  `monthly`/`yearly`; tanggal acuan tidak valid → filter tanggal dilewati; filter tak dikenal
  diperlakukan sebagai monthly.
- **`submitPerformance`**: guard form kosong → validasi → hak akses; jalur **offline**
  (`queueOfflineOperation` + `saveToIndexedDB`, RTDB tidak disentuh) dan jalur RTDB
  (`PERF-<ts>`, `bd`/`freq` dari events, `createdBy` disalin saat edit, audit `Create/Update Performance`);
  antrean offline gagal → tetap mencoba RTDB.
- **`recomputeBD`**: guard admin, tanpa data → info, hitung per equipment+tanggal, satu record
  gagal tidak menghentikan sisanya.

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `enterprise-kpi.js` | 4,08% | **100%** |
| `logs.js` | 9,09% | **68,62%** |
| `performance.js` | 10,19% | **98,08%** |

Total **37,47% → 47,84%** lines · 45,51% stmt · 41,03% branch · 44,17% func.
Suite **539 → 683** tes (27 → 30 berkas). Ratchet `vitest.config.js` **34/29/31/36 → 45/40/43/47**.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline) · `vitest` **683/683** ·
  `test:coverage` lolos threshold baru · `build` ok · `verify:precache` **50/50**.
- `src/js/**` tidak disentuh → bundle identik, `sw.js` tetap **`mtc-asset-v15`**.

### Jebakan yang terulang (catat biar tidak diulang)
- **`makeCtx()` yang menghapus `window.app`/`window.auditModule` harus dipanggil DULU**, baru
  stub global-nya dipasang. Dua tes sempat gagal (`Cannot read properties of undefined`) hanya
  karena urutan itu terbalik.
- **`calcAvailability` membagi dengan `wh`, bukan dengan `wh + bd + stb`.** Menulis ekspektasi
  dari intuisi (bukan dari kode) langsung memerahkan 5 tes; yang salah ekspektasinya, bukan kodenya.
- `calcHealthScore` memotong **2 poin/hari** PM overdue dengan plafon 30 → 30 hari overdue = 70,
  bukan 40. Ember `calcHealthDist` jadi perlu breakdown, bukan tanggal PM, untuk mencapai `warning`.

### Sisa
- `logs.js` 68,62%: yang belum tersentuh adalah badan `submitLog` (baris 305–517: unggah foto,
  sanitasi, retry, refresh 500 ms) dan `approveWO` sinkron `window.app` (790–793).
- Kandidat berikutnya: `indexeddb.js` 9,49% · `bootstrap.js` 1,06% · `pm-schedule.js` 7,9% ·
  `charts.js` 8,5% (butuh mock Chart.js) · `data.js` 48,68%.
- Gap AA tema gelap (`KNOWN_DARK_GAPS`) & H-1/H-2 masih **menunggu keputusan user**.

---

## 📝 Session 24 (S24, 2026-10-18) — coverage modul 0–10%: `auth.js` · `audit.js` · `wo-pdf-template.js` (kartu A)

### Kenapa tiga berkas ini, dan urutannya
Angka S17 (`auth.js` 0,8% · `audit.js` 0% · `wo-pdf-template.js` 0%) **diukur ulang dulu**
sebelum dipercaya: baseline hari ini **28,40 / 26,87 / 30,14 / 29,62** (463 tes / 24 berkas) —
sedikit di atas catatan S17 karena tes `chart-palette.js` di S23. Urutan tetap menurut risiko,
bukan menurut angka: `auth.js` adalah jalur login/role/`isAdmin` — berkas yang melahirkan bug
P0 privilege escalation — jadi utang keamanannya dibayar lebih dulu.

### `tests/auth-module.test.js` (38 tes) — dua invarian P0 dikunci
`auth.js` memakai `window.ref/db/get/set/...` (bukan import SDK), jadi cukup `vi.stubGlobal`;
tidak ada Firebase yang perlu di-mock.
1. **`ensureUserProfile()` tidak pernah menulis `role`.** Profil lama: hanya `email` + `lastLogin`
   yang di-update, `role` lama dipertahankan (assert `Object.keys(updates).sort()` =
   `['email','lastLogin']`). Profil baru: dibuat **tanpa** field `role`, jadi `login()` jatuh ke
   `userRole = 'user'` walaupun state sebelumnya `admin`.
2. **Setiap jalur tulis-admin dijaga `this.isAdmin` sebelum menyentuh RTDB** —
   `createUser` (dan urutannya: validasi email/password **dulu**, baru guard admin), `saveEditUser`,
   `loadAllUsers`, `deleteUser`. Semua diuji dengan `expect(fb.set/remove).not.toHaveBeenCalled()`.

Ikut diuji: login form kosong / sukses (persistence sesi + role dari RTDB) / gagal (`isLoading`
selalu direset), logout batal/sukses/gagal, `showUID`, `getUserRole` (kosong & error → `user`),
`sendPasswordReset` (user tak dikenal, batal, sukses, gagal), modal create/edit, `createdBy`
fallback `'admin'`, merge profil lama saat `saveEditUser`, dan sinkronisasi `allUsers`.

### `tests/audit-module.test.js` (14 tes) — `db.js` yang di-mock, bukan Firebase-nya
`audit.js` mengimpor `../db.js` yang men-inisialisasi Firebase nyata → `vi.mock('../src/js/db.js')`
dengan `{ db, ref, set }`. Yang diuji: bentuk entri (`uid/email/role/page/details`, fallback
`unknown`/`user`/`-`), `details` string vs JSON, pemotongan **200 char + `…`** (panjang akhir 201),
key `AuditTrail/<Date.now()>_<4 char>`, guard audit-off & belum-login, dan yang terpenting:
**kegagalan tulis tidak boleh menjatuhkan aplikasi** — `PERMISSION_DENIED` ditelan tanpa
`console.warn`, error lain hanya di-warn, `logAudit()` selalu resolve.
`setupAuditHooks()` terbukti idempoten (`__auditPatched` / `__auditLogoutPatched`), audit
`Logout` ditulis **sebelum** `signOut`, `app.signOut` dipakai kalau `app.logout` tidak ada, dan
`window.auditModule` yang sudah ada tidak ditimpa.

### `tests/wo-pdf-template.test.js` (24 tes) — `jspdf` di-mock, `doc.text` tetap jalan
`vi.hoisted()` untuk `jsPDF` (dipakai lewat `await import('jspdf')`), jadi seluruh template
benar-benar dieksekusi dan bisa diperiksa: dokumen A4 portrait, nama berkas
`WorkOrder_<no>.pdf` + fallback `DRAFT`, badge prioritas ×4 dan status ×4 (assert `setFillColor`),
cabang equipment internal vs `EXTERNAL`, `PartsUsed` string JSON / array / JSON rusak / kosong
dengan batas **5 baris** (`SP-6` tidak boleh muncul), rupiah ribuan (`Rp 1.500.000`; `Cost: '0'`
→ `Rp 0` karena string truthy), dan **page-break** saat 5 baris parts + blok biaya melewati
`pageHeight - 50`. Deskripsi panjang dipotong 4 baris (`splitTextToSize` → `slice(0,4)`).

### Hasil (angka riil)
| modul | lines sebelum | lines sesudah |
|---|---|---|
| `auth.js` | 0,81% | **100%** |
| `audit.js` | 0% | **97,05%** |
| `wo-pdf-template.js` | 0% | **100%** |

Total **29,62% → 37,47%** lines · 34,95% stmt · 29,65% branch · 32,38% func.
Suite **463 → 539** tes (24 → 27 berkas). Ratchet `vitest.config.js` **27/25/28/28 → 34/29/31/36**.

### Verifikasi
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline; 0 warning baru — `catch` tanpa
  binding dipakai di berkas baru) · `vitest` **539/539** · `build` ok · `verify:precache` **50/50**.
- **`src/js/**` tidak disentuh sama sekali** → bundle identik, `sw.js` tetap **`mtc-asset-v15`**.
  Deploy dijalankan hanya karena dokumentasi ikut berubah, bukan karena ada perubahan runtime.

### Sisa
- Baris yang tidak tercakup: `audit.js:86` (cabang `DOMContentLoaded`, tidak mungkin dijalankan
  di jsdom karena `readyState` sudah `complete`), `auth.js` 2 cabang parsial (fallback email
  profil lama & `idx === -1`).
- Kandidat berikutnya (belum ada kartu): `enterprise-kpi.js` 4,08% · `pm-schedule.js` 7,9% ·
  `charts.js` 8,5% · `logs.js` 9,09% · `indexeddb.js` 9,49% · `performance.js` 10,19% ·
  `bootstrap.js` 1,06%.
- Gap AA tema gelap (`KNOWN_DARK_GAPS`) & H-1/H-2 masih **menunggu keputusan user**.

---

## 📝 Session 23 (S23, 2026-10-18) — palet chart ke token CSS + sisa kecil `style.css` (kartu A + C)

### Kenapa hex di JS tidak bisa disapu seperti kelas
Chart.js menggambar ke `<canvas>`: ia butuh **string warna**, bukan kelas, jadi `charts.js`
menyimpan 53 hex + 6 `rgba()` literal. Hex tidak ikut tema saat paint — tema `light` tetap
memakai palet malam — dan menambah tema berarti menambah satu tabel hex lagi
(`themeAccent()` memang sudah berbentuk tabel per tema). Sapuan kelas S22 tidak menyentuhnya
karena ini bukan kelas.

### Solusi: token `--tac-chart-*` + satu pembaca
- `src/css/tactical.css` dapat **17 token** `--tac-chart-*` (triple channel RGB, sama seperti
  token `tac-*` lain). Nilai `:root` **identik dengan hex lama**, jadi tema malam tidak berubah
  sedikit pun; yang bergeser per tema hanya `accent`, `accent-soft`, `grid`, `tick`, `title`,
  `tooltip`. Blok tema ditaruh **setelah** `:root` — spesifisitas sama, urutan menang.
- `src/js/chart-palette.js` (baru, 3.9 KB): `chartColor(name, alpha)` membaca token lewat
  `getComputedStyle()` → `rgb(r, g, b)` / `rgba(r, g, b, a)` untuk canvas; `chartToken(name)`
  → `rgb(var(--tac-chart-x))` untuk `:style` (browser yang menghitung, jadi gauge OEE ikut tema
  tanpa resolve di JS).
- `themeAccent()/themeAccentSoft()/themeGrid()` jadi tiga baris yang memanggil palette;
  `charts.js` dapat method `chartColor` (dideklarasikan di `appstate.ts`).
- Cache palette per tanda tema (`data-theme|dark`): `getComputedStyle` memaksa recalc, dan satu
  dashboard merender belasan warna sekaligus. Kalau token belum ada (jsdom/SSR) hasilnya abu-abu
  netral dan **tidak** di-cache — fallback hex di JS justru menghidupkan palet kedua.

### Angka hex di `src/js/**`
| berkas | sebelum | sesudah |
|---|---|---|
| `charts.js` | 53 | **0** |
| `modules/enterprise-kpi.js` | 15 | **0** |
| `app.js` | 7 | **1** (di dalam komentar) |
| `modules/ai.js` | 5 | 5 (**sengaja**) |
| `modules/ui.js` | 4 | 4 (**sengaja**) |
| total | **84** | **10** |

Dua pengecualian itu bukan UI bertema dan dieja per berkas di tes: warna kanvas QRCode (`ui.js`
— pemindai butuh hitam/putih murni) dan stylesheet laporan HTML tercetak (`ai.js` — kertas
selalu terang, tanpa `var()` app).

### Temuan yang ikut ketemu
1. **`colorHex` di `app.js` (5 kartu dashboard) = data mati** — ditulis, tidak dibaca siapa pun
   (0 konsumen di `src/`, `public/`, `index.html`). Dihapus.
2. **`hexColor` OEE** (`enterpriseOEE.hexColor`) dipakai `EnterpriseDashboard.html` di `:style`
   untuk gauge radial + angka OEE. Nilainya sekarang ekspresi `rgb(var(--tac-chart-…))`, dan
   namanya dibuat jujur: **`toneColor`** (3 tempat: kpi + app + 2 di HTML).
3. **Grid chart KPI punya warna sendiri tanpa alasan** — `renderKPICharts` memakai
   `gc = darkMode ? rgba(245,158,11,.05) : rgba(0,0,0,.05)`, terpisah dari `themeGrid()`.
   Sekarang semua lewat `themeGrid()`. Konsekuensi kecil: di navy/purple garis grid ikut hue
   tema (dulu selalu amber); di tema malam tidak terlihat.
4. **Klaim S22 "5 ligatur allowlist tidak dipakai" salah 3 dari 5** — `help` dipakai
   `pmStatusTac()` (`app.js:1779`), `info` dipakai config toast (`ui.js`), `menu` dipakai
   sebagai fallback ikon sidebar (`index.html` ×3). Yang benar-benar mati hanya
   **`account_circle`** dan **`home`** → allowlist 84 → **82**, font 10.048 → **9.868 byte**.

### Penjaga baru (6 tes; `tests/legacy-palette.test.js` 10 → 16)
1. tidak ada hex warna di `src/js/**` (kecuali 2 berkas yang dieja + beralasan)
2. tidak ada `rgb()`/`rgba()` bernilai literal — `rgb(var(--tac-…))` tetap sah
3. setiap `--tac-*` yang disebut JS **ada** di `tactical.css`
4. setiap nama seri di `chartColor()`/`chartToken()` ada di `CHART_SERIES`
5–6. sanitas: `chart-palette.js` ikut dipindai, `CHART_SERIES` ≥ 10 dan memuat `accent`/`warn`

### Verifikasi (angka riil)
- `tsc` **0** · `eslint` **0 error / 79 warning** (baseline, tidak naik) · `vitest` **463/463**
  (24 berkas; 457 → 463) · `build` ok · `verify:precache` **50/50**.
- **Browser, 4 tema** (`scratch/chart-palette-harness.html`, dev server): 17 seri resolve dan
  **setiap nilai sama persis dengan hex lama** — night `rgb(255,140,26)` (=#ff8c1a),
  `rgba(245,197,66,.05)` grid, `rgb(139,158,183)` tick, `rgb(245,245,245)` title,
  `rgba(13,17,23,.95)` tooltip; navy `rgb(59,130,246)`; purple `rgb(168,85,247)`;
  light `rgb(0,97,255)`, grid `rgba(0,0,0,.05)`, tick `rgb(100,116,139)`,
  title `rgb(15,23,42)`, tooltip `rgba(255,255,255,.95)`.
- **Chart.js benar-benar memakan string itu** (bukan cuma CSS): line + doughnut dibuat di
  canvas lalu `getDatasetMeta()` dibaca → `border=rgb(255,140,26)`,
  `fill=rgba(245,197,66,0.1)`, arc `rgb(34,197,94)` / `rgb(245,158,11)`; piksel kanvas
  **24 warna unik**, **0 error** window.
- CSS hasil build memuat token: `--tac-chart-accent` **4×** (root+3 tema),
  `--tac-chart-grid` 4×, `--tac-chart-tooltip` 2×, `--tac-chart-good` 1×.
- `check-page.mjs public/pages/EnterpriseDashboard.html` → **syntax errors 0** (461 identifier).
- Kelas `tac-*`: **258/258 ter-generate** (0 hilang) — `scratch/tac-usage.txt` di-regenerate
  dulu; versi lama masih memuat `bg-tac-on-surface` yang sejak S22 tidak ada di sumber, dan
  itulah yang membuat audit lama melaporkan "1 tidak ter-generate".
- `sw.js` `CACHE_NAME` → **`mtc-asset-v15`**.

### C (sisa kecil) — ikut selesai
- `.gold-text` + `.nav-active` (0 referensi; keduanya masih memakai `--nexus-accent`) dihapus →
  `style.css` **9.848 → 9.399 byte** (−449).
- 2 ligatur mati dihapus → font **−180 B**; `tactical.css` +2.090 B (17 token baru).

### Jebakan baru
- **`git push` "gantung" — penyebab SEBENARNYA bukan dialog auth (koreksi catatan S22).**
  `-c credential.helper=store` **menambah** helper ke daftar yang sudah ada, jadi helper sistem
  `helper-selector` tetap dipanggil lebih dulu — dan ia menjalankan `git config --system -e`,
  yaitu membuka **editor** di terminal non-tty → blokir ~39 detik, hening, sebelum akhirnya
  `credential-store get` jalan. Buktinya ada di `GIT_TRACE=1`: `git credential-helper-selector get`
  → `git config --system -e` → (39 s tanpa output) → `git credential-store get`. Obatnya **reset
  daftar helper** dengan nilai kosong lebih dulu:
  `git -c credential.helper= -c credential.helper=store push --verbose origin main`
  → langsung `POST git-receive-pack (20887 bytes)` dan `main -> main`.
  `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true`, `http.version=HTTP/1.1`, dan `http.postBuffer` besar
  **tidak** menyembuhkan — retry juga tidak (itu sebabnya S22 butuh 2–3 percobaan).
- **`getComputedStyle` mengembalikan token apa adanya** (`255 140 26`, bukan `rgb(...)`) —
  custom property tidak di-resolve kecuali didaftarkan `@property`. Pembungkus `rgb()` harus
  dibuat sendiri, plus cache per tema.
- **Jangan pakai `rgb(r g b / a)` (CSS Color 4) untuk Chart.js** — Chart.js mem-parse string
  sendiri, bukan lewat CSS parser; pakai `rgba(r, g, b, a)`.
- **`check-tac-generated.py` membaca snapshot `scratch/tac-usage.txt`** — kalau hasilnya aneh,
  regenerate daftarnya dulu. Itu bukan regresi kode.
- **`npm run lint` naik 1 warning** kalau `catch (e)` tidak memakai `e` → pakai `catch {`
  (optional catch binding) di berkas baru.

### Sisa
- `ai.js` (5 hex) & `ui.js` (4 hex) tetap: dokumen cetak & kanvas QR — keduanya disengaja.
- Gap AA tema gelap (`KNOWN_DARK_GAPS`) masih menunggu keputusan user.
- Coverage modul 0–10% belum disentuh (kandidat B).

---

## 📝 Session 22 (S22, 2026-10-18) — sapu string kelas lama di `src/js/**` (kartu A)

### Premis yang diuji lebih dulu — dan ternyata catatan S21 kurang
S21 mencatat sisa: `text-slate-400` di `app.js` (9), `charts.js` (2), `ui.js` (6) +
`bg-rose-500 text-white` di `app.js`. Setelah dipindai ulang dengan pola yang
mencakup **semua** prefiks utility (`bg|text|border|border-l|from|to|ring|shadow|fill|stroke|divide|…`)
dan **seluruh** palet Tailwind (`slate|gray|zinc|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose`), angkanya:

| cakupan | hit | berkas |
|---|---|---|
| `src/js/**` | **101** | 7 (`app.js` 29 · `ui.js` 40 · `notification.js` 12 · `utils.js` 8 · `kpi-engine.js` 6 · `charts.js` 4 · `logs.js` 2) |
| `index.html` + `public/pages/**` | **23** kelas palet + **37** `border-white/N` + **6** hex | 5 berkas |

Jadi klaim S21 "0 `rose|amber|emerald`" hanya benar untuk **prefiks `text-`/`bg-`** di `index.html`:
`border-amber-400` (dropzone foto), `hover:bg-emerald-700`, dan blok "emergency red"
`#93000A` di `WorkOrders.html` semuanya lolos.

### Tiga bug mati yang ikut ketemu (bukan sekadar kosmetik)
1. **`charts.js:146` memakai `fas`** — kelas FontAwesome yang dibuang sejak S15, dan `<i>`-nya
   tidak pernah diberi `textContent`. Jadi **ikon state chart (offline/error/empty) tidak pernah
   tampil sama sekali** sejak S15. Sekarang `material-symbols-outlined icon-22` + ligatur.
2. **`notification.js` mengirim 8 nama FontAwesome** (`fa-box`, `fa-hourglass-half`, …) ke
   `pushInAppNotif`, padahal `index.html` merender `note.icon` lewat
   `<span class="material-symbols-outlined" x-text="note.icon">`. Yang tampil adalah **teks
   `fa-hourglass-half`**, bukan ikon. (Ini kartu B — dikerjakan sekalian karena satu berkas.)
3. **`enterprise-kpi.js` setengah migrasi** — 7 entri masih `icon: 'fa-…'` sedangkan HTML membaca
   `kpi.ms || 'monitoring'` / `ins.ms || 'smart_toy'`. Akibatnya **7 dari 8 kartu KPI tampil dengan
   ikon fallback yang sama**. Sekarang semua `ms:` dengan ligatur yang sudah ada di subset.
4. Bonus: `icon: 'cancel'` (3 berkas) dan `icon: 'help_outline'` **tidak ada di `icon-subset.txt`**
   (yang ada `block`/`error` dan `help`) → tampil sebagai teks. Ikut diganti.

### Kopling yang hampir jadi regresi senyap
`EquipmentDetail.html:174` memakai
`:style="'border-left-color: ' + getStatColor(logColor(log.Jenis))"`.
`logColor()` mengembalikan nama kelas, `getStatColor()` menerjemahkannya ke **hex**. Kalau hanya
`logColor()` yang dipindah ke `tac-*`, keempat jenis log jatuh ke fallback `#D4AF37` — semua border
kiri jadi emas, tanpa satu pun error. Sekarang `getStatColor()` memetakan ke
`rgb(var(--tac-…))` sehingga ikut tema saat paint. Dikunci tes perilaku (3 tes).

### Pemetaan yang dipakai
| lama | baru | alasan |
|---|---|---|
| `emerald-*` | `tac-status-operational` | semantik |
| `amber-*` / `orange-*` / `yellow-*` | `tac-status-repair` | satu hue peringatan (D-2: emas bukan warning) |
| `rose-*` / `red-*` | `tac-status-emergency` | semantik |
| `slate-*` | `tac-status-standby` / `tac-on-surface-variant` | teks vs penanda |
| `blue-*` / `sky-*` | `tac-sync-cyan` | info |
| `purple-*` | `tac-secondary` | draft |
| `teal-*` | `tac-status-operational` | nyaris sama dengan emerald |
| `border-white/5` · `/10` | `border-tac-border-subtle` · `border-tac-border-tactical` | sesuai tabel S21 |
| `bg-red-500 text-white` (badge) | `bg-tac-error-container text-tac-on-error-container` | **AA di 4 tema** (7,24:1 / 6,93:1); teks terang di atas `#ef4444` hanya 3,76:1 |
| `bg-amber-500/90 text-nexus-black` | `bg-tac-primary-container text-tac-on-primary-container` | 4,58:1 / 6,79:1 |
| `bg-[#93000A] text-white` | `bg-tac-error-container text-tac-on-error-container` | hex = nilai night token itu |
| `from-[#FFD700] to-[#E9C400] text-black` | `bg-tac-primary-container text-tac-on-primary-container` | CTA emas, sama seperti S21 |

Satu tingkat umur WO (3–7 hari) dulu `orange-500`; tidak ada token oranye, jadi dibedakan lewat
intensitas amber (`/20` + border `/40`) — bukan meminjam emas, supaya aturan D-2 tetap utuh.

### Dihapus (dead code, 0 referensi)
`constants.ts`: `STATUS_COLORS` + `StatusColorKey` (tabel kelas→hex yang tidak pernah diimpor) dan
`WO_PRIORITY_COLORS` (tabel hex yang juga 0 referensi). Keduanya sumber palet lama/hardcoded.

`style.css`: 3 blok override yang hanya ada untuk menambal kelas legacy —
`[data-theme='light'] .text-white/.text-slate-400/.text-slate-500`,
`[data-theme='light'] .bg-white/5, .bg-white/40`, dan
`input.text-white/.text-slate-400/.text-slate-500`. Semuanya `!important` yang menambal kelas yang
**sudah tidak dipakai siapa pun**; setelah dihapus, CSS hasil build memuat **0** referensi
`text-white`/`text-slate-400`/`bg-white/5`. `style.css` 10.519 → **9.848 byte**.
`.bg-white` (kanvas QR) tetap ter-emit — dikonfirmasi ada di `dist/assets/*.css`.

### Penjaga baru — `tests/legacy-palette.test.js` (10 tes)
Memindai **`src/js/**` + `index.html` + `public/pages/**`**:
1. tidak ada kelas palet Tailwind bawaan · 2. tidak ada `text-white`/`bg-white`/`white/N`
(pengecualian eksplisit & dieja persis: kanvas QR `bg-white p-8 rounded-[2.5rem]`) ·
3. tidak ada FontAwesome (nama `'fa-…'` maupun kelas `fas`) · 4. tidak ada hex di markup
(kecuali `<meta theme-color>`) · 5. setiap ligatur `ms:`/`icon:` ada di `icon-subset.txt` ·
6. nama ligatur bukan path berkas · 7–9. `logColor()` → `getStatColor()` saling cocok, theme-aware,
dan menghasilkan 4 warna berbeda.

**Kontrol negatif dijalankan** (`scratch/negative-control.mjs`): 11 pola pelanggaran semuanya
tertangkap, 6 kasus sah lolos — termasuk `// Check if date is not too far in past/future` yang
sempat jadi positif palsu karena `fa[srbl]?` polos cocok dengan kata "far".

### Verifikasi (angka riil)
- `tsc --noEmit` **0** · `eslint` **0 error / 79 warning** (baseline, tidak naik) ·
  `vitest` **457/457** (24 berkas; 447 → 457) · `vite build` ok · `verify:precache` **50/50**.
- `check-page.mjs`: `index.html` **402 ekspresi / 0 error** (identik baseline) ·
  `WorkOrders` 243 · `Dashboard` 136 · `RequestPart` 114 · `EquipmentDetail` 70 — semua **0 error**.
- Kelas baru yang dipakai dari string JS **benar-benar ter-emit** di `dist/assets/*.css`
  (dicek satu per satu: `bg-tac-error-container`, `text-tac-on-error-container`,
  `bg-tac-primary-container`, `border-l-tac-status-*`, `shadow-tac-status-operational/20`,
  `bg-tac-status-standby/15`, `bg-tac-sync-cyan/10`, `bg-tac-secondary-container`,
  `divide-tac-border-subtle`, `hover:brightness-110`, …).
- **Ikon benar-benar glyph, bukan teks** (browser, font 10.048 byte): 18 ligatur baru semua
  berlebar **22 px** (= 1 em); kontrol negatif `zzz_bukan_ikon` berlebar **275 px**.
- **Kontras diukur di 4 tema** (bukan dihitung di atas kertas): badge sidebar
  `error-container` **7,24 / 7,24 / 7,24 / 6,93** dan `primary-container` **4,58 / 4,58 / 4,58 / 6,79**;
  chip prioritas WorkOrders: Emergency 7,24 → 6,93 · Urgent 4,58 → 6,79 · Normal 9,59 → 13,78 ·
  Planned 4,53 → 5,52; alert failure report 7,24 → 6,93; badge HM 12,84 → 9,30. **Semua ≥ 4,5:1.**
- `getStatColor` resolve per tema: night `239 68 68`, light `185 28 28` (dst.) — 6 token, 4 tema,
  0 fallback emas.
- `sw.js` `CACHE_NAME` → **`mtc-asset-v14`** (dikonfirmasi ada di `dist/sw.js`).

### Jebakan baru (hemat waktu)
- **`git push` GANTUNG tanpa pesan** karena `credential.helper=helper-selector` (Git Credential
  Manager) membuka dialog auth grafis yang **tidak terlihat** dari sesi ini. `GIT_TERMINAL_PROMPT=0`
  tidak menolong (itu bukan prompt terminal). `git ls-remote` tetap cepat — jadi "jaringan sehat"
  bukan bukti push akan jalan. Akali dengan mematikan helper interaktif:
  `git -c credential.interactive=false -c credential.helper=store push origin main`.
  Kalau masih menggantung, ulangi — percobaan ke-2/3 biasanya tembus (transfer POST-nya flaky).
- **Headroom memampatkan output tool** jadi `<<ccr:HASH,…>>`; isi aslinya lewat
  `mcp__headroom__headroom_retrieve({hash})`. Kalau hash hilang, jalankan ulang perintahnya.
  Untuk data besar, tulis ke berkas `scratch/` lalu baca potongan kecil.
- **`html.dark` mengalahkan `[data-theme='light']`** (spesifisitas 0,1,1 vs 0,1,0). Saat menguji
  tema terang lewat DevTools, **hapus kelas `dark` dulu**, jangan hanya set `data-theme`.
  (Bukan bug app — `applyTheme()` sudah melakukan keduanya.)
- `document.fonts.check()` tetap `false` di layar login (tidak ada ikon terlihat) — jebakan S20,
  masih berlaku. Uji glyph di harness terpisah, bukan di app shell pra-login.
- Regex `fa[srbl]?` polos **cocok dengan kata biasa** ("far", "fab"). Butuh konteks `class=`/`className=`.

### Sisa (belum dikerjakan, sengaja)
- **Hex di `charts.js` (53) dan `enterprise-kpi.js` (15)**: `charts.js` memang butuh string warna
  untuk Chart.js (bukan kelas), jadi tidak bisa ditokenkan sebagai kelas. `kpi.color` di
  `enterprise-kpi.js` masih hex dan dipakai `:style="'color: ' + kpi.color"` di
  `EnterpriseDashboard.html` — mengubahnya berarti mengubah `:style` → `:class` di HTML. Kandidat
  sesi berikutnya (butuh keputusan desain untuk warna seri).
- `RequestPart.html` sudah memakai `rgb(var(--tac-…))` untuk border status, tapi sisa hex di berkas
  lain (kalau ada) belum disapu — tes hex sekarang menjaganya.

---

## 📝 Session 21 (S21, 2026-10-17) — index.html diporting ke Tactical Slate

### Premis yang dikonfirmasi lebih dulu
Catatan S19 menyebut `index.html` masih memakai design system lama: **91 `glass`** + **155 token `nexus-*`** (120 di antaranya `nexus-accent` = emas `#ffd700`), **14 `card-modern`**, plus **11 kelas `neu-*`** yang sama sekali belum tercatat (layar login masih neumorphic — padahal aturan proyek melarang full-neuromorphism). Semua kelas itu masih hidup di `style.css`/`tailwind.config.js`, jadi tidak ada yang rusak — hanya belum seragam dengan 18 halaman `public/pages/`.

Sebelum menyentuh apa pun, premis "hanya index.html yang tersisa" diuji: `grep -rn "glass\|card-modern\|btn-nexus\|gold-gradient\|neu-"` di `src/`, `public/`, `sw.js` → **0 hit** (kecuali `src/css`). Artinya setelah porting, seluruh CSS komponen legacy itu benar-benar mati dan boleh dihapus.

### Pemetaan (satu arah, tanpa kompromi)
| lama | baru |
|---|---|
| `.glass` pada input/select/textarea | `bg-tac-surface-recessed border border-tac-border-subtle` |
| `.glass` pada panel/tombol | `bg-tac-surface-card/60 border border-tac-border-tactical` |
| `.card-modern` (14 modal) | `bg-tac-surface-card/95 backdrop-blur-xl border border-tac-border-tactical` |
| `text/bg/border/ring/from/to-nexus-accent` | `*-tac-gold-bright` |
| `bg-nexus-black/60…95` (scrim) | `bg-black/60…95` (sama seperti modal di 18 halaman) |
| `gold-gradient` + `text-nexus-black` (CTA) | `bg-tac-primary-container` + `text-tac-on-primary-container` |
| `nexus-glow-text` | `.tac-glow-text` (baru, 5 baris di `tactical.css`, `--tac-gold-glow`) |
| `btn-nexus-small/-gold/-close`, `btn-nexus` | `tac-btn-ghost` / `tac-btn-primary` |
| `neu-shell/card/icon/title/sub/label/foot/field/btn/inset-rail` | `tac-plate`, `tac-well`, `tac-btn-primary`, `font-label-mono-sm` |
| `text-white`, `text-slate-400/500/600` | `text-tac-on-surface`, `text-tac-on-surface-variant`, `text-tac-status-standby` |
| `bg-white/5`, `border-white/5`, `border-white/10` | `bg-tac-surface-container-low`, `border-tac-border-subtle`, `border-tac-border-tactical` |
| `rose-*` → `tac-status-emergency` · `amber-*` → `tac-status-repair` · `emerald-*` → `tac-status-operational` · `purple-400` → `tac-secondary` | |

Dikerjakan bertahap, bukan sapu rata: (1) token warna legacy, (2) komponen `glass`/`card-modern`, (3) palet netral + semantik, (4) layar login, (5) hapus CSS mati. Skrip transformasi (`scratch/port-index-tac.py`) **idempoten** — dijalankan dua kali menghasilkan 0 perubahan, jadi aman diulang kalau ada kelas baru yang lolos.

### Tiga temuan yang lebih penting dari portingnya sendiri
1. **Aturan input global memakai `!important`** (`style.css`: `input, select, textarea { background-color: rgba(255,255,255,.03) !important; border: 1px solid var(--nexus-border) !important; color: var(--text-main) !important; border-radius: 1rem !important }`). Efeknya: **seluruh kelas `bg-tac-*`/`text-tac-*` pada input di 18 halaman tidak pernah berlaku sejak S15** — semua input masih putih-3% + aksen `#ffd700`. Diperbaiki ke token `tac-*` (recessed / border-tactical / on-surface / fokus `tac-primary`). Ini yang membuat login dan 21 input modal log ikut benar.
2. **Layar login masih neumorphic** (`.neu-*`): 2 shadow ekstrusi + `!important` sendiri. Ditulis ulang jadi `tac-plate` + `tac-well` + `tac-btn-primary`.
3. **Warna hardcoded yang lolos dari grep kelas**: `bg-[#131313]/95` (overlay scanner), `from-[#FFD700] to-[#E9C400] text-black` + `hover:bg-[#93000A]` (tombol scanner), dan `style="background: linear-gradient(135deg,#1a2e1a,#0d1f0d)"` di modal AI Settings (permukaan hijau gelap yang tidak ikut tema terang). Semua diganti token.

### Hasil terukur
- `index.html`: `glass` **91 → 0** · token `nexus-*` **155 → 0** · `card-modern` **14 → 0** · `neu-*` **11 → 0** · `text-white`/`text-slate-*`/`border-white/*`/`bg-white/*`/`rose|amber|emerald|purple-*` **0 sisa** · hex hardcoded **7 → 0** (kecuali `bg-white` untuk kanvas QR — memang harus putih).
- `src/css/style.css`: **17.408 → 10.519 byte (−6.889, −39,6%)** — 21 blok mati dihapus (`glass`, `card-modern`+hover, `btn-nexus-*`, `tag-nexus`, `gold-gradient`, `nexus-glow-text`, `neu-pill-*`, `neu-*`, animasi `#page-dash .card-modern`), `@layer components` kosong ikut dibuang.
- `src/css/tactical.css`: **+145 byte** (satu utilitas `.tac-glow-text`).
- `index.html` **+9,0 KB** (129.990 → 138.990) — konsekuensi wajar: `glass` (5 huruf) menjadi tiga utility eksplisit. Ditukar dengan 0 ketergantungan pada kelas komponen mati.
- Kelas `tac-*`: **141 dipakai / 141 ter-generate** (`scratch/check-tac-generated.py`) — tidak ada kelas yang tidak punya token.

### Verifikasi (angka riil, bukan klaim)
- `tsc --noEmit` **0** · `eslint` **0 error / 79 warning** (baseline) · `vitest` **447/447** (23 berkas) · `vite build` ok · `verify:precache` **50/50**.
- `node scratch/check-page.mjs index.html` → **402 ekspresi, 0 syntax error** (identik baseline).
- **Lighthouse 12.6.1** (desktop, preview build): performance **100** · accessibility **100** · best-practices **100** · seo **92** · LCP 0,7 s · CLS 0 · TBT 20 ms.
- **Matriks computed style 4 tema** (night/navy/purple/light), transisi dimatikan dulu:
  - login: panel `#161d27 / #131c30 / #1b1128 / #fff`, input recessed `#0a0e14 / #080d19 / #0a0510 / #e8edf4`, kontras label **13,2–17,9:1**, CTA emas **6,11:1**;
  - modal (Equipment / Log / AI Settings): panel `rgba(22,29,39,.95)` → `rgba(255,255,255,.95)`, border emas `rgba(251,191,36,.2)` → `rgba(162,74,6,.2)`, judul **13,2–17,9:1**, CTA emas **4,58:1** (gelap) / **6,79:1** (terang);
  - sidebar `container-lowest`, header `surface-base/90`, body `--nexus-bg` — semuanya ikut tema;
  - mobile 390×844: bottom nav + sheet "More" ikut tema, **overflow 0**, 0 error konsol.

### Jebakan (hemat waktu sesi berikutnya)
- **`!important` global menang atas utility class.** Kalau kelas `tac-*` "tidak berefek" pada input, jangan curiga Tailwind purge — cek `style.css` baris ~138.
- **`getComputedStyle` di tengah transisi CSS mengembalikan nilai LAMA** (kejadian lagi di sesi ini: border terbaca nilai tema sebelumnya). Matikan `*{transition:none!important}` lalu tunggu 2× `requestAnimationFrame`.
- **Prettier sudah gagal pada `index.html` di HEAD** (`Unexpected closing tag "div"` di baris ~1981, 3 `</div>` berlebih) — kondisi lama, bukan regresi. `npm run format:check` juga sudah merah untuk `tests/*`, `tsconfig.json`, `vite.config.js`. Jangan dikejar di tengah porting.
- Regex `class="([^"]*)"` **juga menangkap `:class="…"`** — berguna: string ternary Alpine (`currentPage === item.id ? 'text-nexus-accent' : 'text-slate-500'`) ikut ternormalisasi tanpa penanganan khusus.
- Dua utility warna Tailwind yang bertumpuk (mis. `border-tac-border-tactical` + `border-tac-gold-bright/20`) diputus oleh **urutan key di config**, bukan urutan di atribut `class`. Hindari menumpuk; pilih satu.

### Sisa yang belum dikerjakan
- `src/js/**` masih menyusun kelas dari palet lama di string JS: `text-slate-400` (`app.js`, `charts.js`, `ui.js`), `bg-rose-500 text-white` (badge di `app.js`). Tidak ikut tervalidasi `tsc`/`eslint`/`check-page.mjs`; kandidat sesi berikutnya.
- `notification.js` masih mengirim nama ikon **FontAwesome** (`'fa-hourglass-half'`, `'fa-hourglass-end'`) ke `pushInAppNotif` — FontAwesome sudah dibuang sejak S15, jadi ikon notifikasi itu tidak akan tampil.
- `.gold-text` dan `.nav-active` di `style.css` sudah 0 referensi tapi dibiarkan (di luar cakupan porting).

---

## 📝 Session 20 (S20, 2026-10-17) — font ikon 343 KB → 10 KB

### Masalahnya dua lapis, bukan satu
Item opsional ini tercatat sebagai "335 KB karena 4 sumbu variabel (opsz/wght/FILL/GRAD)". Setelah diukur, **sumbu variabel cuma sebagian kecil biayanya**:

| varian permintaan | ukuran | glyph |
|---|---|---|
| asli: `opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200` + `&text=` | **343,2 KB** | 6.090 |
| sumbu dipin `@24,400,0,0` + `&text=` | 276,0 KB | 3.645 |
| sumbu dipin + **`&icon_names=`** | **9,8 KB** | **112** |

Penyebab sebenarnya: **`&text=` mensubset berdasarkan KARAKTER, bukan ikon.** Aplikasi mengirim 84 *nama ligatur* sebagai teks, jadi Google menyertakan huruf `a-z` + `_` — dan tetap mengirim **ribuan glyph ikon** karena target ligatur tidak bisa ditebak dari daftar karakter. Memin sumbu hanya membuang 20%; `&icon_names=` membuang 97%.

### Dibuktikan, bukan diasumsikan
Font 9,8 KB itu terlalu bagus untuk dipercaya, jadi diverifikasi dua arah:
1. **Isi font** (`fonttools`): 112 glyph = 84 ikon + 25 huruf + 3 lain, cmap 155 entri (128 PUA), **tanpa `fvar`** → statis, dan huruf tetap ada → ligatur masih mungkin.
2. **Render di browser**: 84/84 ligatur tampil sebagai ikon (lebar ≤ 1em, 0 jatuh ke teks) · **84 hash piksel unik**, 0 kosong, 0 duplikat → bukan tofu. Kontrol negatif `zzz_bukan_ikon` render sebagai teks (ink 178) → tes memang bisa membedakan.
3. **Aplikasi nyata** (`localhost:3000`, login dipaksa): **38/38 ikon tampil**, `document.fonts.check()` = true, berkas ter-serve 10.048 byte.

### Yang dikerjakan
- `scripts/download-material-symbols.mjs` **ditulis ulang**:
  - `&icon_names=` menggantikan `&text=` (pengungkit ukuran sebenarnya).
  - **Nama berkas keluaran diperbaiki**: dulu menulis `material-symbols-subset.woff2`, padahal `@font-face` memuat `material-symbols-outlined.woff2` — skripnya tidak pernah benar-benar meng-update font yang dipakai.
  - **UA wajib lengkap dengan `Chrome/…`** — tanpa itu Google mengirim `truetype`, bukan woff2 (kegagalan pertama sesi ini).
  - **Pemindaian ikon diperluas** dari `app.js` saja ke seluruh `src/js/**` (menu/analytics memakai field `ms:` di modul lain).
  - **Font dibangun dari allowlist**, bukan hasil deteksi — menjamin setiap ligatur yang diizinkan punya glyph.
  - **Output CSS mati dibuang**: dulu menulis `material-symbols-local.css` yang tidak pernah dimuat siapa pun.
- `src/css/tactical-icons.css`: `font-weight: 100 700` → **`400`**. Deklarasi rentang hanya benar untuk font variabel; font ini statis. Tidak ada pemakaian `'FILL' 1` di repo, jadi satu instance cukup.
- **3 tes ratchet** (`tests/icon-contract.test.js`): font **< 50 KB** dan ber-magic `wOF2` · skrip memakai `icon_names` (bukan `text=`) · `@font-face` mendeklarasikan satu bobot. Plafon 50 KB memberi ruang ~4x untuk menambah ikon tapi menangkap kalau parameternya dikembalikan.

### Hasil
- Font: **343.220 → 10.048 byte (−97,1%)**. Payload offline turun **−325,4 KiB**.
- Suite **444 → 447** tes (23 berkas) · `tsc` 0 · `eslint` **0 error / 79 warning** (baseline turun 1) · build ok · `verify:precache` **50/50**.

### Jebakan yang perlu diingat
- **Angka "precache N entries (X KiB)" dari Vite PWA TIDAK menghitung berkas `public/`.** Font 343 KB dan 10 KB menghasilkan angka yang sama (3.201,52 KiB). Untuk payload sebenarnya, jumlahkan sendiri ukuran berkas yang tercantum di `dist/sw.js` (di sesi ini: 48 berkas = 3.375,5 KiB).
- `document.fonts.check()` = **false** kalau belum ada elemen terlihat yang memakai font itu — di layar login tidak ada ikon, jadi ini bukan tanda font rusak. Paksa login dulu.
- 5 ligatur di allowlist **tidak dipakai** di mana pun (`account_circle`, `help`, `home`, `info`, `menu`) — sisa dari modal yang dihapus di Q-3. Dibiarkan: biayanya ~600 byte, dan memangkasnya berisiko kalau ternyata dipakai lewat pola markup yang tidak terdeteksi skrip.

---



### Keputusan
Kartu Q-3 minta **pilih SATU**: hapus, atau wiring sungguhan. Dipilih **HAPUS** — markup-nya sudah inline di `index.html`, dan tidak ada kode yang pernah memuatnya. Wiring hanya akan menambah jalur pemuatan dinamis untuk UI yang sudah jalan.

### Premis dibuktikan dulu, bukan dipercaya
Sebelum menghapus, tiga hal dicek:
1. **Tidak ada kode runtime yang memuatnya.** `component-loader.js` men-set `this.basePath = '/pages'` di constructor dan **tidak pernah** diubah di mana pun; `loadPage(name)` → `/pages/<name>.html`. Grep `components/modals` di `src/`, `index.html`, `public/pages/` → **0 hit**. Satu-satunya penyebut path itu adalah tooling (script generator ikon + tes), bukan runtime.
2. **Markup-nya memang sudah inline.** Dibandingkan per-token (atribut Alpine, `id`, potongan teks) antara tiap fragment dan `index.html`: APISettings 100% · Equipment 95% · Log 94% · QRPreview 100% · QRScanner 100% · SpareParts 100% sudah ada di `index.html`.
3. **Tidak ada worktree.** Kartu menyebut `.worktrees\t_22172e91`; direktori itu tidak ada → dikerjakan di working dir utama.

### Yang dikerjakan
- **6 berkas dihapus** (`git rm`): `APISettingsModal`, `EquipmentModal`, `LogModal`, `QRPreviewModal`, `QRScannerModal`, `SparePartsModal` — total **40.489 byte**. Direktori `public/components/` ikut hilang (tidak ada isi lain).
- **2 pembaca direktori diperbaiki** — keduanya akan **crash ENOENT** kalau dibiarkan, karena memanggil `fs.readdirSync('public/components/modals')`:
  - `scripts/download-material-symbols.mjs` — entri modals dibuang dari `filesToScan`.
  - `tests/icon-contract.test.js` — entri modals dibuang dari `htmlFiles`.
- **3 tes penjaga baru** (`tests/icon-contract.test.js`, describe "fragment modal legacy tidak boleh hidup lagi"): direktori `public/components/modals` **tidak boleh ada**, `component-loader` hanya boleh punya `basePath = '/pages'`, dan **tidak ada kode runtime** (`src/**` + halaman) yang menyebut `components/modals`.

### Hasil
- **Precache 56 → 50 entri, 3.240,23 → 3.200,65 KiB (−39,58 KiB).** `verify:precache` **50/50 OK**.
- Suite **434 → 437** tes (22 berkas), `tsc` 0, `eslint` 0 error / 80 warning (baseline), `vite build` ok.
- Dev server (`localhost:3000`) dicek ulang setelah penghapusan: app shell tampil, 3 elemen modal inline ada, 55 span Material Symbols, **0 teks ligatur mentah**.

### ⚠️ Temuan terpisah (BELUM diperbaiki — menunggu keputusan user)
`LogModal.html` bukan salinan persis: ia punya **3 binding Alpine yang tidak ada** di modal inline `index.html`:
- `x-model="logForm.actualHours"`
- `x-model="logForm.completedDate"`
- `x-show="logForm.status === 'Completed'"`

Field state-nya **ada dan ikut tersimpan**: `src/js/constants.ts:64` (`actualHours: 0`) dan `src/js/modules/logs.js:381-382` membaca `this.logForm.actualHours` / `this.logForm.completedDate` saat submit. Tapi modal inline **tidak punya input untuk keduanya** → nilainya selalu `0` / `''`. Jadi ada fitur kecil ("actual hours" + "completed date") yang dulu dibuat di fragment mati dan **tidak pernah benar-benar rilis**. Berkasnya bisa dipulihkan dari git (`git show e667618:public/components/modals/LogModal.html`). Menambah 2 input itu ke modal inline = kerja fitur, bukan bagian Q-3, jadi tidak dikerjakan.

### Catatan kecil
- `scratch/make-scanner-harness.mjs` (harness lokal, **gitignored**) membaca `QRScannerModal.html` → sekarang akan gagal kalau dijalankan. Bukan bagian repo, tidak diperbaiki.
- Semua ligatur yang dipakai di 6 fragment (`add`, `close`, `cloud_done`, `description`, `download`, `fact_check`, `fingerprint`, `inventory`, `logout`, `monitoring`, `photo_camera`, `qr_code_scanner`) **masih dipakai** di halaman/app.js → **tidak ada** entri yatim di `icon-subset.txt`, jadi font subset tidak perlu diregenerasi karena kartu ini.

### Tindak lanjut — 2 temuan DIPERBAIKI (menunggu keputusan user, sudah dijawab "ya")
**1. `index.html` meta viewport — zoom diblokir (WCAG 1.4.4).** `maximum-scale=1, user-scalable=no` dihapus → sekarang `width=device-width, initial-scale=1.0`. Pinch-zoom aktif kembali; audit Lighthouse `meta-viewport` yang sebelumnya **gagal** sekarang lolos.

**2. Input `actualHours` + `completedDate` dipindah ke modal log inline.** Fitur yang dulu hanya hidup di fragment mati sekarang benar-benar bisa diisi:
- `<input type="number" x-model="logForm.actualHours" min="0" step="0.1">` — label **Actual Hours**.
- `<input type="date" x-model="logForm.completedDate" :max="<hari ini>">` — label **Completed Date**, dibungkus `x-show="logForm.status === 'Completed'"`.
- `<select x-model="logForm.status">` dapat `@change` yang **mengisi `completedDate` otomatis** dengan tanggal hari ini saat status diubah ke `Completed` (dan tidak menimpa kalau sudah terisi).
- `DEFAULT_LOG_FORM()` di `src/js/constants.ts` sekarang mendeklarasikan `completedDate: ''` — sebelumnya field ini **tidak ada** di default, jadi `x-model` mengikat ke properti `undefined` dan nilainya tidak pernah ter-reset saat modal dibuka ulang.
- Gaya mengikuti tetangganya (`glass` + `text-nexus-accent/40`) supaya konsisten dengan field lain di modal itu.

**3. 7 tes penjaga baru** — `tests/log-form-contract.test.js`: viewport tidak boleh memakai `user-scalable=no`/`maximum-scale=1` · `DEFAULT_LOG_FORM` mendeklarasikan kedua field · input-nya ada di `index.html` dengan `step`/`:max` yang benar · `Completed Date` dibungkus `x-show` status · `@change` mengisi otomatis · kedua field benar-benar disubmit oleh `logs.js`.

**Verifikasi nyata:**
- `node scratch/check-page.mjs index.html` → **402 ekspresi, 0 syntax error**.
- `tsc` 0 · `eslint` 0 error / 80 warning (baseline) · **444/444** tes (23 berkas) · `vite build` ok · `verify:precache` **50/50** (3.201,53 KiB, +0,88 KiB dari markup baru).
- **Lighthouse 12.6.1 sesudah perbaikan: performance 99 · accessibility 94 → **100** · best-practices 100 · seo 92.** Audit `meta-viewport` yang tadinya **gagal (score 0)** sekarang **lolos (score 1)** — "`[user-scalable="no"]` is not used … and `[maximum-scale]` is not less than 5".
- **Browser (dev server `localhost:3000`)**: meta viewport = `width=device-width, initial-scale=1.0` (zoom diizinkan); kedua input ada; label "Actual Hours" & "Completed Date" tampil; `Completed Date` **tersembunyi saat status Pending**, **muncul saat Completed**; mengubah status lewat event `change` **mengisi `completedDate` = `2026-10-17`** otomatis; `step=0.1`/`min=0` dan `max` = hari ini terpasang.

### ⚠️ Temuan baru (belum diperbaiki — menunggu keputusan user)
`index.html` **masih memakai design system lama** di banyak tempat: **89 pemakaian `glass`** dan **109 pemakaian `nexus-accent`** (emas `#ffd700`), termasuk seluruh modal log ini. Kelasnya **masih hidup** di `src/css/style.css` (`.glass` di baris 116 & 330, `--nexus-accent` di baris 11) dan `tailwind.config.js`, jadi **tidak rusak** — hanya belum diporting ke Tactical Slate (`tac-*`). Catatan S15 ("0 kelas `glass`/`nexus-*`") berlaku untuk `public/pages/` (18 halaman), **bukan** `index.html`. Kalau mau diseragamkan, itu kartu tersendiri.

### Kanban
Kartu **Q-3 `t_22172e91`** → **`done`**. Dikerjakan manual, status dibiarkan `blocked`, tidak pernah di-`unblock`.

---

## 📝 Session 18 (S18, 2026-10-17) — Q-2: audit offline-first (precache + strategi runtime cache)

### Ringkasan
Audit penuh offline-first untuk teknisi di site tambang (koneksi putus-nyambung). Hasilnya: **precache-nya sudah benar dan lengkap**, yang rusak adalah **lapisan fallback + halaman offline**-nya. 5 perbaikan + 1 penjaga otomatis baru.

### Hasil audit — yang SUDAH benar (jangan diubah tanpa alasan)
- **Precache lengkap**: 56 entri / 3.239 KiB — 17 aset build (termasuk chunk lazy `jspdf`/`xlsx`/`html2canvas`/`chart`), 18 halaman `pages/`, 6 `components/modals/`, font Material Symbols, 8 ikon, `index.html`, `offline.html`, `manifest.json`, `logo.png`, `registerSW.js`.
- **Runtime cache `/pages/*.html`**: network-first + cache fallback + `cache: 'no-store'` — sudah tepat (fragment tidak punya hash di nama berkas).
- **CropperJS dari cdnjs**: stale-while-revalidate — masih relevan (`app.js` memang lazy-load cropperjs dari CDN saat crop foto).
- **Offline di sisi aplikasi**: `isOnline` bersumber dari `/.info/connected` (`data.js`), antrean operasi tertunda di IndexedDB + `syncPendingOperations()` saat event `online`, chip sidebar `PWA CACHE / ONLINE|QUEUE`. Sudah ada, tidak disentuh.

### 🔎 Keputusan penting: Firebase RTDB **TIDAK** di-cache di service worker
Kartu meminta "strategi runtime cache untuk Firebase RTDB reads". Setelah ditelusuri, jawabannya **jangan** — dan alasannya ditulis permanen di `sw.js` (`CATATAN AUDIT (Q-2)`):
1. RTDB **tidak lewat `fetch()`**. SDK memakai WebSocket (`wss://`) + long-polling XHR ke `*.firebasedatabase.app`, jadi handler `fetch` di SW tidak pernah menerimanya — aturan `caches.match` untuk RTDB cuma akan jadi **dead code**.
2. RTDB **sudah** offline-capable di sisi SDK: data yang pernah tersinkron disimpan otomatis di IndexedDB (~10 MB, LRU), dan setiap write saat offline diantre lalu dikirim ulang setelah reconnect.
3. `enableIndexedDbPersistence()` itu API **Firestore**, bukan RTDB (diverifikasi: hanya ada di `@firebase/firestore/dist/*.d.ts`, tidak ada di `@firebase/database/dist/*.d.ts`). Pada SDK web modular v9+ (repo ini firebase **12**) tidak ada opt-in untuk RTDB karena persistence-nya memang otomatis.
4. Menaruh data terautentikasi di Cache Storage juga salah secara keamanan.
Ditambah penjaga tes: `sw.js` **tidak boleh** memuat `firebasedatabase.app`/`firebaseio.com`.

### Gap yang ketemu & dibetulkan
1. **`offline.html` ter-precache tapi TIDAK PERNAH dilayani.** Fallback navigasi hanya menunjuk `/index.html`, jadi halaman offline itu praktis mati. Sekarang rantainya: `index.html` → `/` → **`offline.html`** → 503.
2. **Bug `||` pada rantai fallback (gagal senyap).** Kode lama: `return caches.match('/index.html') || caches.match('/')`. Promise selalu truthy → cabang kedua **tidak pernah dievaluasi**, dan kalau `index.html` tidak ada di cache, `respondWith()` menerima `undefined` → navigasi berakhir tanpa respons. Sekarang dirantai berurutan lewat `.then()`.
3. **`offline.html` sendiri rusak saat offline.** Tiga cacat sekaligus: (a) menarik Google Fonts dari CDN — tidak akan termuat saat offline; (b) ikon memakai **ligatur Material Symbols** padahal halaman itu tidak pernah memuat font/CSS-nya → yang tampil adalah **teks mentah** `wifi_off`, `refresh`, `chevron_left`, `warehouse`; (c) kelas Tailwind (`text-[16px]`, `mr-1`) tanpa Tailwind. Plus teksnya bahasa Inggris padahal UI aplikasi Indonesia. **Ditulis ulang self-contained**: ikon inline SVG, system font stack, **0 permintaan eksternal**, copy Indonesia, membedakan "tidak ada sinyal" vs "server tidak terjangkau", auto-kembali saat event `online`, hormati `prefers-reduced-motion`, `role="status"` + `aria-live="polite"`.
4. **Aset ber-hash dulu network-first** → setiap muat menarik ulang seluruh bundle di link tambang yang lemah. Sekarang `/assets|fonts|icons/**` **cache-first** (aman: nama berkas ber-hash konten dan semuanya sudah di-precache; cache miss tetap jatuh ke jaringan).
5. `sw.js` `CACHE_NAME` → **`mtc-asset-v13`** (logika SW berubah).

### Penjaga baru
- **`scripts/verify-precache.mjs`** + `postbuild` di `package.json` — gagal kalau ada berkas hasil build (aset, font, ikon, halaman, komponen, app shell) yang **tidak** masuk daftar precache. Tanpa ini, chunk lazy baru bisa lolos tanpa error apa pun dan aplikasi cuma "blank" saat offline. Sekarang: **56/56 berkas OK**.
  - Saat ditulis, penjaga ini langsung menangkap dua kenyataan yang mudah salah: entri `__WB_MANIFEST` dari Workbox ditulis **relatif** (`assets/x.js`), sedangkan app shell di `sw.js` **absolut** (`/index.html`); dan `dist/sw.js` hasil build **diminify dengan literal backtick** (`` `/manifest.json` ``), bukan tanda kutip.
- **`tests/sw-contract.test.js`** (21 tes) — kontrak offline-first di level sumber (tanpa perlu `dist/`): precache app shell lengkap, rantai fallback berurutan sampai `offline.html`, tidak ada `||` pada `caches.match`, `/pages/` tetap `no-store`, aset ber-hash cache-first, **tidak ada** cache RTDB, `offline.html` tanpa aset eksternal & tanpa ligatur Material Symbols, `postbuild` terpasang.

### Verifikasi (hasil nyata)
- Suite: `tsc` 0 · `eslint` 0 error / 80 warning (baseline) · **434/434** tes (22 berkas) · `vite build` ok · `verify:precache` **56/56 OK**.
- **Browser, SW aktif** (`mtc-asset-v13`, 57 entri), `navigator.onLine === false`: fragment `/pages/Dashboard.html` **200** (48.356 B), halaman yang **belum pernah dibuka** `/pages/MTBFMTTR.html` **200** (9.965 B), `/assets/main-DW9IUQwh.js` **200** (298.762 B), font ikon **200** (343.220 B), `manifest.json` **200**.
- **Server preview benar-benar dimatikan** (bukan cuma mode offline DevTools): navigasi ke `/` → **app shell tampil** (`[x-data]` ada). Lalu `/index.html` + `/` dihapus dari cache SW → navigasi ke `/` → **`offline.html` tersaji**: judul `Offline — MTC.ASSET`, h1 "Anda sedang offline", 7 inline SVG, **0 referensi eksternal**, hint "Perangkat terhubung ke jaringan, tetapi server MTC.ASSET tidak bisa dijangkau…".

### Pelajaran
- **`Network.emulateNetworkConditions({offline:true})` dari CDP TIDAK cukup untuk menguji service worker.** Dua sebab: (a) emulasi itu berlaku pada target halaman, sedangkan `fetch()` di dalam SW berasal dari target SW sendiri; (b) HTTP cache browser tetap bisa memenuhi `fetch()` sehingga rantai fallback `.catch()` tidak pernah jalan. Satu-satunya uji offline yang jujur: **matikan servernya**, lalu `Page.navigate` di tab yang sudah dikontrol SW (`navigator.serviceWorker.controller === true`). Membuka tab baru setelah `unregister()` membuat navigasi gagal `ERR_CONNECTION_REFUSED` — SW-nya belum mengontrol tab itu.
- Halaman fallback offline **wajib** diaudit dengan pertanyaan "kalau semua jaringan mati, apa yang masih bisa dimuat halaman ini?" — CDN dan ligatur font lolos dari review karena tidak error, cuma salah tampil.
- `respondWith(promise || promise)` adalah pola yang mudah ditulis dan selalu salah: promise selalu truthy.

### Kanban
Kartu **Q-2 `t_e5b00df8`** → **`done`**. Dikerjakan manual, status dibiarkan `blocked`, tidak pernah di-`unblock`.

---

## 📝 Session 17 (S17, 2026-10-17) — Q-1: ukur test coverage & tutup gap modul berisiko

### Hasil
`npm run test:coverage` dijalankan pertama kali. Baseline: **18.49% stmt · 17.73% branch · 21.51% func · 19.10% line** (268 tes / 17 berkas). Setelah 4 berkas tes baru: **28.32% stmt · 26.75% branch · 29.95% func · 29.51% line** — suite **268 → 412** tes (**17 → 21** berkas). Tidak ada tes lama yang diubah.

### Modul berisiko yang ditutup

| Modul | Lines sebelum | Lines sesudah | Funcs sebelum | Funcs sesudah |
| --- | --- | --- | --- | --- |
| `src/js/modules/ai.js` | 2.63% | **76.0%** | 10.16% | **88.1%** |
| `src/js/modules/requisition.js` | 11.94% | **67.2%** | 13.95% | **79.1%** |
| `src/js/modules/export.js` | 0.56% | **45.5%** | 0% | **42.0%** |
| `src/js/modules/notification.js` | 40.54% | **77.0%** | 38.7% | **83.9%** |

### Tes baru
- **`tests/ai-module.test.js`** (45 tes) — prompt builder murni (`formatKPIForPrompt` / `buildSmartPrompt` / `buildAnalysisPrompt`), `getKPIContext` (termasuk edge case: log tanpa `woNumber` bukan WO, RCA di-lowercase + top 5, `avgResponseDays` dari `approvalDate`, part tanpa `minStock`), manajemen key (`init` / `setApiKey` / `clearApiKey` / `rotateApiKey` / getter `activeApiKey` / `loadAISettings`), dispatch provider `callAI` (openai / claude / openrouter / key eksplisit / `app.aiApiKeys`) + normalisasi pesan error, alur `analyzeKPI` (tanpa key · sukses · placeholder custom prompt · rate-limit → `rotateApiKey` · semua gagal), `getAIRecommendations`, `sendAIChat`, `updateModelOptions`, `clearAIChat`.
- **`tests/requisition-module.test.js`** (35 tes) — `itemAvail`, `reqGetFilteredList` (filter status/tipe + urut `createdAt` menurun, tidak memutasi sumber), getter `openWOs`, line item (`reqAddLineItem` objek terpisah, `reqRemoveLineItem` menjaga minimal 1), `submitRequisition` (record baru · mode edit · backlink `reqIds` ke WO · error Firebase), transisi status (`approveRequisition` · `markArrived` + auto-tambah stok · `closeRequisition` · `bulkApproveRequisitions` · `deleteRequisition`), `autoReorderLowStock` (qty `MinStock*2 - Stok`, dedupe part yang sudah diajukan, skip `MinStock` 0).
- **`tests/export-module.test.js`** (30 tes) — `exportData` (normalisasi `EquipmentIDs` → string berkoma, `PartsUsed`/`PhotoURLs`/`events` → JSON string, jalur `window.Alpine.raw`, nama file per tipe), `downloadTemplate` (5 tipe), `exportKPIToPDF` (guard tanpa data · tabel `#perfTable` · elemen hilang), `exportWOToPDF` (guard · WO tidak ketemu · delegasi ke `generateProfessionalWOPDF` · error), `importCSV` (pemetaan 4 tipe · `EquipmentIDs` berkoma → array · `freq` turunan dari `bd` · parse JSON `PartsUsed`/`events` · `PartsUsed` non-JSON → `[]` · error). `xlsx`, `jspdf`, dan `wo-pdf-template` di-mock.
- **`tests/notification-checkers.test.js`** (34 tes) — `requestNotificationPermission` (API absen / granted / denied / prompt grant / prompt deny / prompt melempar), `sendBrowserNotification` (izin belum granted · fallback `new Notification` · jalur `registration.showNotification` · tag default · konstruktor melempar), dan keempat checker privat lewat `checkAllNotifications()`: low stock (stok 0 · menyentuh `MinStock` · ringkasan `+N lainnya` · fallback `PartID`), WO urgent/aging (batas 3 hari, tanggal invalid), PM overdue & H-3, umur pakai part, anti-spam, auto-reorder khusus admin/supervisor.

### Ratchet coverage dinaikkan
`vitest.config.js`: threshold **10/11/9/10 → 27/25/28/28** (sedikit di bawah hasil nyata supaya refactor wajar tidak langsung memerahkan gate). Ini yang mengubah config — bukan sumber aplikasi.

### Tindak lanjut — 2 temuan DIPERBAIKI (commit `347d3f7`, live)
Kedua temuan di atas diperbaiki atas persetujuan user (perintah "kerjakan"), bukan dibiarkan menggantung:
1. **`ai.js → loadAISettings()`** — `this.updateModelOptions()` dipindah ke **atas** pembacaan model, dan `this.aiModel = localStorage.getItem('ai_model') || this.aiModel` dibaca **sesudahnya** dengan fallback ke default provider. Jadi model tersimpan menang, dan cabang `Custom: <model>` sekarang benar-benar hidup. Tes `KNOWN DEFECT` diganti **2 tes regresi** (model tersimpan menang · fallback ke opsi pertama saat `ai_model` kosong).
2. **`requisition.js → bulkApproveRequisitions()`** — `this.currentUser?.email` → **`this.user?.email`** (konsisten dengan `approveRequisition()`). Deklarasi mati `currentUser?: any` di `src/js/appstate.ts` **dihapus** supaya tidak memancing pengulangan bug yang sama (`grep -rn currentUser src/` → 0 hit). Tes `bulkApprove` sekarang menyuntik `user`, bukan `currentUser` palsu.
3. **Bundle benar-benar berubah**: `main-B22hopwX.js` → **`main-DW9IUQwh.js`** (diverifikasi lokal = live lewat marker nama berkas di `index.html`); CSS tetap `main-DcdhVYeZ.css`. `sw.js` `CACHE_NAME` **tetap `mtc-asset-v12`** — aset ber-hash di nama berkas ditangani revision manifest Workbox, dan bump manual di repo ini hanya diwajibkan saat fragment `/pages/*.html` berubah (tidak terjadi di sini).
4. Coverage sesudah perbaikan: **28.34% stmt · 26.78% branch · 29.95% func · 29.53% line** — tetap 412/412 tes.

### Verifikasi (hasil nyata)
- `npm run typecheck` **0 error** · `npm run lint` **0 error / 80 warning** (baseline, tidak naik) · `npm run test:run` **412/412** (21 berkas) · `npm run test:coverage` lolos threshold baru · `npm run build` ok (**56 entri precache, 3.235 KiB**).
- **Dua commit**: `d0db110` (tes + ratchet) lalu `347d3f7` (perbaikan 2 temuan). Keduanya di-push ke `origin/main` + `firebase deploy --only hosting`. Live diverifikasi lewat marker konten: `sw.js` = `mtc-asset-v12`, `index.html` menunjuk `main-DW9IUQwh.js` (sama dengan `dist/assets/`), `themeMode` masih ada.
- `git status`: bersih kecuali `m .open/skills` (anomali lokal, **tidak disentuh**).

### Pelajaran
- `Object.create(module)` (bukan spread `{...module}`) adalah cara aman memberi setiap tes state sendiri pada modul Alpine: spread akan **mengevaluasi getter** jadi nilai statis, sedangkan `Object.create` mempertahankan getter + metode lewat prototype chain dan assignment tetap jadi own-property.
- `vi.hoisted()` wajib untuk mock `xlsx`/`jspdf` karena factory `vi.mock` di-hoist ke atas deklarasi `const`.
- `vi.stubGlobal('Notification', ...)` cukup untuk `'Notification' in window` di lingkungan jsdom (jsdom tidak mengimplementasikan Notification).
- Modul yang seluruh jalurnya menabrak library berat tetap bisa diuji: mock **library**-nya, bukan modulnya — jadi logika pemetaan data (`exportData`, `importCSV`) yang justru berisiko tetap dieksekusi sungguhan.

### Kanban
Kartu **Q-1 `t_e6dd5987`** → **`done`**. Dikerjakan manual, status dibiarkan `blocked`, tidak pernah di-`unblock`.

---

## 📝 Session 16 (S16, 2026-10-16) — D-3: palette `tac-*` jadi theme-aware

### Masalah
Palette `tac-*` di `tailwind.config.js` memakai **hex literal**, jadi Dashboard (dan seluruh chrome app) tetap gelap walau tema = `light` — satu-satunya bagian yang tidak mengikuti tema. Hex literal dipilih di commit `497969f` karena Tailwind v3 tidak menerapkan opacity modifier pada warna berbasis `var()` polos. Jadi perbaikannya harus menyelesaikan **dua** hal sekaligus: theme-aware **dan** `bg-tac-status-emergency/15` tetap 15%.

### Solusi: `rgb(var(--tac-…) / <alpha-value>)`
Sintaks resmi Tailwind v3. Setiap token `tac` sekarang menunjuk **triple channel RGB** yang didefinisikan dan di-override per tema:

- **`tailwind.config.js`** — 59 token `tac.*` jadi `rgb(var(--tac-xxx) / <alpha-value>)`; **0 hex literal** di palette. Tiga token yang sudah membawa alpha sendiri (`border.subtle`, `gold.glow`, `sync.cyan-glow`) tetap `var()` utuh karena tidak pernah dipakai dengan opacity modifier.
- **`src/css/tactical.css`** — `:root` (night) + blok `[data-theme='navy']`, `[data-theme='purple']`, `[data-theme='light']`. Utility `.tac-plate/-flat/-inset`, `.tac-well`, `.tac-rail`, `.tac-label`, `.tac-meter`, `.tac-btn-*` ikut `rgb(var(…))`; tepi/bayangan taktil dapat var sendiri (`--tac-edge`, `--tac-rim-a/b`, `--tac-well-shadow`, `--tac-rail-shadow`) supaya tema terang tidak "kotor".
- **night tidak berubah sedikit pun** (nilai channel = hex lama) → 0 regresi visual di tema default.
- **navy / purple** menggeser permukaan ke biru / ungu agar senada `--nexus-bg` (`#0a0f1e` / `#0d0714`).
- **light** = permukaan terang + aksen digelapkan, karena token yang sama dipakai sebagai **warna teks**. Mis. `primary`/`gold-bright`/`status-repair` → `#A24A06`, `status-standby` → `#475569`, `status-emergency`/`error` → `#b91c1c`.

### Bug yang ketemu & dibetulkan
- **`text-tac-text-dim` (3× di `src/js/app.js`)** tidak punya token di `tailwind.config.js` → kelasnya **tidak pernah ter-generate**, jadi badge UNKNOWN / CANCELLED / LOW tampil tanpa warna sejak S15 (dan lolos dari `check-page.mjs` + `tsc` + `eslint`). Diganti `text-tac-on-surface-variant` (warna identik: `#d8c3ad`).
- **`hover:bg-emerald-400` + `text-tac-surface-container-lowest` di `Dashboard.html`** → di tema terang teks putih di atas hijau terang (1.7:1). Jadi `hover:bg-emerald-700 dark:hover:bg-emerald-400` (5.5:1 di terang, 9.6:1 di gelap).
- **Anti-flash `index.html`** hanya kenal `darkMode` boolean → `navy`/`purple` sempat berkedip gelap saat reload. Sekarang membaca `themeMode` (sumber kebenaran yang sama dengan `ui.js applyTheme`).
- **Gap AA tema gelap yang SUDAH ADA** (sengaja **tidak** diubah, cuma dicatat): `text-tac-status-standby` 3.56:1 dan `text-tac-gold-dim` 3.37:1 di atas `bg-tac-surface-card`. Perbaikannya = keputusan desain terpisah (mis. standby → slate-400). Ditulis eksplisit di `KNOWN_DARK_GAPS` (`tests/tac-theme.test.js`) supaya tidak hilang.

### Tes penjaga baru: `tests/tac-theme.test.js` (12 tes) — suite **256 → 268**
1. setiap nilai `tac` = `rgb(var(…) / <alpha-value>)` atau `var()` utuh yang diizinkan · 2. 0 hex literal · 3. var yang dirujuk config ada di `:root` · 4. var yang dirujuk CSS ada di `:root` · 5. nilai channel = 3 angka 0-255 di tiap tema · 6. night identik dengan Tactical Slate asli · 7. navy/purple/light meng-override permukaan + teks · 8. light benar-benar terang, navy biru, purple ungu · 9. kontras tema light ≥ 4.5:1 (18 pasangan) · 10. kontras tema gelap ≥ 3:1 · 11. gap AA tema gelap persis sebanyak yang didokumentasikan · 12. **setiap kelas `tac-*` di halaman/JS punya token** (ini yang menangkap `text-tac-text-dim`).

### Verifikasi (hasil nyata, bukan klaim)
- `npm run typecheck` **0** · `npm run lint` **0 error / 80 warning** (baseline, tidak naik) · `npm run test:run` **268/268** (17 berkas) · `npm run build` ok (**56 entri precache, 3.235 KiB**).
- `node scratch/check-page.mjs public/pages/Dashboard.html` → **136 ekspresi, 0 syntax error**.
- CSS hasil build: `bg-tac-status-emergency/15` → `rgb(var(--tac-status-emergency) / .15)`; `bg-tac-surface-card` → `rgb(var(--tac-surface-card) / var(--tw-bg-opacity,1))`; `border-tac-border-subtle` → `var(--tac-line-subtle)`.
- **Audit kelas** (`scratch/check-tac-generated.py`): 141 kelas `tac-*` dipakai → **141 ter-generate, 0 hilang**.
- **Build nyata di browser** (`python -m http.server` di `dist/`, login dipaksa): `body` = `#0d141d` (night) / `#0a0f1e` (navy) / `#0d0714` (purple) / `#f8fafc` (light); kartu = `#161d27` / `#131c30` / `#1b1128` / `#ffffff`; sidebar = `#080f18` / `#070b16` / `#09040f` / `#ffffff`. **0 error konsol, 0 overflow di keempat tema.**
- **Opacity modifier tetap utuh** (`getComputedStyle`): `/15` → `rgba(239,68,68,.15)` → light `rgba(185,28,28,.15)`; `/10`, `/40`, `/60`, `/95` semua benar; `border-tac-border-subtle` `rgba(255,255,255,.06)` → light `rgba(15,23,42,.08)`.
- **Kontras light** `text-tac-status-standby` di atas `bg-tac-surface-card` = **7.58:1** (syarat kartu ≥ 4.5:1).
- 8 halaman lain (`wo`, `pms`, `equip`, `planning`, `hist`, `parts`, `kpi`, `audit`) di tema light: kartu `rgb(255,255,255)`, **0 error konsol, 0 overflow**.
- `sw.js` `CACHE_NAME` → **`mtc-asset-v12`**.

### Pelajaran
- Tailwind v3 **memang** mendukung `rgb(var(--x) / <alpha-value>)`. Yang tidak didukung cuma `var(--x)` polos (alpha hilang). Jadi hex literal tidak pernah diperlukan untuk theme-aware.
- **`getComputedStyle` di tab yang tidak fokus bisa menahan nilai LAMA selama transisi CSS** (`transition-all duration-300` di `body`/sidebar) — nilainya beku di keadaan awal karena rAF di-throttle. Matikan transisi (`*{transition:none!important}`) sebelum mengukur, jangan simpulkan "CSS tidak jalan".
- Kelas warna yang disusun di string JS **tidak divalidasi** oleh `tsc`, `eslint`, maupun `check-page.mjs`. Hanya tes yang membandingkan daftar kelas vs token Tailwind yang bisa menangkapnya — `text-tac-text-dim` lolos 3 sesi.

### Kanban
- Kartu **D-3 `t_3c1ab35c`** → **`done`**. Sesuai aturan board: dikerjakan manual, status dibiarkan `blocked`, tidak pernah di-`unblock`.

---

## 📝 Session 15 (S15, 2026-10-16) — H-3 tuntas: seluruh halaman ke Tactical Slate

### Ringkasan Eksekusi
- **PlanningBoard** (`public/pages/PlanningBoard.html`, 417 → 424 baris): dirombak total ke Tactical Slate. Komposisi 1:1 pola M-1..M-3 — command bar (chip status + badge OVERDUE/UNASSIGNED) → **dispatch telemetry deck 4 kartu** (`planningKpi`: open queue, active execution + backlog hours, completed + closure rate, schedule risk + unassigned) → filter matrix (search debounce, teknisi, prioritas, RESET) → **kanban 4 kolom dari `planningColumns`** (drag & drop `planningDragStart/planningDrop` dipertahankan, kolom jadi drop target dengan ring) → **timeline/Gantt** bertoken `tac-*` (month quick-nav, header sticky, bar via `planningBarTac`) → WO detail modal. Kartu kanban pakai `[content-visibility:auto]` seperti P4 di WorkOrders.
- **AllLogs** (`public/pages/AllLogs.html`, 129 → 291 baris): dirombak total ke Tactical Slate. Command bar (TEMPLATE / EXPORT / IMPORT / + INPUT LOG) → **activity telemetry deck 4 kartu** (`logKpi`: total records + unit terdampak, open queue, closed logs + closure rate, downtime impact + MTTR) → filter matrix (rentang tanggal + **jenis log baru** `allLogsJenisFilter`) → ledger stream cards (marker jenis, thumbnail, status/WO/priority chips, meta row, notes, aksi edit/hapus/PDF) → infinite scroll sentinel + fallback manual + empty state + floating pill mobile.
- **State & getter baru** (`src/js/app.js`, `src/js/appstate.ts`): `allLogsJenisFilter`; getter `logKpi`, `logJenisOptions`, `planningKpi`, `planningColumns`; helper `logStatusTac`, `logMarkerTac`, `logIconTac`, `logPriorityTac`, `planningStatusTac`, `planningMarkerTac`, `planningPriorityTac`, `planningBarTac`. `filteredAllLogsAll` sekarang juga menyaring `allLogsJenisFilter`.
- **`sw.js`** `CACHE_NAME` → **`mtc-asset-v9`** (fragment `/pages/*.html` berubah ⇒ bump wajib).
- **Rilis tahap 1**: commit `70df0a9` → `git push origin main` → `npx firebase deploy --only hosting` → **live**.

### Lanjutan sesi yang sama — H-3 tahap 2: 10 halaman sisa + HistoryCard (commit `4695bd9`)
- **Halaman yang diporting:** `MTBFMTTR`, `AI`, `AuditTrail`, `KPI`, `MonthlyPlan`, `Performance`, `TechnicianWorkload`, `EnterpriseDashboard`, `EquipmentDetail`, `RequestPart` — plus **`HistoryCard`** yang dipindah dari design system *Industrial Monolith* (`stitch-*`, emas #ffd700, radius 0px) ke Tactical Slate, dan **13 ikon FontAwesome sisa di `WorkOrders.html`** diganti Material Symbols (stepper qty pakai bar yang digambar CSS supaya tidak perlu menambah ligatur ke font subset).
- **Komposisi seragam** di semua halaman: command bar (chip status + h1 + badge) → telemetry deck 4 kartu dari data nyata → filter matrix → ledger/tabel desktop + stream cards mobile → modal/empty state. Halaman chart (`KPI`, `MTBFMTTR`, `EnterpriseDashboard`) memakai kartu `tac-*` dengan `<canvas>` id yang dipertahankan.
- **Helper baru**: `auditKpi`, `auditActionTac/auditMarkerTac/auditIconTac/auditRoleTac`, `perfKpi`, `perfGapTac`, `mpMonthName`, `mpStatusTac`, `mpStatusMarkerTac` (+ deklarasi di `appstate.ts`).
- **Delegasi**: 3 halaman terakhir (`EquipmentDetail`, `RequestPart`, `HistoryCard`) dikerjakan 3 subagent paralel dengan batasan keras *jangan sentuh `app.js`/`appstate.ts`/state baru* supaya tidak ada tabrakan berkas. Hasil mereka diverifikasi ulang di sini (bukan dipercaya begitu saja).
- **Rilis tahap 2**: commit `4695bd9` → push → deploy → **live**. `sw.js` → **`mtc-asset-v10`**.

### Verifikasi tahap 2 (hasil nyata)
- `check-page.mjs` → EquipmentDetail 70 / RequestPart 114 / HistoryCard 88 / WorkOrders 243 ekspresi, **semua 0 syntax error**.
- **Audit lintas-aset** (bukan per halaman): **0 ikon di luar subset lokal** (71 ligatur dipakai, semua ada di `scratch/icons.txt`), **0 kelas `tac-*` yang tidak ter-generate** di `dist/assets/*.css` (131 kelas desain dicek satu per satu), **0 kelas tema lama** (`glass`/`card-modern`/`stitch-*`/`nexus-*`/`btn-nexus*`/`tag-nexus`), **0 ikon FontAwesome**.
- **Diff atribut Alpine lama vs baru** (script): tidak ada binding data yang hilang — semua yang "hilang" adalah string kelas CSS/FontAwesome yang memang diganti. Dua `x-text` HistoryCard yang tampak hilang ternyata hanya diubah kata ("Showing X-Y of Z" → "MENAMPILKAN X-Y DARI Z").
- `tsc` 0 · `eslint .` 0 error / 80 warning (baseline, tidak naik) · `vitest run` **244/244** (10 test baru `tests/h3-tactical-helpers.test.js`) · `vite build` ok (56 entri precache, 3.309 KiB).
- **Build nyata di browser**: 11 halaman dibuka bergantian (login dipaksa + data stub) → **0 error konsol**, 0 overflow, 0 token rusak. Satu `undefined` di RequestPart berasal dari data stub yang tidak lengkap — ekspresi `req.quantity` / `item.quantity` / `req.arrivedDate` **identik dengan versi lama**, jadi bukan regresi.

### Bug yang ketemu & dibetulkan (bukan bagian dari permintaan, tapi ketemu saat audit)
- **`Equipment.html`** memakai ligatur `build` yang **tidak ada di subset font lokal** (84 ligatur) → yang tampil adalah teks "build", bukan ikon. Sudah tampil begitu sejak S14. Diganti `engineering`.
- **`PMSchedule.html` + `src/js/app.js`** memakai kelas `bg-tac-amber`, `bg-tac-amber-muted`, `text-tac-amber` yang **tidak terdefinisi** di `tailwind.config.js` → badge PENDING dan marker kalender tanpa warna sejak S14. Diganti `bg-tac-status-repair` / `bg-tac-status-repair/15` / `text-tac-status-repair`.
- **`AuditTrail.html`** memakai interpolasi Vue `{{ auditShowAll ? 'Admin only' : 'Show all' }}` — Alpine tidak memproses itu, jadi teks mentah muncul di UI. Diganti `x-text`.
- **`EnterpriseDashboard.html`** punya panel "Shutdown Progress" dengan angka hardcoded 85/70/90/60% (bukan dari data) → dibuang.

### Pembersihan sisa design system (commit `e1fe6dd`) — diminta user setelah H-3 tuntas
H-3 menyisakan dua hal yang sudah tidak dipakai siapa pun tapi masih ikut ke bundle. Keduanya dibuang, **net -876 baris** (283 insert / 1159 delete):

- **FontAwesome hilang total.** 76 ikon `<i class="fas fa-*">` di `index.html`, `public/offline.html`, dan 5 modal → Material Symbols lokal. Menu sidebar & tab Analytics Hub sekarang pakai field `ms` (`menuItems[].icon` dan `analyticsTabs[].icon` yang berisi nama FA dihapus); nilai ikon FA di `ui.js`, `logs.js`, `data.js`, `charts.js`, `notification.js`, `enterprise-kpi.js` dikonversi ke ligatur Material. Dependensi `@fortawesome/fontawesome-free` + impor CSS-nya di `src/main.js` + `<link>` CDN di `offline.html` + entri CDN di `sw.js` — semua dicabut. **Precache 3309 → 3226 KiB (-83 KiB).**
- **Mapper FA→Lucide yang mati.** `src/js/icons.js` (89 baris) + `src/js/lucide-icons.js` (706 baris) ternyata **tidak pernah diimpor** di mana pun — sisa dari percobaan sebelumnya. Dihapus.
- **Namespace `stitch` dibuang.** `tailwind.config.js` kehilangan namespace `stitch` + `backgroundImage.stitch-gold`; `src/css/style.css` kehilangan 34 token `--stitch-*` dan 8 utility `.stitch-*` (`.stitch-plate-*`, `.stitch-recessed-well`, `.stitch-btn-*`, `.stitch-ghost-border`) — semuanya 0 pemakai sejak H-3. 34+34 pemakaian kelas `stitch-*` di `index.html` dan `QRScannerModal.html` dipetakan ke token `tac-*`.

**Dua hal yang diperbaiki di alatnya sekalian:**
- `scripts/download-material-symbols.mjs` punya **daftar berkas manual** (hanya 8 berkas) → banyak halaman tidak pernah ikut di-scan, jadi ligatur baru bisa lolos tanpa glyph di font subset dan tampil sebagai teks. Sekarang: scan semua `public/pages/*.html` + semua modal + `index.html` + `offline.html` + `app.js`, lalu **gagal dengan pesan jelas** kalau ada ligatur yang belum ada di allowlist.
- Allowlist ligatur dipindah dari `scratch/icons.txt` (gitignored) ke **`src/css/icon-subset.txt`** yang ikut di-commit — supaya kontraknya bisa ditegakkan tes.

**Tes penjaga baru:** `tests/icon-contract.test.js` (12 tes) — setiap `menuItems`/`analyticsTabs` wajib punya `ms` yang ada di subset, setiap ligatur di halaman/modal wajib ada di subset, fallback `.ms || '…'` wajib ligatur subset, 0 tag FA, 0 binding `'fas ' + …`, 0 nilai `fa-*` di JS, 0 dependensi `@fortawesome`, 0 token/kelas `stitch-*`. Suite naik **244 → 256**.

**Bug yang ketemu saat pembersihan ini (dan dibetulkan):**
- Regex pembersih sempat menghapus `icon` dari `analyticsTabs` **dan** menyisipkan `ms` ke entri `menuItems` yang sudah punya `ms` → 5 properti `ms` ganda (`TS1117`, 5 error eslint). Efeknya nyata: **tab Analytics Hub kehilangan ikon** karena `tab.ms` = `undefined`. Ketemu bukan dari tes (objek dengan kunci ganda tetap legal saat runtime) tapi dari verifikasi browser — `x-text="tab.ms"` tidak pernah terisi. Setelah dibetulkan: 5 tab render `trending_up / show_chart / psychology / factory / neurology` di 18px.
- Fallback `item.ms || 'circle'` (3 tempat) memakai ligatur `circle` yang **tidak ada** di subset → diganti `menu`.

### Pemetaan desain → data nyata (tidak ada angka karangan)
| Modul | Sumber nyata |
|---|---|
| Planning: OPEN QUEUE | `planningWOs` Status `Pending`/`Draft` |
| Planning: ACTIVE EXECUTION + BACKLOG HOURS | Status `In Progress`; Σ `estimatedHours` WO belum Completed/Cancelled |
| Planning: COMPLETED + CLOSURE RATE | Status `Completed`; completed/total |
| Planning: SCHEDULE RISK | `dueDate < today` dan status belum selesai; `unassigned` = tanpa `assignedTo` |
| AllLogs: TOTAL RECORDS + UNIT TERDAMPAK | `filteredAllLogsAll.length`; `new Set(EquipmentID).size` |
| AllLogs: DOWNLOAD/MTTR | Σ `Downtime`; MTTR = Σ downtime breakdown ÷ jumlah breakdown |
| AllLogs: closure | Completed ÷ total |

### Verifikasi (hasil nyata, bukan klaim)
- `node scratch/check-page.mjs public/pages/PlanningBoard.html` → **119 ekspresi, 0 syntax error**; `AllLogs.html` → **73 ekspresi, 0 syntax error**.
- `npm run typecheck` **0** · `npm run lint` **0 error / 80 warning** (baseline, diverifikasi dengan `git stash` — perubahan ini menambah 0 warning) · `npm run test:run` **234/234** (10 test baru) · `npm run build` ok (**56 entri precache, 3.196 KiB**).
- Test baru: `tests/planning-kpi.test.js` (5 test: `planningKpi`, `planningColumns`, filter teknisi/prioritas/search, helper badge) + blok baru di `tests/alllogs-pagination.test.js` (5 test: filter jenis, `logJenisOptions`, `logKpi`, kasus kosong tanpa NaN, helper badge).
- Harness browser (`node scratch/make-harness.mjs <page>` — kini menerima argumen path halaman; stub state diperluas untuk planning + logs) → **0 error konsol**, PlanningBoard 4 kartu kanban / 5 baris Gantt / 4 bar / modal detail isi data nyata; AllLogs 4 kartu stream, 0 `undefined`/`NaN`.
- **Build nyata di browser** (`python -m http.server` di `dist/` + paksa `isLoggedIn`, data stub): `main` `rgb(13,20,29)` · kartu `rgb(22,29,39)` · h1 `26px/600` (headline-lg) · **0 overflow** (`main.scrollWidth === main.clientWidth`) · 0 token rusak · `document.fonts.check('18px "Material Symbols Outlined"')` = true (font lokal) · 0 error konsol. Filter jenis All Logs 4 → 3 log dan `logKpi` ikut terhitung ulang (downtime 12 h, MTTR 4 h, biaya Rp 3,75 jt). Timeline Planning 5 baris / 4 bar, modal detail menampilkan nama equipment hasil resolve (`Belt Conveyor CV-104`).
- **Ikon**: 34 ligatur dipakai di dua halaman ini, **0 di luar subset lokal** (dicek terhadap `scratch/icons.txt`, 84 ligatur).
- **Kelas Tailwind**: 45 kelas `tac-*` yang dipakai dicek langsung di `dist/assets/*.css` — semuanya ter-generate.
- **Live**: `curl -s https://mtc-asset.web.app/pages/PlanningBoard.html | grep -c "Tactical Slate"` = **1**, `.../AllLogs.html | grep -c "MAINTENANCE ACTIVITY STREAM"` = **1**, `sw.js` = **`mtc-asset-v9`**.

### Pelajaran
- **`write_file` menolak menimpa file yang belum dibaca penuh** — `rm` dulu (berlaku juga untuk `scratch/make-harness.mjs`). Simpan salinan lama ke `scratch/*.prev.html` sebelum `rm`.
- **`patch` dengan `old_string` sebaris gagal** kalau baris target terlalu pendek/unik-nya tipis — sertakan satu baris konteks berikutnya.
- `tsc` tetap memeriksa `src/js/app.js`: semua callback `.filter`/`.reduce` di atas nilai bertipe `any` **wajib** `/** @type {any} */` pada parameternya (kali ini 12 error TS7006 muncul dan langsung dibereskan).
- **Kelas Tailwind yang disusun di runtime tidak akan ter-generate.** Jangan `planningMarkerTac(x) + '/40'` — Tailwind memindai literal di source, jadi opacity harus ikut tertulis di string literal (`planningBarTac` mengembalikan `bg-tac-status-repair/40 border-tac-status-repair/60` utuh).
- Untuk verifikasi build nyata, `x-page` hanya ter-mount saat `currentPage` cocok; id halaman All Logs = **`hist`**, Planning Board = **`planning`** (lihat `index.html`).
- Baseline lint repo sebenarnya **80 warning** (bukan 79 seperti catatan S13) — diverifikasi lewat `git stash push` + `npx eslint .`.

### Kanban
- Kartu **H-3 `t_d463afbb`** → **`done`**. Cakupannya ("PlanningBoard + AllLogs + halaman sisa") sudah tuntas: 18/18 halaman `public/pages/` kini Tactical Slate.
- **D-2 `t_4bb41514`** (keputusan arah desain) — pertanyaannya **sudah terjawab oleh implementasi**: 0 halaman bertema lama. Tinggal diputuskan user apakah kartunya ditutup; token `stitch-*` masih tersisa di `tailwind.config.js` + `src/css/style.css` sebagai kandidat pembersihan.
- **H-1 `t_47ae7fe6` / H-2 `t_4fd650a6`** — cakupannya (WorkOrders+Equipment / PMSchedule+SpareParts) sudah terpenuhi lewat M-1/M-2/M-3 + WO-1; belum di-`complete` karena bukan pekerjaan sesi ini.
- Kartu lain tetap: D-3 `t_3c1ab35c` · Q-1 `t_e6dd5987` · Q-2 `t_e5b00df8` · Q-3 `t_22172e91`.

---

## 📝 Session 14 (S14, 2026-10-16) — Porting M-1, M-2, M-3 ke Tactical Slate

### Ringkasan Eksekusi
- **M-1 (Equipment)**: `public/pages/Equipment.html` dirombak total ke Tactical Slate. Telemetry deck 4 kartu (`equipCounts`, `equipKpi`), filter search/status/kategori, table & mobile cards, pagination `equipLimit: 30`, dan form modal diselaraskan. (`t_6d932c5b` Done).
- **M-2 (Spare Parts)**: `public/pages/SpareParts.html` dirombak total ke Tactical Slate. KPI deck riil (`partKpi`: valuasi Rp, total SKU, low stock, rasio kesehatan stok), filter multi-kriteria, stock badges, pagination `partLimit: 30`, dan modal transaksi. (`t_78639db4` Done).
- **M-3 (PM Schedule)**: `public/pages/PMSchedule.html` dirombak total ke Tactical Slate. Header command bar, view toggle switcher (List, Calendar, Gantt), KPI deck 4 kartu (`pmGetStats`), filter search + priority, desktop table & mobile cards, responsive calendar view + day popovers, directive CRUD modal, dan detail modal + live BOM stock check. (`t_d5c31343` Done).
- **PWA Font Offline (D-4)**: Ligatur Material Symbols Outlined dibundel lokal di `public/fonts/material-symbols-outlined.woff2` (336 KB) dan diprecache Service Worker. Cache bump `mtc-asset-v8`.
- **Verifikasi**: `tsc --noEmit` bersih 0 error, 224 unit tests pass, Vite production build sukses 0 error.

---

## 📝 Session 13 (S13, 2026-10-16) — Menu Work Orders diporting ke 'Work Orders Ledger' (Tactical Slate)

### Konteks
- Lanjutan S12. User mengirim **markup asli** screen Stitch "Work Orders Ledger" (project `2861085646384681595`, "Work Order Orchestration & Dispatch") dan minta menu Work Orders mengikuti desain itu.
- Screen ini **belum ada** di `design/stitch/` — `stitch-work-order-protocol.html` yang ada di sana adalah screen **lain** ("PROTOCOL V3"). Jadi markup dari user = satu-satunya sumber, dan porting dari screenshot tidak diperlukan sama sekali.

### Yang dikerjakan
- `public/pages/WorkOrders.html` ditulis ulang **531 → 947 baris**, komposisi 1:1 dengan markup desain:
  1. PWA / Offline Sync strip → 2. breadcrumb + control sub-bar (EXPORT AUDIT CSV, + CREATE NEW WO) → 3. KPI deck 4 kartu → 4. search/filter matrix + view switcher + status tabs + sektor/prioritas + rentang tanggal → 5. Maintenance Log Console (collapsible, form lama) → 6. workspace 12 kolom (kiri 8: **Ledger Stream** / **Kanban Stack**; kanan 4: **Inspector HUD** + NEXT IN QUEUE) → 7. loading/empty → 8. floating create pill (mobile).
- Form **Maintenance Log Console** (hasil porting Monolith S-4) dipertahankan utuh secara fungsi — hanya token kelasnya dimigrasikan `stitch-*` → `tac-*` lewat skrip `scratch/stitch2tac.sed` (diikuti pembersihan bentrok `text-lg`/`text-xl` vs `font-headline-*`).
- State & getter baru (`src/js/app.js`, `src/js/appstate.ts`): `woView`, `woSectorFilter`; `woFiltered`, `woKanbanColumns`, `woSelected`, `woNextInQueue`, `woCounts`, `woKpi`, `woSectorOptions`, `woDowntimeSpark`; helper `woSectorOf`, `woParts`, `woPhotos`, `woStatusTac`, `woPriorityTac`, `woMarkerTac`, `woElapsed`, `rp`, `rpShort`.
- `sw.js` `CACHE_NAME` → **`mtc-asset-v5`** (aturan tetap: fragment `/pages/*.html` berubah ⇒ bump cache).

### Pemetaan desain → data nyata (tidak ada angka karangan)
| Modul desain | Sumber nyata di app |
|---|---|
| `SEKTOR: COMMINUTION SECTOR B` | `equipment.Lokasi` (`woSectorOf` / `woSectorOptions`) |
| `Mean Time To Repair` | rata-rata `Downtime` log `Jenis === 'Breakdown' \|\| 'Repair'` |
| `Downtime Loss Impact $14,250` | Σ `Cost` (label `Rp`, format padat `jt/M/T`) + sparkline `performanceData.bd + stb` |
| `Staged Spares 18 / IDR 342,000,000` | Σ qty `PartsUsed` WO terbuka × `parts.Harga` |
| `LOTO #882 ENGAGED` | **tidak ada di app** → diganti badge AGING / OVERDUE yang nyata |
| `BATCH DISPATCH` | **tidak ada fitur** → dibuang, diganti aksi nyata (EXPORT CSV, + CREATE NEW WO) |
| view `GANTT / TIMELINE` | **dibuang** — butuh jadwal bar yang tidak ada di data; Planning Board sudah jadi timeline-nya |
| `PROOF PHOTOS (3)` | `PhotoURLs` / `PhotoURL` log |
| `Ajeng AI Neural Root Cause 96.4%` | field `rca` log + `Catatan` (persentase keyakinan = angka desain, tidak dipakai) |

### Verifikasi (hasil nyata, bukan klaim)
- `node scratch/check-page.mjs public/pages/WorkOrders.html` → **240 ekspresi Alpine, 0 syntax error**.
- `npm run typecheck` **0** · `npm run lint` **0 error / 79 warning** (baseline) · `npm run test:run` **224/224** · `npm run test:rules` **34/34** · `npm run build` ok (65 entri precache, 3.482 KiB).
- Harness `scratch/harness.html` (stub state diperbarui: `make-harness.mjs` kini memakai token `tac-*`) → **0 error konsol**; klik PROOF membuka inspector, KANBAN STACK menampilkan 4 kolom, tab PENDING menyaring kartu.
- **Build nyata di browser** (`python -m http.server` di `dist/` + paksa `isLoggedIn`, data stub): `main` `rgb(13,20,29)` · kartu `rgb(22,29,39)` · h1 `26px/600` (headline-lg) · pill emergency `rgb(239,68,68)` · teks emas `rgb(255,193,116)` · `document.fonts.check('18px "Material Symbols Outlined"')` = true · **0 overflow** (`main.scrollWidth === main.clientWidth`) · 0 token rusak (`undefined`/`NaN`/`[object Object]`).
- Nilai KPI dihitung kode nyata, bukan stub: 4 WO → 3 aktif · MTTR 4,0 jam · spares 6 pcs / Rp 7.500.000 (3 WO terbuka × qty 2 × Rp 1.250.000).

### Pelajaran
- **`write_file` menolak menimpa file yang belum dibaca penuh** — solusinya `rm` dulu (kasus `scratch/make-harness.mjs`).
- Menyisipkan blok HTML besar hasil migrasi token: pecah jadi `head` + `blok-lama-migrasi` + `tail` di `scratch/`, lalu `cat` → file final. Jauh lebih hemat daripada menulis 950 baris sekaligus.
- `tsc` **memang memeriksa `src/js/app.js`** meski `checkJs: false`; callback di atas nilai bertipe `any` (mis. `this.woFiltered`) memicu `TS7006` dan wajib diberi `/** @type {any} */` pada parameternya.
- Angka rupiah di kartu KPI hero (36px) bisa meluber — pakai format padat (`Rp 77,8 jt`) dengan nilai penuh di baris bawah.

### Kanban
- Kartu tetap seperti S12: D-2 `t_4bb41514` (gate, masih `blocked`) · D-3 `t_3c1ab35c` · D-4 `t_1f747d46` · Q-1 `t_e6dd5987` · Q-2 `t_e5b00df8` · Q-3 `t_22172e91` · H-1/H-2/H-3 `t_47ae7fe6`/`t_4fd650a6`/`t_d463afbb`.
- Pekerjaan WO-1 ini **belum punya kartu** (sama seperti D-1/D-1b) — belum diputuskan user. Catatan detail ada di `TASK-REVIEW.md` bagian **Gelombang 12**.

### Sisa / berikutnya
- **WO-2**: footer status strip global (`h-10`) dari markup desain belum dipasang di `index.html` (sidebar desain memakai `top-16 bottom-10`).
- D-2 masih gate: halaman Work Orders kini **sudah** Tactical, jadi tinggal 3 halaman Monolith + 13 halaman lama.

### Lanjutan sesi yang sama — audit performa (P1 + P2)

User bertanya *"apa nantinya sistem ini tidak berat di desktop dan di mobile phone"*. Diukur, bukan ditebak:

**First load produksi (terkompresi, cache dimatikan):** total **± 512 KB** · `sentry` 119 KB · `jspdf` 114 KB · `vendor` 83 KB · `firebase` 74 KB · `main.js` 53 KB · `vendor.css` 18 KB · `alpine` 14 KB · DCL 2,1 s. Precache SW **3,48 MB / 65 entri** (ikut `xlsx` 415 KB + `html2canvas` 195 KB).

**Runtime halaman Work Orders (benchmark 200 WO, build nyata):**

| Metrik | Sebelum | Sesudah |
|---|---|---|
| Render pertama, desktop | 1.400 ms | **177 ms** |
| Render pertama, CPU mobile 4× | 7.793 ms | **2.619 ms** |
| DOM node (`main`) | 13.842 | **2.455** |
| JS heap | 142 MB | **35 MB** |

**P1 — batas render.** `woLimit: 30` + getter `woVisible` / `canLoadMoreWO` + `loadMoreWO()`; pola sama `allLogsLimit` di All Logs. Ledger **dan** kanban memakai `woVisible`. Tombol `MUAT LEBIH BANYAK (N LAGI)`; penghitung jadi `30 / 200 RECORDS`. Terverifikasi: klik berturut-turut → 30 → 60 → 90 → 120 kartu, 0 error konsol.
**P2 — memo getter.** `woFiltered` di-cache pada (filter key + referensi `logs`) — sebelumnya satu render memanggil filter+sort puluhan kali (`woKanbanColumns` ×4, `woSelected`, `woNextInQueue`, `woVisible`). `woCounts` dan `woKpi` juga di-cache; map `allParts` dipindah ke `partsMap()` yang di-cache (dulu `new Map(allParts)` dibangun ulang **per kartu**).

**Selesai dikerjakan (P1 s.d. P5 + WO-2):**
- **WO-2**: Footer status strip global `h-10` desktop dipasang di `index.html` (LATENCY, SYNC, PAGE, USER, CORE v1.0.0, FAST SYNC). Nav sidebar dan main padding diselaraskan.
- **P3**: `jspdf` terlepas dari entry bundle (Vite 8 Rolldown `advancedChunks` isolasi `preload-helper`). Sentry diturunkan dari top-level `await import` ke background deferred loader via `requestIdleCallback` dengan synchronous backlog buffer. Initial scripts load turun dari >20 file menjadi 6 file bersih.
- **P4**: `content-visibility: auto` + `contain-intrinsic-size` aktif di kartu ledger Work Orders.
- **P5**: Precache diet menjadi 55 entri (3.127 KB).
`sw.js` `CACHE_NAME` → **`mtc-asset-v7`**.

### Update Sesi S13 Lanjutan — D-4 (Material Symbols Offline) Selesai
- Ikon **Material Symbols Outlined** resmi disubset dan disimpan lokal di `public/fonts/material-symbols-outlined.woff2` (336 KB) mencakup seluruh 84 ligatur yang dipakai di app.
- Link CDN `fonts.googleapis.com` untuk Material Symbols di `index.html` dicabut. `@font-face` dideklarasikan di `src/css/tactical-icons.css`.
- `vite.config.js` menyertakan `fonts/*.woff2` ke manifest SW → ter-precache otomatis.
- Teruji langsung di browser dengan network offline/blocked ke Google Fonts: seluruh ikon tetap ter-render sebagai icon glyph sempurna (bukan teks fallback).
- Cache bump ke **`mtc-asset-v8`**. Kartu `t_1f747d46` (D-4) ditandai **`done`**.

---

## 📝 Session 12 (S12, 2026-10-15) — Gelombang 9 Stitch tuntas + Dashboard 'Tactical Slate' (rebuild 1:1 dari markup)

### Konteks
- Lanjutan: menyelesaikan porting desain Google Stitch ke app, lalu Dashboard.
- Screen target: project `2861085646384681595` screen `f88b02d0cb` (DESKTOP 2560×3304, "Tactical Slate & Luminous Gold") + project `15538611438628478374` ("The Industrial Monolith").

### Selesai hari ini
- **Gelombang 9 tuntas (S-1…S-5, The Industrial Monolith)** — S-1 token harmonisasi (`t_a3c6e344`), S-2 SpareParts (`t_1c352dc1`), S-3 HistoryCard (`t_5604054d`), S-4 WorkOrders (`t_0da5991d`, commit `129851a`), S-5 modal QR scanner (`t_40bacf60`, commit `68396f4`).
- **Akses Stitch jalur A**: `gcloud auth login` akun `adhymlb@gmail.com` + enable `stitch.googleapis.com` di quota project `gen-lang-client-0051799821`. `scripts/stitch-bridge.js` jadi multi-project (env `STITCH_ACCOUNT` / `STITCH_QUOTA_PROJECT`, commit `97ee879`); 8 screen ditarik ke `design/stitch/`.
- **Dashboard port pertama** (commit `41ec36c`) → dinilai user *"jauh dari kata mirip"*.
- **Dashboard rebuild 1:1 dari markup Stitch** (commit `497969f`, live) — akar masalah: port pertama hanya meniru *bahasa visual*, bukan **komposisi modul**. Detail lengkap: `diary/2026/10/2026-10-15-MTC-Asset.md` bagian **D-1b**.

### Perubahan teknis inti (commit `497969f`)
- `tailwind.config.js`: namespace `tac` = salinan **1:1 design system Stitch** (surface/primary/secondary/tertiary/on-*/gold/status-*/sync-cyan/outline/border) + skala `fontSize` & `spacing` asli desain (`display-hero` 36/44 −0.02em, `label-mono-sm` 10/14 0.1em, `p-space-md`, `px-gutter-desktop`). Prefix `tac-` dipakai supaya tidak menimpa `primary: var(--nexus-accent)` milik app.
- `index.html` + `src/css/tactical-icons.css` (baru): **Material Symbols Outlined** (ikon resmi desain).
- `public/pages/Dashboard.html` ditulis ulang (~700 baris) mengikuti **urutan modul markup Stitch**: banner PWA → KPI 4 kartu → workspace 12 kolom (kiri 8: Maintenance Activity Protocol + Neural Performance Protocol + distribusi log; kanan 4: System Access + Optical Scanner + Critical Spare Parts) → drawer Ajeng AI Diagnostics → status strip.
- State baru: `dashWoFilter` + `aiDrawerOpen` (`src/js/modules/ui.js` + `src/js/appstate.ts`).
- **BUG diperbaiki**: KPI Fleet Integrity selalu **0%** karena memakai `Status === 'Operational'`; kosakata app sebenarnya `'Active' | 'Running'` (`enterprise-kpi.js:174`).

### Verifikasi (hasil nyata, bukan klaim)
- `npm run typecheck` 0 · `lint` 0 error / 79 warning · `test` **224/224** · `test:rules` **34/34** · `build` ok (65 precache, 3.443 KiB).
- `node scratch/check-page.mjs public/pages/Dashboard.html` → 136 ekspresi Alpine, **0 syntax error**.
- Harness browser `scratch/dashboard-harness.html` → **0 error konsol**, 0 `undefined`/`NaN`/`[object Object]`; filter `CV-104` → 1 kartu; klik Ajeng AI Node → drawer tampil; KPI `66.7%` / `2 / 3 Operational`; kartu WO lengkap; tabel 8 kolom terisi.
- Live `https://mtc-asset.web.app` — bundle `assets/main-DAl9SuYS.js` + `assets/main-CqTPtLGe.css`; CSS live memuat `.bg-tac-surface-card{rgb(22 29 39)}`, `.text-tac-gold-bright{rgb(251 191 36)}`, `.material-symbols-outlined`.

### Kanban
- **Baru**: D-2 `t_4bb41514` (prio 80 — gate arah desain) · D-3 `t_3c1ab35c` (64 — palette theme-aware) · D-4 `t_1f747d46` (62 — Material Symbols offline). Semua `blocked` (kerja manual, jangan `unblock`).
- Terbuka lama: Q-1 `t_e6dd5987`, Q-2 `t_e5b00df8`, Q-3 `t_22172e91`, H-1/H-2/H-3 `t_47ae7fe6`/`t_4fd650a6`/`t_d463afbb`.
- D-1/D-1b (porting + rebuild Dashboard) **belum punya kartu** — belum diputuskan user.

### Rename branding
- **`Ajeng AI` → `MTC AI`** (commit `6f400b2`): label Dashboard jadi `MTC AI Node` + `MTC AI Diagnostics`, dan `MTC AI Settings` di `index.html` + `public/components/modals/APISettingsModal.html`.
- Arsip desain `design/stitch/*.html` **sengaja TIDAK diubah** — itu screen asli Stitch, masih menulis "Ajeng AI"; jangan dipakai sebagai sumber label UI lagi.
- Verifikasi: `grep -rin ajeng` di luar `design/` = 0 hasil · typecheck 0 · test 224/224 · build ok.

### Bug deploy: UI tidak berubah walau sudah di-push (commit `7505be3`)
User lapor **"belum berubah"** setelah rename — padahal `curl` ke live sudah menunjukkan label baru. Akar masalahnya BUKAN browser user:

1. `/pages/**` disajikan dengan `Cache-Control: max-age=3600` → fragment di-cache browser sampai 1 jam. Fragment **tidak punya hash di nama file**, jadi `max-age` panjang = UI basi.
2. `sw.js` handler `/pages/**` memakai `fetch(event.request)` biasa → **boleh dilayani HTTP cache**, jadi respons basi ikut di-`cache.put` ulang ke SW cache (basi jadi permanen).
3. `CACHE_NAME` masih `mtc-asset-v3` → `activate` tidak membuang precache lama (fragment basi tetap ada).
4. `cache.add(url)` saat install juga lewat HTTP cache → precache bisa menyalin salinan basi.

**Perbaikan:** `firebase.json` tambah header `/pages/**` → `no-cache` · `CACHE_NAME` → **`mtc-asset-v4`** · install pakai `cache.add(new Request(url, { cache: 'reload' }))` · handler `/pages/**` pakai `fetch(request, { cache: 'no-store' })` (fallback cache saat offline tetap jalan).
**Diverifikasi live:** `/sw.js` = `mtc-asset-v4` + `no-store` · `/pages/Dashboard.html` → `Cache-Control: no-cache` · `/assets/*` tetap `immutable`.
**Pelajaran:** setiap kali menambah/mengubah fragment `/pages/*.html`, **naikkan `CACHE_NAME` di `sw.js`** — kalau tidak, user lama tetap melihat versi basi walau live sudah benar.

### Chrome app disamakan dengan desain Stitch (commit `a19362e`)
User: *"sidebar menu, header bar belum sama. backgroundnya juga tidak sama."* → chrome global (`index.html`) disetel ke design system Stitch.

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Sidebar | `bg-nexus-black/40` + `backdrop-blur-2xl`, lebar w-72/w-24, ikon FontAwesome, item aktif = teks emas + border kanan | `bg-tac-surface-container-lowest` **#080f18**, lebar **w-64/w-20**, ikon **Material Symbols**, label grup uppercase mono, item aktif = **pill emas #f59e0b** + teks `on-primary-container` |
| Header | `glass` tinggi bebas, judul halaman, dropdown tema, ikon bulat | **h-16** `bg-tac-surface-base/90` backdrop-blur: brand **MTC ASSET + "Industrial Telemetry Core"**, chip `ONLINE - SYNCED` + `PWA READY / PAGE: X`, kotak cari menu + `Ctrl+K`, `+ NEW WO`, **pills GOLD/NAVY/PURPLE/LIGHT**, bell, ikon util, identitas role |
| Background | `--nexus-bg: #05070a` (night) | `--nexus-bg: **#0d141d**` (surface Stitch) + `<main>` `bg-tac-surface` |
| Ikon | FontAwesome saja | `menuItems` dapat properti **`ms`** (nama ikon Material Symbols); FontAwesome tetap untuk nav mobile & drawer |

State baru: **`menuSearch`** + getter **`filteredMenuGroups`** (kotak cari di header memfilter menu sidebar; Ctrl+K fokus ke sana). Bell notifikasi pindah dari sidebar ke header (sesuai desain).

**Verifikasi (dist build di browser nyata, `python -m http.server` + paksa `isLoggedIn`):** sidebar `rgb(8,15,24)` 256px · header `rgba(11,15,21,.9)` 64px · main `rgb(13,20,29)` margin-left 256px · item aktif `rgb(245,158,11)` / teks `rgb(97,59,0)` · font Material Symbols ter-load (`document.fonts.check` = true) · 7 menu tampil untuk role `user`. Lalu: `typecheck` 0 · `lint` 0 error · `test` 224/224 · `build` ok. Live dicek: `/index.html` memuat `Industrial Telemetry Core`, `Cari menu / halaman`, `filteredMenuGroups`, `PWA CACHE`; CSS live `--nexus-bg:#0d141d`.

### Pelajaran
- **Kalau markup sumber desain bisa didapat, JANGAN porting dari screenshot.** Vision atas screenshot berulang kali halusinasi (pernah "membaca" `NETGUARD`, `OEE Forecast`, `Total Cycles`, tanggal `2024-01-xx` — tidak ada di desain maupun di app). Kalau perlu teks dari gambar: **crop region kecil**, jangan gambar penuh.
- `write_file` menolak menimpa file yang belum dibaca penuh di konteks berjalan → untuk rewrite total: backup ke `scratch/`, `rm`, lalu tulis.
- Harness stub harus ikut ditambah setiap ada state baru; kalau tidak, `x-for`/`x-if` gagal **senyap** (tanpa error konsol) dan tampak seperti bug halaman.
- Tailwind v3: warna berbasis `var()` tidak mendukung opacity modifier → token desain pakai **hex literal**.

### Besok
- Putuskan **D-2** (arah desain) → membuka H-1/H-2/H-3.
- Kerjakan **D-3** (Dashboard ikut tema light) dan **D-4** (ikon offline).

---

## 📝 Session 11b (S11b, 2026-08-09) — Dashboard Upgrade & Low Stock Fix

### Konteks
- Lanjutan S11 — semua 4 phase roadmap sudah live, sesi ini fokus polish dashboard + fix inkonsistensi

### Dashboard Upgrade (13a59cb)
- **Alert Zone**: 3 kartu warning (PM Overdue merah, WO Aging > 3d amber, Spare Low Stock orange) — klik navigasi ke page terkait, ping dot saat ada masalah
- **KPI Row**: MTBF (dari kpi-engine, delta HM), MTTR, Availability %, Breakdown — 4 kartu berwarna
- **Cost Trend chart** di dashboard: grid 3:2 (Reliability 3-col + Cost 2-col) — reuse calcCostTrend di renderDashboardCharts

### Low Stock Konsistensi Fix (022310e)
- **BUG ditemukan**: checkLowStockParts() (notif 2-tier: stok 0 merah + ≤MinStock kuning) SUDAH ada tapi TIDAK pernah dipanggil — tak ter-wire di checkAllNotifications
- Fix: wire ke checkAllNotifications + samakan threshold semua sumber ke `Stok <= MinStock && MinStock > 0`
- 4 sumber kini konsisten: card spare, dashboard alert, notif, auto-reorder

### Dashboard Redesign "Industrial Command Center" (895fe14)
- **Stat cards (5)**: per-stat icon (industry/check/heartbeat/boxes/clipboard), gradient wash + accent line atas, progress bar REAL (pct dari data: WO rate, health, PM compliance), icon watermark besar
- **calculatedStats** kini punya metadata design: colorHex, icon, pct — dipakai template
- **Alert zone**: border glow colored + shadow, pulse dot animate-ping, chevron translate hover, gradient sweep
- **KPI row**: icon shadow glow per warna
- **Charts**: sub-label count (assets/tasks/Last 7 days/Monthly), canvas glow saat hover card
- **Entrance**: staggered dashRise animation (0.03s delay/card) via #page-dash CSS — id ditambahkan di index.html wrapper
- CSS baru di style.css: #page-dash .card-modern animation, chart hover glow

### Deploy & Status
- Deploy hosting live: https://mtc-asset.web.app (HTTP 200 verified)
- Test 103/103 pass, build clean
- Push: origin/main up-to-date (895fe14 latest)
- **Browser verify GAGAL**: browser_subagent error "No active credentials for provider: antigravity" — model credentials issue, perlu retry manual

### Teknis yang Dipelajari
- calculatedStats = sumber metadata design (icon/colorHex/pct) — template dashboard baca langsung, jangan hardcode di HTML
- calcCostTrend() sudah ada di scope app (enterprise module) — reuse utk dashboard, jangan duplikasi logika
- CSS entrance animation pakai #page-dash wrapper (x-if template perlu id agar CSS selector jalan)
- Template literal backtick + ${} di .mjs patch script tetap jadi SyntaxError — selalu pakai concat

### Backlog / Next
- [ ] Quick action bar (P3 rekomendasi design — +Log, +PM, +Asset, Export)
- [ ] PM widget warna overdue/normal (P3)
- [ ] Retry browser verify dashboard visual
- [ ] Cek deploy workflow .github (line-ending)
- [ ] Backup otomatis 02:00 WIB verifikasi

---

## 📝 Session 11 (S11, 2026-08-09) — Roadmap 4 Phase Tuntas

### Konteks
- User minta analisis mendalam sebagai maintenance planner → 4 phase roadmap (A: data, B: analitik, C: operasional, D: skala)
- Semua phase dieksekusi + deploy live hari ini

### Phase A — Data & Cleanup (63fcddb)
- Seed data riil: 15 logs (10 breakdown + 5 PM), 80 Performance, PM schedule 150+
- Migrasi FotoURL base64 → ImgBB: 14 equip, 0 gagal (fix HTML entity &#x2F;)
- Hapus PerformanceModal.html duplikat (modal asli di index.html)

### Phase B — Analitik (88e2ea3)
- Wire HM → MTBF: _breakdownEvents gabung logs+Performance, delta HM (fallback kalender)
- generateNextPM otomatis saat load (PM completed ≤30 hari tanpa next)
- Cost trend sudah ada — kini terisi data riil

### Phase C — Operasional (5e805b9)
- WO aging alert: notif pending > 3 hari (badge umur sudah ada)
- Auto-reorder low stock: Stok<=MinStock → requisition otomatis (skip pending)
- Audit trail aktif: logAudit di 6 module CRUD + rules AuditTrail baru
- Normalisasi: helper equipIdOf() + fix rules PM .indexOn EquipmentID→equipmentId

### Phase D — Skala (2ca2b79)
- Export Excel multi-sheet: 7 sheet (Equip, Parts, Logs, Perf, PM, Req, Summary) + tombol header
- Warranty/lifetime check: notif part melewati avgLifetimeDays
- Offline conflict: last-write-wins (skip overwrite server lebih baru)
- Equipment hierarchy: tree view Area → Tipe → Asset (toggle Equipment page)

### Deploy & Status
- Deploy: hosting + database rules live (https://mtc-asset.web.app)
- Test: 103/103 pass, build clean
- Push: origin/main up-to-date (22 commit dari sesi)
- Backup otomatis 02:00 WIB — masih perlu verifikasi GitHub Actions

### Known Issues / Backlog
- [ ] Cek deploy workflow .github (line-ending modified)
- [ ] Backup otomatis harian — verifikasi GitHub Actions jalan
- [ ] Assign teknisi ke WO nyata (seed pakai uid admin/supervisor)
- [ ] Data PM seed: frequency 'monthly' semua — next PM auto-gen menghasilkan banyak pending (evaluasi)

### Teknis yang Dipelajari
- Script seed butuh auth (rules write ketat) → SEED_ADMIN_PASS env, jangan hardcode
- FotoURL di RTD pakai HTML-encoded base64 (&#x2F;) → decode sebelum upload ImgBB
- Modal Performance asli di index.html, bukan components/modals/ (duplikat)
- Template literal backtick + ${} di dalam .mjs patch script → SyntaxError; pakai concat
- Firebase rules .validate multi-line → JSON.parse node gagal, tapi valid utk Firebase CLI

---

# Session Notes — 2026-08-09 (Session 10: Fix Batch + Data Linking + KPI Charts)

## Ringkasan

**Batch fix bug: MTBF/MTTR chart missing, FotoURL invalid (SW error), Performance field linking (equipmentId lowercase), Enterprise KPI data riil, KPI chart canvas sync + modern style, deploy config (Spark plan), Performance form standby/WH auto.**

---

## Baru di Session Ini

### 🐛 Fix: MTBF/MTTR page (06a2e54)
- renderMTBFMTTRChart() + _monthKey() hilang — page referensi fungsi tak ada → tambah di charts.js (trend 6-bulan, lazy chart.js)
- calcMTBFMTTR() getter (mtbfDays/mttrHours/totalEvents)
- cleanUrl() validasi ketat — reject non-http/data/blob + bracket → cegah request invalid

### 🖼️ Fix: FotoURL cleanup (5219f93, b6d2153)
- Scan DB: 17 FotoURL → 12 valid (data URI base64 + i.ibb.co), **5 kosong dihapus**
- Bug database:remove butuh --force (tanpa itu CLI prompt & silent fail)
- Script reusable: scripts/fix-clean-fotourl.mjs

### 🔗 Fix: Performance field linking (1fd984f, 3ed48de)
- **Root cause**: Performance node pakai equipmentId (lowercase), kode filter p.EquipmentID → tak pernah match → data diabaikan
- Fix: (p.equipmentId || p.EquipmentID) di app.js calcMTBFMTTR, charts.js, enterprise-kpi.js (8 refs)
- MTBF/MTTR kini: sum(wh)/sum(freq) atau events dari Performance, fallback HistoryLog

### 📊 KPI Chart kosong (2b54760)
- **Root cause**: KPI.html pakai ID canvas lama (kpiPaVsActual, kpiAreaPa...), renderer cari mtbfChart, mttrChart → tak match → semua Canvas not found
- Fix: page disinkronkan 1:1 ke renderer (9 canvas)
- charts.js: 12 refs p.EquipmentID → (p.equipmentId || p.EquipmentID)

### 🎨 KPI Chart modern + label nama (4a24f35)
- Label pakai getEquipName: "Jaw Crusher" bukan 2220-CR-001
- Style: _gradFill gradient, rounded bars, tension 0.45, point hover radius 6

### 📝 Form Performance (f856589)
- Standby manual dihormati (sebelumnya di-overwrite event)
- WH auto = 24 - bd - stb
- Event Operational = sumber stb otomatis; bd/freq = non-Operational only

### 🚀 Deploy config (4ee333f)
- Hapus functions dari firebase.json — project Spark plan → deploy gagal butuh Blaze

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S10 full batch | ✅ live | 74 files |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 06a2e54 | fix: MTBFMTTR chart + calc + cleanUrl |
| 5219f93 | fix(data): cleanup FotoURL + script |
| b6d2153 | fix(data): --force flag verified |
| 1fd984f | fix: MTBF/MTTR dari Performance |
| 3ed48de | fix: enterprise-kpi 8 refs |
| 4ee333f | chore: hapus functions (deploy) |
| 2b54760 | fix: sync KPI canvas |
| 4a24f35 | style: label nama + chart modern |
| f856589 | fix: perf form standby manual |

## Known Issues

- Data dev minimal: 18 equip, 2 logs, 4 Performance (1 freq>0)
- Browser subagent tak jalan (provider credential) — test manual di browser user

## Next Session

- Isi data nyata (WO, PM schedule, Log breakdown, Performance freq)
- Assign teknisi ke WO

---

# Session Notes — 2026-08-08 (Session 7: Performa P1 + P2 partial + Backup fix)

## Ringkasan

**Eksekusi Phase 1 performa (precompute Map, cache KPI, font preload, render cap) + Phase 2 partial (ImgBB real upload, Cache-Control immutable, migrate base64→URL). Fix backup.js (git diff exit code). Backup + push lengkap.**

---

## Baru di Session Ini

### ⚡ Phase 1 — Performa Quick Win ✅
- **Precompute Map** `equipById`/`partById` — hilangkan `find()` O(n²) di render loop ([src/js/app.js](file:///d:/Coding/MTC-Asset/src/js/app.js), store.js)
- **Cache KPI/HM/MTTR lookup** — kpi-engine.js + logs.js (tak re-calc per baris)
- **Font preload** — index.html (`preload` + `display=swap`)
- **Render cap** — EquipmentDetail log list dibatasi (visibleLogs, default 30)
- PM schedule: targetHM/HM-aware overdue dirapikan

### 🖼️ Phase 2 — Foto + Cache (sebagian ✅)
- **ImgBB real upload** — fix bug blob URL: `uploadToImgBB` kirim ke api.imgbb.com beneran; log photos di-upload ([src/js/modules/logs.js](file:///d:/Coding/MTC-Asset/src/js/modules/logs.js), ui.js)
- **`migrateLegacyImages()`** — pindahkan 12 base64 ImageUploads → URL ImgBB (12/12 sukses); diperluas ke Equipment.FotoURL + HistoryLog.PhotoURLs inline base64; early-return dihapus
- **Cache-Control immutable** — [firebase.json](file:///d:/Coding/MTC-Asset/firebase.json): `/assets/**`+`/icons/**` 1 tahun, sw.js/index no-cache
- Bundle: lazy chunks jspdf/xlsx/sentry/chart terpisah; initial ~300KB gzip

### 🔧 Fix (lanjutan)
- **backup.js** (sebelumnya) — fix git diff exit code

### ⚡ Bundle < 300KB gzip ✅ (Phase 2 selesai)
- Initial **351KB → 252KB gzip** (hemat 28%)
- **qrcode → lazy** `await import('qrcode')` ([ui.js](file:///d:/Coding/MTC-Asset/src/js/modules/ui.js)) — tak lagi statis di initial
- **modulePreload filter** ([vite.config.js](file:///d:/Coding/MTC-Asset/vite.config.js)): jspdf/qrcode/html2canvas/xlsx/sentry tak di-preload eager
- **target: 'esnext'** — skip ES5 transpile, kurangi polyfill

### 🔌 Split Listener (Phase 2) ✅
- HistoryLog/SpareParts/Performance → `onChildAdded` incremental + `limitToLast` (500/500/200)
- Delta sync — tak re-download penuh per tulis; WO detection tetap
- saveCache debounce 250ms + JSON clone (fix `Proxy object could not be cloned` flood)


## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S6 (form+orange+HM+MTBF+PM+spare) | ✅ Live | 73 files |
| S7 P1+P2 (split listener, bundle 252KB, cache fix) | ✅ Live | 74 files, release complete |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 1889346 | perf(P1): precompute Maps + cache KPI/HM/MTTR, font preload, cap render |
| 2dc8398 | perf(P2): ImgBB real upload, Cache-Control immutable, migrate helper |
| d41c22d | feat(P2): migrate extended ke Equipment/Logs base64 |
| 40d8749 | 📦 Backup + push |
| cbed5d9 | perf(P2): split listener onChildAdded + limitToLast + saveCache debounce |
| c97a03b | perf(P2): bundle 351→252KB gzip (qrcode lazy, modulePreload filter, target esnext) |

## Known Issues / Catatan

- Data dev minim (18 equip, 50 parts, 2 logs, 0 PM) — empty state normal
- `.open/skills` submodule dirty — skip commit
- CRLF quirk tetap — edit tools gagal → node script + regex

## Next Session

- [ ] Split HistoryLog/SpareParts/Performance → query Terbatas / bundling
- [ ] Bundle < 300KB gzip (optimasi vendor)
- [ ] Isi data nyata (WO, PM schedule, teknisi)

---

# Session Notes — 2026-08-07 (Session 6: Form Planner + Performa)

## Ringkasan

**Form maintenance planner upgrade (Actual Hours, Completed Date, HM logging, HM-aware MTBF, PM usage-based, spare lifetime hours) + tema gold→orange + flowchart + login fix + analisis performa jangka panjang.** Build pass, 103/103 tests, deploy live (73 files).

---

## Baru di Session Ini

### 🎨 Gold → Orange
- `--nexus-accent` `#f5c542` → `#ff8c1a`, `--nexus-accent-2` `#c9a227` → `#ffb74d` ([style.css](file:///d:/Coding/MTC-Asset/src/css/style.css))
- charts.js night accent → orange, swatch dropdown → orange

### 🔐 Login
- Input ID + Secure Key teks hitam (`#login-id`/`#login-key`, `!important` override `.glass`)

### 📊 Flowchart
- [docs/FLOWCHART.md](file:///d:/Coding/MTC-Asset/docs/FLOWCHART.md) (4 mermaid diagrams)
- [public/flowchart.html](file:///d:/Coding/MTC-Asset/public/flowchart.html) (5 section render via mermaid CDN, tema orange)

### 📝 Form Improvement (Maintenance Planner)
- **LogModal**: `Actual Hours` + `Completed Date` (auto-fill saat status → Completed, max=today)
- **LogModal**: `Running Hours (HM)` field (grid 3→4 kolom) — `logForm.hm` sudah persist (`HM:`)
- **Equipment**: `Current HM (Meter)` + equipment.js save `CurrentHM`; `current` di DEFAULT + edit-init
- **EquipmentDetail**: header Current HM + Last Log HM (`getLastHM()` di logs.js), chip HM per log row
- **MTBF/MTTR**: `_hmIntervalHours()` di kpi-engine — pakai delta HM antar breakdown bila ada, fallback kalender
- **PM Schedule usage-based**: `basis` (`calendar`/`hours`) + `intervalHours`; `generateNextPM()` hitung `targetHM` (max(lastLog.HM, equip.CurrentHM) + interval); `isPMOverdue` HM-aware (`pmCurrentHM()`); detail modal tampil Trigger/Target HM/Now HM; DEFAULT_PM_FORM + save payload
- **Spare**: `avgLifetimeHours` (init/edit/save/default, grid 3→4) — [SparePartsModal](file:///d:/Coding/MTC-Asset/public/components/modals/SparePartsModal.html) + index

### 🚀 Analisis Performa (skill: performance-engineer + web-performance-optimization)
- Bundle 1.48MB raw / ~440KB gzip (vendor 508K, jspdf 421K, firebase 286K, main 200K)
- **Akar masalah**: 9 realtime listener muat SELURUH dataset (Equipment/HistoryLog/SpareParts/Performance) — tiap 1 tulis → full re-download + sort 5000+ logs
- **Render O(n²)**: `filter`/`find`/`calc` di dalam `x-for` (EquipmentDetail dll)
- Laporan lengkap: `PERFORMANCE_ANALYSIS.md` (brain dir)
- Task list 3 phase di TASK.md (Quick Win / Menengah / Arsitektur)

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| S5 (63b6d86) | ✅ Live | 72 files |
| S6 (form+orange+HM+MTBF+PM+spare) | ✅ Live | 73 files |

## Commits

| Hash | Deskripsi |
|------|-----------|
| 63b6d86 | S5: themes, fonts, bottom nav |

## Known Issues / Catatan

- CRLF quirk tetap — edit tools gagal di CRLF files → node `.mjs` + regex `\r?\n`
- 9 realtime listener global = bottleneck utama jangka panjang → Phase 2
- `hmStart`/`hmEnd` delta **SKIP** — bertabrakan dengan semantik HM absolut (MTBF/targetHM/CurrentHM butuh meter utuh)
- Data dev minim (18 equip, 50 parts, 2 logs, 0 PM) — empty state normal

## Next Session

- [ ] Eksekusi Phase 1 performa (precompute Map, font preload, limit render)
- [ ] Phase 2: split listener, base64 foto → URL, patch node
- [ ] Isi data nyata (WO teknik, PM schedule, assign teknisi)

---

# Session Notes — 2026-08-07 (Session 5)

## Ringkasan

**4 tema (Gold/Navy/Purple/Light) + form font themed + mobile bottom nav fix + deploy live.** Build pass + 103/103 tests. Commit `63b6d86`.

---

## Baru di Session Ini

### 🎨 Multi-Theme (4 tema) ✅
- **Dropdown theme** di header (icon moon/sun) → menu 4 pilihan: Gold, Navy, Purple, Light (swatch warna)
- **CSS vars per tema**: `--nexus-accent`, `--nexus-accent-2`, `--nexus-accent-glow`, `--nexus-border`, `--text-main`, `--text-muted`, `--nexus-bg`, `--nexus-card`
- **ui.js**: `toggleDarkMode()` → `setTheme(t)`; `applyTheme()` set `data-theme` (night→dark mapping) + sync `darkMode` untuk charts
- **charts.js**: helper `themeAccent()`/`themeAccentSoft()`/`themeGrid()` — chart warna ikut tema (gold/navy/purple/blue)
- **Tema palette**:
  - Gold (`night`): accent `#f5c542`, bg `#05070a`
  - Navy: accent `#3b82f6`, bg `#0a0f1e`
  - Purple: accent `#a855f7`, bg `#0d0714`
  - Light: accent `#0061ff` (tetap)

### 🔤 Form Font Themed ✅
- Input/select/textarea: override `text-white`/`text-slate-400` hardcoded → `var(--text-main)`
- Placeholder → `var(--text-muted)`
- `select option` → bg `var(--nexus-card)` + text `var(--text-main)`
- `color-scheme: dark/light` per tema (dropdown arrow, date picker native)

### 📱 Mobile Bottom Nav Fix ✅
- **Masalah**: 15 item render di nav 390px (sempit, tanpa label) — P0 5-slot hilang/ke-revert
- **Fix**: grid 5 kolom (Home, WO, Assets, Parts + More) + **More modal** (bottom sheet, grid 4 kolom, 15 item)
- Getter `mobilePrimaryItems` + field `short` label per menu item
- Safe-area-inset untuk notch iPhone

### 🧹 Housekeeping
- Hapus scratch/ (32 file script patch + screenshots)
- Commit file untracked lama yang belum pernah di-commit (5 pages HTML, db.js, icons.js, lucide-icons.js, audit.js) — diverifikasi DIPAKAI via component-loader fetch `/pages/{name}.html`

## Deploy Status

| Deploy | Status | Catatan |
|--------|--------|---------|
| mtc-asset.web.app (hosting) | ✅ Live (S5) | 72 files, release complete |




## Session 9 — Performa P0-P2 (2026-08-08)

### Analisa Mendalam (desktop + mobile)
- Baseline: initial 252KB gzip; chart/jspdf/qrcode/sentry/all lazy; listener split (Phase 2)
- Laporan lengkap: PERFORMANCE_ANALYSIS_2.md
- Temuan: foto equipment eager (mobile data), cropper CDN render-blocking, page fragments network-first, search full-filter per keystroke

### P0 ✅ (ab6db7b) — Mobile image + render-blocking
- Lazy-load foto: `loading="lazy"` + `decoding="async"` (Equipment.html, EquipmentDetail.html, AllLogs.html)
- CropperJS CDN sinkron → dynamic load on-demand di showCropModal (hapus render-blocking dari head index.html)

### P1 ✅ (35ba9fa) — Page cache + render scale
- SW stale-while-revalidate untuk /pages/** (component-loader) — switch page instan
- Alpine `x-model.debounce.150ms` di search equip/parts/WO — full-filter tak per keystroke

### P2 ✅ (d89e4a4, 3b786fa) — Cost/robustness
- Split jspdf SVG chain (canvg+dompurify) → chunk lazy `pdfdeps` — **vendor 151.5→104.7KB gzip, initial ~212KB**
- RUM: PerformanceObserver → Sentry (LCP/FID/CLS/INP/TTFB, produksi only, passive, 0 dep)
- index.html shell split — **skipped** (YAGNI: modal shells + navigasi, bukan page fragment; 104KB di-cache SW)

### Deploy
| Deploy | Status | Catatan |
|--------|--------|---------|
| S8 fix (PDF, SW fallback, QR All) | ✅ Live | 74 files |
| S9 P0-P2 (lazy img, SW page cache, vendor 104K, RUM) | ✅ Live | 74 files |

### Commits
| Hash | Deskripsi |
|------|-----------|
| 5dda807 | fix: structuredClone → JSON clone (Proxy error, PDF export) |
| 3cc6992 | feat: QR All PDF |
| 2654119 | fix(sw): navigation fallback |
| ca1997c | chore: remove scratch/ |
| ab6db7b | perf(P0): lazy images + cropper async |
| 35ba9fa | perf(P1): SW page SWR + search debounce |
| d89e4a4 | perf(P2): pdfdeps chunk, vendor 151→105KB |
| 3b786fa | feat(P2): RUM web-vitals → Sentry |
| 21955d1 | docs: mark P0 done |

### Catatan
- Initial gzip: **252 → 212KB** (sesudah P2)
- Verify RUM: Sentry → event "web-vitals" (extra: LCP/FID/CLS/INP/TTFB)
- Data dev minim tetap (18 equip, 50 parts, 2 logs, 0 PM)
