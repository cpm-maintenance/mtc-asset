# SESSION START — Prompt MTC-Asset (PWA Maintenance)

Gunakan prompt ini di awal setiap sesi di repo `D:\CODING\MTC-Asset` (branch `main`,
remote `origin`, tree bersih). Bagian **Prompt** di bawah untuk disalin ke chat.

---

## Prompt (salin ke chat)

```
Lanjut kerja di D:\CODING\MTC-Asset (PWA maintenance). Baca docs/session-prompt.md
lalu SESSION_NOTES.md (entri terbaru ada di atas; S47a-S47f = audit mobile).
Kalau menyentuh UI: ukur, jangan asumsikan - emulasi 360x800, 375x667, 390x844,
412x915 plus landscape 844x390, target overflow 0 dan tap target minimal 44px.
Rilis lewat CI (push ke main), bukan firebase deploy manual. Setelah push,
verifikasi produksi pakai cache-buster: sw.js harus naik versi dan fragmen yang
berubah memuat kelas barunya. Gerbang wajib di turn yang sama: typecheck, lint,
test:run, test:coverage, build, verify:precache. Ratchet 96/88/96/97 jangan turun.
```

---

## 1. Konteks repo

- **Stack**: Firebase RTDB + Alpine.js fragment HTML + Vite + PWA (`sw.js` cache
  `mtc-asset-vN`, cache-first aset, network-first `/pages/*.html`, RTDB **tidak** di-cache).
- **Gerbang wajib** (jalankan di turn yang sama, lapor angka apa adanya):
  ```bash
  npm run typecheck && npm run lint && npm run test:run
  npm run test:coverage && npm run build && npm run verify:precache
  ```
  - Jangan turunkan threshold `vitest.config.js` (ratchet: **96/88/96/97** =
    statements/branches/functions/lines; naikkan bertahap, jangan turunkan).
  - `sw.js` naik versi **setiap** `src/**` atau `public/**` berubah.
- **Rilis lewat CI**: push ke `main` memicu `.github/workflows/deploy.yml` (build +
  deploy hosting). `npx firebase deploy` manual **tidak perlu** dan pernah balapan -
  build laptop (masih versi lama) ter-upload lalu ditimpa rilis CI. Folder `dist/`
  lokal bukan cerminan produksi; jangan pakai hash aset lokal sebagai bukti.
- **Verifikasi produksi** (±1-2 menit setelah push, selalu pakai cache-buster):
  ```bash
  curl -s 'https://mtc-asset.web.app/sw.js?cb=1' | grep -o 'mtc-asset-v[0-9]*'
  curl -s 'https://mtc-asset.web.app/pages/<Fragmen>.html?cb=1' | grep -c '<kelas-baru>'
  ```
  Untuk CSS: ambil nama berkas dari `index.html` produksi, lalu cek
  `content-type: text/css`. Kalau `text/html`, aset itu tidak ada di rilis dan
  request-nya kena rewrite SPA ke `index.html`.

## 2. Catatan sesi (baca dulu)

- `SESSION_NOTES.md` - entri terbaru di **atas**. S47a-S47c (audit mobile + P1/P2/P3),
  S47d (checkbox berlabel, spesifisitas), S47e (tap target tuntas), S47f (multi-preset 360).
- `AGENT_CONTEXT.md` - komponen proyek, backlog kartu, notes, batas deploy.
- `AGENTS.md` - aturan tata nilai repo (baca sebelum coding).

## 3. Anotasi repoToken (jangan ulang-lakukan)

- **State Alpine harus ada sejak boot**: key yang dipakai binding
  (`x-show="woSelectedIds.length"` dst.) wajib dideklarasikan di **literal**
  `app()`; membuat malas di dalam method -> `Alpine Expression Error` + halaman
  gagal muat. `app()` itu **fungsi**, bukan objek: `const s = app()`, bukan
  `Object.create(app)`.
- **Modul yang di-spread bukan prototype satu sama lain**: helper lintas modul
  dibuat stub di tes, jangan panggil `this.helperDariModulLain`.
- **Icon subset**: cek `src/css/icon-subset.txt` dulu. `delete` / `check_box`
  **tidak ada** di font; pakai `close`, `sync`, `check`, `check_circle`.
- **Prettier**: jangan `prettier --write` satu file utuh (merusak line ending +
  diff ribuan baris). Sisipkan dengan indent anchor, atau `git checkout` lalu ulangi.
  Sama untuk berkas besar seperti `SESSION_NOTES.md`: prepend lewat Python, lalu
  pastikan line ending tetap CRLF (`git diff --numstat` harus `+N -0`).
- **Output tool** kadang datang sebagai marker `<<ccr:hash>>`. Cara kerja: tulis hasil
  ke berkas JSON di workspace lalu agregasi di Python (cetak ringkas), atau
  `mcp__headroom__headroom_retrieve` dengan hash-nya. Jangan merancang alur kerja yang
  bergantung pada pembacaan besar.
