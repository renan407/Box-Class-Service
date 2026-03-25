import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const logoUrl = 'https://lh3.googleusercontent.com/d/1NPLCmJdFrksTRFDtK1Ig9vPkqwz5HawA';
  
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [logoUrl],
        manifest: {
          name: 'Box Class Car',
          short_name: 'Box Class',
          description: 'Estética Automotiva de Alta Performance',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: logoUrl,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: logoUrl,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: logoUrl,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
