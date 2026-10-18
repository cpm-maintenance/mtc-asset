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
            // Nilai di bawah ini sengaja sedikit di bawah hasil nyata supaya
            // refactor wajar tidak langsung memerahkan gate.
            thresholds: {
                statements: 45,
                branches: 40,
                functions: 43,
                lines: 47,
            },
        },
    },
});