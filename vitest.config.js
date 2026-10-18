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
            // Nilai di bawah ini sengaja sedikit di bawah hasil nyata supaya
            // refactor wajar tidak langsung memerahkan gate.
            thresholds: {
                statements: 69,
                branches: 59,
                functions: 66,
                lines: 70,
            },
        },
    },
});