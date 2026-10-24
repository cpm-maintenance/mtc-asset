# Stitch Prompt Pack — MTC-ASSET

Paste-ready prompts for `https://stitch.withgoogle.com/`.
Grounded in: `design/DESIGN-TACTICAL.md` (token source of truth), `tailwind.config.js` (`tac-*`), and live runtime evidence of `https://mtc-asset.web.app/` (REA CDP capture, target `89B01074749BE9A7F7C4863FCA6DB06F`).

---

## 0. Cara pakai

1. Buka Stitch → **New project**.
2. Pilih mode **Web** (desktop 1440) untuk Prompt A–F, **Mobile** untuk Prompt G.
3. Paste **Prompt A** dulu. Itu menetapkan design system + shell aplikasi.
4. Lanjut **Prompt B…H**, satu prompt = satu layar. Jangan gabung dua layar dalam satu prompt.
5. Kalau Stitch menawarkan "upload design system", unggah `design/DESIGN-TACTICAL.md` — token di prompt di bawah identik dengan file itu.
6. Setelah generate: **Export → HTML/Tailwind**, simpan ke `design/stitch/stitch-<nama>.html` (pola yang sudah dipakai di repo ini).
7. Semua copy UI **Bahasa Indonesia**, istilah teknis tetap Inggris (`WORK ORDER`, `MTBF`, `PM`, `HM`). Jangan diterjemahkan.

Blok **NEGATIVE** di akhir setiap prompt itu wajib ikut di-paste — tanpa itu Stitch mengembalikan dashboard SaaS generik (rounded-2xl, gradient ungu, kartu putih).

---

## Prompt A — Master: design system + app shell + dashboard

