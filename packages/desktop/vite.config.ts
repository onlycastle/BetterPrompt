import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  envDir: path.resolve(__dirname),  // Load .env from package root
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@cli': path.resolve(__dirname, '../cli/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
