import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const buildTimestamp = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'maskable-icon.svg'],
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html'
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || process.env.npm_package_version || '0.1.0'),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp)
  }
});
