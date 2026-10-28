import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        exclude: ['node_modules/**', 'dist/**', '.open/**', 'backup/**', 'tests/rules/**'],
        setupFiles: ['tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/js/**/*.js'],
            exclude: ['src/js/**/*.min.js', 'src/js/firebase-config.js'],
            // Ratchet baseline (diukur 2026-10): jaga agar tidak turun. Naikkan
            // bertahap seiring bertambahnya test (target jangka panjang >=60%).
            // Q-1 (S17): 18.49/17.73/21.51/19.10 → 28.32/26.75/29.95/29.51 setelah
            // unit test ai.js, requisition.js, export.js, notification.js.
            // S24 (kartu A): 28.40/26.87/30.14/29.62 → 34.95/29.65/32.38/37.47
            // setelah unit test auth.js (0.81 → 100% lines), audit.js (0 → 97%),
            // wo-pdf-template.js (0 → 100% lines). Suite 463 → 539.
            // S25 (lanjutan kartu A): → 45.51/41.03/44.17/47.84 setelah unit test
            // enterprise-kpi.js (4.08 → 100% lines), logs.js (9.09 → 68.62%),
            // performance.js (10.19 → 98.08%). Suite 539 → 683.
            // S26 (lanjutan kartu A): → 54.11/47.38/52.73/56.73 setelah unit test
            // indexeddb.js (9.49 → 88.6%), data.js (48.68 → 93.79%),
            // pm-schedule.js (7.9 → 62.61% — helper tanggal/kalender/Gantt).
            // Lalu pm-schedule.js lengkap (submitPM/bulkCompletePM/deletePM) → 99.69%,
            // lalu bootstrap.js (1.06 → 100%), total 57.97/50.08/57.13/60.6. Suite 683 → 848.
            // S27 (kartu C-1): charts.js 8.5 → 97.36% lines (unit test dengan
            // `vi.mock('chart.js')` — seluruh perhitungan MTBF/MTTR/availability/
            // reliability/Pareto/cost benar-benar dieksekusi), total
            // 64.8/56.14/65.38/66.3. Suite 848 → 896.
            // S28 (kartu C-2): badan `submitLog` (logs.js 305–517) ditutup —
            // unggah foto, sanitasi, retry/backoff, jalur offline vs RTDB,
            // pemotongan stok, audit, refresh 500 ms. logs.js 68.62 → 97.65%
            // lines, total 66.47/58.03/66.22/68.08. Suite 896 → 938.
            // S29 (kartu A lanjutan): unit test `kpi-engine.js` (43.92 → 100%
            // lines, 33.12 → 96.87% branch) — health score, cache `_kpiCache`,
            // interval HM vs kalender, gabungan HistoryLog+Performance, semua
            // cabang `predictNextFailure`. Total 67.67/59.63/66.84/69.16.
            // Suite 938 → 987.
            // S29 lanjutan: `export.js` 45.5 → 100% lines lewat tiga jalur yang
            // belum tersentuh — `exportExcelFull` (7 sheet + Summary),
            // `exportPMSchedulePDF` (sort overdue, page break, warna status),
            // `exportToPDF` (tabel log/PM/parts, placeholder, error path).
            // Total 71.2/61.59/68.92/72.66. Suite 987 → 999.
            // Threshold 65/57/65/67 → 69/59/66/70 (margin ~2 poin).
            // S30: unit test sisa `ui.js` — tema (setTheme/applyTheme), notifikasi +
            // timer (progress/exiting/auto-remove), scanner kamera (openQR/stopScanner),
            // helper warna (status/crit/log/logStatus/woPriority/getStat), kompresi
            // gambar (landscape/portrait/error), upload Cloudinary (ok/HTTP gagal/
            // network), uploadImage, blobToBase64, systemReset (SW + Cache Storage).
            // ui.js 32.98 → 98.96% lines. Total 73.39/62.65/71.47/74.96. Suite 999 → 1050.
            // Threshold 69/59/66/70 → 71/60/69/72 (margin ~2 poin).
            // S30 lanjutan: sisa jalur `ai.js` — catch luar `analyzeKPI`, rotate key
            // di `generateRecommendations` (rate limit / tanpa rotateApiKey / hasil
            // bukan array / rotate melempar), `callAI` key eksplisit tanpa window.app,
            // error HTTP Claude, body OpenRouter bukan JSON, `generatePPT` (tanpa
            // hasil / delegasi / fallback / error), `generateSimpleReport` (window.open
            // + auto-print), `loadAIFromFirebase` + `saveAIToFirebase` +
            // `saveAIWithCustomModel`, setter `aiApiKey`.
            // ai.js 76.31 → 100% lines (branch 87.42). Total 74.68/63.59/72.01/76.42.
            // Suite 1050 → 1077. Threshold 71/60/69/72 → 72/61/70/74 (margin ~2 poin).
            // S30 paket murah (5 modul, 4 berkas tes baru): equipment.js
            // 46.57 → 100% lines, parts.js 54.83 → 100%, notification.js 77.02
            // → 100% (jalur FCM: register/save/remove/foreground), push-client.js
            // 25 → 100%, requisition.js 67.16 → 89.55 (setupRequisitionsListener).
            // Total 74.85/63.74/72.11/76.60 → 77.21/65.49/74.11/79.26.
            // Suite 1092 → 1175. Threshold 72/61/70/74 → 76/64/73/78.
            // Nilai di bawah ini sengaja sedikit di bawah hasil nyata supaya
            // refactor wajar tidak langsung memerahkan gate.
            // S32 (kartu `t_30aa9581`): harness Alpine untuk `app.js` — 10 berkas
            // tes baru (history/audit, work order, health+badge, dashboard+data,
            // log tactical, planning, MTBF/MP, lifetime+photo, telemetri parts)
            // memanggil `app()` langsung di jsdom dengan stub Firebase di `window`.
            // app.js 20,9 → 74,54% lines. Total 90,05/79,19/87,86/91,45.
            // Suite 1195 → 1527. Threshold 76/64/73/78 → 88/77/85/89.
            // S33: sisa baris merah `app.js` (325 baris / 61 klaster) ditutup —
            // 6 berkas tes baru (auth+menu+install, WO ledger views, dashboard+
            // equipment, migrateLegacyImages, All Logs/parts/planning/workload,
            // mpExportPDF dengan mock jspdf+autotable). 116 tes baru.
            // app.js 74,54 → 97,57% lines (branch 66,41 → 85,51).
            // Total 90,05/79,19/87,86/91,45 → 95,57/84,67/96,00/96,69.
            // Suite 1527 → 1643 (60 berkas). Threshold 88/77/85/89 → 95/84/95/96.
            // Ratchet S33af: 95/84/95/96 -> 96/86/96/97 setelah tiga berkas tes
            // baru (error-handler 0 -> 100 %, fallback enterprise-kpi & requisition).
            // Terukur 96,43 / 86,11 / 96,55 / 97,75 — jangan turunkan.
            thresholds: {
                statements: 96,
                branches: 89, // S48: terukur 89,89%; probe 90,5% wajib gagal.
                functions: 96,
                lines: 97,
            },
        },
    },
});