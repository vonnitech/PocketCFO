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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Pocket CFO',
        short_name: 'PocketCFO',
        description: 'Your personal CFO — track spending, crush debt, build wealth.',
        theme_color: '#facc15',
        background_color: '#F4F6F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
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
