import { defineConfig } from 'vitest/config';

/**
 * Config khusus untuk menguji Firebase Security Rules.
 * Dijalankan lewat `npm run test:rules` (membutuhkan Firebase Emulator + Java).
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**', '.open/**', 'backup/**'],
    // Rules test berinteraksi dengan emulator → butuh waktu lebih & jalan serial
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
