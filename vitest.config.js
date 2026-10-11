import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        exclude: ['node_modules/**', 'dist/**', '.open/**', 'backup/**', 'tests/rules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/js/**/*.js'],
            exclude: ['src/js/**/*.min.js', 'src/js/firebase-config.js'],
            // Ratchet baseline (diukur 2026-10): jaga agar tidak turun. Naikkan
            // bertahap seiring bertambahnya test (target jangka panjang >=60%).
            thresholds: {
                statements: 10,
                branches: 11,
                functions: 9,
                lines: 10,
            },
        },
    },
});