# NOTE-D14 — Import CSV spare part hanya masuk 1 baris

**Status:** `importCSV(..., 'parts')` memakai `row.EquipmentID` sebagai key. Di
`Template_SpareParts.csv` **semua 24 baris punya `EquipmentIDs`/`EquipmentID` sama**
(`5060-PU-12, 5060-PU-13, ...`) → 24× `set(SpareParts/<id sama>)`, baris terakhir menang.
Patch 1 titik di `src/js/modules/export.js`. `sw.js` = `mtc-asset-v124`.

## Akar masalah (1 baris)

[export.js:698](file:///d:/CODING/MTC-Asset/src/js/modules/export.js#L698) urutan id:
`row.EquipmentID || row.PartID || ...` — untuk parts kolom `EquipmentID` selalu terisi
dan berulang, jadi `PartID` tak pernah dipakai sebagai key.

## Yang diubah (`export.js`, 1 titik)

```js
// parts: key harus PartID. EquipmentID identik di banyak baris -> menimpa.
// Fallback parts ikut indeks baris supaya dua baris tanpa PartID tidak menimpa.
const id = type === 'parts'
    ? (row.PartID || row.PartNumber || row.id || row.ID || `${type.toUpperCase()}-${Date.now()}-${i}`)
    : (row.EquipmentID || row.PartID || row.LogID || row.pmId || row.PMID || row.id || row.ID || (type.toUpperCase() + "-" + Date.now()));
```

Tipe lain **tidak** diubah (kontrak fallback `EQUIP-<ts>` dipertahankan; tes lama menegaskannya).

## Bukti (verbatim)

| Jalankan | Hasil |
|---|---|
| Probe CSV asli (sebelum patch) | `rows parsed = 24`, `unique PartID = 24`, `unique id-if-EquipmentID-first = 1` |
| RED 2 tes baru | `AssertionError: expected 'SpareParts/5060-PU-12, 5060-PU-13' to be 'SpareParts/14001430'` |
| GREEN | `Tests 76 passed (76)` |
| Probe key setelah patch | `rows = 24`, `unique keys = 24`, `dupes = []` |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 (0/0) |

## Tes baru (`tests/export-module.test.js`)

1. `menyimpan tiap baris parts ke PartID-nya walau EquipmentID sama` — 2 baris, `EquipmentID` identik → path `SpareParts/14001430`, `SpareParts/14001439`.
2. `memberi id unik per baris parts saat tidak ada PartID` — fallback ikut indeks `i`.

## Jebakan

1. Jangan ubah fallback non-parts: `tests/export-module.test.js` menegaskan
   `/^Equipment\/EQUIP-\d+$/`. Menambah `-${i}` di semua tipe = 1 tes gagal.
2. Parser CSV bukan penyebabnya. `XLSX.read(type:'binary')` sudah benar menangani
   koma dalam kutip, `"` escape, CRLF, dan field kosong. Jangan tulis parser sendiri.
3. `PartNumber` **bukan** key aman (`3010500120` muncul 3×); pakai `PartID` dulu.
4. Patch file CRLF: `edit_file` gagal (match 0). Pakai skrip Node split `/r?\n/` + join EOL asli.
5. Cek path hasil `rg` di PowerShell: pola berisi `|` harus `rg -e a -e b`.

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
- Jangan refactor/split `src/js/app.js`. Jangan sentuh `globals.d.ts`.
- Jangan sentuh `package.json` tanpa izin user.
- Lihat `NOTE-D13.md` (cache SpareParts) — dua perbaikan ini independen.
