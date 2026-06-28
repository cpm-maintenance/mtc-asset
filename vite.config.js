import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: (chunkInfo) => {
        if (chunkInfo.name === 'chart.js' || chunkInfo.name?.includes('chart')) {
          return { name: 'chart' };
        }
        if (chunkInfo.name?.includes('firebase')) {
          return { name: 'firebase' };
        }
      }
    },
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
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
  },
  optimizeDeps: {
    exclude: ['jspdf', 'jspdf-autotable']
  }
});
