# PROMPT — Sesi Baru (D16: Form input melebar di desktop)

Tempel ini sebagai pesan pertama di sesi baru.

---

## Tugas

Perbaiki **semua tampilan form input di semua menu** supaya **melebar khusus
desktop** biar enak diisi. Screenshot bukti: modal "NEW SYSTEM ENTRY" — panel
besar tapi field sempit, footer tombol CANCEL / INITIALIZE PROTOCOL menumpuk
teks "2 FIELD BELUM VALID", field bawah terpotong.

## Langkah 1 — Baca dulu (jangan langsung tambal)

1. `NOTE-D16.md` (repo root) — **investigasi lengkap sudah selesai di sesi
   sebelumnya.** Akar masalah, daftar berkas+baris, rencana patch, daftar tes
   yang mengunci, gerbang verifikasi semuanya ada di sana.
2. `AGENTS.md` — aturan repo (ratchet coverage, verification-before-completion).
3. `NOTE-D15.md` / `NOTE-D14.md` / `NOTE-D13.md` — konteks kerja terakhir.

## Langkah 2 — Konfirmasi ke user (workflow Spec-First)

Tanyakan pilihan lebar desktop sebelum menulis kode:

| Opsi | Perubahan |
|---|---|
| A (rekomendasi) | Tier baru `@container (min-width:900px)` 4 kolom **+** naikkan `max-w` panel modal di `lg:` (log/perf/request → `lg:max-w-6xl`, equip → `lg:max-w-4xl`, part/PM/planning → `lg:max-w-3xl`) |
| B | Hanya naikkan `max-w` panel, grid tetap 3 kolom maksimum |
| C | Hanya tier 4 kolom, panel modal tidak diubah |

Juga konfirmasi: perbaiki bug footer overlap (hapus `max-h-[90vh] overflow-y-auto`
ganda di panel modal log 1482 + perf 1328) — ya/tidak.

## Ringkasan akar masalah (dari NOTE-D16, terverifikasi)

- `.form-grid` **sudah benar** — container query 1→2→3 kolom, `container-type`
  di induk via `:has()`. Bukan ini masalahnya.
- Yang sempit: **panel modal** dibatasi `max-w-4xl` / `max-w-2xl` / `max-w-lg`.
  Modal log 848 px → maksimal 3 kolom ~245 px, bahkan di layar 1920 px.
- Tidak ada tier 4 kolom di CSS. Belum pernah ada.

## Berkas yang akan disentuh

- `src/css/style.css` (~356) — tier desktop baru.
- `public/pages/app-shell.html` — 1109, 1209, 1328, 1482.
- `public/pages/RequestPart.html` — 388.
- `public/pages/PMSchedule.html` — 584.
- `public/pages/PlanningBoard.html` — 348.
- `sw.js` — `mtc-asset-v125` → `v126`.
- `tests/form-desktop-width.test.js` — **baru** (RED dulu).

## Kerjakan

1. Skill wajib dulu: `superpowers:using-superpowers`, lalu
   `superpowers:test-driven-development` untuk patch-nya.
2. Tulis tes RED dulu (`tests/form-desktop-width.test.js`): kunci tier desktop
   ada, `max-w` panel naik, dan **invarian lama tetap** — `.form-grid {
   grid-template-columns: minmax(0,1fr) }`, `:has(> .form-grid) { container-type:
   inline-size }`, `.form-grid` tidak punya `container-type`, dan tidak ada
   `max-h-[90vh]` di panel modal berform.
3. Patch minimal. **Dilarang**: `!important` global, `!w-full` blanket, hapus
   13 blob skeleton lama di `app-shell.html`.
4. Tes relevan hijau: `form-controls`, `mobile-form-layout`, `log-form-layout`,
   `modal-scroll-contract`, `mobile-overflow-contract`, `app-shell-split`,
   `critical-css`, `requestpart-title-wrap`, `ui-module`.
5. Gerbang penuh **di turn yang sama**, output verbatim:
   ```
   npx tsc --noEmit
   npx eslint .
   npx vitest run --coverage
   npx vite build
   node scripts\verify-precache.mjs
   ```
   Baseline D15: **117 berkas / 2314 passed**, coverage **97.48 / 90.22 / 97.7 /
   98.53**, precache **60/60**. Ratchet `vitest.config.js` 96/89/96/97 —
   **jangan diturunkan**. Ulangi 4 TZ: Asia/Jakarta, UTC, Pacific/Kiritimati,
   America/Los_Angeles.
6. Bump `sw.js` → `mtc-asset-v126`.
7. Commit + push (`BypassSandbox: true` untuk git write). Stage eksplisit.
   **Jangan stage** `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx`.
8. `gh run list --limit 3` → tunggu 3 job `completed success`.
9. Verifikasi prod: `status 200` + `cacheName mtc-asset-v126`.

## Jebakan shell (dari sesi sebelumnya — hemat waktu)

- Selalu `cd D:\CODING\MTC-Asset` (atau `cd /d` di cmd). cwd huruf drive kecil
  mematikan `vi.mock`.
- PowerShell memecah `|` di dalam pattern `rg`. Pakai `rg -e a -e b`.
- Quote/conditional di PowerShell bikin parse error → tulis skrip `.mjs` di
  scratch dir, jangan `node -e` inline.
- `edit_file` gagal (match 0) pada file CRLF → pakai skrip Node
  `split(/\r?\n/)` + `join(EOL asli)`.
- `npx vitest run --coverage > file.txt 2>&1` di background mencetak
  "No output" — normal, baca file txt-nya.
- Jangan `--pool=vmThreads` (merusak `ui-module.test.js`).

## Output yang diharapkan

Laporan ringkas: pilihan opsi yang disetujui, hasil RED, patch, angka gerbang
verifikasi verbatim, status CI, `cacheName` prod.
