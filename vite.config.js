import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: { main: './index.html' },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/jspdf')) return 'jspdf';
          if (id.includes('node_modules/chart.js')) return 'chart';
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/html2canvas')) return 'html2canvas';
          if (id.includes('node_modules/@sentry')) return 'sentry';
          if (id.includes('node_modules/dompurify') || id.includes('node_modules/purify')) return 'purify';
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
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
      includeAssets: ['favicon.ico', 'logo.png', 'firebase-messaging-sw.js'],
      manifest: {
        name: 'MTC.NEXUS',
        short_name: 'NEXUS',
        description: 'Advanced Maintenance Analytics Tracker',
        theme_color: '#0B0F1A',
        background_color: '#05070a',
        display: 'standalone',
        // Enable push notifications in PWA manifest
        gcm_sender_id: '400206066339',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192 512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
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
});
