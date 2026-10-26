## 🏷️ S42e · Teks jadi FOR DETAIL INFORMATION (2026-10-26)

**Live sw v74 → v75** (`96541cc`). Satu baris: penjelas kartu `for more information` → `for detail information` (dirender kapital: `FOR DETAIL INFORMATION`).

Dikunci `tests/qr-asset-tag.test.js` (2 asersi ikut diperbarui, termasuk pemeriksaan `uppercase`).

Catatan bahasa: bentuk baku Inggris adalah `DETAILED`; `DETAIL` dipakai sesuai permintaan. Kalau nanti ingin dirapikan, satu baris di `app-shell.html`.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning** · **2042 tes / 96 berkas**
- coverage **96,64 / 88,96 / 96,99 / 97,79** (exit **0**) · build **0** · precache **66/66**
- E2E **15 passed (44,1 s)** · live **mtc-asset-v75**

---

## 🏷️ S42d · Kartu tag: semua teks huruf kapital (2026-10-26)

**Live sw v73 → v74** (`4d5211b`).

| Elemen | Sebelum | Sesudah |
|---|---|---|
| penjelas | `for more information` | `FOR MORE INFORMATION` |
| nama aset | `Pompa E2E` | `POMPA E2E` |
| lokasi | `Area E2E` | `AREA E2E` |
| ID | `EQ-E2E-001` | tetap (mono, sudah kapital) |
| label cetak PDF | nama aset apa adanya | `String(nama).toUpperCase()` — sama dengan kartu |

Huruf kapital dipasang lewat kelas `uppercase` (bukan mengubah data), jadi nama aset di database tetap seperti aslinya; label cetak ikut kapital karena `uppercase` CSS tidak berlaku di PDF, di situ string-nya yang diubah.

### Tes
- `tests/qr-asset-tag.test.js` (+1): tiga baris kartu wajib ber-`uppercase` (penjelas, ID, nama, lokasi).
- `tests/ui-qr.test.js`: label cetak harus `'CRUSHER'` (data `Crusher`), bukan `'Crusher'`.

### Bukti
Teks kartu dibacakan ulang dari render: `MTC · MAINTENANCE · ASSET REGISTRY · SCAN ME · FOR MORE INFORMATION · EQ-E2E-001 · POMPA E2E · AREA E2E` — tidak ada huruf kecil.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning** · **2042 tes / 96 berkas**
- coverage **96,64 / 88,96 / 96,99 / 97,79** (exit **0**) · build **0** · precache **66/66**
- E2E **15 passed (41,0 s)** · live **mtc-asset-v74**

---

## 🏷️ S42c · Kartu tag: lokasi saja, status aset dibuang (2026-10-26)

**Live sw v72 → v73** (`cf8da97`).

| Sebelum | Sesudah |
|---|---|
| baris meta `Area E2E · Operational` (lokasi + status) | `Area E2E` saja; baris disembunyikan kalau lokasi kosong |

Alasan: label aset menempel di unit — statusnya berubah (Active / In Maintenance / Decommissioned) sementara stiker tidak, jadi status di stiker selalu cepat kedaluwarsa. Lokasi ikut tercetak karena membantu teknisi menemukan unit.

Dikunci `tests/qr-asset-tag.test.js` (+1): kartu **tidak boleh** memakai `selectedEquip?.Status`.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning** · **2041 tes / 96 berkas**
- coverage **96,64 / 88,96 / 96,99 / 97,79** (exit **0**) · build **0** · precache **66/66**
- E2E **15 passed (50,2 s)** · live **mtc-asset-v73**

### Rekomendasi kata (dipilih, belum diubah)
`SCAN ME` + `for more information` dipertahankan: netral, terbaca di stiker 40 mm, dan tidak menjanjikan fitur yang belum ada. Alternatif kalau tujuan berubah: `SCAN FOR DETAILS / asset history & work orders`, `SCAN TO IDENTIFY / maintenance asset registry`, `SCAN & REPORT / log a fault in seconds`. Hindari `SCAN FOR ME` — artinya "pindai untuk saya", bukan "pindai untuk info".

---

## 🏷️ S42b · Kartu tag: buang "work order", penjelas bahasa Inggris (2026-10-26)

**Live sw v71 → v72** (`c214b31`).

### Perubahan
| Sebelum | Sesudah |
|---|---|
| `untuk membuka riwayat & work order aset ini` | `for more information` |
| header modal `QR penanda aset` | `QR asset identifier` |

Seluruh teks UI kartu sekarang bahasa Inggris; yang tersisa berbahasa Indonesia hanya **nama aset** (`Pompa E2E`) — itu data milik operator, bukan label.

### Tes
- `tests/qr-asset-tag.test.js` (+2): penjelas harus `for more information`, dan kartu **tidak boleh** memuat `work order` (case-insensitive) — supaya kalimat lama tidak kembali.

### Bukti
- `cv2.QRCodeDetector` → `'EQ-E2E-001'` pada 640 px **dan** 240 px (badge tetap tidak merusak kode).
- Teks kartu dibacakan ulang dari render: `MTC · MAINTENANCE · ASSET REGISTRY · MTC · SCAN ME · for more information · EQ-E2E-001 · Pompa E2E · Area E2E · Operational` — tanpa "work order".

### Gerbang
- tsc **0** · eslint **0 error / 0 warning** · **2040 tes / 96 berkas**
- coverage **96,64 / 88,96 / 96,99 / 97,79** (exit **0**) · build **0** · precache **66/66**
- E2E **15 passed (1,1 m)** · live **mtc-asset-v72**

---

## 🏷️ S42 · Asset tag QR — desain premium + SCAN ME (2026-10-26)

**Live sw v70 → v71** (`d2577d4`).

### Yang dibuat
| Permukaan | Bentuk |
|---|---|
| Modal preview (`app-shell.html`) | kartu tag putih: monogram MTC, `MAINTENANCE · ASSET REGISTRY`, QR 176 px dengan **empat bracket emas**, label **SCAN ME** diapit dua garis emas, subteks `untuk membuka riwayat & work order aset ini`, pembatas, lalu ID (mono) · nama · `lokasi · status` |
| QR itu sendiri (`ui.js`) | `errorCorrectionLevel: 'H'` + **badge "MTC" di tengah** dengan halo putih **24 px (≈1 modul)** — bukan kotak tajam yang menempel di modul |
| Label cetak (`downloadAllQRs`) | tiap sel A4 landscape jadi **kartu tag berbingkai emas** 3 mm: QR 16 mm, `SCAN ME`, ID, nama — sebelumnya QR telanjang + dua baris teks abu |
| Fallback | canvas tidak tersedia (jsdom/WebView) → QR polos dikembalikan, bukan melempar |

### Bukti fungsional (bukan asumsi)
- QR hasil komposisi **tetap terbaca**: `cv2.QRCodeDetector` → `'EQ-E2E-001'` pada 640 px **dan** 240 px (badge + halo tidak merusak sinkronisasi).
- `e2e/qr-asset-tag.spec.js` memotret kartu (`QR_SHOT`) dan menyimpan PNG QR mentah (`QR_IMG`) untuk dekode di luar browser; juga menuntut `naturalWidth > 0` supaya QR kosong tidak lolos.

### Aturan tema yang harus dipatuhi
`tests/legacy-palette.test.js` melarang `bg-white`/`text-white` dan **hex apa pun di markup**. Solusinya bukan mengecualikan tes, tapi memindahkan warna tag ke komponen `.asset-tag` di `src/css/style.css` (triplet RGB `--tag-ink`/`--tag-gold`/`--tag-muted`/`--tag-line`), markup memakai `rgb(var(--tag-gold))`. Pengecualian `bg-white` lama (kartu QR versi lama) **dihapus** — sekarang nol pengecualian.

### Tes
- `tests/qr-asset-tag.test.js` (9): modal memuat SCAN ME + penjelas, `:src="qrCodeDataUrl"`, identitas aset, 4 bracket token, tanpa hex/`bg-white`, tombol tutup/simpan/cetak; `ui.js` memakai ECC `H`, badge MTC, fallback, dan label cetak `SCAN ME` + bingkai.
- `tests/ui-qr.test.js` (+3 asersi): mock jsPDF diperluas (`roundedRect`/`setDrawColor`/`setLineWidth`/`setFont`) dan bulk export harus menghasilkan 3 bingkai + 3 label `SCAN ME`.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning**
- **2039 tes / 96 berkas**
- coverage **96,64 / 88,96 / 96,99 / 97,79** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **15 passed (42,5 s)** di port 3100
- live: `sw.js` = **mtc-asset-v71**; fragmen live memuat `data-testid="asset-tag"` dan `Scan Me`

---

## 🏷️ S41c · PDF Work Order — kolom seimbang + pita statistik 5 sel (2026-10-26)

**Live sw v69 → v70** (`d12be20`).

### Cacat yang diperbaiki
| Cacat (terukur, bukan opini) | Sebab | Perbaikan |
|---|---|---|
| Lubang menggantung 17 mm di bawah kolom kiri | tinggi panel (8 baris) > tinggi kolom kiri (deskripsi 4 baris), lalu `y = max(...)` | panel dan kolom kiri **berbagi tinggi**: `cardH = max(natural, leftH + 2,4)`; kelebihan ruang masuk ke jarak **sebelum** seksi 02, bukan menumpuk di dasar kolom |
| Tepi atas kedua kolom tidak sejajar | panel mulai di `bodyTop`, judul seksi di baseline → beda 2,4 mm | `cardTop = bodyTop − 2,4` (setinggi huruf kapital judul) |
| `DEPARTMENT` memenuhi panel 8 baris | semua metadata ditumpuk di panel | `DEPARTMENT` pindah ke pita statistik → pita **5 sel** (ISSUED · DUE · DEPARTMENT · PRIORITY · STATUS), panel 7 baris |

### Bukti geometri (pdfplumber, halaman 1)
- tepi atas: judul `01` **158,4 pt** vs panel **157,6 pt** (selisih 0,3 mm)
- tepi bawah: teks deskripsi **344,8 pt** vs panel **355,5 pt** (padding 3,8 mm, bukan lubang)
- tepi kanan semua blok tetap **555,6 pt (196 mm)**; **0** kata bertumpuk

### Catatan alat
`vision_analyze` memberi 8/10 untuk halaman yang sama dan tiga "cacat" sisanya bukan cacat: blok tanda tangan kosong (formulir memang belum ditandatangani), perbedaan tanggal `ISSUED 18` vs `Printed 26` (dua fakta berbeda), dan QTY "rata kiri" (padahal rata kanan). Penilaian visual dipakai untuk kesan kasar; keputusan layout selalu dari bbox.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning** · **2029 tes / 95 berkas**
- coverage **97,08 / 88,97 / 97,13 / 98,34** (exit **0**) · build **0** · precache **66/66**
- E2E **14 passed (50,4 s)** · live **mtc-asset-v70**

---

## 🏷️ S41b · PDF Work Order revisi 2 — masthead ink + panel job card (2026-10-26)

**Live sw v68 → v69** (`f44dca8`).

### Kenapa revisi 2
Revisi 1 sudah bersih tapi masih terbaca "daftar baris": semua putih, semua hairline, tidak ada titik masuk mata. Revisi 2 memberi **struktur visual**, bukan hiasan.

| Perubahan | Bentuk |
|---|---|
| Masthead | pita ink **full-bleed 27 mm** + garis emas 1,4 mm; monogram kotak emas, nama perusahaan putih, `WORK ORDER` putih 15,6 pt, nomor WO monogram emas di kanan |
| Pita statistik | 4 sel (ISSUED · DUE · PRIORITY · STATUS); prioritas/status jadi **pil** ber-tone, baseline disamakan dengan nilai teks (y 39,2 → baseline 43) |
| Badan dua kolom | kiri 106 mm: `01 EQUIPMENT / ASSET` + `02 DESCRIPTION`; kanan 68 mm: **panel JOB CARD** (`paper` + rail emas) berisi 8 baris metadata |
| Panel menyesuaikan | `cardH = max(8 baris, tinggi kolom kiri)` → tepi bawah panel dan blok kiri rata, tidak ada tangga |
| Seksi bernomor | `01…04` (aset → deskripsi → parts → biaya/tanda tangan), angka emas + judul berspasi + hairline |
| Baris TOTAL ITEMS | **bar ink penuh** dengan garis emas di atasnya — penutup tabel, bukan baris ke-7 (label & angka putih, dikonfirmasi `pdfplumber`: `non_stroking_color = (1.0,)`) |
| Ringkasan biaya | 4 sel: DOWNTIME · EST. HOURS · ACTUAL HOURS · TOTAL COST 13,4 pt + garis emas di bawah angka |
| Desimal | `4,5 hrs` / `5,5 h` — konvensi Indonesia (`num()`), bukan titik |
| Tanda tangan | catatan `Valid only with original signatures.` 5,8 pt di atas blok, tiga kolom, garis 0,5 pt, ruang tanda 14 mm — tidak lagi didorong ke dasar halaman |
| Footer | `MTC System v2.0 · Form MTC-WO-01 · Printed … · <WO>` 6,8 pt + `Page x of y` |

### Bukti geometri (bukan opini)
- Tepi kanan semua blok = **555,6 pt (196 mm)** — masthead satu-satunya yang menyentuh 595,3 (full-bleed). Diverifikasi `pdfplumber` pada `rects`.
- **0** kotak kata bertumpuk dari 235 kata; label baris kedua tidak menabrak nilai baris pertama.
- WO contoh (6 parts, deskripsi 4 baris, biaya) muat **1 halaman**.

### Catatan alat (penting untuk sesi berikutnya)
`vision_analyze` pada render yang diperkecil **tidak stabil** sebagai penilai: tiga kali menilai dokumen yang sama memberi 7,5 / 7 / 6, dan dua "cacat" yang dilaporkan (label TOTAL hilang, panel kanan tidak sejajar) **terbukti salah** lewat `pdfplumber`. Pakai vision untuk kesan kasar saja; keputusan layout diambil dari angka bbox.

### Gerbang
- tsc **0** · eslint **0 error / 0 warning**
- **2029 tes / 95 berkas**
- coverage **97,08 / 88,97 / 97,13 / 98,34** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **14 passed (50,2 s)** di port 3100
- live: `sw.js` = **mtc-asset-v69**; chunk live memuat `Form MTC-WO-01`, `Valid only with original signatures`, `TOTAL ITEMS`

---

## 🏷️ S41 · Template PDF Work Order — desain ulang premium (2026-10-26)

**Live sw v67 → v68** (`9d9ca07`).

### Yang diganti (bukan ditambal)
| Area | Sebelum | Sesudah |
|---|---|---|
| Kop | blok gelap 40 mm, 3 lapis teks bertumpuk | monogram MTC outline emas + nama perusahaan + judul kanan; nomor WO jadi "stub" bergaris emas |
| Pita meta | badge prioritas/status menempel di bawah kop, tanggal terpisah di kanan | satu baris 4 sel: ISSUED · DUE · PRIORITY · STATUS, pemisah hairline, tone berupa titik + teks (tetap terbaca saat dicetak hitam-putih) |
| Judul seksi | bar gelap 8 mm per seksi (4×) | kotak emas 2,2 mm + label berspasi + hairline — hemat ±24 mm, tanpa blok abu-abu |
| Baris data | label & nilai berdesakan (pitch 8 mm) | konstanta `ROW = 11` (label→label) dan `GAP = 8` (antar seksi) — menyamakan keduanya membuat label baris kedua menabrak nilai baris pertama |
| Deskripsi | dipotong **maksimum 4 baris** | teks penuh, dibungkus, rail emas di kiri, 9,2 pt / 4,5 mm |
| Parts | `slice(0, 5)` dan kolom Description selalu `-` | semua baris, nomor part monospace, nama part kalau ada, zebra, baris **TOTAL ITEMS** dengan garis emas, header tabel diulang di halaman lanjutan |
| Biaya | kotak kuning muda (terbaca seperti peringatan) | pita `paper` + rail emas; TOTAL COST 13 pt sebagai jangkar visual |
| Tanda tangan | dipaku `yPos = pageHeight - 55` → isi panjang menabraknya; kotak abu | tiga kolom, garis 0,5 pt, ruang tanda 13 mm, mengalir setelah isi (didorong ke bawah hanya kalau ada ruang) |
| Footer | satu baris, tanpa nomor halaman | dua kolom + `Page x of y` di **setiap** halaman (`setPage` + `getNumberOfPages`) |

WO contoh (6 parts + biaya + deskripsi panjang) muat **1 halaman**; 40 parts memecah ke halaman lanjutan dengan header tabel diulang.

### Instrumen baru
- `scripts/render-wo-pdf.mjs` — render contoh WO ke `WorkOrder_<no>.pdf` tanpa membuka app, supaya iterasi desain tidak perlu emulator. Dipakai bersama `uv run --with pypdfium2` untuk raster halaman + `vision_analyze`.

### Jebakan yang ditemukan
- **Modul PDF harus tetap daun.** Sempat `import { formatAssignee } from '../utils.js'`; `utils.js` mengimpor `../constants` tanpa ekstensi, sehingga `node scripts/render-wo-pdf.mjs` gagal `ERR_MODULE_NOT_FOUND` walau Vite baik-baik saja. Helper disalin lokal (`formatAssignees`) dengan komentar bahwa perilakunya sama.
- **Verifikasi tumpang tindih jangan pakai mata.** `vision_analyze` pada crop yang diperkecil dua kali melaporkan "label menabrak nilai"; bukti sebenarnya dari `pdfplumber`: 235 kata, **0** kotak kata bertumpuk. Mata pada gambar ter-skalasi bukan bukti.
- `write_file` menolak menimpa berkas yang terakhir dibaca dengan paginasi; tulis ke scratch lalu `cp` — jangan mengulang `patch` di berkas yang sama berkali-kali.

### Tes
- `tests/wo-pdf-template.test.js` ditulis ulang (29 tes): mock `jsPDF` diperluas (`roundedRect`, `circle`, `setCharSpace`, `setLineWidth`, `getTextWidth`, `getNumberOfPages`, `setPage`), asersi mengikuti kontrak baru — semua baris parts dirender, `TOTAL ITEMS`, `MAN HOURS`, `Page 1 of 2`, deskripsi tidak dipotong, WO wajar muat 1 halaman, 40 parts memaksa `addPage`.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **2029 tes / 95 berkas**
- coverage **97,09 / 88,94 / 97,20 / 98,33** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **14 passed (56,0 s)** di port 3100
- live: `sw.js` = **mtc-asset-v68**; chunk live `assets/app-B2Xbf3aU.js` memuat `MAINTENANCE REQUEST FORM` dan `TOTAL ITEMS`

---

## 🏷️ S40 · Nama multi-teknisi + seksi Department Request yang tak pernah terbuka (2026-10-26)

**Live sw v66 → v67** (`55d8cac`).

### Probe dulu (tanpa menyentuh src)
| Cacat | Diukur di browser (emulator, `E2E_PORT=3100`) |
|---|---|
| Nama multi-teknisi mentah | sel All Logs benar-benar tampil `Yuli,Gunawan,Maruf M` — `String(['Yuli','Gunawan','Maruf M'])`, tanpa spasi |
| Department Request selalu tertutup | `details.open === false` sementara keempat field berisi: `Safety` / `Budi Santoso` / `2026-10-18` / `Ir. Fahmi` |

### Yang diperbaiki
| Butir | Bentuk |
|---|---|
| `formatAssignee()` | `src/js/utils.js`: larik → `'Yuli, Gunawan, Maruf M'` (entri kosong dibuang), string di-trim apa adanya, kosong → `'UNASSIGNED'` |
| Metode scope | `logsModule.formatAssignee()` membungkus helper; impor di-alias `formatAssigneeText` supaya nama metode tidak menimpa impor (pitfall `validateLogForm`) |
| Lima binding | `AllLogs.html` (1), `PlanningBoard.html` (2: kartu + panel detail), `WorkOrders.html` (2: baris log + header WO). Inisial avatar `slice(0,2)` **tidak** disentuh — itu potongan, bukan tampilan penuh |
| `logDeptOpen` | state di `logsModule` + `:open="logDeptOpen"` / `@toggle="logDeptOpen = $event.target.open"` pada `<details>` Department Request |
| Isi flag | edit: `!!(requestedBy || approvedBy)`; entri baru: selalu `false` |

### Tes
- `tests/assignee-format.test.js` (7): lima kasus helper + kontrak fragmen — tidak ada lagi `x-text` mentah ke `.assignedTo` dan tiap lokasi memanggil `formatAssignee()`.
- `tests/log-form-dept-section.test.js` (6): default tertutup, edit berdata → terbuka, edit tanpa data → tertutup, entri baru menutup lagi, plus kontrak `<details>` (`:open` + `@toggle`).
- `e2e/log-dept-and-assignee.spec.js` (2): All Logs merender `Yuli, Gunawan, Maruf M`; modal edit → `details.open === true` + empat nilai field.
- `e2e/seed-emulator.mjs`: `NS` kini di-`export` supaya spec bisa menulis record tambahan ke namespace yang sama (namespace salah = data kosong tanpa error).

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **2024 tes / 95 berkas**
- coverage **97,16 / 89,06 / 97,16 / 98,38** (exit **0**)
- ratchet `branches` **87 → 88**; dibuktikan menggigit dengan `89.5` → `ERROR: Coverage for branches (89.06%) does not meet global threshold (89.5%)` (exit 1), lalu diturunkan ke **88**
- build **0** · `verify:precache` **66/66**
- E2E **14 passed (47,6 s)** di port 3100
- `npm run test:rules` tidak dijalankan ulang: tidak ada perubahan `database.rules.json`

---

## 🏷️ S39i · Datalist saran teknisi + tenggat default +7 hari (2026-10-25)

**Live sw v65 → v66** (`2822bfb`).

### Yang dipasang
| Butir | Bentuk |
|---|---|
| Saran teknisi | `<input list="technician-suggestions">` + `<datalist>` dari getter `technicianSuggestions`; **field tetap kosong**, operator memilih |
| Tenggat default | `DEFAULT_DUE_DATE()` = hari ini + 7, dipakai `DEFAULT_LOG_FORM()` **dan** `openLogModal()` |

Sumber saran: riwayat `assignedTo` di `logs` yang sudah dimuat — **bukan** node `Users`, karena `.read` Users hanya untuk admin/supervisor sehingga daftar akan kosong bagi operator biasa. Nilai berbentuk uid Firebase disaring (`/^[A-Za-z0-9]{20,}$/`), array legacy (`['Yuli','Gunawan']`) diratakan, hasil di-dedupe, diurutkan, dibatasi 20.

Kenapa teknisi tidak diisi otomatis: planner sering menugaskan orang lain; WO yang tercatat atas nama pembuat tidak terlihat salah sampai kartunya dibuka.

### Instrumen
- `playwright.config.js`: port dari **`E2E_PORT`** (default 3000). Sebelumnya suite memblokir alur karena harus mematikan dev server di 3000 dulu (`taskkill` butuh persetujuan dan sempat timeout 5 menit). Sekarang `E2E_PORT=3100 … npx playwright test` jalan berdampingan dengan dev server.

### Tes
- `tests/log-form-prefill.test.js` (7): `DEFAULT_DUE_DATE` = hari ini+7, `DEFAULT_LOG_FORM` memakai itu dan `assignedTo` tetap kosong, saran teknisi dedupe/urut/ratakan array/saring uid/batas 20/kosong tanpa log.
- `tests/log-form-layout.test.js` (+1): input teknisi punya `list="technician-suggestions"`, **tanpa** `value=`, dan datalist memakai `x-for="name in technicianSuggestions"`.
- `e2e/log-modal-layout.spec.js`: `techValue === ''`, `techList === 'technician-suggestions'`, `dueValue === hari ini+7`.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **2011 tes / 93 berkas**
- coverage **97,17 / 88,92 / 97,23 / 98,39** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **12 passed (42,5 s)** di port 3100
- live: `sw.js` = **mtc-asset-v66**; fragmen live memuat `technician-suggestions`

### Catatan
- `taskkill` untuk membebaskan port 3000 diblokir sistem (tanpa persetujuan) — itu sebabnya `E2E_PORT` dibuat, bukan sekadar tambalan sesi ini.
- Datalist hanya berisi nama yang pernah dipakai di WO; daftar pengguna yang belum pernah ditugaskan tidak muncul (batasan `.read` Users).

## 🧭 S39h · Form WO sesuai mockup desktop (2026-10-25)

**Live sw v64 → v65** (`ebd1d2a`). Implementasi lima butir usulan desain.

| # | Perubahan |
|---|---|
| 1 | **Department Request terlipat** — `<details>` dengan ringkasan `Opsional · 4 field`; kontrol terlihat turun 18 → **14** |
| 2 | **Footer aksi menempel** (`sticky bottom-0`) berisi status `Wajib terisi` / `N field belum valid`, tombol Cancel, dan submit yang `:disabled` selama field wajib kosong |
| 3 | **Grid 2 kolom** lewat `.form-grid--two` (container-driven, bukan breakpoint viewport) — seksi 4-field jadi 2×2, tidak ada lagi ekor 3+1 |
| 4 | **Angka rata kanan + satuan di dalam field** (`hrs`, `$`, `HM`) pada 5 kontrol numerik |
| 5 | **Validasi inline** — penanda `*` + `aria-required` pada 3 field wajib, pesan per field (`logFormErrors`), pesan hilang saat field diperbaiki |

### Dua jebakan yang tertangkap
1. **`validateLogForm` sudah ada** di `src/js/utils.js` (aturan blokir, pesan Inggris) dan diimpor `logs.js`. Percobaan pertama menambah method bernama sama di modul → menimpa import, `submitLog` berhenti memakai aturan lama, dan tes kontrak merah (`Equipment selection is required`). Perbaikan: method baru dinamai **`syncLogFormErrors()`**; aturan blokir tetap satu sumber di utils.
2. **`details` tertutup tetap menampilkan isinya.** Gaya UA `details:not([open]) > *` kalah oleh `.form-grid { display: grid }` milik author. Tanpa aturan `details:not([open]) > *:not(summary) { display: none }`, seksi terlipat tetap tampil — dibuktikan E2E (`deptFieldsHidden` false) sebelum CSS ditambahkan.

### Tes
- `tests/log-form-validation.test.js` (6) — pesan per field, tenggat < tanggal, jam negatif, string kosong dianggap belum diisi, pesan hilang setelah diperbaiki.
- `tests/log-form-layout.test.js` +6 — 4 grid `form-grid--two`, footer sticky, `<details>` + `</details>` mengurung 4 field, 3 penanda `*` + 3 `aria-required`, 5 input rata kanan, 6 pasang `x-show`/`x-text` pesan error.
- `e2e/log-modal-layout.spec.js` — submit `disabled` di awal, footer terlihat, seksi 04 tertutup (`deptFieldsHidden`), lalu tombol aktif setelah field wajib diisi (di-poll karena Alpine memakai microtask).

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **2003 tes / 92 berkas**
- coverage **97,17 / 88,93 / 97,23 / 98,39** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **12 passed (46,6 s)**
- live: `sw.js` = **mtc-asset-v65**; fragmen live memuat `sticky bottom-0`, `form-grid--two`, dan `Opsional · 4 field`

### Sisa
- Prefill teknisi dari akun login **belum** dilakukan: planner sering menugaskan orang lain, jadi field dibiarkan kosong dengan validasi. Prefill `dueDate` +7 hari juga belum.
- Seksi 04 tetap terbuka saat mengedit log lama? Belum diuji — `<details>` tidak punya state, jadi selalu tertutup saat modal dibuka ulang.

## 🧠 S39g · Seksi "Diagnosis & Briefing" + field numerik kosong (2026-10-25)

**Live sw v63 → v64** (`4259073`). Tindak lanjut tangkapan layar setelah S39f: dua sisa yang masih terbaca tidak rapi.

### Temuan (dari render, bukan dari kelas)
| # | Temuan |
|---|---|
| 1 | `ROOT CAUSE (RCA)` dan `TECHNICAL BRIEFING` tampil sebagai field lepas — tanpa judul seksi, jaraknya lebih rapat daripada jarak antar seksi lain |
| 2 | Lima field numerik menampilkan `0` pada entri baru (`EST. HOURS`, `ACTUAL HOURS`, downtime, cost, running hours) sehingga terbaca seperti data terisi |

### Perbaikan
- Keduanya dipindah ke seksi baru berjudul **🧠 Diagnosis & Briefing** dengan pembungkus `mt-6 pt-6 border-t` yang sama seperti tiga seksi lain (grid 4 field + textarea penuh).
- Default numerik jadi **string kosong** di dua tempat yang membangun form: `DEFAULT_LOG_FORM()` (`constants.ts`) **dan** objek `logForm` di `openLogModal()` (`logs.js`) — sebelumnya hanya salah satunya yang diubah sehingga perbaikan tidak terlihat. `submitLog` tetap menormalkan lewat `Number(...) || 0`, jadi data tersimpan tetap angka.
- `md:grid-cols-2` **dibatalkan**: `tests/form-controls.test.js` melarang `grid-cols-2` di dalam `<form>` karena grid form harus mengikuti lebar wadah (`.form-grid` 1→2→3), bukan breakpoint viewport. Sisa asimetri 3+1 pada seksi 4-field adalah konsekuensi aturan itu, bukan cacat baru.

### Bukti
`e2e/log-modal-layout.spec.js` sekarang juga menuntut kelima field numerik bernilai `''` pada entri baru:

| Metrik | Nilai |
|---|---|
| nilai field numerik | `['', '', '', '', '']` |
| tinggi kontrol | `[44]` |
| label | 20, font `[12, 16]` |

