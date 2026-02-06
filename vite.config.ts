import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-reactylon'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@babylonjs/core/XR/motionController/webXROculusHandController.js': '@babylonjs/core/XR/motionController/webXRGenericHandController.js',
    },
  },
  // Optimize Babylon.js imports
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/gui', '@babylonjs/loaders'],
    exclude: ['@babylonjs/havok'],
  },
  assetsInclude: ['**/*.wasm'],
});