```
Design a desktop web application UI for an industrial maintenance management PWA used inside a gold processing plant. Product name: MTC-ASSET. Operator: PT Citra Palu Minerals. Users: maintenance planners, reliability engineers, plant supervisors, field technicians. Environment: dim control rooms, tablets on the plant floor, gloves, dust, intermittent connectivity. The interface must feel like a piece of heavy machinery, not a SaaS website.

VISUAL LANGUAGE — "Tactical Slate & Luminous Gold"
Strict dark mode. Charcoal-slate carbon substrate with recessed input wells, tactile extruded panels, and thin top-lit chamfer edges that mimic machined metal. Amber-gold is the only high-emphasis accent; cyan means live data/sync; crimson means production stopped. No pure white, no purple, no glassmorphism hero, no marketing gradients.

COLORS (use exactly)
- surface-base #0b0f15 (page background)
- surface-canvas #0f141c
- surface-card #161d27 (modules, KPI cards)
- surface-elevated #1e2634 (modals, popovers)
- surface-recessed #0a0e14 (inputs, search wells)
- border-tactical #283446 (hairline, always 1px)
- text primary #dce3f1, secondary #94a3b8, disabled #64748b
- primary gold #f59e0b, gold-bright #fbbf24, gold-dim #d97706
- secondary cyan #06b6d4 (sync, telemetry, scanner)
- status operational #10b981, repair/planned #f59e0b, emergency #ef4444, standby #94a3b8

TYPOGRAPHY
Inter for all UI text. JetBrains Mono for every number, ID, timestamp, badge and telemetry readout — tabular alignment matters because values refresh live. Sizes: page title 26px/600, section head 18px/600, body 14px/400, meta 12px/400, mono label 11px/600 uppercase with 0.08em tracking. Nothing below 12px for readable text, nothing below weight 500 for labels.

DEPTH
Cards: box-shadow 12px 16px 28px rgba(0,0,0,.5), -4px -4px 14px rgba(255,255,255,.03), 1px top-lit border. Inputs: inset 2px 2px 5px rgba(0,0,0,.6), inset -1px -1px 3px rgba(255,255,255,.04). Active gold elements glow 0 0 16px rgba(245,158,11,.25); live cyan 0 0 16px rgba(6,182,212,.3). Corners: 8px default, 12px on cards, 16px on modals. Nothing pill-shaped except status chips.

APP SHELL
Left rail 248px, collapsible to 64px icon rail. Top: plant mark "MTC ASSET" in gold mono uppercase, subtitle "PT CITRA PALU MINERALS". Nav sections: OPERASIONAL (Dashboard, Work Orders, Equipment, All Logs), PERENCANAAN (PM Schedule, Planning Board, Monthly Plan, Spare Parts, Request Part), ANALITIK (KPI, MTBF/MTTR, Performance, Technician Workload, Enterprise Dashboard), SISTEM (AI Analysis, Audit Trail). Active item: 2px gold left bar, surface-elevated fill, gold icon. Top bar 56px: page title, asset/QR search well, offline/sync pill, user chip with role.
Offline banner pinned under the top bar: amber crosshatch strip, mono text "MODE OFFLINE — PERUBAHAN AKAN DISINKRONKAN", right side cyan pulse dot + "CACHE LOKAL AKTIF".

SCREEN: DASHBOARD
Row 1 — four KPI plates, equal width. Each: mono uppercase label, huge tabular number (32px, weight 700), delta chip, thin sparkline.
  "FLEET INTEGRITY" 96.4% · "TOTAL RUNNING HM / MTBF" 1 284 h · "MTBF ESTIMATE" 412 h · "BD FREQ (30D)" 7
Row 2 — three status counters as compact slabs: "PENDING" 12 (standby), "IN PROG" 5 (gold), "DONE" 38 (emerald), each with a 3px status bar across the top edge.
Row 3 — two columns 2:1.
  Left: "FIELD RCA (PRIMARY)" — a dense incident table: columns TANGGAL (mono), ASSET ID (mono), GEJALA, SEVERITY (chip), STATUS (chip), TEKNISI. Zebra rows using surface-canvas / surface-card, no dividers.
  Right: "DISTRIBUSI JENIS LOG (30 HARI)" — horizontal bar chart, cyan bars on recessed plot well, mono axis labels, gold highlight on the largest bar.
Row 4 — "TARGET ASSET" strip: 6 small asset tiles, each with asset code in mono, machine type, running-hour readout, and a status dot. Emergency asset tile gets a crimson 3px top edge and crimson glow.
Footer strip: mono meta line "AUTHENTICATION ID · ROLE / ACCESS LEVEL · ACTIVE LLM PROVIDER · FAST SYNC" right-aligned, muted.

NEGATIVE — do not use: pure white backgrounds, rounded-2xl, drop shadows with blur over 40px, purple/indigo gradients, glassmorphism cards, emoji, icon-only buttons without labels, 1px dividers between table rows, light mode, marketing copy, stock photography, hero sections.
```

---

## Prompt B — Work Orders (kanban + inspector)

```
Continue the MTC-ASSET design system: dark tactical slate, amber-gold accent, Inter + JetBrains Mono, 8–12px corners, recessed wells, no dividers.

Screen: WORK ORDERS, desktop 1440. Header row: title "WORK ORDER" with mono subtitle "LEDGER STREAM · KANBAN STACK", then a right-aligned cluster of ghost buttons "EXPORT AUDIT CSV" and one gold primary "CREATE WO".

Below header: 4 compact metric slabs in a row — "ACTIVE TASKS" 23, "HOURS / AVG" 4.2 h, "PARTS COMMITTED" 18, "DOWNTIME TERCATAT" 6.5 h. Mono numbers, muted uppercase labels.

Filter bar in a recessed well: sector select "ALL SECTORS (FLEET-WIDE)", date range "CLEAR DATES", sort select "SORT BY PRIORITY SCORE", and a mono search field.

Main area: 4 kanban columns, each 25% wide, header with count chip:
  "ALPHA (EMERGENCY)" crimson dot · "BRAVO (URGENT)" amber dot · "CHARLIE (NORMAL)" slate dot · "PLANNED / PM" cyan dot
Cards (surface-card, 12px radius, 1px border-tactical): top line asset code in mono gold (e.g. "CRU-04"), status chip top-right, title in 14px/600 ("Ganti bearing pulley discharge"), meta rows in mono 11px: "PRIORITY 92 · 14:20 · 3 PART", assigned technician avatar initials, bottom row of ghost action buttons "START WORK", "UPDATE FIELD LOG".

Right side: a slide-over INSPECTOR panel 420px, surface-elevated, gold 1px left edge. Contents: WO number in mono, asset plate (asset code, machine type, location "MILL / CRUSHER LINE 2"), 2×3 field grid with mono labels and values, parts table with qty and stock status, timeline of log entries (mono timestamp + author + note), sticky footer with buttons: primary gold "COMPLETE", secondary "APPROVE", destructive ghost "REJECT WO", text link "TUTUP INSPECTOR".

NEGATIVE — same list as before, plus: do not make cards white, do not use column backgrounds lighter than surface-card, no drag handles as the only affordance.
```

