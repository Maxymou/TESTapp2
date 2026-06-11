import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { appConfig } from './app.config.js';

const buildTimestamp = new Date().toISOString();

const htmlAppIdentity = () => ({
  name: 'html-app-identity',
  transformIndexHtml(html) {
    return html
      .replaceAll('%APP_TITLE%', appConfig.appTitle)
      .replaceAll('%APP_NAME%', appConfig.appName)
      .replaceAll('%THEME_COLOR%', appConfig.themeColor);
  }
});

export default defineConfig({
  plugins: [
    react(),
    htmlAppIdentity(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: appConfig.appName,
        short_name: appConfig.shortName,
        description: appConfig.appDescription,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: appConfig.backgroundColor,
        theme_color: appConfig.themeColor,
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/maskable-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globIgnores: ['**/manifest.webmanifest'],
        navigateFallback: '/index.html'
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || process.env.npm_package_version || '0.1.0'),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp)
  }
});