Suite penuh **12 passed (35,7 s)**.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1991 tes / 91 berkas**
- coverage **97,19 / 88,94 / 97,22 / 98,38** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **12 passed (35,7 s)**
- live: `sw.js` = **mtc-asset-v64**; fragmen live memuat judul "Diagnosis &amp; Briefing"

### Pelajaran
Default form punya **dua sumber** (`constants.ts` dan `openLogModal()` di `logs.js`). Mengubah satu saja membuat perbaikan tampak "tidak ada perubahan" — persis keluhan operator. Cari keduanya (`grep -rn "downtime: 0"`).

## 🎛️ S39f · Modal "New System Entry" dirapikan (2026-10-25)

**Live sw v62 → v63** (`c2d361f`). Permintaan operator: form input WO baru dibuat rapi.

### Yang tidak konsisten (terukur dari fragmen)
| Item | Sebelum |
|---|---|
| Ukuran label | **4 ukuran berbeda** — `text-[8px]`, `text-[9px]`, `text-[10px]`, token 12px |
| Tinggi kontrol | **2 tinggi** — `p-3` (40 px) di grup aset, `p-4` (48 px) di 17 kontrol lain, padahal `:is(input, select, textarea)` sudah menetapkan `--field-h: 44px` |
| Judul grup | hanya **2 dari 3** grup punya judul (grup aset tanpa judul) |
| `x-cloak` | 5 blok `x-show`, hanya modal root yang ber-`x-cloak` → input "external equipment" dan "tanggal selesai" berkedip sebelum Alpine boot |
| Indentasi | blok HM/RCA masuk dengan indentasi tidak konsisten |

### Sesudah
- **20 label** → satu kelas: `font-label-mono-sm text-label-mono-sm … ml-0.5 mb-1.5 block` (12 px, di atas ambang keterbacaan).
- **20 kontrol** → `class="w-full"` saja; tinggi/border/latar dari token `--field-h` (44 px).
- **3 judul grup** seragam (`font-label-mono-md`): 🗂️ Asset & Activity · ⚡ Work Order Settings · 🏢 Department Request.
- Semua `x-show` ber-`x-cloak`.
- Teks kecil sisa (counter foto, tombol Link Part, empty-state parts) juga naik ke token 12 px.

### Bukti hasil render (bukan hanya kelas)
`e2e/log-modal-layout.spec.js` membuka modal di emulator lalu mengukur:
`controlCount 18 · heights [44] · textarea ≥ 44 · labelCount 20 · labelFonts [12,16]` → **12 passed (41,6 s)** untuk seluruh suite.

### Tes
- `tests/log-form-layout.test.js` (5 tes kontrak fragmen: label token, tanpa `text-[8px]/[9px]`, tanpa `p-3/p-4` pada kontrol, `x-show` wajib `x-cloak`, tiga judul seragam). **Dibuktikan menggigit**: satu label dikembalikan ke `text-[9px]` + satu kontrol ke `p-4` → `3 failed | 2 passed`.
- `tests/log-form-contract.test.js` (7 tes lama) tetap hijau — `actualHours`/`step="0.1"`/`completedDate`/`:max` tidak berubah.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1991 tes / 91 berkas**
- coverage **97,19 / 88,94 / 97,22 / 98,38** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **12 passed (41,6 s)**
- live: `sw.js` = **mtc-asset-v63**; fragmen live memuat kelas label baru + judul "Asset &amp; Activity"

## 🩹 S39e · Inisial teknisi pecah saat `assignedTo` berupa array (2026-10-25)

**Live sw v61 → v62** (`5373d22`). Ditemukan dari pemantauan konsol dev server saat operator membuka kartu detail WO.

### Gejala
```
[console.warn] Alpine Expression Error: (intermediate value).slice(...).toUpperCase is not a function
Expression: "(woSelected.assignedTo || '??').slice(0, 2).toUpperCase()"
[Unhandled error] TypeError: (intermediate value).slice(...).toUpperCase is not a function
```

### Sebab
`HistoryLog/*/assignedTo` di data legacy berbentuk **array**, bukan string:

| Record | `assignedTo` |
|---|---|
| `LOG-1778150226931` | `['Yuli', 'Gunawan', 'Maruf M']` |
| `LOG-1781228659633` | `['Sardi', 'Lutfi']` |
| 12 record lain | string uid |

`slice(0, 2)` pada array mengembalikan **array**, lalu `.toUpperCase()` melempar. Karena ekspresi ini hidup di dalam `x-text` blok detail, error-nya mematikan `initTree` untuk blok itu (bukan cuma satu huruf hilang).

### Perbaikan
`public/pages/WorkOrders.html:845`:

```
String([].concat(woSelected.assignedTo || '??')[0] || '??').slice(0, 2).toUpperCase()
```

`[].concat(x)` menormalkan string **dan** array ke larik, `[0]` mengambil teknisi pertama, `String(…)` menjaga sisa tipe aneh (angka, objek) tetap aman.

### Tes
`tests/wo-assignee-initials.test.js` (2 tes): mengekstrak ekspresi asli dari fragmen lalu menjalankannya untuk array 3 nama, array 2 nama, string uid, `''`, `undefined`, `null`, dan `[]` → `YU`, `SA`, `DH`, `??`, `??`, `??`, `??`; plus asersi bentuk lama tidak boleh kembali. **Dibuktikan menggigit**: fragmen dikembalikan ke bentuk lama → `2 failed`.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1986 tes / 90 berkas**
- coverage **97,19 / 88,94 / 97,22 / 98,38** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **11 passed (41,7 s)**
- live: `sw.js` = **mtc-asset-v62**; `pages/WorkOrders.html` live sudah memuat bentuk aman (`frag_fixed=True`)

### Catatan
- Tampilan nama teknisi pada record multi-teknisi masih keluar sebagai `Yuli,Gunawan,Maruf M` (`x-text="wo.assignedTo"` di AllLogs/PlanningBoard/WorkOrders:603). Tidak melempar error, tapi belum dirapikan — kandidat pekerjaan berikutnya.
- Pemantauan konsol dev server: hanya satu kelas error ini yang muncul; nol `pageerror` lain.

## 🧩 S39d · Pola S39c ditutup untuk `SpareParts` & `Performance` (2026-10-25)

**Live sw v60 → v61** (`63ef6cc`). Sisa dari S39c: tiga node masih hanya `onChildAdded`.

### Yang diperiksa dulu
| Node | Listener | Status |
|---|---|---|
| `HistoryLog` | `onChildAdded` + `onChildRemoved` | ditutup di S39c |
| `SpareParts` | `onChildAdded` saja | **ditutup di sini** |
| `Performance` | `onChildAdded` saja | **ditutup di sini** |
| `Equipment` | `onValue` (snapshot penuh) | sudah self-healing — tidak butuh listener tambahan |

### Perubahan
`src/js/modules/data.js`: `onChildRemoved` untuk `spRef` (buang `PartID`, `saveCache('allParts', …)`) dan `perfRef` (buang `id`, `saveCache('performanceData', …)`), keduanya di balik guard `typeof window.onChildRemoved === 'function'` seperti listener HistoryLog.

### Tes
`tests/data.test.js`: kontrak sumber kini mengunci ketiga registrasi (`histRef`, `spRef`, `perfRef`), plus satu tes perilaku yang memanggil kedua callback baru dan memastikan lariknya menyusut. **Dibuktikan menggigit**: kedua registrasi dikembalikan ke `onChildAdded` → `2 failed | 87 passed`; dikembalikan → `89 passed`.

Catatan proses: mutasi pertama menyentuh **semua** kemunculan `window.onChildAdded(spRef` (termasuk listener penambah), sehingga 11 tes merah. Yang benar adalah mengubah baris registrasi `onChildRemoved` saja — nomor baris menentukan, bukan kemunculan pertama (pelajaran yang sama dengan pembersihan `no-unused-vars` di skill).

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1984 tes / 89 berkas**
- coverage **97,19 / 88,94 / 97,22 / 98,38** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **11 passed (38,4 s)**
- live: `sw.js` = **mtc-asset-v61**; `assets/app-jQtR_WV7.js` memuat `onChildRemoved` **6×** dan label `remove listener` **4×**

## 🗂️ S39c · WO yang sudah dihapus tetap tampil di menu Work Orders (2026-10-25)

**Live sw v59 → v60** (`385b276`). Laporan operator: WO `MTC-005` sudah dihapus, kartunya masih ada di menu Work Orders.

### Fakta
- `database:get /HistoryLog` → **15** record, **tidak ada** `MTC-005`. Penghapusan di server **berhasil**; yang basi adalah state klien.
- `filteredWorkOrders` (`app.js:1907`) membaca **`activeWorkOrders` lebih dulu** bila larik itu tidak kosong. `deleteItem()` hanya membersihkan `this.logs` — `activeWorkOrders` tidak pernah ikut dibersihkan, dan hanya dibangun ulang di listener `onChildAdded`.
- **Tidak ada `onChildRemoved` di seluruh `src/js`** (dicek `grep -rn`). Jadi penghapusan dari tab/perangkat lain tidak pernah sampai ke state, dan `saveCache('logs', …)` + IndexedDB memunculkan record itu lagi setiap boot.

### Perbaikan
| Berkas | Perubahan |
|---|---|
| `src/js/modules/data.js` | `deleteItem()` jalur online **dan** offline membersihkan `activeWorkOrders` + `_woSeenIds`; listener `onChildRemoved` untuk `HistoryLog`; snapshot awal `onValue` memangkas record yang sudah tidak ada di server (hanya bila hasil query < cap 500) |
| `src/js/data-layer.js` | ekspor `onChildRemoved` |
| `src/js/firebase-config.js` | bridge `window.onChildRemoved` |
| `src/js/globals.d.ts` | deklarasi `onChildRemoved?: any` |
| `e2e/delete-wo.spec.js` | tidak lagi mengasumsikan pesan sukses jadi notifikasi terakhir — `onChildRemoved` kini bisa mengosongkan `logs` lebih dulu |

### Tes
5 tes baru di `tests/data.test.js`: `deleteItem(HistoryLog)` membersihkan `logs` **dan** `activeWorkOrders` (+ `_woSeenIds`), jalur offline sama, listener `onChildRemoved` membuang record, rekonsiliasi snapshot awal memangkas ghost dari cache, plus kontrak sumber untuk bridge/ekspor. **Dibuktikan menggigit**: dua baris pembersihan dihapus → `2 failed | 84 passed`, lalu dikembalikan.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1983 tes / 89 berkas**
- coverage **97,24 / 88,98 / 97,36 / 98,41** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **11 passed (42,4 s)**
- live: `sw.js` = **mtc-asset-v60**; `onChildRemoved` terverifikasi di `assets/main-D_DEW_f-.js`, `assets/app-D2MV7Dp0.js`, `assets/data-layer-DOdJyT2U.js`

### Catatan
- Untuk sesi di browser yang masih memegang state lama: satu kali reload (SW v60 mengambil alih). Setelah itu penghapusan dari perangkat lain langsung hilang tanpa reload.
- Pola cacat yang sama masih terbuka untuk `Performance`, `Equipment`, `SpareParts` (semua listener-nya juga hanya `onChildAdded`).

## 🔧 S39b · `approveWO` record hantu + `showNotification` tanpa `await` (2026-10-25)

**Live sw v58 → v59** (`83dc8b9`). Dua bug ditemukan dari konsol dev server saat operator menguji alur approve di localhost.

### Bug 1 — `permission_denied` saat Approve WO
- Gejala: `update at /HistoryLog/LOG-1792201969665 failed: permission_denied`, lalu `Approve WO Error`.
- Bukti node-nya tidak ada: `database:get /HistoryLog/LOG-1792201969665` → **`null`**; `--shallow` saat itu 15 key, id tersebut tidak di dalamnya.
- Sebab: `approveWO()` mengirim `update()` **parsial** 6 field. `.validate` `HistoryLog/$logId` menuntut `hasChildren(['LogID','EquipmentID','Jenis','Deskripsi'])`; pada node yang tidak ada, `newData` hanya 6 field itu → validate gagal dan Firebase melaporkannya sebagai `permission_denied` (bukan pesan validasi) — mudah salah dibaca sebagai masalah role.
- Perbaikan: guard `get()` → `snap.exists()` **sebelum** potong stok; kalau kosong → record dibuang dari `this.logs`, notifikasi jelas, halaman dimuat ulang. Gagal jaringan tidak memblokir approve (masuk `logger.warn`, alur lanjut).

### Bug 2 — unhandled rejection dari notifikasi browser
- Gejala: `TypeError: ServiceWorkerRegistration.showNotification: No active worker for scope http://localhost:3000/` sebagai unhandled rejection, 3×.
- Sebab: `registration.showNotification(...)` dipanggil **tanpa `await`**, jadi rejection lolos dari `try/catch`; dan di dev server tidak ada worker aktif sehingga jalur SW selalu melempar, sementara fallback `new Notification` tidak pernah dipakai.
- Perbaikan: `await`, plus `if (!registration?.active) return showDirect()`.

### Tes
- `tests/approve-wo-ghost.test.js` (3): node tidak ada → nol `update`/`set`/`runTransaction`, record dibuang, pesan jelas; node ada → update parsial tetap jalan; `get` gagal → approve lanjut.
- `tests/notification-sw-fallback.test.js` (5): tanpa `serviceWorker`, izin ditolak, `active` kosong → fallback langsung, worker aktif → `showNotification` ditunggu, `showNotification` menolak → ditangkap (bukan unhandled).
- Dua tes lama diperbarui ke kontrak baru: `components.test.js` (approve butuh node ada → `fb.get` mengembalikan `exists: true`), `notification-checkers.test.js` (registration stub diberi `active: {}`).
- **Dibuktikan menggigit**: guard dihapus + `await` dibuang → `2 failed | 6 passed`, lalu dikembalikan.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1978 tes / 89 berkas**
- coverage **97,18 / 89,00 / 97,27 / 98,37** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **11 passed (50,8 s)**
- live: `sw.js` = **mtc-asset-v59**; guard ada di `assets/app-mOB2Cv5p.js`; `notification-*.js` live sudah `await i.showNotification(...)` + cek `i?.active`

### Catatan data
`HistoryLog` saat ini **15** record, semuanya `Completed`. Dua record hilang dibanding 14:29 (`LOG-1792078671160`, `LOG-1792078852510`/MTC-004) — dihapus lewat UI saat pengujian, bukan oleh skrip.

## 🛡️ S39 · Gate hapus `Performance`: premis kartu salah — yang nyata kurang adalah tesnya (2026-10-25)

**Live tetap sw v58** (`1f33b02` + `b4b5721`). Hanya `tests/**` yang berubah, jadi `CACHE_NAME` **tidak** dinaikkan (§2 skill) dan tidak ada byte baru yang diunduh perangkat operator.

### Langkah 1 — probe: role `user` vs `supervisor` (emulator, Playwright)

Probe sementara `e2e/tmp-perf-gate.spec.js` (dihapus setelah angkanya dicatat): seed emulator + satu baris `Performance/PERF-E2E-001`, role diubah lewat REST, lalu `currentPage = 'perf'` dipaksa seperti operator.

| Role | `canAccess({allowedRole:'supervisor'})` | `currentPage` setelah dipaksa | `#perfTable` | Tombol hapus di DOM | Terlihat |
|---|---|---|---|---|---|
| `user` | false | **`dash`** (ditolak) | tidak ada | **0** | 0 |
| `supervisor` | true | `perf` | ada | 2 (tabel + kartu mobile) | 1 |

Hasil: `2 passed (33.7s)`, `pageerror` **0**.

### Premis kartu salah — dan itu temuannya
- Kedua tombol hapus (`Performance.html:269`, `:325`) **sudah** berada di dalam `<div x-show="isAdminOrSupervisor">` sejak `4695bd9` (2026-10-16), dibuktikan `git blame`.
- Halaman `perf` sendiri `allowedRole: 'supervisor'` (`app.js:580/635`), dan `canAccess()` memakai `isAdminOrSupervisor` — role `user` tidak pernah bisa membuka halaman itu (`currentPage` dikembalikan ke `dash`).
- Jadi tidak ada tombol tanpa gate, dan tidak ada jalan bagi `user` untuk melihatnya. Yang keliru adalah **cara memeriksanya**: `deleteButtons()` hanya membaca tag `<button>`, sehingga gate di div induk tidak terlihat — dan karena itu pula tidak ada tes yang menjaganya.

### Langkah 2 — tes kontrak diperluas (bukan markup diubah)
`tests/delete-gate-contract.test.js`: `enclosingDiv()` + `gatedDeleteButtons()` membaca gate dari tag tombol **atau** div pembungkus terdekat; `Performance` dan `SpareParts` masuk daftar. `public/**` tidak disentuh — dibuktikan `git diff --quiet -- src public index.html` = **0** setelah mutasi di-revert.

**Dibuktikan menggigit**: `x-show` dihapus dari div induk `Performance.html:264` → `AssertionError: public/pages/Performance.html: tombol hapus Performance tanpa gate isAdminOrSupervisor` (1 failed | 3 passed), lalu di-revert.

### Langkah 3 — coverage branches 88,56 → 88,98 %
`tests/app-parts-filter-branches.test.js` (15 tes, hanya `tests/**`): guard `allParts` non-array, record `null`, lima jalur pencarian, tiga bentuk `EquipmentIDs`/`EquipmentID`, tiga `partStatusFilter`, empat `partSortBy`, paginasi + `canLoadMoreParts`, `_partMap` (cache + rebuild), `sidebarExpandedGroups` dari localStorage. `app.js` branch **85,89 → 87,37 %**. Threshold tetap **87** (margin ke 88,5 hanya 0,48 → belum ratchet).

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- **1970 tes / 87 berkas**
- coverage **97,20 / 88,98 / 97,34 / 98,37** (exit **0**)
- build **0** · `verify:precache` **66/66**
- E2E **11 passed (36,0 s)**
- live: `sw` **mtc-asset-v58**, `pages/Performance.html` live memuat **2** tombol hapus di dalam **3** kemunculan `x-show="isAdminOrSupervisor"`

### Sisa / catatan
- Gate setara untuk `deletePM` (`PMSchedule.html:778`), `deleteRequisition` (`RequestPart.html:245`, div induk) dan `deleteUser` (`app-shell.html:239`, hanya `u.uid !== user.uid` + panel admin) — semuanya ter-gate, tapi **belum** masuk tes kontrak karena bukan `deleteItem()`.
- `app.js` masih 258 cabang terlewat pada awal sesi (201 baris); sisa terpadat: `heroHUD`, `dashKPIs`, `planningWOs`, `filteredWorkOrders`.

## ⚠️ S38h-c · `database:update` MENGGANTI record WO — dipulihkan (2026-10-25)

### Apa yang terjadi
Untuk menghapus item `P-010` dari `PartsUsed`, dipakai:

```bash
npx firebase database:update /HistoryLog/LOG-1792078852510 patch.json -f
```

Payload-nya `{"PartsUsed":[{"id":"P-011","qty":1}]}`. Hasilnya **bukan** merge: record `LOG-1792078852510` (MTC-004) tinggal berisi **satu** field (`PartsUsed`); 33 field lain (`LogID`, `EquipmentID`, `Jenis`, `Deskripsi`, `Status`, `woNumber`, `Downtime`, `Cost`, `HM`, dst.) hilang.

### Pemulihan
1. Sumber restore: ekspor `database:get /HistoryLog` pukul 13:32 (sebelum perubahan apa pun) — masih memuat record lengkap 34 field. `npm run backup:firebase` 14:01 **tidak** memuat record ini (backup melewatkan record yang sangat baru), jadi ekspor manual itulah yang menyelamatkan.
2. Record asli disusun ulang di memori dengan `PartsUsed = [{"id":"P-011","qty":1}]` (item `P-010` dibuang).
3. Ditulis dengan `database:set /HistoryLog/LOG-1792078852510 restore.json -f` → `Data persisted successfully`.
4. Verifikasi: **34 field**, `Status: Completed`, `woNumber: MTC-004`, `EquipmentID: 5060-PU-12`, `Jenis: Breakdown`, `PartsUsed` hanya `P-011`; total log tetap **17**.
5. Audit ulang: **0 referensi menggantung** (2 referensi part, keduanya valid).

### Pelajaran (sudah masuk skill `mtc-asset-maintenance` §5)
- `firebase database:update <path> <file>` di versi ini **mengganti** node, bukan merge. Untuk mengubah sebagian field: `database:get` → ubah di memori → `database:set` record penuh, atau REST `PATCH`.
- Selalu simpan hasil `database:get` sebelum menulis; backup otomatis tidak selalu memuat record terbaru.

### Status data sekarang
| Item | Nilai |
|---|---|
| `SpareParts` | 11 part (P-010 dihapus) |
| Referensi part di `PartsUsed` | 2, semuanya valid |
| Referensi menggantung | **0** |
| `HistoryLog` | 17 record, utuh |

## 🗑️ S38h-b · `P-010` dihapus dari master (2026-10-25)

Permintaan operator: part `P-010` belum punya nama resmi di sumber mana pun, jadi dihapus.

- Perintah: `npx firebase database:remove /SpareParts/P-010 --project mtc-asset --instance mtc-asset-default-rtdb -f` → `Data removed successfully`.
- Master sekarang **11 part** (dari 12).
- Audit ulang: **1 referensi menggantung** — `P-010` masih disebut di `HistoryLog` `LOG-1792078852510` (MTC-004, qty 1). Referensi ini **tidak berbahaya** sejak S38f: transaksi stok untuk part yang tidak ada dibatalkan, bukan ditolak `permission_denied`.
- Kalau nanti mau bersih total: hapus item `P-010` dari `PartsUsed` log itu (mengubah record WO selesai — sengaja belum dilakukan tanpa persetujuan).

## 🌱 S38h-spare-parts-seeded (2026-10-25) — master `SpareParts` dibuat di produksi

Live **sw v58** (tidak berubah — tidak ada `src/**`). **Data RTDB berubah.**

### Masalah
Node `SpareParts` **tidak ada** di RTDB produksi (root shallow: `PM_Schedule, SparePartLogs, Users, Equipment, AuditTrail, HistoryLog, _fcmTokens, AI_Settings, downtime, logs, Requisitions, Stats, Performance`). Akibatnya semua `PartsUsed` menunjuk part yang tidak ada → setiap transaksi stok ditolak `.validate` (`permission_denied`, S38f), stok tidak pernah bisa dipotong maupun dipulihkan.

### Yang dikerjakan
1. **Backup dulu**: `npm run backup:firebase` → `backups/backup-2026-10-25_13-51-07.json` (128 record).
2. **Rencana dari data operator**, bukan karangan: `scripts/plan-spare-parts-seed.mjs` menyusun payload dari `Requisitions` (nama, 52 record), `SparePartLogs` (nama resmi + stok IN/OUT + equipment, 2 record), dan `HistoryLog` (memastikan semua id `PartsUsed` tercakup, 17 record). Id tanpa nama ditandai `needsReview`, bukan diisi nama palsu.
3. **Terapkan**: `npx firebase database:set /SpareParts spare-parts-seed.json --project mtc-asset --instance mtc-asset-default-rtdb -f` (opsi `--confirm` tidak ada di versi ini; yang benar `-f`).
4. **Verifikasi**: `scripts/audit-dangling-parts.mjs` dijalankan ulang → **0 referensi menggantung**.

### Isi master (12 part)
| PartID | Stok | Nama |
|---|---|---|
| `2810-CV-009` | 1 | Gearbox;H5Y307-20 Md100,Paramax |
| `2810-CV-010` | 1 | Gearbox,With Backstop,H5Y307-13 Md100 |
| `2810-CV-011` | 0 | Gearbox;100Mm Output Bore,H5Y307-13 |
| `5060-FP-01` | 0 | ROLLER;RETURN,89X1810MM,WITH SHAFT 17MM |
| `P-007` | 0 | Filter Press Feeding Pump Pemo, Front Hardalloy Sleeve … |
| `P-008` | 0 | Filter Press Feeding Pump Pemo, Hardalloy Sleeve; Pn 1000039 … |
| `P-010` | 0 | **`P-010`** (nama belum ada di sumber mana pun, `needsReview: true`) |
| `P-011` | 0 | Filter Press Feeding Pump Pemo High Pressure Pump … |
| `P-016` | 0 | Filter Press Feeding Pump Pemo Inlet Flange |
| `P-021` | 0 | Filter Press Feeding Pump Pemo Aisi Seal Spacer |
| `P-038` | 0 | Filter Press Feeding Pump Pemo Gaskets Kit |
| `P-039` | 0 | Filter Press Feeding Pump Pemo Seal Locking Ring Aisi 316 |

`MinStock: 0` + `isLowStock: false` supaya tidak memicu alarm stok rendah palsu.

### Hasil audit sebelum vs sesudah
| Metrik | Sebelum | Sesudah |
|---|---|---|
| Referensi part di `PartsUsed` | 3 | 3 |
| Referensi menggantung | **3 (100 %)** | **0** |
| Id unik hilang | 3 | **0** |

### Perkakas
| Berkas | Isi |
|---|---|
| `scripts/audit-dangling-parts.mjs` | baca-saja, memparse `PartsUsed` bentuk legacy, membandingkan dengan key `SpareParts` **dan** `PartID` |
| `scripts/plan-spare-parts-seed.mjs` | menyusun payload master dari tiga ekspor; tidak menulis RTDB |
| tes | 9 + 11 tes untuk kedua skrip |

### Sisa
- `P-010` masih bernama id; isi nama resminya saat sudah diketahui.
- Stok 10 part lain = 0 (tidak ada jejak pergerakan). Perlu stock opname kalau ada saldo fisik.
- `MinStock` semua 0 → fitur low-stock belum akan menyala sampai minimum diisi.

## 🐞 S38f-stock-restore-guard (2026-10-25) — `Restore parts stock error: permission_denied` saat hapus WO

Live **sw v58** (`src/**` berubah ⇒ `CACHE_NAME` naik).

### Gejala
Hapus Work Order → konsol operator: `Restore parts stock error: Error: permission_denied` (stack di `assets/data-layer-*.js`). Stok part tidak kembali.

### Root cause
`deleteItem()` memulihkan stok dengan transaksi ke **child** `SpareParts/<id>/Stok`:

```js
(curr) => (curr || 0) + Number(p.qty)
```

Kalau `id` part di `PartsUsed` sudah tidak ada di `SpareParts` (id menggantung), `curr` = `null` dan transaksi menulis **hanya** `Stok`. `.validate` node part menuntut `hasChildren(['NamaPart','Stok','MinStock'])`, jadi tulisan itu ditolak dan Firebase melaporkan `permission_denied`. Mekanisme itu dibuktikan dengan rules asli di emulator (bukan dugaan): `SpareParts/P-GHOST/Stok` → `assertFails`, part lengkap → `assertSucceeds`.

Kelas bug yang sama ada di dua tempat lain: `submitLog` memotong stok tanpa guard `curr === null` **dan** tanpa clamp (bisa menulis `Stok` negatif → ditolak `.validate Stok >= 0`). Hanya `approveWO` yang sudah dijaga sejak S36.

### Perbaikan (tiga lokasi, satu bentuk)
`src/js/modules/data.js` (restore saat delete), `src/js/modules/logs.js` (potong saat submitLog, dan approveWO dinormalkan):

```js
if (curr === null || typeof curr === 'undefined') return undefined; // part tidak ada → batalkan
const qty = Number(p.qty);
if (!Number.isFinite(qty) || qty <= 0) return undefined;            // qty rusak → batalkan
return Math.max(0, Number(curr) ± qty);                             // tidak pernah negatif
```

### Tes
| Berkas | Isi |
|---|---|
| `tests/delete-stock-restore.test.js` (baru, 3 tes) | callback transaksi: `null` → `undefined`, `qty` bukan angka → `undefined`, `qty` negatif → `undefined`, stok normal `5 + 2 = 7` |
| `tests/stock-transaction-guard.test.js` (baru, 4 tes) | kontrak sumber: ketiga lokasi `SpareParts/<id>/Stok` wajib memuat `curr === null`, `Number.isFinite(qty)`, dan `Math.max(0` |
| `tests/rules/database.rules.test.js` (+4 tes) | rules asli: part tidak ada → ditolak; part lengkap → admin & supervisor boleh; user biasa ditolak |
| `tests/logs-module.test.js` (1 tes diperbarui) | asersi lama mengunci `-3` (bug); sekarang `undefined` saat part tidak ada dan `0` saat stok kurang |

Kedua tes baru dibuktikan **merah dulu**: `delete-stock-restore` 3 failed (callback mengembalikan `2`), dan kontrak sumber merah saat `Number.isFinite` dihapus dari `data.js`.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- test:run **1933 lulus / 84 berkas**
- test:rules **38 lulus**
- coverage **exit 0** — 97,13 / 88,56 / 97,34 / 98,37
- build **0**
- verify:precache **OK 66 berkas**
- E2E **11 passed (35,6 s)**

### Sisa
- Stok yang gagal dipulihkan (part sudah tidak ada) sekarang **dilewati tanpa suara**. Kalau operator perlu tahu, tambahkan `showNotification` sekali per delete yang melewatkan part — belum dilakukan supaya tidak menambah derau.
- Emulator E2E memakai rules terbuka (`e2e/database.e2e.rules.json`), jadi jalur `permission_denied` hanya bisa diuji lewat `npm run test:rules`, bukan Playwright.

## 🐞 S38e-delete-wo-gate (2026-10-25) — Supervisor tidak bisa menghapus WO

Live **sw v57** (`public/pages/**` berubah ⇒ `CACHE_NAME` naik).

### Gejala
Operator dengan role **supervisor** tidak punya cara menghapus Work Order dari UI — tombol hapus tidak pernah muncul.

