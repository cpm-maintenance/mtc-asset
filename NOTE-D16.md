# NOTE-D16 — Form input melebar di desktop (BELUM DIEKSEKUSI)

**Status:** investigasi selesai, 0 baris kode diubah. Rencana patch siap di bawah.
HEAD `f0ccdef` = `origin/main`, `sw.js` = `mtc-asset-v125`. Working tree bersih
kecuali `docs/SOP-Penggunaan-MTC-Asset.pdf|.pptx` (untracked, **jangan di-stage**).

## Akar masalah (2 baris, terverifikasi)

1. `.form-grid` **sudah benar** — container-driven: 1 kolom → `@container 400px`
   2 kolom → `@container 640px` 3 kolom; `container-type: inline-size` dipasang di
   induk lewat `:has(> .form-grid)` (`src/css/style.css` 335–377).
2. Yang sempit adalah **wadahnya**: panel modal dibatasi `max-w-*`. Modal log
   `max-w-4xl` (848 px) − `lg:p-10` (40 px ×2) = ~768 px → maksimal 3 kolom
   ~245 px. Di layar 1920 px tetap 848 px. Tidak pernah ada tier 4 kolom.

## Sumber sempit (semua terverifikasi)

| Berkas | Baris | Kelas | Isi |
|---|---|---|---|
| `public/pages/app-shell.html` | 1482 | `max-w-4xl` | modal log/WO (yang di screenshot) |
| `public/pages/app-shell.html` | 1328 | `max-w-4xl` | modal performance |
| `public/pages/app-shell.html` | 1109 | `max-w-2xl` | modal equipment |
| `public/pages/app-shell.html` | 1209 | `max-w-lg` | modal spare part |
| `public/pages/RequestPart.html` | 388 | `max-w-4xl` | modal request multi-item |
| `public/pages/PMSchedule.html` | 584 | `max-w-lg` | modal PM |
| `public/pages/PlanningBoard.html` | 348 | `max-w-lg` | modal detail WO |

Jangan sentuh modal kecil: notif (40), confirm create/edit user (110/142/271),
delete (328), error (355), AI settings (945), more-menu (1062), scanner (1761),
QR preview (1853), crop (1949).

## Bug kedua terlihat di screenshot (footer overlap)

`app-shell.html` 1482 & 1328 punya **batas tinggi + `overflow-y-auto` dua kali**:
panel `max-h-[calc(100dvh-2rem)] ... overflow-y-auto` **dan** badan form
`flex-1 min-h-0 overflow-y-auto`. Kontrak `tests/modal-scroll-contract.test.js`
menuntut scroll hanya di badan form. Dua scrollport → footer `sticky bottom-0`
menempel ke scrollport form, panel ikut scroll → tombol CANCEL / INITIALIZE
tumpang tindih teks "2 FIELD BELUM VALID". Perbaikan: hapus `max-h-[90vh]` +
`overflow-y-auto` dari panel (pertahankan `max-h-[calc(100dvh-2rem)] flex flex-col`).

## Rencana patch (TDD: RED dulu)

1. `src/css/style.css` ~356: tambah tier desktop
   `@container (min-width: 900px) { .form-grid { grid-template-columns: repeat(4, minmax(0,1fr)); } }`
   + fallback `@media (min-width: 1280px)` di blok `@supports not selector(:has(*))`.
   Jangan ubah rule `1fr` / `minmax(0,1fr)` yang sudah dikunci tes.
2. Panel modal: `max-w-4xl` → `max-w-4xl lg:max-w-6xl` (1482, 1328, RequestPart 388);
   `max-w-2xl` → `max-w-2xl lg:max-w-4xl` (1109);
   `max-w-lg` → `max-w-lg lg:max-w-3xl` (1209, PMSchedule 584, PlanningBoard 348).
3. Hapus `max-h-[90vh] overflow-y-auto` dari panel 1482 dan 1328.
4. `sw.js` `mtc-asset-v125` → `v126` (`src/**` + `public/**` berubah).

## Tes yang mengunci (jangan sampai merah)

- `form-controls.test.js:138` — `.form-grid { ... minmax(0, 1fr) }`.
- `form-controls.test.js:139–140` — `@container (min-width: 400px)` + `640px` ada.
- `form-controls.test.js:147–148` — `:has(> .form-grid) { container-type: inline-size`; `.form-grid` **tidak** boleh punya `container-type`.
- `form-controls.test.js:188` — ≥14 `class="form-grid"` di `MARKUP`.
- `mobile-form-layout.test.js:34–35` — `.form-grid { minmax(0,1fr) }` + `.form-grid > * { min-width: 0 }`.
- `log-form-layout.test.js:78–79` — tepat **4** `class="form-grid form-grid--two..."` di modal log.
- `modal-scroll-contract.test.js:71–72,77–78,85–86,91` — panel `max-h-[calc(100dvh-2rem)]` + `flex flex-col`; form `overflow-y-auto` + `min-h-0`; footer `sticky bottom-0` di >80 % panjang form; header `shrink-0`.
- `app-shell-split.test.js` — `indexKb<60`, `shellKb>80`, `indexKb < shellKb/2`.
- `requestpart-title-wrap.test.js:29` — `cls` tidak boleh `max-w-[200px]`.
- **Tidak ada** tes yang mengunci `max-w-lg|2xl|4xl` di panel modal → bebas diubah.

## Gerbang verifikasi (wajib, turn yang sama, `cd /d D:\CODING\MTC-Asset`)

```
npx tsc --noEmit
npx eslint .
npx vitest run --coverage
npx vite build
node scripts\verify-precache.mjs
```
Baseline D15: **117 berkas / 2314 passed**, coverage **97.48 / 90.22 / 97.7 / 98.53**,
precache **60/60**. Jangan turunkan ratchet `vitest.config.js` (96/89/96/97).
Plus 4 TZ: Asia/Jakarta, UTC, Pacific/Kiritimati, America/Los_Angeles.

## Aturan keras

- `!important` global / `!w-full` blanket **dilarang**. Jangan hapus 13 blob skeleton lama.
- Jangan sentuh `package.json`, `src/js/app.js`, `src/main.js`, `globals.d.ts`.
- Commit via CI saja. Jangan stage `docs/SOP-*`.
- Lihat `NOTE-D15.md` (skeleton), `NOTE-D14.md` (import CSV), `NOTE-D13.md` (cache SpareParts).
