import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  // Production builds must never bake a localhost API base into the bundle:
  // Vite inlines VITE_* vars, and a localhost base makes every live API call
  // hit a dead endpoint (this shipped once). Local dev is unaffected.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    const apiBase = env.VITE_API_BASE_URL || '';
    if (/localhost|127\.0\.0\.1|:8787/.test(apiBase)) {
      throw new Error(
        `VITE_API_BASE_URL="${apiBase}" points at a local address. Remove it from .env ` +
          '(it belongs in .env.development only) before building for production.'
      );
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon.svg', 'pgwalo-logo.png'],
        manifest: {
          id: '/',
          name: 'PGWalo',
          short_name: 'PGWalo',
          description: 'PGWalo — Your Home Away From Home. Modern PG accommodation and property management platform.',
          theme_color: '#2563EB',
          background_color: '#f8fafc',
          display: 'standalone',
          display_override: ['standalone', 'fullscreen'],
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['lifestyle', 'business'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: command === 'serve',
          type: 'module',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/properties'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pgwalo-search',
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/media/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pgwalo-media',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-vendor': ['lucide-react', 'motion'],
          },
        },
      },
    },
  };
});