- **Dev server**: `npm run dev` -> Vite di `http://localhost:3000`.
- **Dev server mode emulator Firebase**: `.env.emulator` (gitignored,
  `VITE_USE_EMULATORS=1`) + `./node_modules/.bin/vite --mode emulator --port 3002`,
  emulator Auth `:9099` / RTDB `:9000` (namespace `mtc-asset-default-rtdb`), akun QA
  role admin. Emulator dijalankan dari folder scratch dengan `--config firebase.json`.
- **Push hang**: pakai `git -c credential.helper= -c credential.helper=store push origin main`.
- **Jangan `unblock` kartu kanban**; kerjakan manual, lalu `hermes kanban complete <id> --force`.

## 4. Anotasi CSS & layout (pelajaran S47)

- **Spesifisitas**: selector elemen (`main button`, `header a`) **kalah** dari kelas
  utilitas Tailwind (`min-h-6`, `min-w-6`, `w-7`) - 0,1,0 mengalahkan 0,0,2. Aturan
  tap target wajib pakai penguat kelas: `main button[class]`, `header button[class]`,
  `nav button[class]`, `select[class]`.
- **`src/css/style.css` di-inline** ke `index.html` sebagai CSS kritis. Hanya sebagian
  utilitas Tailwind yang jadi `assets/main-*.css`. Jadi blok `@media (pointer: coarse)`
  dicari di `index.html` produksi, bukan di berkas CSS - dan minifier menulisnya tanpa
  spasi (`pointer:coarse`), sehingga grep `pointer: coarse` bisa memberi 0 palsu.
- **Overflow di layar sempit**: akar yang berulang adalah baris `flex` tanpa `min-w-0`
  (select dengan opsi panjang, input tanggal), dan kontainer `overflow-x-auto` yang tidak
  bisa menyusut di dalam flex/grid item. Grid item default `min-width: auto` - beri
  `min-w-0` pada anaknya, dan untuk grid ringkasan pakai
  `grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4`.
- **Audit mobile wajib multi-preset**: 360x800, 375x667, 390x844, 412x915, plus
  landscape 844x390. Dua defect (select Equipment 20px, grid PM Schedule 6px) hanya
  muncul di 360px dan tidak terlihat di 390px.
- **Kontrak**: `tests/mobile-overflow-contract.test.js` (19 tes) mengunci kelas wajib
  per fragmen, blok tap target `pointer: coarse`, checkbox berlabel, dan grid 380px.

## 5. Emulasi & MCP

- **`browser_exec`** - alat ukur utama: CDP penuh (`Emulation.setDeviceMetricsOverride`,
  `setTouchEmulationEnabled`, UA override, `Page.captureScreenshot` dengan `clip`), dan
  bisa menulis hasil ukur ke berkas JSON di workspace untuk diagregasi Python.
- **MCP `chrome-devtools`** - tool `emulate`: `viewport: "390x844x3,mobile,touch"`,
  `cpuThrottlingRate` sampai 20, `networkConditions` Slow 3G sampai Fast 4G, UA,
  colorScheme. Catatan: `take_screenshot` dengan `filePath` ditolak di luar workspace root.
- **MCP `playwright`** - terpasang 2026-10-28 (`--device "iPhone 14" --isolated`,
  25 tool). Kelebihannya: preset device dan browser **WebKit** (engine Safari iOS).
  Kalau browser-nya belum ada: `npx playwright install chromium webkit`.
- Emulasi bukan HP: safe-area notch, install prompt PWA, physics gesture, dan kinerja
  nyata tetap butuh perangkat fisik.

## 6. Selesai (definisi)

- Perubahan UI diverifikasi dengan **pengukuran, bukan cuma build hijau**: kontrak tes
  markup + state, pengukuran box-model fragmen di viewport pendek (harness + CSS hasil
  build), sapuan emulator multi-preset (overflow 0, tap target minimal 44px), lalu
  rantai gerbang repo.
- Kalau deploy: verifikasi produksi - `sw.js` menunjukkan `CACHE_NAME` baru dan markup
  barunya ada di fragmen yang berubah; beri tahu user untuk hard-reload sekali.
- Catatan sesi tulis ke `SESSION_NOTES.md` (per topik, gaya S47a-S47f), lalu commit.

## 7. Status terkini (per 2026-10-28)

- `sw.js` = **v101**; commit terakhir `907304c`.
- Audit mobile: 18 view x 5 preset -> **overflow 0**, **tap target di bawah 44px = 0**.
- P1 (overflow), P2 (tap target), P3 (chrome FAB/safe-area) selesai dan sudah dirilis
  lewat CI.
- Sisa yang memang butuh HP fisik: notch/safe-area visual, install prompt, gesture,
  kinerja di 4G atau CPU lambat.