### Root cause (Phase 1–3, terbukti di emulator)
1. **Rules mengizinkan**: `database.rules.json` → `HistoryLog/$logId/.write` = `auth !== null && (role === 'admin' || role === 'supervisor')`. Sama untuk `Equipment`, `SpareParts`, `Performance`, `PM_Schedule`, `Stats`.
2. **UI memblokir**: tombol hapus memakai `x-show="isAdmin"` — di `public/pages/WorkOrders.html:683`, `public/pages/AllLogs.html:211`, `public/pages/EquipmentDetail.html:38`.
3. **Delete-nya sendiri sehat**: probe Playwright + emulator (role dipaksa `supervisor`) mencatat `{xShow: 'isAdmin', visible: false}` untuk kedua halaman, tetapi `deleteItem('HistoryLog', id)` yang dipanggil langsung tetap `modalShown: true` → `Record successfully deleted`, record hilang. Jadi yang salah **gate UI**, bukan backend.
4. Probe pertama sempat mencatat `found: 0` tombol — itu **salah selektor** (`[title="Hapus log"]`; tombol di WorkOrders tidak punya `title`), bukan bukti tombol tidak ada.

### Perbaikan
- Tiga tombol hapus: `x-show="isAdmin"` → **`x-show="isAdminOrSupervisor"`** (WorkOrders, AllLogs, EquipmentDetail) — sejajar dengan rules dan dengan pola `SpareParts` yang sudah benar.
- `tests/delete-gate-contract.test.js` (baru, 2 tes) membaca fragmen **dan** `database.rules.json`: setiap tombol `deleteItem('<node>', …)` wajib `x-show="isAdminOrSupervisor"` selama rules-nya menyebut `supervisor`. Dibuktikan **merah dulu** (2 failed) sebelum fragmen diubah.
- `e2e/delete-wo.spec.js` (baru, 1 tes) — emulator, role dipaksa `supervisor`: login → halaman WO → tombol hapus **terlihat** → klik → modal konfirmasi → Delete → record hilang + notifikasi `Record successfully deleted`, nol `pageerror`; role dikembalikan ke `admin` di akhir supaya spec lain tidak terpengaruh.
- Dibuktikan menggigit: `x-show` dikembalikan ke `isAdmin` → rebuild `dist-e2e` → **E2E merah** (`supervisor harus melihat tombol hapus WO`), lalu dipulihkan.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- test:run **1926 lulus / 81 berkas**
- coverage **exit 0** — 97,14 / 88,55 / 97,34 / 98,37
- build **0**
- verify:precache **OK 66 berkas**
- E2E **11 passed (34,6 s)**

### Sisa / temuan sampingan
- Tombol hapus **Performance** (`Performance.html:269` dan `:325`) tidak punya gate sama sekali — user biasa melihatnya lalu ditolak RTDB. Kandidat perbaikan berikutnya (`x-show="isAdminOrSupervisor"`).
- Console Firefox pada tangkapan layar operator hanya berisi derau: `Ignoring unsupported entryTypes` (PerformanceObserver), font `Liberation Mono` diblokir proteksi fingerprinting, `-webkit-text-size-adjust`/`-moz-column-gap` diabaikan, dan `may not load or link to file:///`. Tidak ada error Firebase/`PERMISSION_DENIED` di sana — bukan penyebab bug ini.

## 🧭 S38d-focus-trap (2026-10-25) — Focus trap dialog + branch 88,02 → 88,55 %

Live **sw v56** (`src/js/modules/confirm-dialog.js` berubah ⇒ `CACHE_NAME` naik).

### Dialog: focus trap & reduced motion
- **Tab/Shift+Tab menyiklus dua tombol** di panel (`okBtn` ⇄ `cancelBtn`) dan tidak pernah keluar ke elemen di belakang overlay — `aria-modal` tanpa trap adalah jebakan keyboard. Escape tetap menutup sebagai batal.
- **`prefers-reduced-motion: reduce`** → kelas `transition-all`/`active:scale-95` dibuang dari kedua tombol, jadi tidak ada animasi saat OS memintanya.
- 3 tes baru di `tests/confirm-dialog.test.js` (Tab maju/mundur, Tab saat fokus sempat keluar panel, reduced-motion). Total berkas ini **20 tes**.

### Coverage 88,02 → 88,55 %
| Berkas tes | Tambahan | Cabang |
|---|---|---|
| `tests/enterprise-kpi-module.test.js` | 7 tes | `calcReliability` 4 pita (Optimal/Good/Warning/Critical × status+warna), `calcMTBF`/`calcMTTR` dengan `performanceData` kosong dan fallback 24 jam + `EquipmentID`, `calcInventoryABC` kategori A/B/C dengan `Harga` kosong, `computeEnterpriseData` (prioritas WO Emergency/Urgent/Normal, label due today/tomorrow) |
| `tests/performance-module.test.js` | 3 tes | `submitPerformance` jalur offline yang memperbarui entri lokal (`idx >= 0`), entri `null` saat mencari duplikat (`p &&`), audit opsional tanpa `window.auditModule` |
| `tests/utils.test.js` | 5 tes | `equipIdOf` (null/undefined/`{}`, prioritas `equipmentId` vs `EquipmentID`), `calculatePartLifetime` pita overdue/warning/ok, `validatePerformanceForm` HM undefined/`''`/negatif |

Hasil: **Branches 88,55 %** (5767/6512), statements 97,14, functions 97,34, lines 98,37, **1924 tes / 81 berkas**. Threshold tetap **87** — margin 1,55 poin; menaikkan ke 88 hanya menyisakan 0,55 (di bawah aturan ≥ 0,7), jadi belum di-ratchet.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- test:run **1924 lulus / 81 berkas**
- coverage **exit 0** — 97,14 / 88,55 / 97,34 / 98,37
- build **0**
- verify:precache **OK 66 berkas**
- E2E **10 passed (38,3 s)**

### Jebakan
- `calcInventoryABC` mengurutkan **menurun** menurut nilai, jadi part tanpa `Harga` (nilai 0) ada di **akhir** — asersi `abc[2].value` salah, harus `abc.at(-1)`.
- `installConfirmDialog(undefined)` mengembalikan `true` karena parameter default menangkap `undefined`; uji cabang `false` pakai `null`.

### Sisa
- `app.js` 258 cabang terlewat (85,89 %) — sasaran berikutnya bila target 88,8 %.
- `charts.js` 50 slot, `ai.js` 40 slot.

## 📈 S38c-coverage-e2e (2026-10-25) — Branch 87,36 → 88,02 % + E2E dialog konfirmasi

Live **sw v55** (tidak berubah — hanya `tests/**`, `e2e/**`, `vitest.config.js`).

### Langkah 1 — branch coverage ke ≥ 88,0 %
Sasaran dari `BRDA taken=0`, tiga berkas terbesar: `export.js` (74 slot), `logs.js` (72), `data.js` (70). Tidak ada `src/**` yang disentuh.

| Berkas tes | Tambahan | Cabang yang ditutup |
|---|---|---|
| `tests/export-module.test.js` | 5 tes | `exportToPDF` (seluruh field equipment terisi → 8 sisi `||` + tabel log/PM/part; jalur kosong; guard tanpa equipment) dan `exportWOToPDF` (`window.Alpine.raw` dipakai 3×; `logs`/`equipment`/`allParts` undefined) |
| `tests/logs-module.test.js` | 4 tes | `rejectWO` normalisasi legacy (`Downtime` string, `Cost` string kosong, `HM` numerik, `Deskripsi` 600 char dipotong 500), fallback `rejectedBy: 'supervisor'`, `window.appState`, `idx >= 0`; `getLastHM` cache per referensi `logs`, `logs` undefined, comparator tanpa `Tanggal` |
| `tests/data.test.js` | 4 tes | `checkPendingWorkOrders` (larik notifikasi sendiri + salin ke `appState`), `loadMoreEquipment` dengan `filteredEquip` undefined, getter `paginatedEquip` tanpa `filteredEquip`, `saveToIndexedDB` dengan empat koleksi undefined |

Hasil: **Branches 87,36 → 88,02 %** (5682 → 5725 / 6504), statements 97,05, functions 97,18, lines 98,29. Threshold `vitest.config.js` **86,5 → 87** (margin 1,02) dan **dibuktikan menggigit**: `88,5` → `ERROR: Coverage for branches (88.02%) does not meet global threshold`, lalu dikembalikan ke `87` (exit 0).

### Langkah 2 — E2E dialog konfirmasi (`e2e/confirm-dialog.spec.js`, 2 tes)
1. **Deep reset**: login emulator → `app.systemReset()` → overlay `[role="alertdialog"]` berjudul "Deep reset aplikasi" tampil, fokus awal di **Batal** (tone danger), klik Batal menutup dialog, sesi tetap login, dan **tidak ada** event `dialog` bawaan browser.
2. **Escape**: `app.closeRequisition()` → dialog "Tutup permintaan" tampil, fokus awal di **OK** (tone primary), `Escape` menutupnya, tetap tanpa dialog bawaan.

**Dibuktikan menggigit**: `installConfirmDialog();` dikomentari di `src/main.js` → rebuild `dist-e2e` → **2 tes merah** (`expect(locator).toBeVisible() failed`), lalu dikembalikan dan `git diff --quiet -- src/main.js` = **identik dengan HEAD** (tidak perlu bump `CACHE_NAME`).

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- test:run **1903 lulus / 81 berkas**
- coverage **exit 0** — 97,05 / 88,02 / 97,18 / 98,29 (threshold 87)
- build **0**
- verify:precache **OK 66 berkas**
- E2E **10 passed (44,4 s)** — 2 spec baru ikut jalan

### Jebakan
- `jsPDF.doc.autoTable` adalah stub bersama; `beforeEach` hanya membersihkan `jsPDF.ctor`, jadi asersi `not.toHaveBeenCalled()` pada tes berikutnya gagal palsu. Panggil `mockClear()` di awal tes yang mengasersi negatif.
- `makeCtx({ equipment })` meng-*override* dengan objek, bukan larik — `Alpine.raw(this.equipment)` lalu `equipment.find` melempar dan generator tidak pernah dipanggil. Selalu bungkus: `equipment: [equipment]`.
- `data.js:468` (`equipHasMore` saat `nextPage.length >= equipLimit`) **tidak bisa dijangkau**: `nextPage` di-slice dari `filteredEquip` mulai `currentLength`, jadi selalu kosong. Jangan dikejar.

### Sisa
- `app.js` masih 258 cabang terlewat (85,89 %) — sasaran berikutnya bila target 88,5 %.
- Dialog konfirmasi belum punya focus-trap Tab penuh.

## 🔔 S38b-confirm-dialog (2026-10-25) — `window.confirm()` diganti dialog in-app di semua modul

Live **sw v55** (`src/**` berubah ⇒ `CACHE_NAME` naik).

### Masalah
12 pemanggilan `confirm()` bawaan browser tersebar di 5 modul (auth, logs, pm-schedule, requisition, ui). Tampilannya kotak putih bawaan Chrome — tidak ikut tema gelap Tactical, tidak bisa diberi judul/ikon/tone, dan teks panjang (deep reset) terbaca seperti peringatan sistem.

### Yang dikerjakan
- **`src/js/modules/confirm-dialog.js` (baru)** — `showConfirmModal({message,title,confirmLabel,cancelLabel,tone})` membuat satu overlay imperatif (bukan markup Alpine) di `document.body`: panel `bg-tac-surface-card/95` + `backdrop-blur-xl` + `border-tac-border-tactical`, chip ikon (gold untuk `primary`, merah untuk `danger`), judul `font-black`, pesan `whitespace-pre-line`, dua tombol `min-h-11` (44 px). Klik OK → `true`, Batal/Escape/klik latar → `false`, fokus awal ke **Batal** untuk `danger` dan ke **OK** untuk `primary`, fokus dikembalikan ke elemen pemicu, dialog kedua menutup yang pertama sebagai batal (tidak menumpuk).
- **Seam `window.__confirmModal`** — `askConfirm(message, opts)` memakai dialog modern bila provider terpasang, dan jatuh ke `window.confirm()` bila tidak. `main.js` memanggil `installConfirmDialog()` sebelum Alpine boot. Konsekuensi penting: **1800+ tes lama tidak berubah** karena di jsdom provider tidak terpasang.
- **12 call site** diganti `await askConfirm(...)` dengan judul, label, dan tone per aksi: logout, kirim reset password, hapus user (`danger`), approve WO saat stok kurang (`danger`), hapus tugas PM (`danger`), selesaikan PM massal, 5 aksi requisition (hapus = `danger`), dan **deep reset** (`danger`, judul "Deep reset aplikasi", tombol "Reset sekarang").
- **`tests/confirm-dialog.test.js` (baru, 17 tes)** — jalur seam (tanpa provider, `confirm` tidak ada, provider terpasang), keputusan OK/Batal/Escape/klik latar/klik panel, singleton, label default & kustom, fokus per tone, pemulihan fokus, dan fallback saat `document.body` belum ada.

### Bukti browser nyata (Chromium 390×844, build `dist/`)
| Ukuran | Nilai terukur |
|---|---|
| Provider terpasang (`window.__confirmModal`) | `true` |
| Panel | 358 × 316 px, bg `rgba(22,29,39,0.95)`, border 1 px `rgb(40,52,70)` |
| Tombol | 308 × 44 px (keduanya), label 11 px mono uppercase |
| Tone `danger` | ikon `warning`, chip `rgba(239,68,68,0.15)`, fokus awal **Batal** |
| Tone `primary` | ikon `help`, OK `rgb(251,191,36)` solid, fokus awal **OK** |
| Klik Batal / OK | `false` / `true`, overlay hilang (`0` dialog tersisa) |
| Overflow-X dokumen | 0 px |
| Error konsol / `pageerror` | 0 |

### Biaya
| Metrik | Nilai |
|---|---|
| Muatan jalur login (gzip, 10 berkas `modulepreload`) | 61.498 → **62.895 B (+1.397 B / +1,36 KiB)** |
| Jumlah entri `modulepreload` | 10 → **10** (tidak ada chunk baru) |
| Branches | 87,39 → **87,36 %** (kode baru +39 cabang, 9 di antaranya struktural) |
| Tes | 1873 → **1890 / 81 berkas** |

Gerbang: tsc **0**, eslint **0 error / 0 warning**, test:run **1890 lulus / 81 berkas**, coverage exit **0** (96,98 / 87,36 / 97,18 / 98,22), build **0**, `verify:precache` **OK 66 berkas**, **E2E 8 passed (37,7 s)**.

### Jebakan yang ditemukan
- **`tests/legacy-palette.test.js` menangkap ligatur ikon di luar subset.** Ikon `bolt` untuk tone `primary` tidak ada di `src/css/icon-subset.txt` → tes merah ("ligatur di luar allowlist akan tampil sebagai teks, bukan ikon"). Diganti `help` (ada di subset bersama `warning`, `check`, `info`, `error`, `refresh`, `sync`, `task_alt`, `logout`). Setiap ikon baru di string JS wajib dicek ke subset itu lebih dulu.
- **`innerHTML` hanya untuk konstanta statis.** `MARKUP` tidak berinterpolasi; seluruh teks dinamis diisi `textContent`, jadi tidak ada jalur XSS dari judul/pesan.
- **Tes `installConfirmDialog(undefined)` mengembalikan `true`**, karena parameter default menangkap `undefined` — untuk menguji cabang `false` harus `null`.
- A/B muatan login dilakukan dengan `git stash push -u` → `npm run build` → ukur → `git stash pop` → **`npm run build` lagi**; tanpa build ulang setelah `pop`, `dist/` tetap build baseline.

### Sisa
- Dialog belum punya focus-trap penuh (Tab bisa keluar panel ke elemen di belakang overlay). Kalau perlu: tangkap `Tab` dan siklus antar dua tombol.
- `alert()` tidak ada lagi di `src/js/modules/**` (dicek), jadi tidak ada jalur notifikasi bawaan browser lain yang tertinggal.

## 📈 S38-coverage-branches (2026-10-25) — Branch coverage 86,62 → 87,39 %, threshold 86 → 86,5

Live **sw v54** (tidak berubah — hanya `tests/**` + `vitest.config.js`).

### Yang dikerjakan
Dua berkas tes baru, **39 tes**, sasaran dipilih dari `BRDA taken=0` di `coverage/lcov.info`:

1. **`tests/bootstrap-branches.test.js`** (13 tes) — cabang mati di `src/js/bootstrap.js`: pesan `error` kosong (`e.message || ''`), rantai `&&` watcher `logs` (logs null / kosong / terisi), guard navigasi dengan `oldVal` kosong (`oldVal || 'dash'`), wadah chart dashboard & KPI yang belum dibuat, entri chart KPI `null`, pembersihan chart enterprise dengan `_appCharts` undefined **dan** `{}`, sisi `false` watcher `kpiFilter`/`kpiFilterDate`/`performanceData` dan watcher modal, serta `onUser()` yang memuat `window.__loadNotifications` (termasuk loader yang menolak).
2. **`tests/requisition-branches.test.js`** (26 tes) — cabang sisa `src/js/modules/requisition.js`: `_reqPrevStatuses` yang tersisa tanpa `_reqSeenIds`, fallback `Someone`/`Item` untuk request baru, `openRequisitionModal` tanpa `itemName`, `submitRequisition` edit dengan default `itemType`/`priority`/`notes` dan record yang tidak ada di state, record baru tanpa `user`/prioritas (`Unknown`/`unknown`/`woNumber` dari `logs`), backlink WO saat `logs` undefined dan saat WO ditemukan, `autoReorderLowStock` dengan `allParts`/`requisitions` undefined + dedupe lewat `itemName`, `approveRequisition`/`markArrived`/`closeRequisition`/`bulkApproveRequisitions`/`deleteRequisition` saat `confirm()` dibatalkan, part yang tidak ada di `allParts`, `part.Stok` kosong dan `NamaPart` kosong, `itemAvail` tanpa `allParts`, dan `reqGetFilteredList` tanpa `createdAt`.
3. **`vitest.config.js`**: `branches` **86 → 86,5**. Dibuktikan menggigit: `87,5` → `ERROR: Coverage for branches (87.25%) does not meet global threshold`, lalu dikembalikan ke `86,5` dan `npm run test:coverage` exit **0**.

### Hasil
| Metrik | Sebelum (S37c) | Sesudah |
|---|---|---|
| Branches | 86,62 % (5600/6465) | **87,39 %** (5650/6465) |
| Statements | 96,84 % | **96,97 %** |
| Functions | 97,09 % | **97,16 %** |
| Lines | 98,19 % | **98,21 %** |
| Tes | 1834 / 78 berkas | **1873 / 80 berkas** |
| Threshold branches | 86 | **86,5** (margin 0,89 poin) |

Gerbang: tsc **0**, eslint **0 error**, test:run **1873 lulus / 80 berkas**, coverage exit **0**, build **0**, `verify:precache` **OK 66 berkas**.

### Sisa (dan kenapa tidak dikejar)
- `bootstrap.js:112` — satu sisi `&&` (`window._appCharts` falsy) tetap `taken=0` walau jalur itu dipanggil di tes; slot cabangnya tidak bertambah. Satu cabang, tidak sepadan dengan waktu.
- `requisition.js:189/191/214/216` — **mustahil dijangkau**: filter `itemName && quantity > 0` sudah menjamin `validItems[0].itemName` dan `i.quantity` terisi, jadi sisi kanan `|| item.itemName` dan `|| 0` mati secara struktural.
- `requisition.js:442` — `openWOs` menyaring `l.woNumber` **sebelum** comparator, jadi `String(b.woNumber || '')` tidak pernah jatuh ke `''`.
- Kandidat berikutnya bila butuh margin lagi: `data.js` (82,5 % branch), `export.js` (81,99 %), `logs.js` (84,9 %), `enterprise-kpi.js` (85,64 %), `performance.js` (85,64 %).

### Brief sesi berikutnya (S39)
Target: **branch 87,39 → 88,0 %** (± 40 cabang). Sasaran terukur dari `BRDA taken=0`: `data.js` + `export.js` + `logs.js` (tiga berkas terbesar yang branch-nya di bawah 85 %). Jangan sentuh `src/**`; kalau terpaksa, bump `CACHE_NAME`. Threshold jangan diturunkan; ratchet ke **87,5** hanya setelah hasil ≥ 88,2 %.

## 📈 S37c-notification-branches (2026-10-25) — Branch coverage 86,35 → 86,62 %

Live **sw v54** (tidak berubah — hanya `tests/**`).

### Yang dikerjakan
`tests/notification-checkers.test.js` +16 tes, dua kelompok:

1. **Guard state kosong** — `window.app` belum ada, `notifications` bukan array, notifikasi duplikat (tipe+pesan sama), auto-reorder hanya untuk admin/supervisor, dan kegagalan auto-reorder tidak menjatuhkan `checkAllNotifications()`.
2. **Kategori > 3 item** — sisi `true` dari setiap ternary `length > 3 ? ' +N lainnya' : ''` di keenam checker (low stock, WO urgent, WO aging, PM overdue, PM due soon, lifetime), plus fallback `NamaPart || PartID` dan `woNumber || 'N/A'`, plus part dengan `lastReplaceDate` rusak yang harus dilewati.

Jebakan yang ditemukan: pesan hanya memuat **tiga item pertama** (`slice(0, 3)`), jadi item "tanpa NamaPart"/"tanpa woNumber" harus ditaruh di posisi 1–3 — kalau di posisi ke-4 ia tidak pernah muncul dan asersinya gagal walau kodenya benar.

### Hasil
| Metrik | Sebelum | Sesudah |
|---|---|---|
| Branches | 86,35 % (5583/6465) | **86,62 %** (5600/6465) |
| Statements | 96,83 % | 96,84 % |
| Functions | 97,09 % | 97,09 % |
| Lines | 98,19 % | 98,19 % |
| Tes | 1823 / 78 berkas | **1834 / 78 berkas** |

Gerbang: tsc **0**, eslint **0 error**, coverage exit **0**, build **0**, `verify:precache` **OK 66 berkas**.

### Sisa
- Margin 0,62 poin = 40 cabang dari baseline 86,00. Sasaran 87 % butuh **+25 cabang lagi**: `bootstrap.js` (13 terlewat) + blok `submitRequisition` di `requisition.js` (~12).
- Threshold `vitest.config.js` masih **86** — ratchet ke 86,5 baru aman setelah putaran berikutnya.

## 📈 S37b-coverage-margin (2026-10-25) — Branch coverage diberi margin

Live **sw v54** (tidak berubah — hanya `tests/**` yang disentuh).

### Masalah
Branch coverage tepat **86,00 %** (5560/6465) — lulus tapi tanpa margin; satu cabang baru tanpa tes langsung merah.

### Yang dikerjakan
- `tests/chart-palette.test.js` (baru, 9 tes): passthrough nama token mentah, alpha opsional (termasuk alpha `0`), fallback abu-abu saat token CSS tidak terpasang / `getComputedStyle` melempar, invalidasi cache per tanda tema.
- `tests/component-loader.test.js` (baru, 9 tes): cache hit tanpa `fetch` kedua, HTTP gagal → rejection, injeksi ke elemen target, `preload`, `clearCache`, singleton `window.componentLoader`.
- `tests/export-module.test.js` (+6 tes): cabang state kosong `exportData` — `window.Alpine` absen, state `null`/`undefined`, ternary `typeof … === 'string'` untuk `events`/`PartsUsed`/`PhotoURLs`, `EquipmentIDs` array vs string.

Catatan jebakan: `chart-palette` menyimpan cache per tanda tema, jadi tema harus **unik per tes** — kalau tidak, nilai cache dari tes sebelumnya membuat asersi fallback lolos/gagal secara palsu.

### Hasil
| Metrik | Sebelum | Sesudah |
|---|---|---|
| Branches | 86,00 % (5560/6465) | **86,35 %** (5583/6465) |
| Statements | 96,41 % | 96,83 % |
| Functions | 96,55 % | 97,09 % |
| Lines | 97,69 % | 98,19 % |
| Tes | 1799 / 76 berkas | **1823 / 78 berkas** |

Gerbang: tsc **0**, eslint **0 error**, coverage exit **0**, build **0**, `verify:precache` **OK 66 berkas**.

### Sisa
- Margin 0,35 poin = 23 cabang. Threshold `vitest.config.js` **tidak** dinaikkan (tetap 86) — ratchet baru masuk akal setelah margin ≥ 0,7 poin.
- Sasaran berikutnya bila butuh margin lebih: `notification.js` (26 cabang terlewat), `bootstrap.js` (13), `requisition.js` blok `submitRequisition` edit-vs-baru (~12).

## 🔧 S37-create-user-fix (2026-10-24) — Admin tidak bisa menambah user (`auth/email-already-in-use`)

Live **sw v54**. Mengatasi `[Auth] Create user error: FirebaseError: Error (auth/email-already-in-use)`.

### Root Cause
1. `createUser()` memanggil `createUserWithEmailAndPassword(window.auth, …)` — API ini **menggeser `currentUser`** ke akun baru, jadi sesi admin hilang tepat setelah akun dibuat.
2. Penulisan profil `Users/<uid>` karenanya dilakukan oleh akun baru itu, yang belum punya `role`. Rule `Users/$uid/role.validate` (`root.child('Users').child(auth.uid).child('role').val() === 'admin' || data.val() === newData.val()`) menolak → `PERMISSION_DENIED`.
3. Hasilnya **akun Auth yatim**: ada di Authentication, tidak ada di RTDB. Percobaan ulang dengan email sama selalu gagal `auth/email-already-in-use`.

### Perbaikan
- Akun dibuat di **app Firebase sekunder** (`initializeApp(config, 'user-create')` + `getAuth`), dimuat dinamis (`import('firebase/app')`, `import('firebase/auth')`) sehingga tidak menambah chunk jalur login — 8 entri `modulepreload` sebelum & sesudah, set chunk identik.
- Profil `Users/<uid>` ditulis oleh sesi **admin** di app utama → lolos `.write` (cabang admin) dan `role.validate`.
- **Adopsi akun yatim**: bila `auth/email-already-in-use`, `signInWithEmailAndPassword` dicoba di app sekunder dengan password yang diketik admin. Cocok → uid lama dipakai, profilnya ditulis. Tidak cocok → pesan berisi instruksi reset/hapus di Firebase Console.
- Cleanup `finally`: `signOut` + `deleteApp` app sekunder (gagal pun tidak menjatuhkan alur); app basi bernama sama dihapus lebih dulu.
- `window.firebaseConfig` dibuka di `firebase-config.js`; `globals.d.ts` diperbarui.

### Verifikasi
- `tests/auth-module.test.js` +9 tes (65 di berkas itu): auth sekunder dipakai, sesi admin tidak di-signOut, adopsi uid lama, password beda → gagal rapi, cleanup tahan gagal, app basi dihapus.
- Gerbang: tsc **0**, eslint **0 error**, vitest **1799 lulus / 76 berkas**, coverage 96,41 / 86 / 96,55 / 97,69 (exit 0), build **0**, `verify:precache` **OK 66 berkas**.

### Sisa / catatan
- Akun yatim lama hanya bisa diadopsi kalau admin tahu password-nya; kalau tidak, harus dihapus di Firebase Console (Authentication → Users). Tidak ada jalur client-side untuk mencari uid dari email.

## 📝 S36-approve-wo-fix (2026-10-24) — Perbaikan bug permission_denied saat Approve Work Order

Live **sw v53**. Mengatasi error `Approve WO Error: Error: permission_denied`.

### Root Cause
1. **Validasi Stok RTDB**: Pada `src/js/modules/logs.js:approveWO()`, pemotongan stok part dilakukan via `runTransaction(ref(db, 'SpareParts/' + p.id + '/Stok'), curr => (curr || 0) - Number(p.qty))`. Saat part mengalami kekurangan stok (shortage) dan supervisor memilih "OK = tetap approve", callback mengembalikan nilai negatif. Aturan Firebase RTDB di `database.rules.json` pada `SpareParts/$partId/.validate` mewajibkan `newData.child('Stok').val() >= 0`. Nilai negatif langsung ditolak RTDB sebagai `permission_denied`.
2. **Part ID Tidak Terdaftar**: Jika WO merujuk part ID yang tidak terdaftar di node `SpareParts` (`curr === null`), transaksi membuat node baru yang kehilangan field wajib `NamaPart` dan `MinStock`, melanggar `newData.hasChildren(['NamaPart', 'Stok', 'MinStock'])` dan menghasilkan `permission_denied`.
3. **Ketiadaan Error Boundary Transaksi**: Transaksi stok tidak dibungkus `try/catch` per part (berbeda dari `createLog`), sehingga kegagalan transaksi part langsung menghentikan eksekusi dan membatalkan update status WO ke `HistoryLog`.
4. **Data Legacy Non-Numerik**: Jika record WO lama memiliki field `Downtime` atau `Cost` bernilai string kosong `""`, aturan `HistoryLog/$logId/.validate` (`(!newData.hasChild('Downtime') || newData.child('Downtime').isNumber())`) akan menolak pembaruan record dengan `permission_denied`.

### Perbaikan
- **Guard Transaksi Stok Part**:
  - Jika `curr === null || typeof curr === 'undefined'`, kembalikan `undefined` (membatalkan transaksi tanpa menulis node tidak valid).
  - Nilai stok diklem dengan `Math.max(0, (curr || 0) - Number(p.qty))` agar tidak pernah negatif dan mematuhi aturan `Stok >= 0`.
  - Setiap transaksi part dibungkus dalam blok `try { ... } catch (err) { logger.warn(...) }` sehingga kegagalan potong stok pada satu part tidak membatalkan approval WO.
