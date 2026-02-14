import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split Three.js and 3D stack into a dedicated chunk to avoid a single 500k+ bundle
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three') || id.includes('@pixiv/three-vrm')) {
              return 'three';
            }
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'avatrr',
        short_name: 'avatrr',
        description: 'Real-time AI avatar chat',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
