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
