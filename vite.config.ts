import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  // Add proper asset handling for GLFT files
  build: {
    assetsInlineLimit: 0, // Don't inline any assets
    rollupOptions: {
      output: {
        manualChunks: {
          // Split code efficiently 
          react: ['react', 'react-dom'],
          scenes: ['./src/scenes/GLTFImportScene/GLTFImportScene.ts', './src/scenes/shadowDemoScene.ts'],
        },
      },
    },
  },
  // Make sure binary files like GLB are correctly copied and accessible
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin'],
});
