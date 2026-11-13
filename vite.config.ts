/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SoloQuest',
        short_name: 'SoloQuest',
        description: 'Zargon companion for HeroQuest',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#EFE6D2',
        theme_color: '#6E1F2A',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,otf,json}'] },
    }),
  ],
  test: { include: ['src/**/*.test.ts', 'tests/engine/**/*.test.ts', 'tools/**/*.test.ts'] },
});