- **Normalisasi Field Legacy**:
  - Pada `approveWO()` dan `rejectWO()`, nilai `Downtime` dan `Cost` dinormalisasi ke `Number` jika bukan number.
  - `HM` dipastikan `String`, dan `Deskripsi` dipotong max 500 karakter sesuai batas `.validate`.
- **Unit Test Baru**:
  - `tests/logs-module.test.js`: menguji bahwa callback transaksi stok mengklem nilai ke 0 saat defisit, abort saat null, dan kegagalan transaksi part tidak menggagalkan approval WO.
- **Catatan Akun RTDB**:
  - Aturan `.write` pada `HistoryLog` dan `SpareParts` mewajibkan `root.child('Users').child(auth.uid).child('role').val() === 'admin' || ... === 'supervisor'`. Pastikan akun pengguna yang digunakan di produksi memiliki field `role` bernilai `'admin'` atau `'supervisor'` di node `Users/{uid}` pada Realtime Database.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- vitest **1790 tes / 76 berkas**
- coverage **96,40 / 86,00 / 96,62 / 97,68**
- build ok · precache **66/66**

## 📝 S36-mobile (2026-10-24) — Perapihan layout mobile, form input, dan modal

Live **sw v53** (siap di-push). Lanjutan S36-form-c.

### Yang dirapikan
- **Header mobile (`public/pages/app-shell.html`)**:
  - Subtitle brand `Industrial Telemetry Core` disembunyikan di layar HP (`hidden sm:block`) agar nama `MTC ASSET` tidak tertekan atau terpotong pada viewport 360 px.
  - Aksi utilitas sekunder `Export Excel` dan `Refresh` disembunyikan dari header mobile (`hidden sm:flex`), disederhanakan menjadi 4 aksi esensial (`+ NEW WO`, `Notifications`, `Scan QR`, `Logout`).
  - Pintasan utilitas cepat `Refresh` dan `Export Excel` dipindahkan ke drawer mobile `More Menu` agar tetap bisa diakses cepat oleh operator HP.
- **Modal bertoken & responsif HP (`public/pages/app-shell.html`)**:
  - **Asset Config (`showEquipModal`)**: padding modal diturunkan dari `p-10 rounded-[2.5rem]` ke `p-5 sm:p-8 lg:p-10 rounded-2xl md:rounded-[2.5rem]`, grid diganti `.form-grid` bertoken.
  - **Spare Part (`showPartModal`)**: padding modal disesuaikan `p-5 sm:p-8 lg:p-10 rounded-2xl md:rounded-[3rem]`, grid stok/level/harga 3-kolom kaku diganti `.form-grid` bertoken (1 kol HP, 2 kol tablet, 3 kol desktop).
  - **Performance Log (`showPerformanceModal`)**: padding `p-5 sm:p-8 lg:p-10`, grid info dasar disesuaikan `grid-cols-1 md:grid-cols-3 gap-4`.
  - **Maintenance Log (`showLogModal`)**: padding `p-5 sm:p-8 lg:p-10`, bukti foto 4-kolom kaku diganti `.form-grid`.
  - **QR Preview (`showQRPreviewModal`)**: padding modal `p-5 sm:p-10 rounded-2xl sm:rounded-[3rem]`, tombol aksi reflow `grid-cols-1 sm:grid-cols-2`, menghapus risiko overflow QR canvas di layar 360 px.
- **Form Work Order (`public/pages/WorkOrders.html`)**:
  - Baris komponen part `logForm.parts` yang sebelumnya kaku `grid-cols-12` (membuat tombol hapus terjepit jadi sliver 25 px dan Qty sempit 100 px) di-reflow responsif: `grid-cols-1 sm:grid-cols-12` dengan target tap minimal 44 px dan label hapus di mobile.
- **Form Requisition (`public/pages/RequestPart.html`)**:
  - Sub-grid peralatan tujuan dan link WO / prioritas / catatan disapu dari `grid-cols-12` ke `.form-grid` bertoken.
- **Kalender PM Schedule (`public/pages/PMSchedule.html`)**:
  - Wadah kalender 7 hari diberi `overflow-x-auto` dengan `min-w-[560px] lg:min-w-0` agar kolom tanggal tidak terhimpit menjadi irisan 40 px yang tidak terbaca di layar HP.
- **`sw.js` v52 → v53**.

### Verifikasi viewport HP (CDP Emulation & Browser Probe)
| Target | Viewport | Coarse Pointer | Overflow-X | Kontrol Terlihat | Min Touch Size | Status |
|---|---|---|---|---|---|---|
| Android Mid | 360×800 (dpr 3) | **true** | **0 px** | 8 | **24 px** (checkbox) · 44 px (input/btn) | PASS |
| iPhone 14/15 | 390×844 (dpr 3) | **true** | **0 px** | 8 | **24 px** (checkbox) · 44 px (input/btn) | PASS |

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- vitest **1789 tes / 76 berkas**
- coverage **96,43 / 86,12 / 96,55 / 97,75**
- build ok · precache **66/66**


## 📝 S36-form-c (2026-10-24) — Label 110 kontrol dirapikan + verifikasi viewport HP

Live **sw v52** (belum di-push). Lanjutan S36-form-b.

### Yang berubah
- **110 `aria-label`** yang sebelumnya hasil turunan mesin (`All Logs Jenis Filter`, `Pm Filter
  Equip`, `Mp Month`) diganti teks Indonesia yang enak dibaca (`Filter jenis log`, `Filter
  equipment PM`, `Bulan rencana`). Istilah teknis tetap Inggris sesuai konvensi UI repo:
  WORK ORDER, PM, MTBF, HM, RCA, PA plan, working hours, breakdown.
- **`sw.js` v51 → v52.**

### Verifikasi viewport HP (emulasi CDP, bukan resize)
| Properti | Nilai |
|---|---|
| Viewport | 360×800, dpr **3**, `mobile=true` |
| `pointer: coarse` | **true** |
| Overflow horizontal | **0 px** |
| Kontrol terlihat | 3 (layar login) |
| Tinggi kontrol terkecil | **24 px** (checkbox) · input 44 px |
| Service worker aktif | ya |

Screenshot dibaca dengan `vision_analyze`: tidak ada teks terpotong, tidak ada elemen meluber,
tidak ada kontrol bertumpuk, dan checkbox tampil sebagai kotak bergaris gelap — bukan kotak
putih native. Emulasi direset setelah probe.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- vitest **1789 tes / 76 berkas**
- coverage **96,43 / 86,12 / 96,55 / 97,75** — identik
- build ok · precache **66/66**
- E2E **5 passed / 3 skipped** (39,1 s)

### Jebakan yang kena di sesi ini
**`vite dev` yatim di port 3000 membuat seluruh E2E gagal dengan `auth/invalid-credential`.**
Gejalanya menyesatkan: `#login-id` tetap terisi, tombol tidak disabled, `submitLogin` ada,
`isLoading` false — hanya gate yang tidak terbuka. Penyebabnya `reuseExistingServer: true` di
`playwright.config.js` memakai ulang dev server sisa run sebelumnya yang berjalan **tanpa**
`VITE_USE_EMULATORS=1`, sehingga sign-in menembak Firebase produksi dan user E2E tidak ada di
sana. Perbaikannya: matikan listener **3000** juga (bukan cuma 9000/9099) sebelum menjalankan
ulang. Probe diagnosis yang dipakai: tangkap `pageerror` + `console` lalu baca
`auth/invalid-credential` dari log — bukan menyimpulkan dari `toBeHidden` yang timeout.

## 📝 S36-form-b (2026-10-24) — Nama aksesibel 132 kontrol, 14 grid form, checkbox kustom

Lanjutan S36-form. Live **sw v51** (belum di-push).

### Yang berubah
- **132 `aria-label`** ditambahkan ke kontrol yang tidak punya nama aksesibel, di 15 berkas.
  Sumber teks, berurutan: teks `<label>` terdekat (81), `placeholder` (11), `x-model` yang
  di-humanize (30), dan 10 sisanya (file input impor, checkbox baris tabel, field readonly).
  Ligatur ikon Material yang ikut terbaca sebagai teks dibersihkan (`assignmentNO RESV` →
  `NO RESV`). Tidak ada elemen yang dapat `aria-label` statis sekaligus `:aria-label` Alpine.
- **14 grid form** di dalam `<form>` disapu ke `.form-grid` (`app-shell` 7 · `PMSchedule` 3 ·
  `WorkOrders` 3 · `RequestPart` 1). Grid kartu KPI **tidak** disentuh — filternya: punya
  `bg-`/`border`/`shadow`/`rounded` berarti bukan grid field.
- **Checkbox & radio kustom** — `appearance:none`, 24 px, radius 5 px, kotak centang SVG
  sendiri, titik radio, ring fokus, state disabled. Selector atribut (0,1,1) mengalahkan
  utility `.w-4`/`.w-5` (0,1,0), jadi checkbox lama yang membawa kelas Tailwind ikut 24 px.
- **`tests/form-controls.test.js`** 13 → **18 tes**: nama aksesibel per kontrol, larangan
  `grid-cols-2` tersisa di dalam `<form>`, minimal 14 `.form-grid`, kotak cek digambar sendiri,
  dan ukuran ≥ 24 px.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- vitest **1789 tes / 76 berkas** (+7 dari 1782)
- coverage **96,43 / 86,12 / 96,55 / 97,75** — identik, threshold tidak disentuh
- build ok · precache **66/66**
- E2E **5 passed / 3 skipped** (41,8 s)
- Bukti menggigit: satu `aria-label` dihapus → 1 merah · satu `grid-cols-2` dikembalikan →
  1 merah · `:checked::after` diganti `::before` → 1 merah · ketiganya revert hijau.
- Terukur di build baru: `#keep-session` **24×24**, `appearance:none`, radius **5px**,
  bg `rgb(10,14,20)`, border `1px rgb(40,52,70)`.

### Pelajaran
1. **Deteksi "sudah berlabel" harus memeriksa `<label for>` DAN `aria-label`, bukan id saja.**
   Hitungan awal 16 kontrol tanpa label ternyata 132 — markup repo ini mayoritas memakai
   `<label>` tanpa `for` di atas input tanpa `id`, pola yang tidak terdeteksi oleh cek `for=`.
2. **`aria-label` statis jangan ditambahkan ke elemen yang punya `:aria-label`** (binding Alpine) —
   keduanya akan bertabrakan dan yang statis menang, mematikan teks dinamis. Saring dengan
   `(?<!:)\baria-label=` saat memindai.
3. **Menyapu grid harus memfilter kelas visual.** `grid-cols-2` juga dipakai kartu KPI; tanpa
   filter `bg-`/`border`/`shadow`, 71 grid ikut berubah dan tata letak kartu rusak.

## 📝 S36-form (2026-10-24) — Sistem kontrol form bertoken: 174 kontrol, satu tinggi per konteks

Live **sw v50** (belum di-push). Mockup: `design/mockups/form-controls.html` (standalone, 43 KB,
tanpa build) — disetujui sebelum implementasi.

### Temuan awal (inventaris, bukan taksiran)
| Metrik | Angka |
|---|---|
| Kontrol form di repo | **174** (input 139 · select 19 · textarea 2 · 14 hidden) |
| Kombinasi `(tag, class)` unik | **79** |
| Berkas terdampak | 19 (`index.html` + 18 fragmen `public/pages/`) |
| Tinggi kontrol sebelum | 21 px (filter) · 24–40 px (form) — **di bawah WCAG 2.2 target 24 px** |
| Token surface dipakai | 2 (`recessed` + `container-low`) · radius 0/4/8/16 px |

Akar masalahnya `src/css/style.css:112` — satu blok `!important` memaksa bg/border/radius untuk
SEMUA kontrol. Efeknya utility Tailwind di markup mati, tidak ada jalan opt-out, dan tinggi
kontrol sepenuhnya ditentukan padding acak di 79 kombinasi kelas.

### Yang berubah
- **`src/css/style.css`** — blok `!important` diganti sistem bertoken. Menang lewat
  spesifisitas `:is()` (0,2,1), bukan `!important`. Token baru: `--field-h` 44 px ·
  `--field-h-sm` 36 px · `--field-h-xs` 32 px · `--field-px` 12 px · `--field-radius` 8 px ·
  `--field-ring` (2 px emas) · `--field-ring-err` · `--field-well` (inset neumorphic).
- **State lengkap** — hover, `:focus`/`:focus-visible` (ring 2 px, menggantikan `outline:none`
  tanpa pengganti), `[aria-invalid='true']`, `:disabled`, `[readonly]` (border putus-putus),
  checkbox/radio 24 px + `accent-color`.
- **Opt-out `.tac-well`** — kontrol di dalam well (layar login) tetap transparan tanpa border;
  tanpa ini bg/border ganda menutupi well. Terukur: `#login-id`/`#login-key` 44 px,
  `background rgba(0,0,0,0)`, `border 0px`.
- **41 kontrol filter di 15 berkas** ditandai `field-compact` → 32 px. Kriteria penandaan:
  punya `bg-tac-surface-recessed` + `font-label-mono` + bukan `w-full`. Terukur 32 px.
- **`.form-grid`** 1 → 2 → 3 kolom menurut **lebar wadah**. `container-type` dipasang di induk
  lewat `form:has(> .form-grid)`; cadangan media query di `@supports not selector(:has(*))`.
  Diterapkan ke 3 baris form Spare Part di `app-shell.html`. Terukur di modal 430 px: **2 kolom**
  (media query murni memberi **3 kolom ~130 px** — itu yang ditolak).
- **`tests/form-controls.test.js`** (13 tes) mengunci token, larangan kembalinya blok
  `!important`, fokus yang tidak boleh mematikan outline tanpa `box-shadow`, sweep
  `field-compact`, dan container-type di induk (bukan di grid).
- **`eslint.config.js`** — `.archify/**` masuk ignores; skrip `.mjs` di working dir tool itu
  memakai `process`/`console` dan membuat `npm run lint` merah tanpa sebab.

### Gerbang (dijalankan di turn yang sama)
- tsc **0**
- eslint **0 error / 0 warning**
- vitest **1782 tes / 76 berkas** (dari 1771/75; +13 tes baru)
- coverage **96,43 / 86,12 / 96,55 / 97,75** — identik baseline, threshold tidak diturunkan
- build ok · precache **66/66**
- E2E **5 passed / 3 skipped** (54,3 s) — 3 skip = `css-critical-path` yang butuh `E2E_PREVIEW=1`
- Bukti menggigit: mutasi `--field-h-xs: 20px` → 2 tes merah; satu kontrol kehilangan
  `field-compact` → 1 tes merah; keduanya revert hijau.

### Belum dikerjakan (sengaja)
- **Sweep label**: 16 kontrol di markup belum punya `<label for>`/`aria-label` (input pencarian
  di filter bar). Tidak masuk pass ini karena mengubah markup + butuh keputusan teks label.
- **71 `grid-cols-2` lain** belum dipindah ke `.form-grid`; hanya 3 baris form Spare Part.
- **Checkbox `PMSchedule.html` tanpa class** masih memakai `accent-color` global, bukan kotak
  kustom seperti mockup.

### Pelajaran
1. **Container query di elemen grid tidak bisa meng-query dirinya sendiri.** `container-type`
   di `.form-grid` membuat aturan `@container … { .form-grid { … } }` tidak pernah cocok dan
   grid jatuh permanen ke 1 kolom — tanpa satu pun error. Wadahnya harus induk.
2. **Media query untuk form di dalam modal salah sasaran.** Modal Spare Part hanya 430 px di
   layar 1280 px; media query memaksanya 3 kolom ~130 px. Ukur lebar wadah, bukan viewport.
3. **`:is()` menggantikan `!important` tanpa kehilangan daya tekan** — (0,2,1) sudah mengalahkan
   utility (0,1,0), dan opt-out cukup ditulis sesudahnya satu tingkat lebih tinggi.
4. **Probe sintetis (fragmen di-inject) tidak bisa dipercaya untuk tinggi kontrol** kalau modal
   bertumpuk `position:fixed`; satu input terbaca 19 px di sana. Angka yang dipakai adalah hasil
   sesi emulator nyata.

## 📝 S36-diagram (2026-10-24) — Peta sistem MTC-Asset: 4 artefak diagram

**Archify 3.2.0 dipasang permanen** sebagai skill Hermes: paket di `%LOCALAPPDATA%\hermes\skills\archify`, shim bash di `~/.local/bin/archify` (sudah di PATH), launcher Windows di `<paket>\bin\archify.cmd`. Perintah `archify <subcommand>` langsung jalan tanpa path panjang. Tidak ada entri di npm global, tidak ada di `node_modules` repo.

Dibangun dengan Archify 3.2.0 (dipasang permanen sebagai skill Hermes — lihat baris di atas; **bukan** `npm i archify`, nama itu paket lain). Clone sementara di scratch sudah dihapus; semua artefak dibuat dari paket terpasang.

### Artefak (semua lolos 4 gate: validate · deliver · check · browser-check)
| File | Tipe | Isi |
|---|---|---|
| `docs/mtc-asset-usage-flow.html` | workflow | 5 lane · 17 node · 19 relasi — 10 modul README (termasuk KPI Analytics + AI Analysis) |
| `docs/mtc-asset-work-order-lifecycle.html` | lifecycle | 8 status WO + jalur tolak/revisi |
| `docs/mtc-asset-request-part-sequence.html` | sequence | 6 partisipan · 12 pesan — request part → stok |
| `docs/mtc-asset-dataflow.html` | dataflow | 4 tahap — form → RTDB → cache/push → log/KPI |
| `docs/mtc-asset-architecture.html` | architecture | 10 komponen · 3 boundary — PWA, Firebase, pihak ketiga, Vercel |
| `docs/mtc-asset-data-tree.html` | tree | 16 simpul — struktur koleksi RTDB |
| `docs/mtc-asset-pm-schedule-sequence.html` | sequence | 6 partisipan · 10 pesan — jadwal jatuh tempo → auto-log |
| `docs/mtc-asset-ai-analysis-sequence.html` | sequence | 6 partisipan · 10 pesan — konteks WO → provider + cadangan |
| `docs/mtc-asset-permission-matrix.html` | HTML table | 10 modul × 3 peran (bukan archify — matriks adalah tabel) |
| `docs/mtc-asset-offline-sync-sequence.html` | sequence | 6 partisipan · 10 pesan — tulis offline → antrean → sinkron |
| `docs/mtc-asset-release-lifecycle.html` | lifecycle | 5 tahap — commit → build → preview → produksi → klien |
| `docs/mtc-asset-kpi-formula.html` | dataflow | 4 tahap — wh/stb/bd/freq → avail → PA → gap |
| `docs/mtc-asset-backup-sequence.html` | sequence | 6 partisipan · 10 pesan — backup, verifikasi, restore |
| `docs/mtc-asset-import-sequence.html` | sequence | 6 partisipan · 10 pesan — CSV/XLSX → validasi → RTDB |
| `docs/mtc-asset-observability.html` | dataflow | 4 tahap — error + web vitals → DSN → dashboard/alert |
| `docs/mtc-asset-diagrams.html` | index | halaman penghubung kelima belasnya |
| `docs/mtc-asset-dashboard.html` | dashboard | grid 16 kartu + filter jenis + pencarian + panel pratinjau (iframe dimuat saat diklik) |

Sumber kandidat JSON: `.archify/{workflow-usage,lifecycle-wo,sequence-requestpart,dataflow}-*/candidate.json`.
`.archify/` **belum** masuk `.gitignore` — tambahkan sebelum commit kalau tidak mau ikut.

### Batas keras Archify yang terukur (biar tidak mengulang trial-error)
- `col` maksimum **5** → maksimum 6 kolom.
- Satu node per lane per kolom; `yOffset` **tidak** menambah baris (lane height tetap) → 5 lane × 6 kolom plafon praktis 16–18 node.
- 6 lane mustahil: tinggi minimum 838 px, sedangkan rasio canvas wajib ≥ 1,55 dan lebar ≤ 1240 → gagal.
- Lebar node ≤ 60 px agar clearance antar kolom 10 px (gate butuh 8 px terarah / 28 px langsung).
- Sublabel ≤ 8 karakter agar font tetap ≥ 6 px pada skala desktop.
- Phase `fromCol`/`toCol` tidak boleh berbagi kolom; label fase ≤ ~92 px per kolom.
- `finalize` menolak menimpa `*.browser-check.json` lama — hapus sidecar dulu.
- Perbaikan cepat: `ARCHIFY_UPDATE_CHECK_DISABLED=1` untuk semua run skrip.

## 📝 S33ah (2026-10-22) — `logo.png` 16,1 → 4,7 KiB (total login **151 → 140 KiB**) + `exportData` format excel|csv (G)

Live **sw v49**. Tiga commit: `b93d2ab` (WebP header + `exportData`) · `2255d8a` (palette q90) ·
`667d5bf` (palette q80). `f4e9882` (favicon 48×48) **dibatalkan** — lihat "Premis kartu yang salah".

### Angka live (3 run `simulate`, `npx --no-install lighthouse`)
| audit | sebelum (v45) | sesudah (v49) |
|---|---|---|
| `total-byte-weight` | 155.095 B / 151 KiB | **143.305 B / 140 KiB** (median; 143.316 · 143.272 · 143.305) |
| selisih | — | **−11.790 B = −11,5 KiB** (kriteria ≥ 10 KiB) |
| `unused-javascript` | 0 KiB | **0 KiB** |
| `unused-css-rules` | 0 KiB | **0 KiB** |
| request `logo.png` | 16,1 KiB | **4,69 KiB** |
| perf | 96–99 | 96 · 97 · 97 |
| CLS probe (`cls-probe.mjs 3 0.02`) | 0,000 | **0,000 ×3** (LULUS) |

### Premis kartu yang salah (diukur, bukan diduga)
`logo.png` 16,1 KiB di jalur login **bukan** `<img>` header shell — elemen itu
`loading="lazy"` **dan** di dalam panel `hidden lg:block`, jadi tidak pernah diminta di
layar login. Yang meminta adalah **ikon manifest** (`manifest.json` → `logo.png`):
`resourceType: Other`, mendarat ~1234 ms, satu batch dengan favicon.
Bukti: favicon diganti ke `/icons/favicon-48.png` (`f4e9882`) → `logo.png` **tetap**
diminta 16,1 KiB, total malah **151 → 153 KiB**. Percobaan itu dibatalkan (`2255d8a`).

### Yang menang
| perubahan | byte |
|---|---|
| `logo.png` di-re-encode palette PNG (nama, 180×180, format **sama**; alpha asli seluruhnya 255 → dibuang; q80) | 16.743 → **4.397 B** |
| `logo.webp` (q90, 180×180) untuk `<picture><source>` header shell, fallback PNG | 2.508 B (berlaku **setelah** login) |
| `manifest.json` + `favicon` **tidak disentuh** (tetap PNG) | 0 |

Fidelity palette q80 diukur terhadap aslinya: 0,88 % piksel menyimpang > 8/255, maks 22, mean 0,40.
q90 (6.255 B) hanya −9,7 KiB → di bawah kriteria, karena itu q80.

### `exportData(type, format)`
`_format` yang selalu diabaikan (temuan S33ad) sekarang dipakai:
`'excel'` → `XLSX.utils.book_new` + sheet `Data` + `XLSX.writeFile(...xlsx)`;
`'csv'` **dan tanpa argumen** → jalur lama (`sheet_to_csv` + Blob + `<a download>`).
Tiga tes baru di `tests/export-module.test.js` (excel menulis `.xlsx`, sheet ke workbook,
default tetap CSV). **Dibuktikan menggigit**: `format === 'xlsx'` → 2 tes merah → revert.
Bukti browser nyata (probe Playwright + emulator, dihapus setelah dipakai):
`EXCEL_DOWNLOAD=Equipment_Export_1792660675429.xlsx`, `DEFAULT_DOWNLOAD=Equipment_Export_…csv`.
**Belum ada UI**: kelima tombol halaman masih `exportData(x,'csv')` — cabang `excel`
belum punya pemicu; itu keputusan produk, bukan bug.

### Gerbang
- tsc **0**
- eslint **0 error / 0 warning**
- tes **1771 / 75 berkas** (dari 1767 / 74)
- coverage **96,43 / 86,12 / 96,55 / 97,75** (ratchet 96/86/96/97 tetap)
- build ok · precache **66/66** (`logo.webp` masuk `includeAssets` + `verify-precache`)
- E2E **8 passed (29,3 s)** · probe export browser **1 passed**
- live: `sw.js` = `mtc-asset-v49`, `logo.png` 4.497 B, `logo.webp` 2.508 B (`image/webp`),
  `pages/app-shell.html` memuat `logo.webp` 1×, precache memuat `logo.webp`

### Pitfall baru
- **`total-byte-weight` menghitung request di luar markup halaman.** Ikon manifest
  (`resourceType: Other`) tetap diunduh browser walau halaman tidak menampilkannya, jadi
  menukar `<link rel="icon">` **tidak** menghapus byte itu — satu-satunya cara adalah
  memperkecil berkas ikon manifest itu sendiri.
- **`sharp.png({palette:true})` membuang alpha.** Aman hanya bila alpha asli seluruhnya
  255 (cek `minAlpha`); kalau tidak, logo transparan akan jadi kotak gelap.
- **Perbandingan piksel `raw()` wajib `.removeAlpha()` di kedua sisi.** Tanpa itu channel
  4 vs 3 → `mean=NaN`, `maxdiff=255`, dan hasilnya terlihat seperti kerusakan total.
- Re-encode berantai (palette → palette) menurunkan kualitas dua kali; selalu encode dari
  sumber asli (`git show <sha>:public/logo.png`).

---

## 📝 S33ag (2026-10-22) — audit `unused-javascript`: **0 KiB** (F)

Tanpa perubahan kode. Live **sw v45**. Tiga run `lighthouse --only-categories=performance`
(mode `simulate`, karena `--throttling-method=devtools` selalu mengembalikan 0 item
untuk audit ini), diagregasi `npm run lh:live`.

### Hasil audit
| audit | hasil |
|---|---|
| `unused-javascript` | **score 1, 0 KiB** (era `main-*.js` dulu 105 KiB) |
| `unused-css-rules` | **score 1, 0 KiB** |
| `legacy-javascript` | score 1 (tidak ada polyfill ES5) |
| `duplicated-javascript` | score 1 (tidak ada modul dobel antar chunk) |
| `total-byte-weight` | **151 KiB / 17 request** |

### Ke mana 151 KiB itu pergi
| sumber | KiB | catatan |
|---|---|---|
| `inter-subset.woff2` | 32,0 | font teks utama |
| `jetbrains-mono-subset.woff2` | 26,3 | label mono |
| `index.esm-D13AyfEk.js` | 20,9 | firebase auth |
| `main-*.js` | 17,4 | entry |
| **`logo.png`** | **16,1** | **PNG 180×180 — satu-satunya sisa yang bisa dipangkas** |
| dokumen (HTML + CSS kritis inline) | 13,2 | CSS terpisah 0 KiB (sudah inline) |
| `material-symbols-outlined.woff2` | 10,1 | font ikon |
| `index.esm-B85zkWW_.js` | 9,6 | firebase app |
| sisanya (ui-core, helper, runtime, manifest, registerSW) | < 5 | — |
| stylesheet / image | **0** | tidak ada permintaan CSS terpisah; gambar login `lazy` tidak dimuat |

FCP simulate 1532 ms · LCP 2197 ms · CLS 0,000 (TBT 0 karena mode simulate memang buta —
angka nyata tetap dari `lh:real`, lihat S33ab).

### Kesimpulan
**Tidak ada sisa kode mati.** Setiap byte JS/CSS yang dikirim layar login dieksekusi.
Bundel yang tersisa 151 KiB didominasi **font 68,4 KiB (45 %)** dan itu sudah di
lantai terukur (subset `&text=`, lihat S33o; preload font terbukti merugikan di S33n).

Satu-satunya item yang masih layak: **`logo.png` 16,1 KiB** — PNG 180×180 yang dipakai
sebagai `<img>` header shell, `favicon`, dan ikon manifest. Varian WebP/AVIF untuk
`<img>` (manifest tetap PNG, karena ikon PWA butuh PNG) diperkirakan 3–5 KiB →
potensi −11…−13 KiB (~6 % total byte login). Belum dikerjakan: itu keputusan aset,
bukan perbaikan kode.

---

## 📝 S33af (2026-10-22) — coverage branch 84,70 → 86,11 %; error-handler 0 → 100 % (D)

Commit `cb0ab19`. Tanpa perubahan `src/**` ⇒ `sw.js` tetap **v45**.
Lanjutan daftar sisa (D: metrik terendah). Tidak ada kode produksi yang disentuh.

### Sasaran dipilih dari data, bukan dari perasaan
`coverage/lcov.info` diurutkan per branch belum tercover:
`app.js` 258 (tapi 85,9 %) · `enterprise-kpi.js` 86 (79,4 %) · `export.js` 83 ·
`requisition.js` **76 (65,3 %)** · `data.js` 70 · **`error-handler.js` 31 (0 %)**.
`error-handler.js` satu-satunya modul di `src/js/` tanpa tes sama sekali.

### Tiga berkas tes baru (52 tes)
| berkas | yang dikunci |
|---|---|
| `tests/error-handler-module.test.js` | semua kelas pesan (network/permission/quota/not found/auth + fallback), `errorDetails` untuk error non-`Error`, tag Sentry `context` dan `unknown`, `handleError` tidak melempar walau Sentry gagal, `clearError` |
| `tests/enterprise-kpi-fallbacks.test.js` | cabang **state kosong** (sisi kanan `this._raw(x) \|\| []`) untuk 14 metrik + ambang availability 95/85/70 dan clamp 0–100 |
| `tests/requisition-fallbacks.test.js` | record lama tanpa `items`, default `quantity` 1, clone line item tidak berbagi referensi, `autoReorderLowStock` dengan `PartID`/`partId`/`NamaPart` + dedupe pending/approved, backlink `reqIds` ke WO (belum ada / sudah ada id / id lain / gagal) |

