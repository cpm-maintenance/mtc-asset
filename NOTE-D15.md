# NOTE-D15 — Skeleton di semua menu

**Status:** `x-page` (directive di `src/main.js`) menyuntik fragmen halaman hanya
setelah `await componentLoader.loadPage()` selesai. Selama fetch, 5 menu
(`wo`, `pms`, `planning`, `monthlyplan`, `workload`) tampil kotak kosong.
13 menu lain aman karena punya wrapper skeleton di `app-shell.html`.
Patch 1 titik di `src/main.js`. `sw.js` = `mtc-asset-v125`.

## Akar masalah (1 baris)

`Alpine.directive('page', ...)` tidak punya state awal: `el.innerHTML` dibiarkan
kosong sampai `fetch` fragmen selesai, jadi tidak ada placeholder untuk 5 menu
yang fragmen-nya belum diunduh.

## Yang diubah (`src/main.js`, 1 titik)

`PAGE_SKELETON` (array `.join('')`, ~11 baris markup) + 1 baris paint:

```js
if (pageName) {
  // Cache miss -> paint skeleton dulu; tanpa ini menu tampil kosong.
  if (!componentLoader.cache.has(pageName)) el.innerHTML = PAGE_SKELETON;
  try { const html = await componentLoader.loadPage(pageName); ...
```

Sengaja **tidak** diubah: `app-shell.html` (13 blob skeleton lama tetap; tidak
dihapus agar diff kecil dan kontrak `app-shell-split.test.js` utuh),
`component-loader.js`, `style.css` (kelas `.skeleton*` sudah ada), `package.json`.

## Bukti (verbatim)

| Jalankan | Hasil |
|---|---|
| `git show HEAD:src/main.js \| findstr PAGE_SKELETON` | output kosong (RED) |
| `npx vitest run tests/skeleton-all-menus.test.js` | **4 passed (4)** |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src/main.js` | exit 0 |

## Tes baru (`tests/skeleton-all-menus.test.js`)

1. Setiap `x-page` di shell punya `public/pages/<name>.html` (18 halaman).
2. Directive paint `PAGE_SKELETON` pada cache miss, **sebelum** `await loadPage`.
3. Kelas `.skeleton*` yang dipakai ada di `style.css`.
4. Skeleton membawa `role="status"` + `aria-label`.

## Jebakan

1. Paint harus **sebelum** `await loadPage`; kalau sesudah, skeleton tak pernah terlihat.
2. `componentLoader.cache` publik (Map) — pakai `.has(pageName)` untuk deteksi cache miss.
3. Jangan hapus 13 blob skeleton lama di `app-shell.html` pada patch yang sama:
   `critical-css.test.js` + `app-shell-split.test.js` membaca fragmen itu.
4. Fragmen `WorkOrders/PMSchedule/PlanningBoard/MonthlyPlan/TechnicianWorkload`
   sudah punya skeleton internal; yang kurang cuma gap selama fetch.
5. Patch file CRLF: pakai skrip Node split `/r?\n/` + join EOL asli.

## Perintah

```
cmd /c "cd /d D:\CODING\MTC-Asset && npx tsc --noEmit"
cmd /c "cd /d D:\CODING\MTC-Asset && npx eslint ."
cmd /c "cd /d D:\CODING\MTC-Asset && npx vitest run --coverage"
cmd /c "cd /d D:\CODING\MTC-Asset && npx vite build"
cmd /c "cd /d D:\CODING\MTC-Asset && node scripts\verify-precache.mjs"
```

## Aturan keras

- Ratchet `vitest.config.js` 96/89/96/97 — jangan diturunkan.
- Jangan `npm audit fix --force`, jangan upgrade `xlsx`.
- Jangan refactor/split `src/js/app.js`, `src/main.js`. Jangan sentuh `globals.d.ts`.
- Jangan sentuh `package.json` tanpa izin user.
- Lihat `NOTE-D14.md` (import CSV parts), `NOTE-D13.md` (cache SpareParts).
