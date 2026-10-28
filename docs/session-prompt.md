# SESSION START — Prompt MTC-Asset (PWA Maintenance)

Gunakan prompt ini di awal setiap sesi di repo `D:\CODING\MTC-Asset` (branch `main`,
remote `origin`, tree bersih). Baca bagian **# Prompt** untuk menyalin ke chat.

---

## 1. Konteks repoToken
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
- **Deploy**: `build` → `git add` → `git commit` → `git -c credential.helper= -c credential.helper=store push origin main`
  → `npx firebase deploy --only hosting` (≈ 1–2 menit propagasi CDN).
- **Verifikasi produksi** (setelah deploy): `curl -s https://mtc-asset.web.app/sw.js | grep -o mtc-asset-v[0-9]*`
  dan cek markup baru di fragmen yang berubah.

## 2. Catatan sesi (baca dulu)
- `SESSION_NOTES.md` — riwayat sesi + "3 topik terakhir" + pelajaran.
- `AGENT_CONTEXT.md` — komponen proyek, backlog kartu, notes, batas deploy.
- `AGENTS.md` — aturan tata nilai repo (baca sebelum coding).

## 3. Anotasi repoToken (jangan ulang-lakukan)
- **State Alpine harus ada sejak boot**: key yang dipakai binding
  (`x-show="woSelectedIds.length"` dst.) wajib dideklarasikan di **literal**
  `app()`; membuat malas di dalam method → `Alpine Expression Error` + halaman
  gagal muat. `app()` itu **fungsi**, bukan objek: `const s = app()`, bukan
  `Object.create(app)`.
- **Modul yang di-spread bukan prototype satu sama lain**: helper lintas modul
  dibuat stub di tes, jangan panggil `this.helperDariModulLain`.
- **Icon subset**: cek `src/css/icon-subset.txt` dulu. `delete` / `check_box`
  **tidak ada** di font; pakai `close`, `sync`, `check`, `check_circle`.
- **Prettier**: jangan `prettier --write` satu file utuh (merusak line ending +
  diff ribuan baris). Sisipkan dengan indent anchor, atau `git checkout` lalu ulangi.
- **Output tool** kadang datang sebagai marker `<<ccr:hash>>` → baca dalam digest
  (python yang cetak nomor baris/verdict kecil, atau lewat kanal browser
  `fetch('/src/js/...')` dari halaman dev server).
- **Dev server**: `npm run dev` → Vite di `http://localhost:3000`.
- **Push hang**: pakai `git -c credential.helper= -c credential.helper=store push origin main`.
- **Jangan `unblock` kartu kanban**; kerjakan manual, lalu `hermes kanban complete --force <id>`.

## 4. Selesai (definisi)
- Perubahan UI diverifikasi dengan **pengukuran, bukan cuma build hijau**:
  kontrak tes markup + state, pengukuran box-model fragmen di viewport pendek
  (harness + CSS hasil build), rantai gerbang repo.
- Kalau deploy: cek produksi — `sw.js` menunjukkan `CACHE_NAME` baru dan markup barunya
  ada di fragmen yang berubah.
- Catatan sesi tulis ke `SESSION_NOTES.md` (per topik, gaya S45o/S46a), lalu commit.