Untuk cabang `cur.includes(id)` dipakai `Date.now` + `Math.random` distub supaya
id-nya deterministik — tanpa itu cabang tersebut tidak bisa dieksekusi dari luar.

### Angka
| metrik | sebelum | sesudah |
|---|---|---|
| statements | 95,80 % | **96,43 %** |
| branches | 84,70 % | **86,11 %** |
| functions | 96,16 % | **96,55 %** |
| lines | 97,00 % | **97,75 %** |
| tes | 1715 / 71 berkas | **1767 / 74 berkas** |

Threshold di `vitest.config.js` di-ratchet **95/84/95/96 → 96/86/96/97**.
**Dibuktikan menggigit**: `branches: 87` → `ERROR: Coverage for branches (86.11%)
does not meet global threshold (87%)`, lalu di-revert.

### Gerbang
tsc 0 · eslint **0/0** · 1767 tes / 74 berkas · coverage 96,43/86,11/96,55/97,75 ·
build ok · precache **65/65** · **E2E 8 passed (30,7 s)**.

### Pelajaran
1. **Pilih sasaran coverage dari `lcov.info`, bukan dari ukuran berkas.**
   `app.js` punya 258 branch terlewat tapi sudah 85,9 %; `error-handler.js`
   hanya 31 branch tapi 0 % — dan itu satu-satunya modul yang sama sekali tak
   tersentuh.
2. **Cabang `|| []` hanya bisa dicapai dengan state kosong.** Semua tes lama
   memberi data terisi, jadi sisi kanan fallback tidak pernah jalan — padahal
   itulah kondisi nyata halaman sebelum listener RTDB mengisi apa pun.
3. **Threshold baru harus dibuktikan menggigit** (naikkan 1 poin → merah →
   revert). Tanpa itu, ratchet hanya angka di berkas konfigurasi.

---

## 📝 S33ae (2026-10-22) — CSS dobel dibuang: bundel 16,6 → 9,0 KB gzip (sw v45)

Commit `7d96859`. Live **sw v45**. Lanjutan S33ab (C dari daftar sisa).

### Masalahnya
Sejak S33ab bundel penuh dimuat **setelah** paint, tapi ia tetap dibangun dari
SELURUH konten — jadi ia memuat ulang setiap aturan yang sudah ada di CSS kritis
inline (8,7 KB gzip). Total CSS yang dibayar satu kunjungan: 8,7 + 16,6 = 25,3 KB.

### Yang dikerjakan
- `scripts/css-dedupe.mjs`: selisih **per aturan**, bukan tebakan kelas. Kunci
  normalisasi `rule|media|selector|deklarasi` (dan `atrule|media|nama|params|isi`).
  Aturan dengan selector sama tapi deklarasi beda **tidak** dibuang; konteks
  `@media` ikut jadi bagian kunci.
- **Invarian**: setiap aturan bundel penuh harus tetap ada di (kritis ∪ hasil).
  Kalau tidak, `dedupeCss` melempar error dan build gagal — lebih baik bundel
  gemuk daripada shell tanpa gaya.
- `vite.config.js` (`generateBundle`): buang aturan dobel, terbitkan aset CSS
  dengan **hash baru**, dan tukar `data-full-css` di HTML. Nama lama tidak boleh
  dipakai ulang: aset ber-hash di-cache `immutable`, jadi pengunjung lama akan
  terus menerima berkas 16,5 KB dari cache.
- `tests/css-dedupe.test.js` (4 tes): identik dibuang · deklarasi beda
  dipertahankan · `@media` tidak disamakan · invarian.

### Angka
| | sebelum | sesudah |
|---|---|---|
| bundel CSS gzip | 16.562 B | **9.007 B** (−7.555, −46 %) |
| aturan di bundel | 1.174 | 812 (362 dobel dibuang) |
| `index.html` gzip | 15.524 B | 15.524 B (tidak berubah) |
| total CSS per kunjungan | 25,3 KB | **17,7 KB** |

Diverifikasi di live: `curl …/assets/main-BuzeYsZW.css` = 60.333 B mentah /
**8.989 B gzip**; `data-full-css` menunjuk nama baru; `sw.js` memuat nama baru.

### Bukti tidak ada gaya yang hilang
- Invarian di atas dijalankan saat build (build lolos).
- `scripts/critical-css-parity.mjs` di preview: **0 selisih** pada 143 elemen ×
  3 keadaan (paint, mode PIN, mode SSO).
- E2E **8 passed** termasuk alur login → dashboard → PDF (shell butuh CSS ini).

### Gerbang
tsc 0 · eslint **0/0** · **1715 tes / 72 berkas** · coverage 95,8/84,7/96,16/97,00 ·
build ok · precache **65/65** · **E2E 8 passed (38,1 s)**.

### Live v45
`lh:real` 3 run: perf **94** · FCP=LCP **2211** · TBT 124 (derau) · main-thread 1553.
`cls-probe` **0,000 ×3**. Tidak ada regresi vs v44 (FCP 2139) — seperti diharapkan,
ini perbaikan **byte**, bukan FCP: bundel CSS tidak ada di jalur kritis.

### Pelajaran
1. **Aset yang isinya diubah saat build WAJIB diganti nama.** Nama ber-hash dengan
   isi berbeda = cache poisoning: pengunjung lama tetap menerima berkas lama
   karena header `immutable`.
2. Dedupe CSS aman kalau dipakai **selisih per aturan + invarian**, bukan
   heuristik "kelas ini dipakai di mana". Kunci harus memuat konteks `@media`,
   kalau tidak aturan yang sama di media berbeda ikut terbuang.

---

## 📝 S33ad (2026-10-22) — A/B/E: jalur CSS dikunci tes, 78 warning lint habis, `.open/skills` dijinakkan (sw v44)

Commit `39823d5` (kode) + `bb…` (test jalur CSS). Live **sw v44**.
Tiga pekerjaan hygiene berurutan; tidak ada perubahan fitur.

### A — properti S33ab akhirnya dikunci tes
`e2e/css-critical-path.spec.js` (3 tes, butuh `E2E_PREVIEW=1`):
1. `style[data-critical-css]` ada **satu**, `data-full-css` menunjuk `assets/main-*.css`,
   dan `head` **tidak** memuat `link[rel=stylesheet]`;
2. **0 request `.css`** sebelum interaksi (tunggu 2 s setelah gate login tampil);
3. request `.css` muncul setelah interaksi pertama (`page.mouse.click`, bukan
   `page.click('body', …)` — overlay `fixed inset-0` membuat actionability timeout).

**Dibuktikan menggigit**: memanggil `window.__loadFullCss()` saat boot → 2 tes merah;
revert → **8 passed (29,0 s)** (5 lama + 3 baru).

### B — 78 warning `no-unused-vars` → 0
| kategori | jumlah | tindakan |
|---|---|---|
| catch binding tak terpakai (termasuk ber-JSDoc `/** @type {any} */ e`) | 48 | `catch {` |
| parameter tak terpakai | 15 | dihapus kalau di ekor (`new Promise((resolve))`, `onRetry: (attempt, error)`), diberi `_` kalau posisinya dokumentasi API (`confirmDelete(_node, _id)`, `exportData(type, _format)`) |
| binding lokal/impor tak terpakai | 15 | dibuang (`CONSTANTS`, `orderByChild`, `CAN_USE_STORAGE`, `perfSum`, `withHM` + `elogs`, `performanceData`, `lastError`, `today` ganda, `readFileSync`, `_pmTemplates`, `e1`/`e2`/`idbErr`) |

`const Audit = (await import('./modules/audit.js'))` → `await import(...)`: modul tetap
dimuat, binding-nya saja yang tidak dipakai.

**Temuan, sengaja tidak diubah**: `exportData(type, format)` selalu menulis CSV walau
JSDoc-nya menjanjikan `excel|csv`. Sekarang ditandai `_format` + JSDoc menyebut batasnya —
bukan diam-diam diganti perilakunya. Kalau mau diperbaiki, itu kartu sendiri.

Angka: `app-*.js` gzip **61.670 → 61.555 B** (−115). Coverage **95,8/84,7/96,16/97,00**
(turun tipis karena baris yang dihapus tadinya tercakup; ambang 95/84/95/96 tetap lulus).

### E — `.open/skills` berhenti mengotori `git status`
`.open/skills` adalah **gitlink** (entri mode 160000) tanpa `.gitmodules` — repo git
bersarang. Setiap perubahan di dalamnya muncul sebagai ` M` dan menutupi perubahan nyata.
Perbaikan **lokal** (tidak di-commit): `git update-index --skip-worktree .open/skills`.
Sesudahnya `git status --porcelain` kosong.

### Gerbang
tsc 0 · eslint **0 error / 0 warning** (dari 0/78) · **1711 tes / 71 berkas** ·
coverage 95,8/84,7/96,16/97,00 · build ok · precache **65/65** ·
**E2E 8 passed (29,0 s)**.

### Live v44
`lh:real` 3 run: perf **94** · FCP=LCP **2139** · TBT 126 (derau 22–150) ·
main-thread 1501. `cls-probe` **0,000 ×3**. Tidak ada regresi vs v43 (FCP 2227).

### Pelajaran
1. **Kemenangan perf tanpa tes akan hilang.** Properti "0 request `.css` sebelum
   interaksi" hanya dijaga spec E2E; `grep` di tes unit tidak bisa melihatnya.
2. **Jangan hapus baris berdasarkan kemunculan pertama.** `const today = now.split('T')[0];`
   ada tiga kali di `requisition.js`; eslint menandai satu. Menghapus "yang pertama ketemu"
   mematikan dua pemakaian nyata (`requestDate`, `arrivedDate`) dan tsc yang menangkapnya,
   bukan tes. Selalu pakai `line` dari output eslint.
3. **Config eslint per-folder berbeda**: `scripts/**` hanya punya `argsIgnorePattern`,
   jadi menamai ulang variabel jadi `_x` **tidak** membungkam warning di sana — hapus.

---

## 📝 S33ac (2026-10-22) — sisa FCP dibedah: koneksi ~400 ms + layout pertama ~160–250 ms (tanpa perubahan kode)

Instrumen baru `scripts/paint-trace.mjs`; live tetap **sw v43** (`886d9b5`).
Langkah ini **pengukuran, bukan patch** — hasilnya: tidak ada lever ≥ 100 ms yang
tersisa di sisi aplikasi.

### Instrumen
`scripts/paint-trace.mjs` mengambil trace Chromium nyata (CPU ×4 + slow-4G, cache
dingin) lalu menjumlahkan **self time per nama event** di thread utama sampai FCP —
jadi kelihatan `Layout` vs `UpdateLayoutTree` vs `v8.evaluateModule` vs `ParseHTML`,
bukan cuma ember "Style & Layout" milik Lighthouse. Ikut mencetak setiap pass
`Layout` (kapan, durasi, jumlah node kotor) dan rincian navigasi
(dns/tcp/tls/ttfb/download). Dua jebakan yang sudah ditutup di dalamnya:
`ts` trace itu absolut sehingga harus dinormalkan ke `navigationStart` (kalau tidak,
semua event terbuang → "total 0 ms"), dan thread utama dicari dari total durasi
terbesar, bukan dari metadata `thread_name`.

### Komposisi FCP (live v43, probe sendiri, 2 pass)
| komponen | ms |
|---|---|
| dns | 9 |
| tcp | 117–153 |
| tls | 62–96 |
| ttfb | 57–60 |
| download HTML (15,6 KB gzip) | 158–172 |
| **Layout pertama** (91–114 node) | **149–267** |
| UpdateLayoutTree (style) | 24–37 |
| ParseHTML | 28–43 |
| Paint | 7–12 |
| **FCP** | **964–1048** |

Lighthouse devtools melaporkan ~2,2 s untuk build yang sama (≈2,2× probe), dan
`mainthread-work-breakdown` "Style & Layout 519–620 ms" ternyata **didominasi
`Layout`**, bukan style.

### Dua hipotesis diuji, dua-duanya gugur
| hipotesis | uji | hasil |
|---|---|---|
| rantai fallback webfont (4 keluarga + 12 `@font-face` metrik) yang mahal | `--no-webfont` (`*{font-family:sans-serif!important}`) | Layout pertama **242–357 ms** vs 251–267 → **bukan** font |
| layout terlalu luas, bisa dipersempit containment | `--css '*{contain:layout style}'` | **182 ms** vs 202–239 → hanya −20 %, bukan lever |

### Kesimpulan
Sisa FCP = **setup koneksi dingin ~400 ms** (3 RTT pada 150 ms) + **layout pertama
yang intrinsik** ~160–250 ms + byte HTML 15,6 KB (8,7 KB di antaranya CSS kritis
inline — hasil S33ab). Tidak ada satu pun yang bisa dipotong ≥ 100 ms tanpa
membongkar markup, dan arah "potong DOM" sudah terbukti negatif di live (S33m:
93 → 91). Kandidat sisa kalau ada yang mau mengejar: memangkas subset kritis
(perkiraan 40–50 ms) atau urusan edge/HTTP3 yang di luar repo.

### Gerbang
Tidak ada perubahan `src/**`/`index.html`/`public/**` ⇒ `sw.js` tetap **v43**.
tsc 0 · eslint **0 error / 78 warning** · **1711 tes / 71 berkas** hijau.

---

## 📝 S33ab (2026-10-22) — CSS kritis inline + bundel penuh SETELAH paint: FCP 2510 → 2227 ms (sw v43)

Commit `886d9b5`. Live **sw v43**. Lanjutan `t_4c952280` (S33aa ditutup negatif).
Dua percobaan sebelumnya memberi batas yang jelas, dan yang ketiga menang.

### Urutan bukti
| percobaan | hasil | kesimpulan |
|---|---|---|
| baseline v40/v42 | FCP 2374 / 2510 · TBT 25–197 · perf 95/90 | patokan |
| CSS diblokir (`--blocked-url-patterns`) | FCP **1785** (−589) | CSS penyumbang terbesar FCP |
| S33aa: subset inline + bundel `media=print` | FCP 2259, **TBT 489** | bundel penuh diterapkan sebelum paint → style dua kali |
| A: `fetchpriority="high"` (kanal) | FCP 2439 vs 2519 | nol — CSS render-blocking **sudah** `VeryHigh` |
| **B′: subset inline + bundel penuh hanya setelah paint** | **FCP 2227 · TBT 60 · perf 95** | menang |

### Bentuk yang dipakai
- Plugin build (`vite.config.js`): `<link rel=stylesheet>` **dihapus**, CSS kritis
  (subset Tailwind `index.html` + token/ikon/font, **8.720 B gzip**) di-inline,
  href bundel penuh dititipkan di `data-full-css`, plus `<noscript>` fallback.
- `window.__loadFullCss()` (`src/main.js`, idempoten) dipicu: gate auth (sesi ada),
  interaksi pertama, dan `submitLogin()` (`modules/auth.js`) — jadi 13,2 KB CSS
  berjalan paralel dengan round-trip auth, bukan menahan paint.
- **Diverifikasi**: 0 request `.css` sebelum interaksi, 1 sesudahnya.

### Angka (3 run devtools)
| | perf | FCP | LCP | TBT | main-thread |
|---|---|---|---|---|---|
| v42 produksi (berpasangan) | 90 | 2510 | 2515 | 197 | 1688 |
| kanal `s33ab-b` | 95 | 2147 | 2214 | 72 | 1500 |
| **live v43** | **95** | **2227** | **2227** | **60** | 1574 |

Live v43 run: FCP 2123 / 2227 / 2231 · TBT 1 / 60 / 172 · CLS Lighthouse 0,072.
`cls-probe` **0,000 / 0,005 / 0,000 → median 0,000** (lulus, ambang 0,02).
FCP −283 ms vs v42 (median berpasangan), perf 90–93 → **95**.

### Biaya
`index.html` gzip 6,1 → **15,6 KB** (8,7 KB CSS kritis ikut di dalamnya); bundel CSS
16,6 KB gzip **tidak lagi di jalur kritis** dan hanya diunduh saat interaksi/login.
Total byte per kunjungan pasif naik ~9,5 KB; kunjungan yang login membayar bundel
penuh seperti sebelumnya, hanya tidak lagi sebelum paint.

### Bukti bahwa subset cukup
`scripts/critical-css-parity.mjs` (diperbarui): kasus "penuh" kini **meminta**
`__loadFullCss()` sendiri — tanpa itu kedua kasus sama-sama hanya kritis dan
perbandingan lolos tanpa memeriksa apa pun. Ditambah blok tersembunyi (tab PIN/SSO)
ikut diukur. Hasil: **0 selisih** pada 143 elemen × 3 keadaan.

### Gerbang
tsc 0 · eslint **0 error / 78 warning** · **1711 tes / 71 berkas** · coverage
95,87/84,70/96,17/97,07 (ambang 95/84/95/96) · build ok · precache **65/65** ·
**E2E 5 passed (35,6 s)**. `tests/critical-css.test.js` 6 tes, dibuktikan menggigit
(hapus dua pemicu `__loadFullCss` → 1 tes merah).

### Pelajaran
1. **Yang menentukan FCP bukan byte CSS-nya, tapi apakah CSS itu ada di jalur
   permintaan sebelum paint.** Menurunkan 16,6 → 8,7 KB (subset) dan menaikkan
   prioritas tidak menggerakkan apa pun selama bundel penuh tetap mendarat sebelum
   paint; memindahkannya sepenuhnya ke pasca-paint memberi −283 ms.
2. **Jangan pakai `media="print"` + `onload` untuk CSS di aplikasi ini** — bundel
   penuh diterapkan sebelum paint dan TBT melonjak 25 → 489 ms.
3. Probe paritas harus **meminta** keadaan pembandingnya sendiri setelah bentuk
   "muat belakangan" dipakai; kalau tidak, tesnya vakum dan tetap hijau.

---

## 📝 S33aa (2026-10-22) — CSS kritis inline DIBATALKAN: FCP derau, TBT 25 → 489 ms (kartu `t_4c952280`, sw v42)

Percobaan `e951f89`, revert `582c73d`. Live **sw v42** = keadaan sebelum percobaan.
Satu percobaan, diukur, gagal acceptance, dibatalkan — bukan karena tidak dikerjakan.

### Langkah 1 — baseline v40 + harga CSS (live, 3 run devtools)
| | perf | FCP | LCP | TBT | main-thread | JS eval |
|---|---|---|---|---|---|---|
| baseline v40 (median) | 95 | 2374 | 2374 | 25 | 1307 | 1230 |

`cls-probe` v40: **0,000 ×3**.
CSS diblokir (`--blocked-url-patterns='*assets/main-*.css'`, 3 run): FCP
**1785 / 1735 / 3352 → median 1785 ms (−589)**, TBT 303/155/257 (naik: long task JS
yang tadinya tersembunyi di balik CSS kini terlihat).
Probe Chromium sendiri (cache dingin per pass, CPU ×4 + slow-4G): base FCP
**1120 / 1116**, tanpa CSS **856 / 776** → harga CSS ≈ **300 ms**. Lighthouse devtools
melaporkan ~2× angka probe; probe dipakai untuk arah, `lh:real` untuk keputusan.

### Langkah 2 — yang dicoba
- `scripts/critical-css.mjs`: Tailwind dijalankan ulang dengan `content: ['index.html']`
  (satu-satunya markup sebelum login) + `tactical.css` + `tactical-icons.css` + `fonts.css`,
  diminifikasi lightningcss → **37.452 B mentah / 8.720 B gzip**.
- Plugin build: `<style data-critical-css>` inline menggantikan `<link rel=stylesheet>`;
  bundel penuh tetap dimuat lewat `media="print" onload="this.media='all'"` + `<noscript>`.
- **Bukti subset cukup**: `scripts/critical-css-parity.mjs` membandingkan computed style +
  kotak **143 elemen** antara "CSS penuh" dan "bundel penuh diblokir" → **0 selisih**
  (FCP lokal 172 vs 148 ms).

Dua jebakan Tailwind programatik, keduanya **senyap**:
1. objek yang dioper ke plugin tailwind **menggantikan** config file — tanpa
   `{...userConfig}` semua `theme.extend` (`tac-*`, `font-label-mono-*`, `gutter-*`) hilang
   dan utilitasnya tidak diemit sama sekali;
2. glob `content` harus **relatif** — path absolut Windows gagal dicocokkan fast-glob.

### Langkah 3 — hasil live dan keputusan
| | perf | FCP | TBT | Style & Layout | main-thread |
|---|---|---|---|---|---|
| v40 baseline | 95 | 2374 | 25 | 448 | 1307 |
| **v41 percobaan** | **81** | **2259** | **489** | **942** | **2052** |
| v42 revert | 93 | 2508 | 83 | — | 1557 |

Diagnosis dari JSON: CSS async mendarat **2082–2169 ms** (priority `VeryLow`) tapi tetap
**diterapkan sebelum paint pertama** (long task 316–581 ms) → biaya style dibayar dua kali
(kritis inline + bundel penuh) dan paint tetap menunggu. FCP −115 ms ada **di dalam derau**
(v41 2108–2455 vs baseline 2339–2413); TBT gagal acceptance (≤ 60 ms) dengan selisih 6×.
→ revert, `sw.js` v41 → **v42**, live diverifikasi: `sw.js` v42, `grep -c data-critical-css` = 0.
Sesudah revert: FCP 2508, TBT 83, CLS probe **0,000 ×3**.

### Gerbang
tsc 0 · eslint **0 error / 78 warning** · **1708 tes / 71 berkas** · coverage
95,88/84,71/96,17/97,07 · build ok · precache **65/65** · **E2E 5 passed (36,8 s)**
— dijalankan dua kali: sebelum commit percobaan dan sesudah revert.

### Yang tetap di repo (instrumen, tanpa efek runtime)
`scripts/critical-css.mjs`, `scripts/critical-css-parity.mjs`,
`tests/critical-css.test.js` (3 tes: subset memuat kelas login, subset membuang kelas
khusus shell, plugin **tidak** kembali). Tes subset dibuktikan menggigit:
`content: ['nope.html']` → merah pada `.bg-tac-surface-base`.

### Pelajaran
1. **Render-blocking CSS bukan soal byte.** Memindahkan CSS keluar jalur blokir tidak
   menurunkan FCP kalau bundel penuh tetap diterapkan sebelum paint — yang terjadi justru
   dua kali kerja style. Kalau mencoba lagi: inline **seluruh** bundel (tanpa permintaan
   CSS kedua) atau serang biaya style/layout-nya, jangan subset + async.
2. **FCP `lh:real` di halaman ini ~2× probe Chromium sendiri** (2374 vs 1120). Probe
   menentukan arah, `lh:real` menentukan lulus/gagal.
3. Angka TBT baseline pun bergerak 25 → 83 ms pada build yang sama (v40 vs v42 hanya beda
   `CACHE_NAME`), jadi selisih < 100 ms bukan bukti; 489 vs 25–83 adalah.

---

## 📝 S33z (2026-10-21) — 7 duplikat state di literal `app()` dibuang (kartu `t_cee197a5`, sw v40)

Commit `c0a86f2`. Live **sw v40**.

**Koreksi hitungan**: kartu menyebut 8 duplikat; hitung ulang = **7** (angka 8 ikut menghitung
`login`/`logout`/`showUID` yang sudah dibuang di S33y).

### Yang dibuang dari literal `app()`
`isLogDetailView`, `selectedEquip`, `isOnline` (← `logs.js`), `loginForm` (← `auth.js`),
`equipPage`, `equipLimit` (← `data.js`), `logForm` (← `logs.js`). Impor `DEFAULT_LOG_FORM` dan
`DEFAULT_PM_FORM` ikut hilang (tidak ada pemakai lain).

### Bukti netral — snapshot, bukan asumsi
Harness jsdom, 630 kunci `app()` di-snapshot (nilai primitif, tipe, bentuk objek, getter yang
melempar) sebelum dan sesudah:

| | sebelum | sesudah |
|---|---|---|
| jumlah kunci | 630 | **630** |
| hanya-di-sebelum / hanya-di-sesudah | — | **0 / 0** |
| nilai berubah | — | **0** |

### Tes
`tests/app-state-single-source.test.js` (3): penanda `// --- MODULE INJECTION ---` ada; setiap
kunci literal sebelum batas itu tidak dimiliki modul mana pun; ketujuh kunci tidak kembali.
**Dibuktikan menggigit**: mengembalikan `isOnline: navigator.onLine` ke literal → 2 tes merah
(`isOnline (literal) vs logs.js`), lalu di-revert.

### Angka
`app-*.js` gzip 61.723 → **61.670 B** (−53). Muatan login tidak berubah (56.295 B).
Penghematan byte kecil dan **bukan** tujuan — yang diperbaiki satu sumber kebenaran.

### Gerbang
tsc 0 · eslint **0 error / 78 warning** · **1705 tes / 70 berkas** · coverage
95,88/84,71/96,17/97,07 · build ok · precache **65/65** · **E2E 5 passed (34,4 s)**.

### Pelajaran
Untuk kode yang "kalah oleh spread", bukti netral paling murah adalah **snapshot seluruh objek
hasil komposisi sebelum/sesudah** — bukan penalaran tentang urutan spread. Snapshot 630 kunci
memakan satu tes sementara, dan langsung menjawab "apakah ada nilai awal yang berubah".

---

## 📝 S33y (2026-10-21) — kode mati era pre-authModule dibuang (kartu `t_a9ec2a2d`, sw v39)

Commit `b78c4e8`. Live **sw v39**. Sweep pemanggil dulu, baru hapus — semua yang dibuang
**dibuktikan tidak bisa dieksekusi**, bukan sekadar terlihat tidak dipakai.

### Yang dibuang
| lokasi | apa | bukti mati |
|---|---|---|
| `src/js/app.js` | `login()`, `logout()`, `showUID()` | literal objek kalah oleh `...authModule` yang di-spread SESUDAHnya; versi sah di `modules/auth.js`. Pemanggil hanya `submitLogin()` + tes lewat `makeApp()` |
| `src/main.js` | `window.Sentry = Sentry;` | no-op: `Sentry` resolve ke `window.Sentry` (stub 340 baris di atasnya) |
| `index.html` | blok "Emergency Global Fallbacks" (13 baris) | `window.login()` memanggil `window.appData` yang **tidak pernah didefinisikan** → selalu `alert()` + `location.reload()`; `window.isLoggedIn/isLoading/loginForm` ditulis tapi tidak pernah dibaca; nol `onclick=` di markup |

### Angka
| metrik | sebelum | sesudah |
|---|---|---|
| `app-*.js` mentah | 236.549 B | **235.699 B** (−850) |
| `app-*.js` gzip | 61.991 B | **61.723 B** (−268) |
| `index.html` sumber | 27.478 B | **26.549 B** (−929) |
| muatan login | 56.295 B | 56.295 B (tidak berubah — sudah chunk malas) |

**Coverage naik** karena kode tanpa cakupan ikut hilang: 95,55/84,61/95,95/96,66 →
**95,88/84,71/96,17/97,07**. Efek samping yang wajar, bukan tujuan.

