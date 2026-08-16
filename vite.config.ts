/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed to GitHub Pages at https://<user>.github.io/inventory/, i.e. a
// subpath. Base, SW scope, manifest id/start_url/scope must all agree or
// iOS opens the installed app in a browser tab instead of standalone.
const BASE = '/inventory/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      base: BASE,
      scope: BASE,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // the app is fully local; never let a fetch block a screen
        navigateFallback: `${BASE}index.html`,
      },
      manifest: {
        id: BASE,
        name: 'The Cabinet',
        short_name: 'Cabinet',
        description: 'Home spirits inventory. Offline, on your phone, no account.',
        start_url: `${BASE}#/`,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#E5E1D6',
        theme_color: '#E5E1D6',
        // absolute under the base: leaves no room for scope-relative
        // resolution differences between browsers
        icons: [
          { src: `${BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
