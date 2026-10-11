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

  return {
    root: './',
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
          manualChunks(id) {
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
        includeAssets: ['favicon.ico', 'logo.png', 'firebase-messaging-sw.js', 'icons/*.png'],
        manifest: {
          name: 'MTC.NEXUS',
          short_name: 'NEXUS',
          description: 'Advanced Maintenance Analytics Tracker',
          theme_color: '#0B0F1A',
          background_color: '#05070a',
          display: 'standalone',
          // Enable push notifications in PWA manifest
          gcm_sender_id: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '400206066339',
          icons: [
            {
              src: 'icons/manifest-icon-192.maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/manifest-icon-192.maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'icons/manifest-icon-512.maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/manifest-icon-512.maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    server: {
      port: 3000,
      open: true,
      allowedHosts: true,
    },
    optimizeDeps: {
      exclude: ['jspdf', 'jspdf-autotable']
    }
  };
});
