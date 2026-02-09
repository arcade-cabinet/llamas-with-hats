import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages deploys to /llamas-with-hats/ subpath
  base: process.env.GITHUB_ACTIONS ? '/llamas-with-hats/' : '/',
  plugins: [
    react(),
  ],
  server: {
    // Fix HMR WebSocket failures when restarting the dev server while the
    // browser tab stays open.  Without this, Vite's client-side HMR code
    // sometimes loads React from two module graphs and crashes hooks.
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
    },
  },
  // Optimize Babylon.js imports
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/gui', '@babylonjs/loaders'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/systems/**/*.ts', 'src/hooks/**/*.ts', 'src/data/**/*.ts'],
    },
  },
});
