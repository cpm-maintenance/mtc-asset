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
            // Nilai di bawah ini sengaja sedikit di bawah hasil nyata supaya
            // refactor wajar tidak langsung memerahkan gate.
            thresholds: {
                statements: 27,
                branches: 25,
                functions: 28,
                lines: 28,
            },
        },
    },
});