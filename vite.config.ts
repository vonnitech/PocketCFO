import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { deleteAccountForToken } from './api/_delete-account-core';

function localAccountApi(env: Record<string, string>): Plugin {
  return {
    name: 'pocketcfo-local-account-api',
    configureServer(server) {
      server.middlewares.use('/api/delete-account', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const header = req.headers.authorization ?? '';
          const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
          const result = await deleteAccountForToken(env, token);
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          if ('error' in result) {
            res.end(JSON.stringify({ error: result.error }));
            return;
          }
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error('[local delete-account]', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Could not delete account' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [
    localAccountApi(env),
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
        // The report/import machinery — xlsx + papaparse (export-*), jspdf, and
        // jspdf's html2canvas / DOMPurify / ESM-sibling deps — is ~408KB gzipped,
        // 57% of what this precache would otherwise ship. Every one of those
        // chunks is reachable ONLY through the dynamic import()s in Settings and
        // ImportMapperModal, so precaching them hands the full download to every
        // user on install for a feature most never open, and re-ships whichever
        // ones rehash on each deploy. They are cached at runtime on first real
        // use instead (see runtimeCaching below).
        //
        // Verify after changing chunking: the build log's "precache N entries
        // (X KiB)" line should stay near ~1.0MB, not jump back to ~2.4MB.
        globIgnores: [
          'assets/export-*.js',
          'assets/jspdf*.js',
          'assets/html2canvas*.js',
          'assets/index.es-*.js',
          'assets/purify*.js',
        ],
        runtimeCaching: [
          {
            // Same set as globIgnores. Filenames are content-hashed, so a cache
            // hit can never be stale — CacheFirst is safe and means the download
            // happens exactly once per user, not once per session.
            urlPattern: /\/assets\/(export|jspdf|html2canvas|index\.es|purify)[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pocketcfo-report-chunks',
              // Bounded so superseded hashes from past deploys can't accumulate.
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
  };
});
