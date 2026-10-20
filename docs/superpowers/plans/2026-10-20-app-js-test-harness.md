# Harness Alpine + Tes `app.js` ≥70% Lines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Naikkan coverage `src/js/app.js` dari 20,9% → **≥70% lines** (1277 statement, ~1010 baris merah) tanpa menyentuh `src/**`.

**Architecture:** `app()` dipanggil langsung di jsdom (bukan Alpine). Firebase disuntik sebagai stub di `window` (`ref/get/set/update/remove/auth`) — pola "mock LIBRARY, bukan modul" yang sudah dipakai tes modul lain. Setiap berkas tes memakai `makeApp()` dari `tests/helpers/app-harness.js` lalu memanggil method app.js satu per satu.

**Tech Stack:** vitest 4, jsdom, v8 coverage.

**Spec:** `HANDOFF-S32.md` §3(a) — kartu `t_30aa9581`.

## Global Constraints

- Jangan ubah `src/js/app.js` atau `src/**` apa pun — hanya `tests/**` yang bertambah.
- Jangan turunkan `thresholds` di `vitest.config.js` (76/64/73/78).
- Setiap berkas tes: `// @vitest-environment jsdom` di baris pertama.
- Tanpa `skip`/`todo`; setiap tes harus lulus sungguhan.
- Angka dilaporkan dari tool, bukan perkiraan.

## Review Focus

- Getter state (`historyFilteredLogs`, `historyTotalPages`, …) dihitung ulang setiap akses — tes harus membaca ulang setelah mengubah `this.*`, bukan menyimpan hasil lama.
- `_partMap()` menyimpan cache yang di-invalidate lewat identitas `this.allParts`; tes harus memakai array baru untuk membuktikan invalidasi.
- Method yang menyentuh `window.db` tanpa guard akan melempar di jsdom — stub wajib ada sebelum panggilan.
- `historyGetParts` menerima 3 bentuk (`array`, string JSON, objek Firebase) + jalur `window.Alpine.raw`; keempat jalur harus diuji.
- Method notifikasi (`showNotification`) dipanggil dengan (pesan, tipe) — tes memverifikasi keduanya, bukan hanya jumlah panggilan.

---

### Task 1: Harness bersama

**Files:** Create `tests/helpers/app-harness.js`

- [x] `makeApp(overrides)` → `app()` + default `showNotification`, `queueOfflineOperation`, `saveToIndexedDB`, `user`, `isOnline`, `isLoading`, semua lewat `defineProperty` (accessor modul tidak punya setter).
- [x] `stubFirebase()` → `window.ref/get/set/update/remove/db/auth`.

### Task 2: Kelompok method per berkas tes

Setiap task: buat berkas tes, jalankan `npx vitest run <berkas>`, semua lulus, commit.

| Task | Baris `app.js` | Berkas tes | Isi |
|---|---|---|---|
| 2a | 127–435 | `tests/app-history-audit.test.js` | history* (filter/sort/paging/part map/export), audit* helper |
| 2b | 435–790 | `tests/app-workorders.test.js` | `wo*` (age, bucket, color, sector, parts, photos, status/priority tac, elapsed, score) |
| 2c | 790–1060 | `tests/app-health-equipment.test.js` | criticality/health/backlog/mttr per tech, pmEffectiveness, `equipStatusTac`, paging equipment |
| 2d | 1060–1300 | `tests/app-badges-nav.test.js` | badge*, canAccess, dashboard filter/preset, `isLowStock`, `confirmDelete`, `cleanUrl`, `safeParseLogParts` |
| 2e | 1300–1620 | `tests/app-logs-planning.test.js` | `logStatusTac`/`logMarkerTac`/`logIconTac`, `planning*` (drag/drop/status/gantt) |
| 2f | 1620–1960 | `tests/app-planning-mp.test.js` | `mp*`, `calcMTBFMTTR`, `mtbfRefresh`, `getPartLifetimeInfo`, `getLifetime*Label`, `getPartStock` |
| 2g | 1960–2603 | `tests/app-crop-photo.test.js` | `showCropModal`/`applyCrop`/`handleLogPhotoDrop` + method sisa di rentang itu |

### Task 3: Verifikasi

- [ ] `npm run typecheck && npm run lint && npm run test:run`
- [ ] `npm run test:coverage` — catat angka `app.js` (target ≥70% lines) dan total.
- [ ] Naikkan `thresholds` bila total naik (ratchet, jangan turunkan).
- [ ] `npm run build && npm run verify:precache` — `src/**` tidak berubah, jadi `sw.js` **tidak** di-bump.
- [ ] `git show --name-only HEAD` membuktikan hanya `tests/**` + `vitest.config.js` yang berubah.
- [ ] Prepend `SESSION_NOTES.md`, update `AGENT_CONTEXT.md`, commit, push, `kanban complete t_30aa9581 --force`.
