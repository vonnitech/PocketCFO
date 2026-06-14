import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-mark.svg', 'favicon.svg', 'favicon-32x32.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Pocket CFO',
        short_name: 'Pocket CFO',
        description: 'Your personal CFO — track spending, crush debt, build wealth.',
        theme_color: '#facc15',
        background_color: '#FAFAF9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          // SVG fallback — resolution-independent for browsers that support it
          { src: '/icon.svg',         sizes: 'any',     type: 'image/svg+xml', purpose: 'any maskable' },
          // PNG raster icons — required by iOS, older Android, and the Chrome install prompt preview
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png',     purpose: 'any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png',     purpose: 'any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png',     purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    modulePreload: {
      polyfill: false, // Eliminates the inline script block so CSP can drop 'unsafe-inline'
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react/')) return 'react-vendor';
          if (id.includes('lucide-react') || id.includes('motion')) return 'ui-vendor';
          if (id.includes('zustand') || id.includes('idb')) return 'state-vendor';
        },
      },
    },
  },
});
