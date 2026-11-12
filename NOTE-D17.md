# NOTE-D17 — higiene repo: gitlink `.open/skills`

Status: **selesai**, terverifikasi lokal. Belum di-commit/push (menunggu item 2 selesai).

## Masalah

`.open/skills` ter-track sebagai **gitlink** (`mode 160000`, commit `abd5f75`) sejak
initial commit `245a381`, **tanpa entri `.gitmodules`**. Repo git bersarang, bukan
submodule. Akibatnya setiap job CI mencetak:

```
fatal: No url found for submodule path '.open/skills' in .gitmodules
##[warning]The process '/usr/bin/git' failed with exit code 128
```

Sesi S33ad (sw v44) hanya menambal lokal dengan `git update-index --skip-worktree`
(flag `S`) → `git status` bersih tapi CI tetap kena. Itu sebabnya temuan ini bertahan.

## Perbaikan

```
# .gitignore (+5 baris)
.open/

git update-index --no-skip-worktree .open/skills
git rm --cached --sparse .open/skills
```

- `--sparse` wajib: index punya `skip-worktree`, `git rm --cached` biasa menolak
  dengan `paths and/or pathspecs matched paths that exist outside of your
  sparse-checkout definition` (meski `git sparse-checkout list` bilang
  "this worktree is not sparse").
- `--no-skip-worktree` dulu supaya entri bisa dihapus dari index.
- Folder `.open/skills` **tetap utuh di disk** — hanya berhenti di-track.
- Tidak ada kode/build/CI yang membaca `.open/skills`. Referensi hanya di
  `diary/**`, `HANDOFF-*.md`, `AGENT_CONTEXT.md`, `SESSION_NOTES.md`,
  `TASK-REA-FIX.md` — semuanya gitignored.

## Tes

`tests/repo-hygiene.test.js` (3 tes): `.gitignore` memuat `^\.open/$`;
`git ls-files .open` kosong; tidak ada entri mode `160000` selama `.gitmodules`
tidak ada. RED 3/3 → GREEN 3/3.

## Gerbang

```
npx tsc --noEmit                     exit 0
npx eslint .                         exit 0
npx vitest run --coverage            121 files / 2344 passed
coverage                             97.48 / 90.24 / 97.7 / 98.53
npx vite build                       ✓ built in 9.12s
node scripts\verify-precache.mjs     OK — 60 berkas
```

Catatan: `sw.js` **tidak** naik versi — perubahan hanya `.gitignore` +
`tests/**`, tidak menyentuh `src/**` atau `public/**`.