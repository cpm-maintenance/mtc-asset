import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * ESLint flat config — MTC-Asset.
 *
 * Prinsip (P1-4, mode aman):
 * - Fokus `no-unused-vars` + `no-undef` (menangkap variabel/typo & import mati).
 * - Formatting TIDAK diurus ESLint (prettier menangani) → `eslint-config-prettier` dimatikan konfliknya.
 * - Global CDN (Alpine, Chart, firebase, dst) dideklarasikan eksplisit agar `no-undef` tidak salah alarm.
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'backups/**',
      'backup/**',
      '.open/**',
      '.firebase/**',
      'coverage/**',
      'scratch/**',
      'public/**',
      '*.min.js',
    ],
  },

  js.configs.recommended,
  prettier,

  // ── Source aplikasi (browser) ──────────────────────────────────────────
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Alpine: 'readonly',
        Chart: 'readonly',
        firebase: 'readonly',
        XLSX: 'readonly',
        jspdf: 'readonly',
        html5QrCode: 'readonly',
        Html5Qrcode: 'readonly',
        Sentry: 'readonly',
        QRCode: 'readonly',
        OneSignal: 'readonly',
        Cropper: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },

  // ── Service worker (public/) ───────────────────────────────────────────
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.serviceworker, firebase: 'readonly' },
    },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // ── Node scripts & tooling ─────────────────────────────────────────────
  {
    files: ['scripts/**/*.{js,mjs}', 'api/**/*.js', 'onesignal-server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // ── Service worker root (sumber vite-plugin-pwa injectManifest) ───────
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // ── Tests ──────────────────────────────────────────────────────────────
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
];
