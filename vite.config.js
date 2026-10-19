import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P2-2: Inject Firebase web config ke public/firebase-messaging-sw.js dari env.
 *
 * File di public/ disalin apa adanya oleh Vite, jadi tidak bisa pakai
 * import.meta.env seperti modul lain. Solusi:
 *   - dev  : intercept request SW via middleware, isi config dari .env
 *   - build: rewrite file hasil copy di dist/ via writeBundle
 *
 * File SW berisi placeholder (__FIREBASE_API_KEY__, dst) yang diganti saat runtime build/dev.
 */
function firebaseMessagingSwPlugin(env) {
  const SW_FILE = 'firebase-messaging-sw.js';
  const MAP = {
    __FIREBASE_API_KEY__: env.VITE_FIREBASE_API_KEY,
    __FIREBASE_AUTH_DOMAIN__: env.VITE_FIREBASE_AUTH_DOMAIN,
    __FIREBASE_DATABASE_URL__: env.VITE_FIREBASE_DATABASE_URL,
    __FIREBASE_PROJECT_ID__: env.VITE_FIREBASE_PROJECT_ID,
    __FIREBASE_STORAGE_BUCKET__: env.VITE_FIREBASE_STORAGE_BUCKET,
    __FIREBASE_MESSAGING_SENDER_ID__: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    __FIREBASE_APP_ID__: env.VITE_FIREBASE_APP_ID,
    __FIREBASE_MEASUREMENT_ID__: env.VITE_FIREBASE_MEASUREMENT_ID,
  };
  const inject = (code) =>
    Object.entries(MAP).reduce((acc, [k, v]) => acc.split(k).join(v ?? ''), code);
  const sourcePath = () => path.resolve(process.cwd(), 'public', SW_FILE);

  return {
    name: 'inject-firebase-messaging-sw',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url !== '/' + SW_FILE) return next();
        try {
          const raw = await fs.promises.readFile(sourcePath(), 'utf-8');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end(inject(raw));
        } catch {
          next();
        }
      });
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir || path.resolve(process.cwd(), 'dist');
      const target = path.join(outDir, SW_FILE);
      if (fs.existsSync(target)) {
        fs.writeFileSync(target, inject(fs.readFileSync(target, 'utf-8')));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));

  return {
    root: './',
    // Versi app untuk footer status strip (index.html) — satu sumber: package.json.
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: {
      outDir: 'dist',
      // Modern browsers only: skip ES5 transpile & heavy core-js polyfills (keeps vendor slim)
      target: 'esnext',
      modulePreload: {
        // Don't eagerly preload lazy-only chunks (jspdf/qrcode load on demand)
        resolveDependencies: (filename, deps) => deps.filter(d => !/jspdf|qrcode|html2canvas|xlsx|sentry/.test(d)),
      },
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: { main: './index.html' },
        output: {
          // Rolldown (Vite 8) mengabaikan `manualChunks` untuk modul virtual
          // `\0vite/preload-helper`, sehingga helper itu menempel di chunk jspdf —
          // dan entry jadi `import{D as M}from"./jspdf-*.js"`, menarik 114 KB ke
          // jalur kritis. `advancedChunks` memisahkannya jadi chunk kecil sendiri.
          advancedChunks: {
            groups: [{ name: 'vite-preload-helper', test: /preload-helper/ }],
          },
          manualChunks(id) {
            // Helper preload milik Vite (`\0vite/preload-helper`) TIDAK boleh ikut
            // nempel di chunk besar mana pun: kalau nempel, chunk itu jadi statically
            // imported oleh entry dan seluruh isinya (mis. jspdf 114 KB) ikut ke
            // jalur kritis. Pernah kejadian: `import{D as M}from"./jspdf-*.js"`.
            if (id.includes('preload-helper')) return 'preload-helper';
            if (id.includes('node_modules/xlsx')) return 'xlsx';
            if (id.includes('node_modules/jspdf')) return 'jspdf';
            // jspdf's SVG chain (canvg + dompurify) — only used inside jspdf lazy chunk
            if (id.includes('node_modules/canvg') || id.includes('node_modules/dompurify') || id.includes('node_modules/purify')) return 'pdfdeps';
            if (id.includes('node_modules/chart.js')) return 'chart';
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/html2canvas')) return 'html2canvas';
            if (id.includes('node_modules/@sentry')) return 'sentry';
            if (id.includes('node_modules/alpinejs')) return 'alpine';
            if (id.includes('node_modules/qrcode')) return 'qrcode';
            if (id.includes('node_modules')) return 'vendor';
          }
        }
      },
      // Suppress size warning for known-large libs
      reportCompressedSize: false,
    },
    plugins: [
      firebaseMessagingSwPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: '.',
        filename: 'sw.js',
        includeAssets: ['favicon.ico', 'logo.png', 'firebase-messaging-sw.js', 'icons/*.png', 'fonts/*.woff2', 'img/*.jpg', 'img/*.webp'],
        // Manifest dimiliki oleh public/manifest.json (satu sumber kebenaran).
        // Dinonaktifkan agar VitePWA tidak membuat <link rel="manifest"> kedua
        // yang bertabrakan (dulu menghasilkan manifest.webmanifest dengan brand lama).
        manifest: false
      })
    ],
    server: {
      port: 3000,
      open: true,
      allowedHosts: true,
      // `vitest --coverage` menulis ribuan berkas HTML di coverage/ dan test-results/;
      // tanpa ini Vite me-reload halaman tiap laporan ditulis ulang.
      watch: { ignored: ['**/coverage/**', '**/test-results/**', '**/.lighthouseci/**'] },
    },
    optimizeDeps: {
      exclude: ['jspdf', 'jspdf-autotable']
    }
  };
});