---

## Prompt C — Equipment registry + asset detail

```
Continue the MTC-ASSET design system.

Screen: EQUIPMENT registry, desktop. Top: title "ASSET REGISTRY", mono counter "1 284 UNIT · 6 SEKTOR", right cluster: recessed search well "CARI KODE ASET / NAMA MESIN", filter chips (SEMUA, OPERATIONAL, REPAIR, EMERGENCY, STANDBY), and a ghost button "SCAN QR" with a cyan scanner glyph.

Body: a dense table inside a surface-card. Columns: ASSET ID (mono gold), NAMA MESIN, SEKTOR, TIPE, RUNNING HM (mono, right-aligned), MTBF (mono), STATUS (dot chip), AKSI (ghost icon+label "DETAIL"). Zebra rows, 48px height, hover row lifts to surface-elevated. Status column uses the four status colors with translucent tinted backgrounds.

Screen 2 of the same prompt — ASSET DETAIL for asset "CRU-04 · JAW CRUSHER":
- Breadcrumb mono: ASSET REGISTRY / CRUSHER LINE 2 / CRU-04
- Hero plate: asset code huge in mono gold, machine name, location, install date, big status chip "OPERATIONAL". Right side: primary gold "BUAT WO", ghost "EDIT", ghost "QR LABEL".
- Four KPI tiles: RUNNING HM 12 480, MTBF 412 h, MTTR 3.8 h, BREAKDOWN 30D 2.
- Two-column body: left "RIWAYAT WORK ORDER" table (mono dates, WO number, jenis, durasi, teknisi); right column stacked: "PM SCHEDULE" list with next-due countdown chips (overdue = crimson), "SPARE PART TERKAIT" list with stock bar (emerald > 60%, gold 20–60%, crimson < 20%), and "DOKUMEN" rows with file glyph and mono size.
- Bottom: recessed well containing a 30-day running-hour line chart, cyan line, gold dot on the last point, mono grid labels.

NEGATIVE — same list, plus no card carousels, no hero images of machinery.
```

---

## Prompt D — PM Schedule + Planning Board

```
Continue the MTC-ASSET design system.

Screen: PM SCHEDULE, desktop. Header: title "JADWAL PERAWATAN", mono subtitle "PREVENTIVE MAINTENANCE · ROLLING 12 MINGGU", right cluster: view toggle (BULAN / MINGGU / DAFTAR) as a segmented control in a recessed well, ghost "EXPORT", gold primary "JADWAL BARU".

Main: a Gantt-style planning grid. Left frozen column 260px lists assets (mono code + machine name + sector). Right: week columns with mono week numbers across the top, today column marked with a 1px cyan vertical line and cyan "HARI INI" tag. Bars: 6px tall, 4px radius, gold for planned PM, cyan for inspection, crimson for overdue, slate for completed; each bar carries a mono label on hover row. Row height 40px, alternating surface rows.

Below the grid: a "BACKLOG" strip — horizontal scroll of small cards, each with asset code, task, due countdown chip, and a ghost "ASSIGN" button.

Screen 2 — PLANNING BOARD: three columns (ANTRIAN, DIJADWALKAN, SELESAI) of task cards, each card showing week chip, asset, duration estimate in mono, technician initials stack, and a load bar. Right rail 280px: "BEBAN TEKNISI" list with 5 technicians, name, avatar, hours-planned vs capacity bar (over-capacity turns crimson), and a mono percentage.

NEGATIVE — same list, plus: no pastel colors, no calendar illustrations, no rounded-pill bars.
```