### Tes
`tests/app-auth-menu.test.js` +3 (header diperbarui, nomor baris lama stale):
`app.js` tidak lagi punya ketiganya **dan** `modules/auth.js` masih punya (mengunci "satu
sumber", bukan sekadar "hilang"); `main.js` tanpa `window.Sentry = Sentry`; `index.html` tanpa
`window.appData`.

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1702 tes / 69 berkas** · coverage
95,88/84,71/96,17/97,07 · build ok · precache **65/65** · **E2E 5 passed (34,8 s)**.

### Temuan sampingan — kartu baru `t_cee197a5`
Masih ada **8 duplikat state** di literal `app.js` yang juga kalah oleh spread:
`isLogDetailView`, `selectedEquip`, `isOnline`, `loginForm`, `equipPage`, `equipLimit`,
`logForm`. Sengaja **tidak** dikerjakan: ini nilai **awal state**, bukan metode, dan bisa tidak
setara (mis. `isOnline: navigator.onLine` vs default modul) — perlu perbandingan per kunci.

### Pelajaran
"Kode mati" bukan satu kategori. Metode yang kalah oleh spread aman dibuang setelah sweep
pemanggil; **nilai awal state** yang kalah oleh spread tidak — urutannya menentukan nilai, dan
menghapusnya tanpa membandingkan per kunci bisa mengubah perilaku diam-diam.

---

## 📝 S33x (2026-10-21) — kontrak state bersama antar dua scope (kartu `t_dcef9e80`)

Commit `2fb0a22`. Hanya berkas tes baru → `sw.js` **tidak** naik, tidak ada deploy.

### Masalah yang dikunci
S33u memecah satu root Alpine jadi dua scope. Yang ikut pecah bukan cuma markup tapi **state
bersama** — dan bug toast pasca-login (`4aa993f`) lolos ke produksi tanpa satu tes pun melihatnya.
Tidak ada gerbang yang menangkap kelas bug ini.

### Inventaris (hasil ekstraksi, bukan tebakan)
Identifier Alpine `index.html` ∩ fragmen shell, disaring ke kunci yang benar-benar dimiliki
objek komponennya (jadi `note`/`i`/`n` lokal tidak ikut):

| kunci | keputusan | alasan |
|---|---|---|
| `notifications` | **shared** | `main.js`: `loginScreen.notifications = instance.notifications` |
| `isLoading` | **both** | `main.js` + `bootstrap.onUser` wajib menulis keduanya |
| `isLoggedIn` | **separate** | dua gate beda tugas: overlay login vs shell |

Login-only (aman, tidak beririsan): `loginForm`, `loginMode`, `setLoginMode`, `submitLogin`,
`showLoginKey`, `rememberedEmail`.

### `tests/scope-shared-state.test.js` (9 tes)
1. Irisan identifier **wajib** sama dengan daftar keputusan → kunci irisan baru = tes merah.
2. `shared`: baris pembagian di `main.js` wajib ada; `ui-core.js` wajib `splice`; handler
   dismiss `index.html` wajib `splice` dan **tidak** boleh `notifications = notifications.filter(…)`.
3. Uji perilaku: setelah notifikasi kedaluwarsa, `app.notifications` dan `login.notifications`
   masih **objek yang sama** (`toBe`) dan panjangnya 0.
4. `both`/`separate`: `main.js` menulis `loginScreen.isLoading`/`isLoggedIn`, `bootstrap.js`
   menulis `this.isLoading`, logout menutup kedua gate.

### Tes dibuktikan menggigit (mutasi, bukan asumsi)
`ui-core.js` dikembalikan sementara ke `this.notifications = this.notifications.filter(…)` →
2 tes merah, `AssertionError: referensi bersama putus: expected [] to be [ { id: … } ]`.
Di-revert, 9/9 hijau.

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1699 tes / 69 berkas** · coverage
95,55/84,61/95,95/96,66 (ratchet utuh).

### Pelajaran
Tes kontrak yang membaca sumber **harus dibuktikan menggigit** sebelum dipercaya: mutasi satu
baris, lihat merah, revert. Tanpa itu, tes yang selalu hijau tidak bisa dibedakan dari tes
yang tidak memeriksa apa pun.

---

## 📝 S33w (2026-10-21) — prefetch chunk app + lapisan data saat submit login (kartu `t_2af5fb60`, sw v38)

Commit `fa68cc7`. Live **sw v38**. Muatan login tidak berubah (54,97 KiB) — yang berubah
adalah **kapan** chunk itu diminta.

### Kenapa
Setelah S33u, chunk `app-*.js` (57,7 KiB gzip) dan lapisan data (38,5 KiB) diminta **serial
setelah** auth selesai: `__loadDataLayer()` → `__loadApp()` → `__loadAppShell()`. Prefetch
yang ada hanya fragmen shell, jadi seluruh 96 KiB itu ada di jalur kritis login → dashboard.

### Yang dikerjakan
`submitLogin()` (`src/js/modules/auth.js`) memulai `window.__loadDataLayer()` dan
`window.__loadApp()` **sebelum** `signInWithEmailAndPassword`, fire-and-forget. Keduanya
idempoten, jadi jalur auth di `main.js` tinggal menunggu promise yang sama; kegagalan prefetch
diabaikan karena jalur sebenarnya mencoba lagi dan melaporkan errornya sendiri.

Sengaja **tidak** dipicu dari interaksi generik (`pointerdown`): kunjungan pasif tidak boleh
membayar 96 KiB untuk sesuatu yang belum tentu dipakai.

### Angka (emulator, slow-4G 1,6 Mbps/150 ms + CPU ×4, median 3 run)
| metrik | sebelum | sesudah |
|---|---|---|
| klik submit → gate login terbuka | **648 ms** | **334 ms** (−48%) |
| sampel | 765 / 648 / 457 | 502 / 326 / 334 |

Target kartu: turun ≥ 30%. Tercapai.

### Verifikasi kunjungan pasif
| konteks | request | `app-*` | `data-layer-*` | fragmen shell |
|---|---|---|---|---|
| emulator, klik di luar form, 4 s | 19 | **0** | **0** | — |
| produksi, tanpa interaksi, 3 s | 15 | **0** | **0** | **0** |
| produksi, setelah 1 klik | 18 | **0** | **0** | **1** |

Artinya prefetch fragmen shell tetap satu-satunya yang dipicu interaksi; chunk pasca-auth
hanya bergerak setelah tombol submit ditekan. Nol `pageerror`.

### Tes
`tests/auth-module.test.js` +3: prefetch terpanggil dan login tetap dijalankan; tidak meledak
kalau loader belum terpasang (jsdom); prefetch yang gagal tidak menjatuhkan login.
`globals.d.ts`: deklarasi `window.__loadApp` (tsc merah tanpa itu).

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1690 tes / 68 berkas** · coverage
95,55/84,61/95,95/96,66 · build ok · `verify:precache` **65/65** · **E2E 5 passed (23,8 s)**.

### Catatan
- Probe sementara `e2e/tmp-submit-timing.spec.js` dihapus setelah dipakai; bentuknya: throttle
  CDP **setelah** layar login tampil, lalu ukur di dalam halaman sampai `#login-id`
  `offsetParent === null` (gate terbuka). `page.click('body')` tidak bisa dipakai untuk
  "interaksi generik" — overlay `fixed inset-0` membuat Playwright menunggu actionability
  sampai timeout; pakai `page.mouse.click(x, y)`.

---

## 📝 S33v (2026-10-21) — notification-*.js + ui.js keluar jalur login (kartu `t_e08217cd`, sw v37)

Commit `e9a5dfa`. Live **sw v37**. Muatan login **60,0 → 54,9 KiB** gzip.

### Yang dikerjakan
- `notification-*.js` (8,1 KiB gzip) tidak lagi di `modulepreload`. Dimuat lewat
  `window.__loadNotifications()` (idempoten), dipicu `bootstrap.onUser()` **tanpa di-await** —
  gate tidak boleh menunggu chunk ini.
- FCM registration + `setInterval` sapuan 5 menit pindah ke `armNotifications()` yang jalan
  setelah modul termuat. Sapuan pertama tetap milik `onUser` supaya tidak ada dua sapuan
  berdekatan (kalau keduanya dipindah, `checkAllNotifications` jalan dobel di ~7 s).
- `window.notificationAPI` diisi di dalam loader, bukan saat boot.

### Efek samping yang tidak diperkirakan — dan koreksinya
Begitu `notification.js` keluar dari graf eager, Rollup mengangkat **`ui.js` jadi chunk
bersama** yang tetap di-preload: bersihnya cuma **−2,0 KiB** (60,0 → 58,0), bukan −8,1.
Karena itu `ui.js` dipecah:
- **`src/js/modules/ui-core.js` (baru)** — `setTheme`, `applyTheme`, `showNotification`,
  `readThemeMode`. Ini satu-satunya bagian yang dipakai sebelum login.
- `ui.js` meng-`...`-spread `uiCore` lalu menambahkan QR/Cloudinary/helper warna, jadi
  `app()` dan `reattachModuleGetters` tidak berubah sama sekali.
- `login.js` mengimpor `ui-core.js`, bukan `ui.js`.

### Angka terukur
| metrik | v36 | v37 |
|---|---|---|
| `modulepreload` | 7 berkas (termasuk `notification-*`) | **8 berkas, 0 hit `notification-*`**, tanpa `ui.js` penuh |
| muatan login (JS+CSS gzip) | 60,0 KiB | **54,9 KiB** |
| probe produksi (Chromium 390×844) | — | 15 request, **0** untuk `notification-*`/`app-*`/`data-layer-*`; `__loadNotifications()` memuat chunk dalam 4 ms dan mengisi 7 kunci API |

**Target ≤ 52 KiB di kartu TIDAK tercapai.** Lantai terukur: firebase auth 24,3 + CSS 16,6 +
firebase app 10,6 = **51,5 KiB** yang semuanya dipakai layar login. Sisa 3,4 KiB adalah
`ui-core` + runtime + helper. Angka 52 KiB di kartu adalah estimasi saya, bukan hasil ukur;
dikoreksi di komentar kartu.

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1687 tes / 68 berkas** · coverage
95,55/84,60/95,94/96,66 (ratchet utuh) · build ok · `verify:precache` **65/65** ·
**E2E 5 passed (27,2 s)**.

### Pelajaran
**Menarik satu modul keluar dari graf eager tidak otomatis memindahkan byte-nya.** Rollup
mengekstrak modul yang dipakai bersama oleh graf eager dan chunk malas menjadi chunk baru
yang **tetap di-preload**. Yang benar: sesudah setiap perubahan bentuk impor, ukur ulang
**total** `modulepreload` (jumlah semua berkas + CSS), bukan hanya berkas yang dipindahkan.
Di sini selisih antara "8,1 KiB keluar" dan kenyataan "−2,0 KiB" adalah tepat sebesar
`ui.js` yang muncul menggantikan tempatnya.

---

## 📝 S33u-b (2026-10-21) — regresi toast pasca-login (ditemukan & ditutup, sw v36)

Ditemukan saat menyusun rekomendasi lanjutan, bukan oleh tes mana pun. **Saya sendiri yang
membawanya di `e01a7a7`.**

Toast stack tinggal di `index.html` (scope `login()`), sedangkan `showNotification()`
pasca-login dipanggil dari instance `app()`. Dua larik `notifications` berbeda, satu renderer:
setiap notifikasi setelah login **tidak pernah tampil**. Dibuktikan di emulator, bukan dibaca
dari kode: `app.notifications` 1 · `__loginScreen.notifications` 0 · `sameArray` false ·
teks toast tidak ada di DOM. Tes yang ada tidak melihatnya karena smoke hanya memeriksa
keberadaan live region, bukan perilakunya.

**Perbaikan** (`4aa993f`, sw **v36**):
- `main.js` — `loginScreen.notifications = instance.notifications` setelah chunk app terpasang:
  satu larik untuk kedua scope.
- `ui.js` — hapus entri dengan `splice()`, **bukan** `this.notifications = …filter(…)`.
  Penugasan ulang memutus referensi bersama itu; itu justru bug kedua yang menunggu.
- `index.html` — handler dismiss toast ikut `splice` (bentuk lama juga menugaskan array baru).
- `e2e/workorder-pdf.spec.js` — kunci regresi: setelah login, toast dari `app()` wajib terlihat
  di live region `role="status"`. Ditulis `page.getByRole('status')…` karena `getByText` polos
  cocok ke dua node (toast + panel notifikasi di dalam shell) → strict mode violation.

**Gerbang**: tsc 0 · eslint 0/79 · 1686 tes / 68 berkas · coverage 95,56/84,61/96,01/96,67 ·
build ok · precache 63/63 · **E2E 5 passed (22,1 s)**.

**Pelajaran umum**: memecah satu root Alpine jadi dua scope memindahkan **state bersama**
(`notifications`, dan apa pun yang dirender di luar scope asalnya), bukan cuma markup. Setiap
larik/objek yang dibaca dari dua scope harus dibagi referensinya, dan penghapusan isinya harus
di tempat (`splice`) — bukan penugasan ulang. Kontrak "satu renderer, satu larik" perlu tes
perilaku; tes keberadaan elemen tidak menangkapnya.

---

## 📝 S33u (2026-10-21) — chunk `app()` malas SELESAI: login 120,3 → 60,0 KiB, TBT 115 → 25 ms (sw v35)

Percobaan ke-3 lulus semua gerbang. Live **sw v35**, commit `e01a7a7`.

### Blokir S33t terpecahkan — dan penyebabnya bukan scope
`showCropModalOpen` gagal karena **tiga `</div>` yatim di `public/pages/app-shell.html:1830-1832`**
(sisa markup import overlay, tepat sebelum crop modal). Fragmen seimbang di dalam dirinya
sendiri, tapi **tidak** setelah dibungkus: parser HTML memakai `</div>` yatim pertama untuk
menutup `<div x-data="app()">` lebih awal, jadi `<template x-if="showCropModalOpen">` —
satu-satunya node terikat yang jatuh di luar — dievaluasi di scope `<body x-data="login()">`.
`ReferenceError` itu melempar di tengah `Alpine.initTree()`, init sisa fragmen berhenti,
`app.logs` tetap 0. Semua gejala S33t ("store kosong") berasal dari satu baris markup rusak.

Bukti Chromium (fragmen + wrapper, `page.evaluate`):

| fragmen | anak wrapper | node terikat di luar wrapper | `closest('[x-data]')` crop modal |
|---|---|---|---|
| lama (3 `</div>` yatim) | 19 | **1** | `login()` |
| setelah dihapus | 20 | **0** | `app()` |

**Metode yang salah**: membandingkan fragmen **tanpa** wrapper. Di jsdom maupun Chromium
hasilnya identik untuk kedua versi (20 anak, crop modal tetap anak `#app-shell`), jadi
hipotesis terlihat terfalsifikasi padahal benar. Uji parse wajib memakai bentuk final
(wrapper + fragmen), bukan fragmen telanjang.

### Temuan kedua: Alpine memanggil `init()` per scope `x-data`
Alpine 3.15: `reactiveData["init"] && evaluate(el, reactiveData["init"])` di direktif `data`.
Begitu fragmen membawa wrapper sendiri, `bootstrap.init()` jalan **dua kali** untuk singleton
yang sama → watcher, listener online/offline, dan penjadwalan chart terdaftar ganda.
Ditutup dengan guard `_booted` (+ `_booted?: boolean` di `appstate.ts`).

### Perubahan
- **`src/js/modules/login.js` (baru, eager)** — `createLoginScreen()`: state sesi + `notifications`
  + `themeMode` (lewat `readThemeMode()` baru di `ui.js`) + spread `uiModule`/`authModule` +
  `init()` yang memasang tema. Kedua modul sumber tidak punya getter → spread aman.
- **`src/main.js`** — `app.js` tidak lagi diimpor statis. `window.__loadApp()` memuat chunk
  malas, mendaftarkan `Alpine.data('app')` **sebelum** `initTree`. `react()` membungkus
  `Alpine.reactive()`. Listener auth pindah ke sini (bootstrap.js ikut chunk malas) dengan
  urutan wajib: `__loadDataLayer()` → `__loadApp()` → `__loadAppShell()` → `onUser()` → gate.
  `__loadAppShell` dipecah: `fetchAppShell()` (boleh di-prefetch) vs pasang + `initTree`
  (butuh chunk app sudah terdaftar).
- **`src/js/bootstrap.js`** — `init()` (watcher, error handler, tema, online/offline) +
  `onUser(user)` (checkUserRole, listener RTDB, AI settings, PM schedule, requisitions,
  sapuan notifikasi). Guard `_booted`.
- **`index.html`** — `<body x-data="login()">`; dua handler `@keydown.window` (n/l) pindah
  ke wrapper fragmen (di body mereka akan dievaluasi di scope `login()`).
- **`public/pages/app-shell.html`** — 3 `</div>` yatim dihapus, wrapper `<div x-data="app()">`
  + `@keydown.window` ditambahkan, komentar kepala menjelaskan jebakan scope & yatim.
- `sw.js` → **v35**.

### Angka (terukur)
| metrik | sebelum (v34) | sesudah (v35) |
|---|---|---|
| `modulepreload` memuat chunk app | ya | **0 hit** |
| muatan login (JS+CSS gzip) | 120,3 KiB | **60,0 KiB** |
| `app-*.js` | entry chunk | **chunk malas, 57,7 KiB gzip** |
| TBT live (median 3 run devtools) | 115 ms | **25 ms** |
| main-thread | 1408 ms | **1289 ms** |
| JS eval | 1334 ms | **1217 ms** |
| CLS `cls-probe` (3 pass) | 0,000 | **0,000** |

Probe produksi (Chromium, 390×844): layar login **0 request** untuk `app-*`, `data-layer-*`,
`prod-*` (14 request total); `window.__loadApp()` menarik `app-DIebibNh.js` dalam 21 ms dan
`window.app === instance` dengan `onUser` tersedia. Satu-satunya console warning:
`entry type 'first-contentful-paint' does not exist` (observer RUM, pre-existing).

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1686 tes / 68 berkas** · coverage
95,56/84,62/96,01/96,67 (ratchet 95/84/95/96 utuh) · build ok · `verify:precache` **63/63** ·
**E2E 5 passed (29,9 s)**.

### Tes yang ikut diubah (bukan dihapus)
- `tests/bootstrap-module.test.js` — listener auth tidak lagi milik bootstrap
  (`expect(window.onAuthStateChanged).not.toHaveBeenCalled()`); tes auth-state memanggil
  `ctx.onUser(...)` langsung; tes baru untuk idempotensi `init()`.
- `tests/app-shell-split.test.js` — urutan shell-sebelum-gate dibaca dari `main.js` +
  tes baru: fragmen wajib punya `<div x-data="app()"`, `#app-shell` tidak boleh ber-`x-data`.
- `tests/data-layer-lazy.test.js` — urutan `loadDataLayer → loadApp → loadAppShell → onUser`
  dibaca dari `main.js`.
- **`tests/login-screen-module.test.js` (baru, 8 tes)** — bentuk state, kelengkapan binding
  markup login, tidak membawa permukaan chunk app, `init()` memasang tema, `readThemeMode()`.

### Sisa / catatan
- Kartu `t_bea98211` ditutup dengan bukti ini.
- `git commit` sempat gagal `index.lock` basi (dari 20:43, tanpa proses git hidup) — `rm -f
  .git/index.lock`, bukan proses yang benar-benar berjalan.
- `login()`/`logout()` mati di `app.js` (kalah oleh spread `authModule`) **tidak** dihapus
  sesi ini: bukan bagian dari blokir, dan menghapusnya menambah permukaan tes tanpa manfaat
  terukur. Kandidat pembersihan berikutnya.

---

## 📝 S33t (2026-10-21) — percobaan refactor ke-2: build-side LULUS, E2E merah lagi (penyebab baru)

Working tree dikembalikan ke `a71e7b0`. Live tetap **sw v34**. Tidak ada deploy.

### Yang sudah berhasil (build-side)
Dengan ketiga perbaikan (proxy `Alpine.reactive()`, wrapper `x-data="app()"` di fragmen, `ensureUserProfile` menunggu lapisan data) + diff yang lebih kecil karena `login()`/`logout()` memang sudah di `auth.js`:
- `dist/index.html` `modulepreload` = runtime · preload-helper · 3× `index.esm` · **`login-*.js`** · `firebase-core-*.js` — **tanpa chunk app, tanpa `data-layer`**.
- `verify:precache` **63/63**.

### Yang gagal (E2E, 2,3 m)
4 passed, **1 failed** — tetap `login → dashboard → export WO PDF`, gagal di `expect.poll(window.app.logs…)` = 0.

Probe Playwright (emulator, 14 s setelah submit) memberi gambaran yang jauh lebih tajam:
`{"loggedIn":true,"logs":0,"equip":0,"hasOnUser":"function","hasSetup":"function","shellLoaded":"1","wrapper":true,"loginFlag":true,"dbFn":"object","refFn":"function"}`
`ERRS ["warning:Alpine Expression Error: showCropModalOpen is not defined","PE:ReferenceError: showCropModalOpen is not defined"]`

Kesimpulan:
- **Perbaikan #2 (wrapper) TERBUKTI BEKERJA**: tidak ada lagi `sidebarCollapsed is not defined` / `showNotifications is not defined`. `wrapper: true`, shell terpasang, gate terbuka, `onUser`/`setupFirebaseListeners` ada, `window.db`/`ref` siap.
- Kegagalan sekarang **berbeda**: ada **`ReferenceError` yang tidak tertangkap** (`pageerror`, bukan sekadar warning Alpine) pada ekspresi `showCropModalOpen` di fragmen. Error itu melempar saat `Alpine.initTree(host)` dijalankan di dalam callback auth, sehingga sisa node fragmen tidak pernah ter-init dan store tetap kosong.

### Hipotesis berikutnya (murah, lakukan ini dulu)
1. `grep -rn "showCropModalOpen" src/ public/pages/` — kalau properti itu **tidak ada di mana pun**, ini ekspresi rusak yang sudah lama ada di fragmen dan baru sekarang muncul sebagai error tak tertangkap; perbaiki ekspresinya (atau tambahkan field-nya) lalu ulangi.
2. Kalau properti itu **ada**, berarti wrapper tidak menjangkau semua node — kemungkinan besar markup crop modal berada di dalam `<template x-if>` yang di-clone belakangan dan dievaluasi terhadap scope yang salah.
3. Bungkus `Alpine.initTree(host)` dengan try/catch **tidak** menyelesaikan akar; ia hanya menyembunyikan sisa node yang tidak ter-init.

### Aturan kerja yang perlu ditambahkan
- Saat mem-probe alur boot/scope, **tangkap `pageerror`, bukan hanya `console`**. Dua percobaan berturut-turut menghabiskan waktu karena `logs: 0` terlihat seperti masalah listener padahal ada ReferenceError tak tertangkap yang menghentikan init.
- Probe state yang berguna: `loggedIn`, `logs`, `hasOnUser`, `hasSetup`, `shellLoaded`, `wrapper`, `loginFlag`, `dbFn`, `refFn` — semuanya dalam satu `page.evaluate`.

### Addendum S33t — hipotesis 1 sudah diuji: FALSIFIKASI
`grep -rn showCropModalOpen src/ public/pages/`:
- `src/js/app.js:365` → **`showCropModalOpen: false`** (properti ADA di `app()`)
- `src/js/app.js:2543/2568/2580` → pemakaian
- `public/pages/app-shell.html:1835` → **`<template x-if="showCropModalOpen">`**

Jadi bukan properti yang hilang. Berarti `x-if` di fragmen itu dievaluasi pada scope yang
**tidak** punya properti tersebut — artinya wrapper `<div x-data="app()">` tidak menjangkau
node itu, walau `wrapper: true` dan `shellLoaded: 1`.

Uji termurah berikutnya (satu baris, sebelum menyentuh kode aplikasi): di probe, cetak
`document.querySelector('#app-shell template[x-if]')?.closest('[x-data]')?.getAttribute('x-data')`
dan `.parentElement.closest('[x-data]')` — kalau hasilnya bukan `app()`, cari di mana wrapper
tertutup lebih awal (periksa keseimbangan `<div>` di `app-shell.html` setelah pembungkusan,
terutama di sekitar markup crop modal dan `</template>` di akhir berkas).

**Status**: refactor ini sudah gagal 2×, keduanya di E2E dan keduanya dengan penyebab berbeda yang sekarang sudah terdokumentasi. Sisa satu langkah investigasi (hipotesis 1) sebelum layak dicoba lagi.

---

## 📝 S33s (2026-10-21) — bug #3 tertutup: sinkronisasi profil menunggu lapisan data (sw v34)

Bug ini **sudah ada di live sejak S33p**, bukan cuma di percobaan S33q: `ensureUserProfile()`
(`src/js/modules/auth.js:109`) dipanggil tepat setelah `signInWithEmailAndPassword`, sementara
listener auth di `bootstrap.js` baru memuat lapisan RTDB **setelah** fragmen shell 129 KB selesai
diunduh. Jadi `window.ref` masih `undefined` → `Failed to sync user profile: TypeError: window.ref
is not a function`; akibatnya `lastLogin` tidak pernah tertulis dan profil user baru tidak pernah
dibuat (UI tetap pulih karena `checkUserRole` menyusul).

**Perbaikan** (`a1543ed`): `ensureUserProfile()` menunggu `window.__loadDataLayer()` (idempoten,
satu guard `typeof … === 'function'` + try/catch). Tidak ada perubahan urutan di `bootstrap.js`.

**Bukti (emulator, probe Playwright, 15 s setelah submit)**: `logs 1` · `withWo 1` · `equip 1` ·
`userRole "admin"` · `refFn function` · **`ERRS []`** (nol error `window.ref`, nol Alpine Expression
Error). Sebelum perbaikan: `logs 0`, `Failed to sync user profile`.

**Koreksi catatan S33q**: gejala `app.logs` tetap 0 di percobaan refactor itu **bukan** bug
terpisah — penyebabnya shell yang mati karena bug scope (#2). Setelah #2 dan #3 beres, store terisi
normal di build yang sama.

**Temuan yang menyederhanakan refactor berikutnya**: `login()`, `logout()`, `loginMode`,
`setLoginMode`, `loginForm`, `submitLogin`, `rememberedEmail`, `showLoginKey` **semua sudah ada di
`modules/auth.js`** (app.js punya salinan mati yang selalu kalah oleh spread). Jadi komponen login
ringan cukup meng-`...`-spread `auth.js` + `ui.js`; tidak perlu memindahkan `login()` ke mana pun.

**Gerbang** (turn yang sama): tsc 0 · eslint **0 error / 79 warning** · **1675 tes / 67 berkas** ·
coverage 95,47/84,60/96,00/96,6x (ratchet utuh) · build ok · `verify:precache` **61/61** ·
**E2E 5 passed (11,2 s)**. Live **sw v34**, `modulepreload` `index.html` tidak berubah
(tanpa `data-layer`, tanpa chunk app) — tidak ada regresi payload.

**Sampingan** (`fa6def1`): `playwright-report/**` + `test-results/**` masuk `ignores` eslint —
tanpa itu `npm run lint` merah (trace viewer memuat bundel pihak ketiga) hanya karena suite E2E
pernah dijalankan. Probe `scripts/alpine-scope-probe.mjs` juga memakai `globalThis.document`.

**Sisa sebelum refactor diulang**: tidak ada blocker yang diketahui. Bug #1 (`Alpine.reactive()`) dan
#2 (varian c: wrapper `x-data` di dalam fragmen) sudah terpecahkan di S33q/S33r; #3 tertutup di sini.
Langkah berikutnya: ulangi refactor chunk `app()` malas sesuai desain, gate + E2E dulu.

---

## 📝 S33r (2026-10-21) — probe scope Alpine: jawabannya varian c (wrapper di fragmen)

Sesi pendek, satu tujuan: memastikan apakah `x-data` pada elemen host bisa menjadi scope.
**Jawaban: tidak bisa, dalam urutan apa pun.** `node scripts/alpine-scope-probe.mjs` (baru):

| varian | cara | hasil |
|---|---|---|
| control | atribut → `innerHTML` → `initTree(host)` | gagal (`probeValue is not defined`) |
| a | atribut → `initTree(host)` kosong → `innerHTML` → `initTree` | gagal |
| b | atribut → `initTree(document.body)` → `innerHTML` → `initTree` | gagal |
| **c** | fragmen membawa root **`<div x-data="app()">`** | **LULUS** (`SCOPE-OK`, tanpa error) |

Jadi bug #2 S33q terpecahkan: pakai varian c. Turunannya:
- `#app-shell` tidak diberi `x-data`; `main.js` cukup `innerHTML` + `Alpine.initTree(host)`.
- `@keydown.window` shortcut n/l pindah **ke dalam wrapper**, bukan tetap di `#app-shell`
  (direktif di host akan terikat ke scope `login()`).
- Risiko CSS wrapper: **nol temuan** — `grep -c 'body *>'` di `style.css`/`tactical.css` = 0,
  `:nth-child`/`:last-child` hanya di `.skeleton-*` dan `#page-dash a.rounded-2xl`, dan
  wrapper statis tidak membuat containing block untuk `position: fixed`.

Desain diperbarui: `docs/superpowers/specs/2026-10-21-lazy-main-chunk-design.md` (bagian
"Hasil probe scope"). Sisa pekerjaan sebelum refactor diulang: **bug #3** (balapan
`window.ref` antara sign-in dan `__loadDataLayer()`; `app.logs` 0 di emulator).
Tidak ada perubahan `src/**` sesi ini → `sw.js` tetap **v33**, live tetap `5cccd53`.

---

## 📝 S33q (2026-10-21) — percobaan chunk `app()` malas: 79,0 KiB tercapai, TIDAK di-merge (3 bug runtime)

Status: **dibatalkan, working tree kembali ke `0aa410f`**. Live tetap `3cbae47` / sw **v33**. Tidak ada yang di-deploy.

### Yang berhasil sebelum dibatalkan
- Desain tertulis: `docs/superpowers/specs/2026-10-21-lazy-main-chunk-design.md` (fakta lapangan: `index.html` pra-shell 0 `$root`, `app-shell.html` 0 `$root` + tanpa `x-data`, 12+ elemen top-level bersaudara, `auth.js`/`ui.js` hanya bergantung pada `logger`/`constants`).
- Implementasi (di-revert): `src/js/modules/login.js` baru (`loginModule` + `reattachModuleGetters` + `createLoginScreen()`), `login()`/`logout()` pindah ke sana, `<body x-data="login()">`, `app()` jadi chunk malas lewat `window.__loadApp()`, `bootstrap.init()` kehilangan listener auth dan dapat `onUser(user)`.
- Angka build yang tercapai: muatan login **120,3 → 79,0 KiB** gzip (−41,3), `app-*.js` **58,9 KiB** gzip keluar dari `modulepreload`, `login-*.js` 8,4 KiB eager. Suite **1676/1676** hijau, `tsc` 0, eslint 0 error. **E2E 4 passed / 1 failed** — dan di situlah bugnya.

### Tiga bug runtime yang hanya muncul di browser (ini inti catatan)
1. **Tulisan dari luar komponen tidak memicu reaktivitas Alpine.** `Alpine.data('login', () => objek)` membuat proxy sendiri; menulis `objek.isLoading = false` dari `main.js` mengubah objek mentah tanpa men-trigger efek. Gejala: tombol submit `disabled` permanen walau `isLoading` sudah `false`. Perbaikan yang terbukti: bungkus dengan `Alpine.reactive()` (`typeof Alpine.reactive === 'function'` → benar) dan pakai proxy itu untuk `window.__loginScreen`/`window.app`.
2. **`Alpine.initTree(host)` tidak membuat scope milik `host` itu sendiri.** Menaruh `x-data="app()"` di `#app-shell` lalu meng-inject fragmen membuat node fragmen mencari scope terdekat dan menemukan `<body x-data="login()">` → `Alpine Expression Error: sidebarCollapsed is not defined`, `showNotifications is not defined`, `rejectReason is not defined`. Urutan dua fase (set atribut → `initTree` host kosong → innerHTML → `initTree` lagi) **tidak** menolong; kemungkinan perlu `Alpine.initTree(document.body)` (atau membungkus fragmen) supaya `initNode(host)` benar-benar jalan. Ini yang belum terpecahkan.
3. **Menunda lapisan data membuka balapan baru.** Di antara `signInWithEmailAndPassword` dan `__loadDataLayer()` selesai masih ada jalur yang memakai `window.ref` → `Failed to sync user profile: TypeError: window.ref is not a function`. Selain itu, pada alur emulator `window.app.logs` tetap **0** setelah 15 s walau `setupFirebaseListeners()` sudah jalan dan `window.db`/`window.ref` ada — belum ketahuan apakah ini akibat butir 2 (shell mati) atau listener yang tidak pernah terpasang.

### Aturan kerja yang terbukti
- `git checkout -- .` menyelamatkan; commit terakhir selalu hijau, jadi percobaan besar boleh gagal asal tidak di-commit.
- E2E adalah satu-satunya gerbang yang menangkap butir 1–3. Unit test 1676 hijau sementara aplikasinya tidak bisa login — **jangan pernah menutup pekerjaan boot/scope tanpa E2E**.
- Subagent untuk refactor sebesar ini mati di kuota (HTTP 429 `deepseek-v4.1-flash`, 31 panggilan, 0 berkas ditulis). Kerjakan inline atau pastikan kuota dulu.

### Langkah berikutnya (kalau dilanjutkan)
1. Pecahkan butir 2 lebih dulu dengan probe kecil (bukan refactor penuh): buat halaman uji yang menaruh `x-data` pada elemen host lalu cek apakah anak-anaknya mendapat scope itu.
2. Kalau scope host tidak bisa dibuat tanpa wrapper, pilih: bungkus fragmen dalam satu `<div x-data="app()">` (uji dulu efek `fixed`/`body > *`) **atau** tambahkan `x-data="app()"` ke setiap elemen top-level fragmen.
3. Baru setelah login + shell + logs hijau di E2E, ulangi pengukuran TBT live.

---

## 📝 S33p (2026-10-21) — CLS swap webfont ditutup (0,027 → 0,000) + SDK RTDB keluar jalur login (TBT 349 → 115 ms)

### Prioritas 1 — CLS: penyebabnya swap font, dan instrumennya baru
- **Instrumen baru** `scripts/cls-probe.mjs`: Chromium nyata, CPU ×4 + slow-4G, **cache dingin per pass** (browser baru tiap pass — dalam satu browser, cache dibagi antar-tab sehingga shift font hilang sejak pass ke-2), mencatat setiap `layout-shift` + node penyebab + sumber daya yang selesai ≤1,5 s sebelumnya. Opsi: `[url] [passes] [threshold] [settleMs] [vw] [vh] [dpr]`, dan `CLS_CHANNEL=chrome` untuk memakai Chrome sistem.
- **Baseline live (`cea89de`, sw v32)**: CLS **0,027** (0,027 / 0,021 / 0,027, 3 pass) — bukan 0,058–0,073. Dua shift, satu penyebab: kartu login `DIV.w-full.max-w-7xl` (+4 px) dan `FOOTER` (+16 px), tepat setelah `jetbrains-mono-subset.woff2` (2882 ms) lalu `inter-subset.woff2` (2929 ms) selesai. **Cache hangat = 0,000**, karena swap-nya tidak terjadi — itu sebabnya angka Lighthouse lama terlihat aman (0,051 / 0,009 / 0,008 pada build yang sama).
- **Perbaikan** (`3c3a1d7`): generator `download-webfonts.mjs` sekarang juga menulis **12 `@font-face` fallback metrik** (`src: local(...)` + `size-adjust` + `ascent/descent-override`, nol byte unduhan). Angkanya **diukur**, bukan ditebak: `scripts/font-metric-probe.mjs` (baru) mencetak tabel rasio lebar advance seluruh ASCII printable + ascent/descent per (keluarga, fallback). `tailwind.config.js`, `style.css`, `tactical.css` memakai `'Inter Fallback'` / `'JetBrains Mono Fallback'` di stack.
- **Hasil**: live CLS **0,000** — 4 pass @390×844 + 3 pass @412×823 (viewport Lighthouse) + 2 pass dengan Chrome sistem = **9 pass, semua 0,000**, tanpa satu pun shift. `scripts/font-render-check.mjs` tetap melaporkan glyph dirender webfont sendiri (Inter/JetBrains), jadi fallback tidak menutupi kegagalan muat font.
- **BELUM selesai**: Lighthouse devtools CLS pada build yang sama tetap mencatat 0,049 (0,005 / 0,049 / 0,130) dan audit `layout-shifts`-nya menunjuk **elemen yang sama** (kartu login). Tidak bisa direproduksi di luar pipeline Lighthouse sendiri — sudah dicoba Chromium Playwright & Chrome sistem, 390 & 412 px, settle 8 s. Lighthouse CLS build ini memang **bimodal** (0,005–0,130 pada 3 run berurutan), jadi ia bukan gerbang yang bisa dipakai. Gerbang CLS yang dipakai sekarang: `node scripts/cls-probe.mjs <url> 3 0.02`.

### Prioritas 2 — SDK RTDB keluar dari jalur login (kartu `t_cb2a51d4` → **ditutup**)
- **Harga terukurnya lebih dulu** (produksi, devtools throttling, `--blocked-url-patterns`): baseline main-thread **1318 ms / TBT 349 ms**; blokir `*db-*` → **555 ms / 0 ms**; blokir `*main-*` → 485 ms / 0 ms. Jadi lever-nya chunk RTDB, bukan app.js.
- **Perubahan** (`27dbd50`): `db.js` dipecah → `firebase-core.js` (App + Auth, eager karena tombol login butuh) + `data-layer.js` (**malas**). `firebase-config.js` hanya memasang auth ke `window.*` dan menyediakan `window.__loadDataLayer()` (impor dinamis, idempoten, bisa di-retry). `bootstrap.js` memanggilnya tepat setelah `onAuthStateChanged` memberi user, **sebelum** `checkUserRole()` (consumer pertama). Impor statis terakhir ke `db.js` (`audit.js`) jadi impor dinamis; `loadAISettings()` dicabut dari jalur init pra-login karena ia membaca RTDB.
- **Hasil**: muatan login 138,2 → **120,3 KiB gzip**; `data-layer` (39,4 KiB gzip) **0 hit** di `modulepreload` `index.html` live; **TBT median live 349 → 115 ms (−67%)**, perf devtools 86 → **94**; E2E **5 passed (29,6 s)**; suite **1675/67**; coverage 95,51/84,61/96,00/96,61 (turun tipis, threshold tidak diturunkan); precache 61/61.
- Dikunci `tests/data-layer-lazy.test.js` (6 tes baca-sumber: tidak boleh ada impor statis `db.js`/`data-layer.js` di `src/**`, urutan pemuatan sebelum consumer pertama, `audit.js` dinamis).
- `main-*.js` **naik** 71,4 → 84,7 KiB gzip: ia sekarang menyerap bagian Auth dari chunk `db-*.js` yang dulu terpisah. Kartu `t_bea98211` (main-*.js 69 KiB unused) **tetap terbuka** — belum tersentuh; langkah berikutnya yang masuk akal: komponen login ringan untuk `<body x-data>` supaya `app()` penuh baru didaftarkan setelah gate terbuka.
- Catatan: `unused-javascript` **tidak bisa** dibaca dari `lh:real` (mode devtools mengembalikan 0 item) — hanya ada di mode `simulate`, dan sesi ini tidak menjalankannya.

### Verifikasi
- Gerbang lengkap di turn yang sama: `tsc` **0 error** · `eslint` **0 error / 79 warning** · **1675 tes / 67 berkas** · coverage 95,51/84,61/96,00/96,61 · build ok · `verify:precache` **61/61** · E2E **5 passed**.
- Live terverifikasi isi (bukan hash): `sw.js` = **mtc-asset-v33**; `index.html` preload hanya `rolldown-runtime`, `vite-preload-helper`, 3× `index.esm`, `firebase-core-*` — `grep -c data-layer` = **0**.
- Commit: `3c3a1d7` (CLS) → `27dbd50` (data layer) → `3cbae47` (probe). `sw.js` v32 → **v33**.

### Kartu
- `t_cb2a51d4` (tunda chunk db) — **ditutup** dengan bukti di komentar.
- `t_bea98211` (main-*.js unused) — **tetap `blocked`**, komentar temuan ditambahkan (apa yang berubah, apa yang belum).

---

## 📝 S33o (2026-10-21) — subset webfont dikirim sebagai `text=` (−20,5 KiB jalur login) + protokol **TBT nyata**

### Prioritas 1 — subset webfont: −34,4 KiB total, tanpa regresi

Subset "latin" Google membawa seluruh Latin-1 + Latin Extended-A yang tidak dipakai aplikasi berbahasa Indonesia. Yang benar-benar dipakai UI = **ASCII + 9 tanda baca** (© · – — • … → ± ×), dan daftar itu dikirim sebagai `&text=` supaya subsetting dilakukan **server-side** — tanpa fonttools, tanpa tool baru di repo.

| berkas | sebelum | sesudah | turun |
|---|---|---|---|
| outfit-subset.woff2 | 32.292 B | **24.088 B** | −25% |
| space-grotesk-subset.woff2 | 22.288 B | **15.720 B** | −29% |
| inter-subset.woff2 | 48.256 B | **32.612 B** | −32% |
| jetbrains-mono-subset.woff2 | 31.432 B | **26.560 B** | −15% |
| **total** | **131,1 KiB** | **96,7 KiB** | **−26%** |

Plafonnya ~26% karena **variabel font** tetap menyimpan seluruh delta sumbu `wght` untuk glyph yang tersisa: Inter ASCII saja 30,5 KB, ASCII+9 tanda baca 33,6 KB, latin penuh 48,3 KB — jadi 10 KB dari penghematan itu berasal dari Latin-1 yang memang tidak dipakai.

Bukti tanpa regresi:
- **Kanal `s33n-c`, 3 run**: total byte **260 → 240 KiB**, perf 91, FCP 2170, LCP 3109 (di dalam derau LCP yang sudah diketahui).
- **Probe berpasangan** (base vs subset, 3 pasang, CPU ×4 + slow-4G, cache dingin): FCP 1128 → 1184 ms (median) — tidak ada regresi seperti kasus preload; font tetap tiba sesudah paint.
- **Glyph yang benar-benar dirender** dicek lewat CDP `CSS.getPlatformFontsForNode` (`scripts/font-render-check.mjs`, baru): JetBrains Mono(24) · Inter(65) · Inter(56) **identik** dengan build lama — bukan sekadar "CSS-nya bilang Inter".
- Live sesudah deploy (sw **v32**, `cea89de`, 3 run): total **240 KiB**, perf median **96**, FCP 2175, LCP 2250 (LCP derau — jangan diklaim).
- Kerugian yang diterima, dikunci tes: karakter di luar subset (mis. huruf beraksen Latin-1 yang ditempel pengguna) dirender font berikutnya di stack, **per glyph** (bukan tofu). Generator mencetak peringatan kalau ada karakter teks baru; `tests/webfont-subset.test.js` (5 tes) mengunci ASCII+9 tanda baca tercover, plafon ukuran, dan nama lama tidak kembali.

### Prioritas 2 — TBT nyata sebagai angka kedua (`npm run lh:real`)

Sampai sesi ini hanya mode `simulate` yang diukur, dan mode itu **melaporkan TBT 0** sementara Chrome dengan throttle sungguhan mencatat **254 ms** (median 3 run hari ini; 355 ms di 2 run sebelum subset).

| run | perf | FCP | LCP | TBT | CLS | main-thread | JS eval |
|---|---|---|---|---|---|---|---|
| 1 | 91 | 2240 | 2240 | 254 | 0,058 | 1225 | 1137 |
| 2 | 90 | 2239 | 2239 | 264 | 0,073 | 1216 | 1133 |
| 3 | 92 | 2253 | 2253 | 214 | 0,008 | 1136 | 1025 |
| **median** | **91** | **2240** | **2240** | **254** | 0,058 | **1216** | **1133** |

- `scripts/lh-real.mjs` = 3 run `--throttling-method=devtools` → cetak perf/FCP/LCP/TBT/CLS + main-thread + JS eval. CLI dipanggil lewat `process.execPath` + `node_modules/lighthouse/cli/index.js` (`npx.cmd` tidak bisa di-spawn tanpa shell di Windows/node 24).
- **Temuan baru langsung dari instrumen ini**: **CLS nyata 0,058–0,073** (mode simulate: 0,000–0,013) — di atas ambang 0,02 yang dipakai sebagai gerbang. Jadi gate CLS yang dilacak hari ini mengukur versi model, bukan versi perangkat. Belum diperbaiki; kandidat sesi berikutnya dengan `scripts/cls-probe.mjs` + throttle nyata.

### Gerbang
tsc 0 · eslint **0 error / 79 warning** · **1669 tes / 66 berkas** · coverage **95,56 / 84,64 / 96,00 / 96,68** (ratchet 95/84/95/96) · build ok · precache **58/58** · E2E lokal **5 passed (21,2 s)**.
Commit `cea89de` (subset) → `0862266` (protokol `lh:real`). `sw.js` v31 → **v32**.
Live: sw v32 · `/fonts/inter-subset.woff2` HTTP 200 Content-Length 32.612 · CSS live menunjuk 5 berkas `*-subset.woff2`.

### Jebakan
1. **Plafon subset server-side ≈26%** (variabel font) — jangan janjikan 50%; penghematan besar hanya datang dari membuang glyph Latin-1/ExtA.
2. **`unicode-range` sempit = fallback per glyph**, bukan tofu. Kalau UI menambah karakter baru, perluas `EXTRA` di generator dan jalankan ulang; generator sudah mencetak peringatan (`≥` sisa hanya ada di komentar CSS — sengaja tidak diminta).
3. `curl -w '%{size_download}'` di git-bash bisa melaporkan **0 walau HTTP 200** — verifikasi ukuran pakai `curl -sI` (Content-Length) atau `| wc -c`.
4. **Aset lama tidak benar-benar hilang**: `firebase.json` punya rewrite `** → /index.html`, jadi URL berkas yang sudah dihapus menjawab **200 berisi index.html**. Periksa keberadaan aset dari `Content-Type`/`Content-Length`, jangan dari status code.

---

## 📝 S33n (2026-10-21) — dua kandidat jalur kritis diukur, **keduanya ditolak**: preload webfont (Lighthouse bilang menang, browser nyata bilang kalah) · tunda `@font-face`

### Target sesi (LCP live median ≤ 2,8 s): **tidak tercapai — dan penyebabnya bukan kandidat yang diuji**

Lighthouse `critical-request-chains` menaruh jalur paint pertama halaman login sebagai
`main-*.css` (12,9 KB) → `jetbrains-mono-latin.woff2` (31,7 KB) → `inter-latin.woff2` (48,6 KB):
**80 KB berurutan + 2 RTT sesudah CSS**. Harga tiap sumber daya diukur di URL produksi
(`--blocked-url-patterns`, median 3 run):

| dipblokir | dFCP | dLCP | byte |
|---|---|---|---|
| `main-*.css` (12,9 KB) | **−69 ms** | +45 | −30 KiB |
| `inter-latin.woff2` (48,6 KB) | −171 ms | +370 | −47 KiB |
| `jetbrains-mono-latin.woff2` (31,7 KB) | −170 ms | −140 | −31 KiB |
| keduanya | −249 ms | +35 | −89 KiB |

Premis kartu ("CSS 12,5 KiB yang memblokir render adalah tuasnya") lemah di live: 69 ms. Yang mengisi rantai itu justru webfont — 80 dari 94 KB.

**Probe browser nyata** (`scripts/login-paint-probe.mjs`, Chromium, CPU ×4 + slow-4G, cache dingin):
**FP = FCP = LCP ≈ 1,19 s** (median 4 run). Lighthouse mode `simulate` mencetak FCP 2,2 s dan LCP 2,4–3,4 s pada build yang sama → selisihnya artefak model Lantern, yang menganggap webfont penentu paint pertama padahal `font-display: swap` sudah mencatat teks sebelum font tiba.

### Yang diuji, dan angkanya

| varian | Lighthouse (kanal A/B) | probe nyata (berpasangan) | keputusan |
|---|---|---|---|
| preload 2 webfont | 3 vs 6 run: FCP 2269 → **1965**, LCP 3076 → **2484**, perf 91 → **94,5** | FCP 1188 → **1508 ms** (4/4 pasang, tanpa tumpang tindih); TTFB lebih rendah di jalur preload (272 → 225) | **dibatalkan** (`835d135`) |
| tunda `@font-face` setelah paint pertama | FCP sama (−330), **LCP tidak turun** (3065) | + kedipan font | dibuang, tak pernah di-deploy |
| inline / potong CSS | hanya 69 ms | — | tidak dikerjakan |

Mekanisme penolakan: 80 KB font prioritas High berebut pipa 1,6 Mbps dengan CSS yang memblokir render. JetBrains memang datang lebih awal (1705 → 1448 ms), tapi teks login sudah tercatak sebelum font tiba → untungnya nol, biayanya nyata.

Instrumen A/B yang baru: **kanal hosting** (`npx firebase hosting:channel:deploy s33n-a --expires 3d`) — A/B di URL hosting asli tanpa menyentuh produksi.

### Temuan untuk sesi berikutnya

1. **LCP live tidak bisa dipakai sebagai pembeda.** Build yang sama (`fd8540f`, sw v30) memberi LCP **2262–3414 ms** lintas 10 run (median 2459) — bimodal ≈2,5 s vs ≈3,4 s. Elemen LCP selalu `label.font-body-sm` yang sama, Load Delay/Load Time 0, tidak ada sumber daya yang berubah. Tidak ada perubahan hari ini yang menggeser mediannya secara terbaca. Jangan simpulkan menang/kalah dari median 3 run LCP.
2. **FCP bisa dipakai**, tapi hanya dengan instrumen yang sama: ~1,1–1,2 s di probe nyata, ~2,2 s di Lighthouse `simulate`.
3. Kandidat yang belum tersentuh dan masih punya angka: `db-*.js` 34 KB terunduh pra-login (31 K unused), `main-*.js` 57 K unused (lihat kartu).

### Gerbang + deploy

tsc 0 · eslint **0 error / 79 warning** · **1664 tes / 65 berkas** · coverage **95,56 / 84,64 / 96,00 / 96,68** (ratchet 95/84/95/96) · build ok · precache **58/58** · E2E lokal **5 passed (23,7 s)** · CI `835d135`: Lighthouse CI + Build and Deploy **success**, E2E di CI 14 s.
Commit `999ac98` (preload, dibatalkan) → `835d135` (revert + tes kontrak negatif). `sw.js` tetap **v31**; `index.html` kembali identik dengan `f83e999`.
Live sesudah revert (3 run, sw v31): perf **91**, FCP 2169, LCP 3064, TBT 0, CLS 0 — kembali ke baseline S33m (91 / 2186 / 3097).

### Jebakan

1. **Lighthouse `simulate` menghukum rantai webfont, bukan waktu paint nyata.** Keputusan yang bergantung pada FCP/LCP wajib lewat probe nyata + A/B **berpasangan selang-seling**; kalau tidak, drift jaringan/jam jadi kesimpulan palsu: di sini urutan blok (base dulu, preload kemudian) memberi arah yang berlawanan dengan 4 pasang selang-seling.
2. **A/B lewat URL berbeda (kanal vs produksi) punya TTFB berbeda** (189–243 vs 275–408 ms) — bandingkan kanal↔kanal atau produksi↔produksi, jangan campur.
3. `npx playwright --workers=1` **bukan** perintah yang benar — subcommand `test` wajib: `npx playwright test --workers=1` (tanpa itu: "unknown option '--workers=1'").
4. **eslint tidak mengabaikan berkas scratch di root repo.** `curl -s ... > live-sw.js` (35 error `no-undef` di berkas minified) + 3 error `no-undef` di probe baru membuat `npm run lint` merah padahal source bersih. Hapus berkas curl sebelum lint; untuk probe, tulis `globalThis.document` / `globalThis.getComputedStyle` di dalam `page.evaluate()`.
5. Kanal hosting kedaluwarsa 3 hari (`--expires 3d`) — kalau mau diukur lagi, deploy ulang.

---

## 📝 S33m (2026-10-21) — shell aplikasi (128 KB) keluar dari `index.html` — hasil live: **tidak naik** (median 93 → 91)

### Yang dikerjakan
`index.html` **156 KB → 28 KB**. Layar login + toast stack tetap di sana; sidebar, `<main>` (`x-page`), footer, nav mobile, dan seluruh modal pindah ke fragmen **`public/pages/app-shell.html`** (129 KB), dimuat `window.__loadAppShell()` di `src/main.js`:

1. prefetch pada interaksi pertama (`pointerdown`/`keydown`/`touchstart`/`focusin`) — kunjungan pasif ke layar login tidak membayar 128 KB itu;
2. inject ke `<div id="app-shell">` lalu `Alpine.initTree(host)`;
3. `bootstrap.js` **menunggu** `await window.__loadAppShell()` sebelum `this.isLoggedIn = true`, supaya `x-page`/`x-show` di dalam shell sudah punya target saat data mengalir.

| Berkas | Isi |
|---|---|
| `public/pages/app-shell.html` | baru — 1.848 baris markup shell (sidebar, main, footer, nav mobile, 12 modal) |
| `index.html` | −1.848 baris, +placeholder `#app-shell` |
| `src/main.js` | `APP_SHELL_URL`, `__loadAppShell()`, prefetch 4 event, `Alpine.initTree` |
| `src/js/bootstrap.js` | auth callback jadi `async`, menunggu shell sebelum membuka gate |
| `src/js/globals.d.ts` | deklarasi `window.__loadAppShell` |
| `tests/app-shell-split.test.js` | baru — 7 tes kontrak pemisahan (placeholder, tidak ada markup shell di index.html, plafon ukuran, urutan `await` sebelum gate) |
| `tests/legacy-palette · log-form-contract · login-image-weight` | membaca fragmen shell juga (markup-nya pindah) |
| `sw.js` | `mtc-asset-v29` → **v30** |

### Pengukuran
**Preview (build yang sama, 2 run)** — di sinilah efeknya terlihat:

| Metrik | Sebelum split | Sesudah split |
|---|---|---|
| perf | 82 / 84 | **91 / 92** |
| LCP | 3.177 / 3.180 ms | **2.887 / 2.838 ms** |
| render delay | 2.711 / 2.691 ms | **2.429 / 2.382 ms** |
| total byte | 308 KiB | **290 KiB** |

**Live, 6 run** (`lh-live-1..6`, commit `fd8540f`, sw v30):

| Run | perf | FCP | LCP |
|---|---|---|---|
| 1 | 95 | 2.273 | 2.348 |
| 2 | 90 | 2.187 | 3.199 |
| 3 | 88 | 2.282 | 3.414 |
| 4 | 95 | 2.185 | 2.410 |
| 5 | 91 | 2.168 | 3.064 |
| 6 | 91 | 2.163 | 3.129 |
| **median** | **91** | **2.186** | **3.097** |

a11y/bp/seo 100 · TBT 0 · CLS 0,000 · total **260 KiB** (dari 274).

### Kesimpulan yang jujur: hipotesisnya salah untuk metrik live
S33k (sebelum split) median 3 run = **93** dengan LCP 2.929 ms; sesudah split median 6 run = **91** dengan LCP 3.097 ms. Rentangnya tumpang tindih (88–95 di kedua sampel), jadi ini **bukan kemenangan** — dan bukan regresi yang terbukti, hanya noise di sekitar angka yang sama.

Artinya: **ukuran dokumen bukan penghambat LCP di live.** 128 KB markup shell memang hilang dari parse/style/layout, dan byte pertama turun 274 → 260 KiB, tapi render delay tetap ~2,5 s — biayanya ada di CSS + `main-*.js` + swap font, bukan di DOM. Eksperimen preview memberi +7 poin karena preview lebih lambat dari live; selisih itu tidak terbawa ke produksi.

Keputusan: **perubahan dipertahankan** (payload awal lebih kecil, struktur lebih jelas, E2E hijau, tes kontrak mengunci pemisahannya), tapi **tidak diklaim sebagai perbaikan perf live**. Kalau prioritasnya angka median, langkah berikutnya harus menyentuh render delay itu sendiri: inline critical CSS layar login, atau pangkas `main-*.js`.

### Gerbang + CI
tsc 0 · eslint 0 error / 79 warning · **1660 tes / 64 berkas** · coverage **95,56 / 84,64 / 96,00 / 96,68** (ratchet 95/84/95/96) · build ok · precache **61 entries**, `verify:precache` **58/58** · E2E lokal **5 passed (24,3 s)** · CI run `39532178038` (sha `fd8540f`) **success**, E2E **5 passed (14,1 s)**.

### Jebakan
1. **`Alpine.initTree(host)` wajib** setelah `innerHTML` — tanpa itu seluruh `x-show`/`x-for`/`x-page` di fragmen jadi markup mati.
2. **Gate login harus menunggu fragmen**, bukan sebaliknya: kalau `isLoggedIn` dibuka lebih dulu, `x-page` belum ada target dan halaman pertama tidak pernah dimuat.
3. **Fragmen harus ada di precache** (`verify:precache` 58/58) — kalau tidak, login offline dengan sesi tersimpan akan kehilangan seluruh shell.
4. **`window.__loadAppShell` perlu deklarasi** di `src/js/globals.d.ts`, kalau tidak `tsc --noEmit` gagal TS2339 di `bootstrap.js`.
5. **Tes yang membaca `index.html` ikut pindah sasaran.** Tiga berkas (palette, log-form, image-weight) harus membaca `public/pages/app-shell.html` juga — kalau tidak, tesnya hijau tapi tidak lagi memeriksa apa pun yang nyata.

---

## 📝 S33l (2026-10-21) — E2E alur kritis jalan di CI: 5 passed di runner (kartu `t_58fcaef2`)

### Akar masalah (dua lapis, bukan satu)
1. **CI cuma menjalankan smoke** karena langkah E2E memakai `vite preview` atas `dist` yang dibangun dengan env demo → `VITE_USE_EMULATORS` tidak aktif, `db.js` tidak pernah menyambung ke emulator, jadi `e2e/workorder-pdf.spec.js` mustahil lolos.
2. Percobaan pertama (dev server di CI) **merah**: 3 passed / 2 failed. Dev server dingin di runner butuh transform on-demand — smoke `x-cloak` kehabisan 10 s, `workorder-pdf` menabrak timeout 60 s. Bukan bug aplikasi.
3. Percobaan kedua (preview atas `dist-e2e`) **merah lagi**: `window.app.logs` selalu 0. Build E2E memakai `VITE_FIREBASE_DATABASE_URL` = `demo-mtc-asset.firebaseio.com` (namespace `demo-mtc-asset`) sementara `seed-emulator.mjs` menulis ke `mtc-asset-default-rtdb` (fallback saat `.env` tidak ada di runner). **Namespace RTDB emulator = host `databaseURL`, bukan `projectId`.**

### Perubahan
| Berkas | Isi |
|---|---|
| `package.json` | script `build:e2e` = `vite build --outDir dist-e2e` (tanpa `postbuild`, jadi `verify:precache` tidak ikut) |
| `.github/workflows/test.yml` | step **Build (E2E, emulator)** dengan `VITE_USE_EMULATORS=1` + env demo + `databaseURL` = `mtc-asset-default-rtdb.firebaseio.com`; step E2E jadi `npx playwright test --workers=1` (seluruh suite) dengan `E2E_PREVIEW=1` |
| `playwright.config.js` | `E2E_PREVIEW=1` → `npx vite preview --outDir dist-e2e --port 3000 --strictPort`; default lokal tetap `npm run dev -- --port 3000`; `stdout`/`stderr` di-pipe; `timeout` 60 s di CI |
| `e2e/seed-emulator.mjs` | cetak `[seed] RTDB namespace = …` (penyebab namespace mismatch langsung terlihat di log CI) |
| `eslint.config.js` | `dist-e2e/**` di-`ignores` — tanpa ini `npm run lint` lokal ikut melinting hasil build (2.929 error palsu) |
| `.gitignore` | `dist-e2e/` |

### Bukti
- Lokal `E2E_PREVIEW=1 CI=1 npx playwright test --workers=1` → **5 passed (27,5 s)**.
- CI run `39529677960` (sha `dd4768f`) → **success**, langkah E2E **5 passed (10,0 s)**:

```
✓ 1..4  e2e/smoke.spec.js
[seed] RTDB namespace = mtc-asset-default-rtdb
✓ 5     e2e/workorder-pdf.spec.js  login → dashboard → export a Work Order PDF (1,1 s)
5 passed (10.0s)
```

Run merah sebelumnya (untuk jejak): `39527882633` 3 passed/2 failed (dev server dingin), `39528872830` 4 passed/1 failed (namespace mismatch).

### Jebakan
1. **`vite preview` atas `dist` ber-env demo tidak pernah bisa menguji login.** Butuh build kedua (`dist-e2e`) dengan `VITE_USE_EMULATORS=1`.
2. **Dev server di runner terlalu lambat** untuk tes pertama: transform on-demand membuat smoke `x-cloak` (10 s) dan alur login (60 s) timeout. Static preview: 10 s total.
3. **Namespace RTDB = host `databaseURL`.** Samakan dengan seed, kalau tidak: 0 baris, tanpa error apa pun.
4. **`eslint .` melinting `dist-e2e/`** setelah `build:e2e` — tambahkan ke `ignores`, kalau tidak lint lokal melaporkan ribuan error yang tidak nyata.
5. `/* global … */` di berkas ESM harus memuat `console` kalau memakai `console.log` — `no-undef` bikin CI merah di langkah Lint.

---

## 📝 S33k (2026-10-21) — webfont di-self-host: fonts.googleapis.com keluar dari jalur kritis login (perf live **79 → 93**)

### Temuan: font pihak ketiga adalah biaya terbesar FCP, bukan JS
Lighthouse live mobile satu run + A/B `--blocked-url-patterns` (tanpa rebuild, jadi murni efek sumber daya):

| Kondisi (live, 1 run) | perf | FCP | LCP | total byte |
|---|---|---|---|---|
| baseline (S33j) | 79 | 3.680 ms | 3.980 ms | 275 KiB |
| blokir `fonts.googleapis.com` + `fonts.gstatic.com` | **82** | **2.667 ms** | 3.034 ms | 196 KiB |
| blokir chunk `db-*` | 81 | 3.576 ms | 3.801 ms | 241 KiB |
| blokir `main-*.js` | 83 | 3.475 ms | 3.475 ms | 206 KiB |

Font = **−1.013 ms FCP** dan 79 KiB transfer. Penyebabnya `index.html` memakai pola
`<link rel=preload as=style href="fonts.googleapis.com/css2?…" onload="this.rel='stylesheet'">`
— CSS tetap diunduh dari origin lain (DNS+TLS ke dua host) lalu memicu unduhan woff2 dari
`fonts.gstatic.com`. `preconnect` tidak menghapus rantai itu.

Eksperimen pembanding (preview, DOM aplikasi dipotong dari `dist/index.html`): perf **90**,
LCP 2.911 ms — jadi sisa biaya render delay memang markup shell 128 KB yang ikut diparse
sebelum login. Itu pekerjaan tersendiri, belum dikerjakan (lihat "Tidak dikerjakan").

### Perubahan
| Berkas | Isi |
|---|---|
| `scripts/download-webfonts.mjs` | generator: ambil css2 (UA Chrome, variable range `wght@300..800` dll), simpan **hanya subset latin**, tulis `src/css/fonts.css` |
| `src/css/fonts.css` | 4 `@font-face` (`font-display: swap`): Outfit 300–800, Space Grotesk 300–700, Inter 400–700, JetBrains Mono 400–600 — **131 KiB** total |
| `public/fonts/*-latin.woff2` | 4 berkas font (ikut `includeAssets` `fonts/*.woff2` → ter-precache) |
| `index.html` | preconnect ×2, preload, dan `noscript` Google Fonts dibuang; preconnect cdnjs juga (cropper dimuat on-demand) |
| `src/main.js` | `import './css/fonts.css'` sebelum `style.css` |
| `sw.js` | `mtc-asset-v28` → **v29** |
| `.gitignore` | `lh-*.json`, `lh.log`, `gf.css`, `preview.log` (artefak ukur, jangan ke-commit) |

Subset `latin-ext`/cyrillic/greek sengaja dibuang: aplikasi berbahasa Indonesia, dan tiap
subset ikut masuk precache SW — byte-nya nyata, bukan gratis.

### Gerbang
tsc 0 · eslint 0 error / 79 warning · **1653 tes / 63 berkas** · coverage **95,60 / 84,65 / 96,00 / 96,73** (ratchet tetap) · build ok · precache **60 entries** (`verify:precache` 57/57) · E2E **5 passed** (43,4 s).

### Live sesudah push `1dfaa14` (sw v29 aktif t≈65 s)
`curl sw.js` → `mtc-asset-v29`; `curl index.html | grep -c fonts.googleapis` → **0**.
Probe browser produksi: 5 `@font-face` lokal terdaftar, `document.styleSheets` tanpa origin
luar, Inter + JetBrains Mono + Material Symbols berstatus `loaded`.

Lighthouse live mobile **3 run** (`node scripts/lighthouse-aggregate.mjs`):

| Metrik | S33j (median) | S33k (median) | Run 1/2/3 |
|---|---|---|---|
| perf | 79 | **93** | 88 / 93 / 95 |
| a11y · bp · seo | 100 · 100 · 100 | 100 · 100 · 100 | 100 semua |
| FCP | 3.680 ms | **2.197 ms** | 2.235 / 2.013 / 2.197 |
| LCP | 3.988 ms | **2.929 ms** | 3.205 / 2.929 / 2.497 |
| render delay | 3.298 ms | **2.266 ms** | 2.469 / 2.266 / 1.800 |
| TBT | 0 ms | 48 ms | 167 / 48 / 0 |
| CLS | 0 | **0,000** | 0,014 / 0 / 0 |
| total byte | 275 KiB | 274 KiB | 274 semua |
| unused-js | 58 KiB | 58 KiB (`main-*`) | 58 / 53 / 84 |
| `prod-*.js` di network | 0 / 3 | 0 / 3 | 0 semua |

Target sesi (**≥ 85**) tercapai: **93**. Unused-js tidak turun — perbaikan datang dari jalur
kritis, bukan dari pemangkasan byte JS; `db-*` (34 KiB) masih diunduh di login.

### Tidak dikerjakan (dan kenapa)
1. **Chunk `db-*` ditunda sampai setelah login** (kartu `t_cb2a51d4`) — A/B blokir hanya **+2** poin dari baseline 79; menundanya butuh `db.js` jadi binding hidup + urutan boot baru (risiko jalur data seluruh app) untuk sisa gain yang lebih kecil lagi di baseline 93.
2. **`main-*.js` 58 KiB unused** (kartu `t_bea98211`) — butuh pemecahan `app()` 2.604 baris / 15 mixin; belum, sesuai isi kartu.
3. **Shell aplikasi 128 KB keluar dari `index.html`** — eksperimen preview menunjukkan perf **90** dengan DOM dipotong (LCP 2.911 ms); kandidat kuat berikutnya, tapi mengubah cara semua halaman boot, jadi butuh sesi sendiri.

### Jebakan
1. **`preconnect` ≠ menghapus rantai.** Font pihak ketiga tetap 2 origin + 1 CSS hop. Yang menghapusnya hanya self-host (atau blokir total).
2. **Pola `preload as=style onload="this.rel='stylesheet'"` lolos dari audit `render-blocking-resources`** — Lighthouse tidak menandainya, tapi A/B blokir membuktikan 1 s FCP. Jangan percaya audit itu sebagai daftar lengkap.
3. **Ukur hipotesis dengan `--blocked-url-patterns`, bukan dengan rebuild.** Satu perintah per hipotesis di URL produksi; hasilnya berlaku untuk build yang sedang live, tanpa risiko `dist/` basi.
4. **`wght@300;400;…` mengembalikan 55 `@font-face` (semua subset).** Pakai rentang variabel (`wght@300..800`) + filter `unicode-range: U+0000-00FF` supaya yang tersimpan hanya latin.

---

## 📝 S33j (2026-10-21) — iframe auth + gapi keluar dari jalur login (kartu `t_505ab09a` dibuka lagi)

### Kartu S33h salah menutup premisnya — karena UA probe
S33h menyimpulkan "premis kartu tidak terbukti: 0 request ke `apis.google.com` / `__/auth/iframe`" dan kartu `t_505ab09a` ditutup. Pengukuran ulang di **live dengan UA mobile** (Android moto g power, Playwright) menemukan **4 request**: `__/auth/iframe.js`, `__/auth/iframe?…eid=p&usegapi=1`, `apis.google.com/…/cb=gapi.loaded_0`, satu lagi iframe gapi.

Penyebabnya: **Firebase hanya menginisialisasi iframe auth di browser mobile.** Probe Playwright default memakai UA desktop → 0 request, seolah bersih. Kartu itu benar; yang salah alat ukurnya.

### Akar masalah
`src/js/db.js` memakai `getAuth(app)`. Dependensi default `getAuth` menyertakan `popupRedirectResolver` (`browserPopupRedirectResolver`), dan di mobile resolver itu memuat iframe + gapi saat boot — bukan saat tombol SSO ditekan.

| Request | Transfer | Waktu |
|---|---|---|
| `__/auth/iframe.js` | 93,1 KB | 2.196 ms |
| `cb=gapi.loaded_0` (gapi) | 34,7 KB | 1.407 ms |

### Perubahan
| Berkas | Isi |
|---|---|
| `src/js/db.js` | `getAuth(app)` → `initializeAuth(app, {persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]})` — resolver tidak didaftarkan saat boot |
| `src/js/modules/auth.js` | `loginWithSSO` mengambil `browserPopupRedirectResolver` di import dinamis dan memberikannya sebagai argumen ketiga `signInWithPopup(auth, provider, resolver)` |
| `sw.js` | `mtc-asset-v27` → **v28** |
| `tests/auth-module.test.js` | mock `firebase/auth` menambah `browserPopupRedirectResolver`; assert memakai resolver nyata (bukan `expect.anything()`) |
| `tests/login-critical-path.test.js` | tes kontrak baru: `db.js` wajib `initializeAuth(app,`, dilarang `getAuth(app)` / `popupRedirectResolver:`, `auth.js` wajib memberi resolver ke `signInWithPopup` |
| `scripts/auth-iframe-probe.mjs` | probe baru (UA mobile + CDP initiator stack) |
| `scripts/lighthouse-aggregate.mjs` | agregator 3-run Lighthouse (median skor, LCP breakdown, unused-js) |

### Bukti A/B (preview `:4173`, probe UA mobile)
| Kondisi | Hit iframe/gapi | Request JS | `networkidle` |
|---|---|---|---|
| baseline (`git stash push -- src/js/db.js src/js/modules/auth.js`) | **4** | 8 | 3.417 ms |
| sesudah fix | **0** | 7 | **1.177 ms** |

Lighthouse preview mobile sesudah fix: perf **83 / 79** (2 run), total **231 KiB** (baseline 444 KiB), `iframe/gapi` 0, `prod-*.js` 0, 7 request JS.

### Gerbang
tsc 0 · eslint 0 error / 79 warning · **1653 tes / 63 berkas** · coverage **95,60 / 84,65 / 96,00 / 96,73** (ratchet tetap) · build ok · precache **53/53** · E2E **5 passed** (48,6 s).

### Live sesudah push `70e0f82`
`mtc-asset-v28` aktif (t=80 s). Probe UA mobile produksi: **0** hit iframe/gapi, 7 request JS, `networkidle` **1.859 ms**. Lighthouse live mobile 3 run:

| Metrik | Sebelum (S33i, median) | Sesudah (S33j, median) |
|---|---|---|
| perf | 62 | **79** |
| LCP | 6.428 ms | **3.988 ms** |
| render delay | 5.747 ms | **3.298 ms** |
| total byte | 411 KiB | **275 KiB** |
| unused-js | 84 KiB | **58 KiB** |
| `iframe/gapi` | 4 request (2 run) | **0 / 3 run** |
| `prod-*.js` | 0 | 0 |

a11y/bp/seo tetap **100/100/100**, TBT **0 ms**, CLS **0**. Sisa `unused-javascript`: `main` 58 KiB (Alpine — kartu `t_bea98211`) + `db` 31 KiB (kartu `t_cb2a51d4`). Target ≥85 belum tercapai; render delay 3,3 s masih didominasi parse `main` + font.

### Jebakan
1. **`window.Sentry` bukan bukti SDK termuat.** `src/main.js:21` memasang stub `window.Sentry = {…}` sebelum SDK diunduh. Probe S33i yang mencetak `sentryGlobalAfter: "object"` karena itu **menyesatkan** — bukti yang sah adalah request chunk `prod-*.js`, bukan nilai global.
2. **Probe Firebase auth WAJIB UA mobile.** UA desktop = 0 request iframe, kesimpulan "bersih" palsu. Ini yang membuat S33h menutup kartu yang benar.
3. **`getAuth()` ≠ `initializeAuth()`.** Yang pertama mendaftarkan `popupRedirectResolver` bawaan (iframe auth di mobile), yang kedua tidak. Kalau resolver dilepas, `signInWithPopup` **wajib** diberi resolver eksplisit atau gagal `auth/argument-error`.
4. Assert mock jangan pakai `expect.anything()` untuk resolver — bandingkan dengan objek resolver dari mock supaya penolakan argumen ketiga ketahuan.

---

## 📝 S33i (2026-10-21) — Sentry keluar dari jalur kritis login (kartu `t_bea98211`, bagian Sentry)

### Masalah
`src/main.js` memuat Sentry lewat `requestIdleCallback(initSentry, {timeout: 3000})`. Pada render login mobile, timeout 3 s itu **selalu** menang atas paint, jadi chunk `prod-*.js` (83.856 B / **28.015 B gzip**) ikut terunduh di layar login — padahal Sentry hanya telemetry.

### Perubahan
| Berkas | Isi |
|---|---|
| `src/main.js` | `initSentry` dipicu interaksi pertama (`pointerdown`/`keydown`/`touchstart`, `{passive:true}`) + jaring pengaman `setTimeout(armSentry, 30000)`; listener dilepas setelah menyala (`sentryArmed`) |
| `sw.js` | `mtc-asset-v26` → **v27** |
| `tests/login-critical-path.test.js` | baru — 2 tes kontrak: `requestIdleCallback(initSentry` / `setTimeout(initSentry,` dilarang muncul lagi; `armSentry` + daftar event + `setTimeout(armSentry` wajib ada |
| `scripts/login-network-probe.mjs` | baru — probe Playwright: hitung request `prod-*.js` sebelum vs sesudah interaksi (dipakai untuk bukti di bawah) |

### Bukti A/B (probe Playwright, preview `:4173`)
| Kondisi | Request JS sebelum interaksi | `prod-*.js` sebelum interaksi | sesudah klik |
|---|---|---|---|
| baseline (`git stash push -- src/main.js`, build ulang) | 8 | **dimuat** | dimuat |
| sesudah fix | 7 | **tidak ada** | dimuat (`window.Sentry` = object) |

`prod-C6YQoGgw.js` juga tidak ada di `modulepreload` `dist/index.html`; di chunk `main` hanya muncul sebagai `import(\`./prod-C6YQoGgw.js\`)` — dinamis, jadi jalur login bersih. 0 `pageerror` di kedua run.

### Lighthouse preview (Chromium headless, sesudah fix)
| Preset | perf | a11y | FCP | LCP | TBT | CLS | total byte | `prod-*.js` di network |
|---|---|---|---|---|---|---|---|---|
| desktop | **100** | 100 | 0,6 s | 0,7 s | 0 ms | 0,001 | 293 KiB | tidak ada |
| mobile (default throttle) | **89** | 100 | 2,3 s | 2,6 s | 260 ms | 0,013 | 444 KiB | tidak ada |

`unused-javascript` preview **105 KiB** — `main-*.js` 69 KiB + `db-*.js` 36 KiB. Keduanya **bukan** bagian perubahan ini: `main` = kartu `t_bea98211` (Alpine + modul), `db` = kartu `t_cb2a51d4` (RTDB SDK setelah login). Kartu `t_bea98211` belum bisa ditutup — bagian Sentry selesai, bagian Alpine belum.

### Gerbang
tsc 0 · eslint 0 error / 79 warning · **1652 tes / 63 berkas** · coverage **95,60 / 84,65 / 96,00 / 96,73** · build ok · precache **53/53** · E2E **5 passed** (`--workers=1`, 40,7 s).

### Live (setelah push `687c549`)
`mtc-asset-v27` aktif di `https://mtc-asset.web.app` (terdeteksi **t=90 s** setelah push). Probe produksi: **0** request `prod-*.js` sebelum interaksi, muncul setelah klik pertama (`window.Sentry` = object), 7 request JS, **0 `pageerror`**. Chunk live `main-B8v51kMt.js`: `import(\`./prod-C6YQoGgw.js\`)` ada, `requestIdleCallback` **0 kemunculan**, `prod-` di `index.html` **0**.

### Jebakan
1. **`npm run test:coverage && npm run build` dalam satu panggilan dengan `timeout` > 600 s dipromosikan jadi background process** — pakai `timeout` ≤ 600 atau poll `process_manage`, jangan jalankan ulang (dobel build).
2. **Probe `prod-*.js` harus menunggu `networkidle` + 3 s** — `requestIdleCallback` baseline butuh jeda itu; tanpa jeda baseline terlihat "bersih" dan A/B jadi palsu.
3. Nama chunk `prod-*.js` berubah tiap build (hash) — probe mencocokkan regex, jangan hardcode hash.

---

## 📝 S33h (2026-10-20) — SSO Google: import dinamis + jembatan global mati (kartu `t_505ab09a`)

### Premis kartu tidak terbukti
Kartu menyatakan layar login mengunduh `__/auth/iframe.js` (93 KiB) + `apis.google.com/js/api.js` + `gapi.loaded_0` "hanya karena `signInWithPopup` di-import statis". Diukur dengan Playwright pada preview **dan** live: layar login membuat **0 request** ke `apis.google.com` maupun `__/auth/iframe` — pada baseline (sebelum perubahan) **dan** sesudahnya. Firebase JS SDK memuat iframe + gapi hanya ketika popup benar-benar dipanggil.

### Yang dikerjakan (commit `0d5701f`)
| Berkas | Perubahan |
|---|---|
| `src/js/modules/auth.js` | `GoogleAuthProvider` + `signInWithPopup` diambil lewat `await import('firebase/auth')` di `loginWithSSO` |
| `src/js/db.js` | import/export `GoogleAuthProvider`, `signInWithPopup` dihapus |
| `src/js/firebase-config.js` | `window.GoogleAuthProvider` / `window.signInWithPopup` dihapus (0 pemakai) |
| `src/js/globals.d.ts` | dua deklarasi global dihapus |
| `tests/auth-module.test.js` | mock modul `firebase/auth` (`vi.hoisted` + `vi.mock`), bukan `vi.stubGlobal` |

### Byte: tidak ada penghematan
`firebase/auth` tetap dibutuhkan login email (`signInWithEmailAndPassword`), jadi paket itu tidak bisa keluar dari bundel. Hasilnya chunk hanya terpecah: `db` 217,4 → **132,4 KB** + chunk baru `index.esm` **85,0 KB** = total identik (~514 KB).

Nilai perubahan ini **struktural, bukan byte**: permukaan global (`window.GoogleAuthProvider`, `window.signInWithPopup`) hilang dan jalur SSO tidak lagi bergantung pada jembatan `window`. Kalau prioritasnya kode minimum, import dinamis ini justru bisa dibatalkan (import statis + hapus jembatan sudah memberi manfaat yang sama) — belum dilakukan karena kartu memintanya eksplisit.

### Bug nyata yang tertangkap (bukan bagian kartu)
Percobaan pertama memakai `this.auth` — **AppState tidak punya field `auth`** → klik SSO mati dengan `TypeError: Cannot read properties of undefined (reading 'app')` di chunk firebase/auth.

Tes lama ikut menyembunyikannya: assert `toHaveBeenCalledWith(ctx.auth, expect.anything())` dengan `ctx.auth` bernilai `undefined` tetap lolos. Sekarang tes mengambil `fb.auth` dari `stubFirebase()` dan mengunci instance nyata (`window.auth`).

Setelah fix, klik SSO di preview membuka popup `__/auth/handler`, gapi + iframe termuat → jalur SSO hidup.

### Gerbang
tsc 0 · eslint 0/79 · **1650 tes / 62 berkas** · coverage **95,60/84,65/96,00/96,73** · build ok · precache **53/53** · E2E **5 passed** (1 flake `page.goto` 30 s pada cold dev server, lolos saat diulang — pola S33). `sw.js` **v25 → v26**; live terverifikasi: `mtc-asset-v26`, `main-CHfqLDv3.js` tanpa `window.signInWithPopup`, `loginWithSSO` ada.

### Jebakan baru
1. **`vi.mock('firebase/auth', () => ({...}))` dengan objek inline tidak bisa dimutasi dari tes** — factory dievaluasi per import sehingga referensinya berbeda. Pakai `vi.hoisted()` untuk satu objek bersama, lalu `vi.mock('firebase/auth', () => ssoMock)`.
2. **State mock bocor antar tes**: tes "tanpa provider" men-set `ssoMock.GoogleAuthProvider = undefined` dan meracuni tes berikutnya. Reset di `beforeEach`; jangan pasang `mockResolvedValueOnce` default di `beforeEach` bila tes lain butuh `mockRejectedValueOnce` (antrean *once* dieksekusi berurutan).
3. **`expect.anything()` menyembunyikan argumen `undefined`** — `toHaveBeenCalledWith(undefined, expect.anything())` lolos. Ambil nilai nyata dari stub, jangan `anything`.
4. **Dynamic import tidak memisahkan paket yang sudah diimpor statis di tempat lain.** `firebase/auth` dipakai `db.js` untuk login email → chunk-nya tetap statis di entry; buktikan dengan membaca daftar static import di chunk `main-*.js`, bukan dari nama berkas.
5. **Jangan percaya judul kartu perf.** Ukur baseline A/B dulu (`git stash push -- <berkas>` → build → probe → `git stash pop`); probe siap pakai: `scratch/probe-auth-network.mjs`, `scratch/probe-sso-click2.mjs`.

---

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

### Tambahan S33b — a11y chip filter status WorkOrders
`public/pages/WorkOrders.html:224-249`: 6 chip filter status sekarang punya **`aria-label` statis** (nama tidak lagi bergantung pada `x-text`/Alpine), **`:aria-pressed`** untuk status terpilih, dan **`min-h-6 min-w-6`** (24 px — WCAG 2.2 target-size 2.5.8). Terverifikasi di CSS hasil build (`min-h-6{min-height:1.5rem}`).

Kontrak baru `tests/wo-filter-a11y.test.js` (4 tes, ditulis RED dulu). `sw.js` `CACHE_NAME` **v21 → v22** (`public/**` berubah). Commit `af81fd8`. Live terverifikasi: `sw.js` → `mtc-asset-v22`, marker `aria-label="Filter status Pending"` muncul di `/pages/WorkOrders.html` (~50 s setelah push). Suite 1643 → **1647**; coverage tetap 95,57/84,67/96,00/96,69.

### S33g — gambar panel desktop berhenti diunduh di mobile (kartu `t_cb45e098`)
Lighthouse live mencatat `offscreen-images` **77 KiB**: `login-mill-800.webp` 61,1 KiB + `logo.png` 16,0 KiB. Keduanya berada di dalam panel `hidden lg:*`, jadi tak pernah terlihat di layar kecil — tapi `<img>` tanpa `loading` tetap diunduh.

Perbaikan: `index.html` → hero mill `loading="lazy"` + `fetchpriority="low"`, logo sidebar `loading="lazy"`. Kontrak dikunci `tests/login-image-weight.test.js` (3 tes, RED dulu). `lighthouse/` masuk `.gitignore`.

| Metrik (Lighthouse preview) | Sebelum | Sesudah |
|---|---|---|
| `offscreen-images` | 77 KiB | **lulus (score 1)** |
| total byte | 427 KiB | **409 KiB** |
| LCP | 3,6 s | **2,6 s** |
| perf | 67 | **88** |

`sw.js` **v24 → v25**; live terverifikasi. Commit `ea343d1`. Gerbang: tsc 0, eslint 0/79, **1650 tes / 62 berkas**, coverage **95,60/84,67/96,00/96,73**, build ok, precache 52/52, E2E 5 passed.

### S33f — Lighthouse **live mobile** diukur ulang (3 run, median)
| Run | perf | a11y | bp | seo |
|---|---|---|---|---|
| 1 | 76 | 100 | 100 | 100 |
| 2 | 69 | 100 | 100 | 100 |
| 3 | 74 | 100 | 100 | 100 |
| **median** | **74** | **100** | **100** | **100** |

Baseline S31 = 91/100/96/100 → **perf turun 91 → 74**, `best-practices` naik 96 → 100 (efek S33d: font legibel).

Akar masalah dari JSON: LCP **4,3 s** dengan **render delay 3.487 ms (81%)**, TTFB 797 ms. Elemen LCP = **teks** `label.font-body-sm` di form login (bukan gambar). `unused-javascript` 89–104 KiB, `offscreen-images` 77 KiB (`login-mill-800.webp` 61,1 + `logo.png` 16,0 — di luar viewport mobile), `render-blocking` = `main-*.css` 12,8 KB + `registerSW.js`. TBT 140 ms (0,95), SI 3,7 s (0,85) → masalahnya render delay, bukan main-thread.

Kartu: `t_8409c23c` (ukur ulang) **selesai**; regresi dicatat di kartu baru **`t_b613af07`** (LCP/render delay, median perf ≥ 85).

### S33e — bundel awal: buang `firebase/storage` + `firebase/messaging`
Halaman login tidak pernah memakai Firebase Storage (foto naik ke **Cloudinary**) dan tidak memanggil FCM saat boot, tapi keduanya ikut terunduh lewat chunk `db` (85,6 KiB gzip; 67 KiB di antaranya *unused* menurut Lighthouse).

| Perubahan | Efek |
|---|---|
| `db.js`: import/instance/export `firebase/storage` + `firebase/messaging` dihapus | chunk `db` **295 → 222 KB** (raw) |
| `firebase-config.js`: jembatan `window.storage/refStorage/uploadBytes/getDownloadURL/messaging` dihapus | tidak ada pemakai di `src/**` maupun `public/**` |
| `notification.js`: `firebase/messaging` → **dynamic import** di `registerFCMToken` + `setupForegroundListener` (kini async) | SDK messaging keluar dari bundel awal |
| `tests/notification-fcm.test.js`: 4 tes listener di-`await` | 16/16 hijau |

Lighthouse mobile (preview): unused JS **136 → 122 KiB**, total **438 → 427 KiB**, chunk `db` unused 67 → 52,5 KiB. Skor perf lokal berisik (63–87 antar run) — jangan dipakai sebagai bukti tunggal.

`sw.js` **v23 → v24**, precache 50 → **52** berkas (chunk lazy baru). Live: `mtc-asset-v24`. Commit `11c2372`.
Gerbang: tsc 0, eslint 0/79, **1647 tes**, coverage **95,60/84,67/96,00/96,73**, build ok, precache 52/52, E2E 5 passed.

**Sisa peluang** (belum dikerjakan): chunk `db` (Firebase RTDB SDK) masih dimuat sebelum login; menundanya butuh pemuatan dinamis seluruh lapisan data — refactor besar, jangan dikerjakan setengah.

### S33d — skala tipografi label >= 12 px (audit `font-size` tuntas)
Audit Lighthouse `font-size` hanya menghitung teks **>= 12 px**, jadi label 10/11 px membuat hampir separuh teks dianggap tidak legibel.

| Langkah | % teks legibel |
|---|---|
| Baseline (S31, handoff) | 52,96% |
| Token Tailwind saja (`label-mono-sm/md` → 12 px) | **89,97%** |
| + `.tac-btn-*`, `.tac-label-sm/md`, `.tac-chip` → 12 px | **100%** |

Berkas: `tailwind.config.js` (`label-mono-sm` 10→12/16, `label-mono-md` 11→12), `src/css/tactical.css` (5 deklarasi 10/11 px → 12 px). `sw.js` `CACHE_NAME` **v22 → v23**. Lighthouse mobile di preview build: a11y **100**, best-practices **100**, `font-size` **100% legible**.

Live terverifikasi: `sw.js` = `mtc-asset-v23` (~70 s), CSS live `assets/main-4ZWAo_I9.css` memuat `.tac-chip{…font-size:12px…}`. Commit `9427fc9`. Gerbang: tsc 0, eslint 0/79, 1647 tes, coverage 95,57/84,67/96,00/96,69, build ok, precache 50/50, E2E 5 passed.

### S33c — CI `Test` HIJAU (E2E di runner)
**Akar masalah** (dari log runner, bukan tebakan): `firebase-tools` 15.33 **menolak Java < 21**, sedangkan runner `ubuntu-latest` memasang Java 17 → emulator mati seketika (`Error: firebase-tools no longer supports Java version before 21`), dan Playwright melaporkannya sebagai `Process from config.webServer was not able to start. Exit code: 1` tanpa stderr (Playwright menelan output webServer).

Perbaikan:
1. `.github/workflows/test.yml`: tambah `actions/setup-java@v4` (temurin, `java-version: '21'`) sebelum langkah E2E.
2. `playwright.config.js`: perintah webServer jadi **`npx firebase emulators:start …`** (biner `firebase` hanya ada di `node_modules/.bin` di runner, tidak di PATH).
3. Langkah E2E pakai `--workers=1` (4 worker paralel = `page.goto` timeout saat preview dingin).

Hasil: run `39371163886` → **Test success**, E2E **4 passed (12,8 s)**. `Build and Deploy` + `Lighthouse CI` success. Commit `9a52973`, `fa79b92` (diagnostik sementara, sudah diganti), `ebade22`.

### CI (temuan terbuka)
~~Job `Test` gagal di langkah "E2E tests (smoke)"~~ — **SELESAI di S33c** (JDK 21 + `npx firebase`). Dulu gagal sejak S32 (`5024f6c`), **bukan regresi S33**. Langkah lint/typecheck/unit/coverage/build di runner **hijau semua**; `Build and Deploy` + `Lighthouse CI` **success** untuk `4f176b8` maupun `d3c1df4`. Percobaan `--workers=1` di workflow (commit `d3c1df4`) belum menyelesaikan; simulasi CI lokal (`CI=true npx playwright test e2e/smoke.spec.js --workers=1`) → **4 passed, 23,9 s**. Diagnosa lanjut butuh log runner (`gh run view --log-failed` setelah `gh auth login`) — jangan menebak.

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
