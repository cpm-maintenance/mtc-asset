# TASK LIST — MTC-Asset — Session 5 (2026-08-07)

> **Baseline**: Session 4 selesai — R1-R7 complete + QA + 4 bug fix. Deploy live `mtc-asset.web.app`.
> **Fokus hari ini**: tema gold + 4 tema (navy/purple), form font themed, fix bottom nav mobile, deploy.

---

## 🎨 Multi-Theme (4 tema) ✅

- [x] Gold dark theme — accent `#00f2ff` (cyan) → `#f5c542` (gold), border/glow/gradient ikut
- [x] Dropdown theme menu di header — Gold, Navy, Purple, Light (swatch warna)
- [x] CSS vars per tema (accent, glow, border, text, bg, card)
- [x] Charts ikut tema — `themeAccent()`/`themeAccentSoft()`/`themeGrid()`
- [x] Light theme tetap biru (tidak berubah)

## 🔤 Form Font Themed ✅

- [x] Input/select/textarea text → `var(--text-main)` (override hardcoded `text-white`/`text-slate-400`)
- [x] Placeholder → `var(--text-muted)`
- [x] `select option` themed + `color-scheme` dark/light

## 📱 Mobile Bottom Nav Fix ✅

- [x] 15 item → 5 slot grid (Home, WO, Assets, Parts + More button)
- [x] More modal (bottom sheet, grid 4 kolom, 15 item, auto-close on navigate)
- [x] `mobilePrimaryItems` getter + `short` label field
- [x] Safe-area-inset (notch iPhone)

## 🧹 Housekeeping ✅

- [x] Hapus scratch/ (32 file)
- [x] Commit file untracked lama (5 pages HTML + db.js, icons.js, lucide-icons.js, audit.js) — diverifikasi dipakai

---

## Deploy Status

| Item | Status |
|------|--------|
| Session 1-4 (R1-R7 + V1-V4 + QA) | ✅ live `mtc-asset.web.app` |
| Session 5 (4 tema + form font + nav fix) | ✅ live (72 files) — commit 63b6d86 |

## Known Issues

- `.open/skills` submodule dirty — skip saat commit
- CRLF quirk: edit tools gagal di CRLF files → pakai node `.mjs` + regex `\r?\n`
- Data Firebase dev minim → beberapa page empty state (bukan bug)

## Next Session

- [ ] Isi data nyata: assign teknisi ke WO (Workload), input PM schedule (Monthly Plan)
- [ ] Optional: audit trail capture (AuditTrail Firebase masih kosong)
- [ ] Cek deploy workflow .github (line-ending)
- [ ] Opsional R8: ide feedback planner/analyst
