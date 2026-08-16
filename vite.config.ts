/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'fonts/*.css', 'fonts/*.woff2'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // the app is fully local; never let a fetch block a screen
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'The Cabinet',
        short_name: 'Cabinet',
        description: 'Home spirits inventory. Offline, on your phone, no account.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#E5E1D6',
        theme_color: '#E5E1D6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