---

## Prompt E — Spare parts ledger + request part

```
Continue the MTC-ASSET design system.

Screen: SPARE PARTS, desktop. Header: title "SPARE PART LEDGER", mono "BOM · STOK · QR LABEL", right cluster ghost "IMPORT", ghost "EXPORT", gold primary "PART BARU".

Top row: 4 metric slabs — "SKU AKTIF" 412, "DI BAWAH MINIMUM" 17 (crimson), "NILAI STOK" Rp 2,84 M (mono), "PERMINTAAN TERBUKA" 6.

Body: table in surface-card. Columns: PART NO (mono), DESKRIPSI, KATEGORI, LOKASI RAK (mono), STOK (mono with a 64px stock bar), MIN, HARGA (mono, right-aligned), LEAD TIME (mono days), AKSI. Rows under minimum get a 3px crimson left edge and a faint crimson tint. Status chips: "AMAN" emerald, "MENIPIS" gold, "HABIS" crimson.

Right side drawer example open: part "BRG-22314 · TAPERED ROLLER BEARING" — spec table (dimensi, material, brand), "DIPAKAI DI ASSET" list of 4 asset codes, movement history mini-table with mono dates, and footer buttons gold "AJUKAN PERMINTAAN", ghost "CETAK QR".

Screen 2 — REQUEST PART: a form inside a surface-card, 2-column field grid. Fields as recessed wells with persistent uppercase mono labels above: ASSET TUJUAN, PART, QTY, PRIORITAS (segmented ALPHA/BRAVO/CHARLIE), TANGGAL DIBUTUHKAN, CATATAN (textarea 4 rows). Right column: approval chain as a vertical stepper (PLANNER → SUPERVISOR → GUDANG) with mono status per step and timestamp. Sticky footer: ghost "BATAL", gold "KIRIM PERMINTAAN".

NEGATIVE — same list, plus no product photos, no currency symbols other than "Rp", no rounded input pills.
```

---

## Prompt F — Secure login gateway (matches the live screen)

```
Continue the MTC-ASSET design system. Full-viewport dark screen, no app shell.

Split layout 55/45. Left panel is surface-base with a very faint diagonal carbon texture and a thin gold hairline on the right edge. Right panel is surface-card, 480px wide, vertically centered card with 16px radius and top-lit chamfer border.

LEFT PANEL content, top to bottom:
- mono uppercase gold line: "RELIABILITY OPERATIONS" with a small gold shield glyph
- headline 36px/700: "MTC ASSET" then 26px/600 "MAINTENANCE PLANNING"
- 14px muted line: "REGISTRY ASET · JADWAL PERAWATAN · RIWAYAT WORK ORDER"
- two module slabs side by side, each surface-elevated with recessed icon well:
  "ASSET REGISTRY" / "Equipment" / "Spare parts · BOM · QR label" / mono tag "MODUL"
  "MAINTENANCE LEDGER" / "Work Orders" / "PM schedule · logs · KPI" / mono tag "MODUL"
- bottom mono strip with cyan dot: "OFFLINE-FIRST · CACHE LOKAL TETAP JALAN TANPA SINYAL" and a chip "PWA READY"
- footer mono 10px muted: "© 2026 MTC ASSET"

RIGHT PANEL — the login card:
- header row: mono gold "MTC ASSET SECURE GATEWAY", below it muted 12px "PT CITRA PALU MINERALS", right side a lock glyph chip "KONEKSI TERENKRIPSI"
- heading "System Access" 22px/600, subline 12px muted "Kredensial operator dikelola admin lewat User Management."
- segmented tab bar in a recessed well, three tabs with icons: "EMAIL" (person), "PIN" (fingerprint), "SSO" (public). Active tab: surface-card fill, gold underline 2px.
- two recessed input wells, persistent mono uppercase labels above: "OPERATOR ID / EMAIL" with person glyph and helper "DIBUAT ADMIN"; "SECURE KEY" with fingerprint glyph, helper "MINIMAL 6 KARAKTER", and an eye toggle button at the right edge.
- checkbox row 12px: "Simpan sesi di perangkat ini (shift bawah tanah / sinyal terputus)"
- full-width primary button, 52px tall, gold gradient (#f59e0b → #fbbf24), dark text, mono uppercase 11px/600 tracking 0.08em, login glyph + label "AUTHENTICATE & ENTER COMMAND CENTER"
- footer row split: left mono muted "AKSES HANYA UNTUK AKUN TERDAFTAR", right chip "CACHE LOKAL AKTIF" with cyan dot
- top-right of the screen, floating: a tiny settings glyph button and a mono chip "PANEL MASUK"

NEGATIVE — same list, plus: no illustration of people, no mountain/mining artwork, no "Welcome back!" copy, no social login buttons beyond the SSO tab, no light card on light background.
```

