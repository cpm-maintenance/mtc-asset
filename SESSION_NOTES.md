# SESSION NOTES — 2026-07-11

## Task Progress

| Task | Status | Detail |
|------|--------|--------|
| P2 — OEE Hero Card | ✅ Done | Big digital clock OEE card, A×P×Q breakdown, color-coded status, radial glow |
| P3 — Color Diff (Cyan → Amber) | ✅ Done | `--nexus-accent` #00f2ff → #f59e0b. Bulk `text-cyan-400` → `text-amber-400` across all pages |
| P4 — Layout Asymmetry | ✅ Done | OEE hero 1:3, health 1col + WO 2cols, PM 2cols + downtrend 1col, AI breakout amber gradient |
| P5 — Micro-interactions | ✅ Done | Custom chart tooltips, expandable equipment rows, chart colors amber |
| **Bug: expandedEquip is not defined** | ✅ Fixed | Root cause: Alpine scope chain broken by `x-page` + `innerHTML`. Fix: DOM `classList.toggle()` instead of Alpine `x-show` |
| **Bug: Table columns cramped** | ✅ Fixed | Nested `<tbody>` inside `<template x-for>` invalid HTML. Removed inner `<tbody>`. |
| **Bug: Missing `</tr>`** | ✅ Fixed | Expandable detail row had no closing `</tr>` |
| **Bug: Alpine x-for warning (EnterpriseDashboard)** | ✅ Fixed | `x-for` on `<template>` with 2 sibling `<tr>`. Fix: `<template x-for>` > `<tbody>` (single root) wrapping both `<tr>` rows |
| **Bug: Alpine x-for TypeError (tbody)** | ✅ Fixed | Reverted `x-for` to `<template>` after putting it on `<tbody>` broke Alpine 3. Wrap in `<tbody>` inside `<template>`. |
| **Bug: Performance PERMISSION_DENIED** | ✅ Fixed | DB rule write restricted to admin/supervisor → relaxed to all auth users. Validate rule mismatched field names (`EquipmentID` vs `equipmentId`). Deployed. |

# SESSION NOTES — 2026-07-12

## Task Progress

| Task | Status | Detail |
|------|--------|--------|
| **Bug: Parts hilang di Edit WO** | ✅ Fixed | 3-layer root cause: (1) `sanitizeInput()` corrupts JSON string (`"` → `&quot;`), (2) corrupted data di Firebase, (3) Alpine `x-model` timing bug dgn nested `x-for` |
| **Bug: Equipment dropdown reset di Edit WO** | ✅ Fixed | Same `x-model` + nested `x-for` timing issue. Fix: `x-model` → `:value` + `@change` for equipment & parts selects |
| **HistoryCard — Parts breakdown per baris** | ✅ Done | `historyPartRows` getter flattens log+parts jadi 1 baris per part. Log tanpa parts tetap 1 baris dgn `-` |

### Files Modified
| File | Changes |
|------|---------|
| [logs.js](src/js/modules/logs.js) | Restore `PartsUsed`/`PhotoURLs` after `sanitizeDataForFirebase`; Alpine.raw unwraps; diagnostic console.log |
| [data.js](src/js/modules/data.js) | Unescape HTML entities (`&quot;` → `"`, `&#x2F;` → `/`) in `safeParseJSONField` |
| [LogModal.html](public/components/modals/LogModal.html) | `x-model` → `:value` + `@change` for equipment & parts `<select>` |
| [HistoryCard.html](public/pages/HistoryCard.html) | Iterate `historyPartRows` (per-part rows) instead of `historyCurrentPageLogs` |
| [app.js](src/js/app.js) | Added `historyPartRows` computed getter |

### Bug Diagnosis Flow (for next session)
- **Parts hilang**: Firebase data periksa dulu — `PartsUsed` string mengandung `&quot;` atau `[]`?
- **Dropdown reset**: Pastikan value match option value — kalau pakai `x-model` + nested `x-for`, ganti ke `:value` + `@change`

## Deploy
- **Live:** https://mtc-asset.web.app
- **Test:** `npm run test:run` — 96/96 pass
- **Build:** `npm run build` — 0 errors

## Next Session
- Parts sudah muncul di HistoryCard & Edit WO
- Lanjut fitur berikutnya atau bug lain
