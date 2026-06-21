import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api/v1/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/api/v1/wardrobe': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/v1/outfits': { target: 'http://localhost:3003', changeOrigin: true },
      '/api/v1/jobs': { target: 'http://localhost:3003', changeOrigin: true },
      '/api/v1/process': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/recommendations': { target: 'http://localhost:3003', changeOrigin: true },
      '/api/v1/avatars': { target: 'http://localhost:3002', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3003', ws: true },
    },
  },
});