---

## Prompt G — Field technician mobile (WO execution)

```
Continue the MTC-ASSET design system, but MOBILE PWA at 390×844. Single column, 16px margins, thumb-reachable actions. 44px minimum touch targets.

Screen: FIELD WORK ORDER execution.
- Status bar zone: mono 10px "OFFLINE · ANTRIAN SINKRON 3" in amber, and a cyan sync dot.
- Header: back chevron, title "WO-2026-0417" in mono gold, right chip "ALPHA" crimson.
- Asset plate card: "CRU-04 · JAW CRUSHER", mono location "MILL / CRUSHER LINE 2", status chip, and a QR glyph button.
- Segmented progress rail: 4 steps (TERIMA · MULAI · LOG · SELESAI), current step gold, completed emerald, future slate.
- Body: three stacked recessed wells — "DOWNTIME MULAI" mono timestamp with a gold play button; "TEMUAN" textarea with 2 photo thumbnails and a dashed recessed drop target "+ FOTO"; "PART DIPAKAI" row with qty stepper and mono stock hint.
- Sticky bottom command dock, surface-elevated with top-lit border, three buttons: ghost "TUNDA", secondary "UPDATE FIELD LOG", primary gold full-width "SELESAIKAN WO".
- Below dock, mono 10px muted: "PERUBAHAN TERSIMPAN LOKAL · SINKRON SAAT ONLINE"

NEGATIVE — same list, plus: no horizontal scroll, no floating action bubble, no rounded-3xl, no bottom tab bar with 5 icons.
```

---

## Prompt H — KPI / MTBF-MTTR analytics

```
Continue the MTC-ASSET design system.

Screen: KPI & MTBF/MTTR, desktop. Header: title "KINERJA PEMELIHARAAN", mono "MTBF · MTTR · AVAILABILITY · 90 HARI", right cluster: period segmented control (7H / 30H / 90H / TAHUN), ghost "EXPORT".

Row 1: four KPI plates with big mono numbers and delta chips — MTBF 412 h (+6.2%), MTTR 3.8 h (−0.4 h), AVAILABILITY 94.1%, COMPLIANCE PM 87%.
Row 2: two large panels.
  Left, 2/3 width: "TREN MTBF / MTTR" — dual-axis line chart on a recessed plot well, cyan line for MTBF, gold dashed for MTTR, mono axis labels, target line as a 1px crimson dashed rule with mono tag "TARGET 400 h".
  Right, 1/3: "TOP 5 ASSET BERMASALAH" — ranked list, each row with rank in mono gold, asset code, breakdown count, and a horizontal severity bar.
Row 3: "MATRIKS SEKTOR" heatmap — 6 rows × 12 month columns of small squares, values from emerald through gold to crimson, mono legend beneath.
Row 4: "AUDIT TRAIL" compact table — mono timestamp, user, aksi, entitas, with a ghost "LIHAT SEMUA" link.

NEGATIVE — same list, plus: no 3D charts, no gradient area fills over 20% opacity, no pie charts with more than 4 slices, no rounded chart containers with soft shadows.
```

---

## Reusable NEGATIVE block (kalau perlu berdiri sendiri)

```
Do not use: light mode, pure white, purple/indigo/violet, teal-pink gradients, glassmorphism, rounded-2xl/3xl, soft pastel status colors, 1px dividers between rows, emoji, stock photos, illustrations of people, marketing headlines, pill-shaped inputs, floating action bubbles, more than one accent color per screen.
```
