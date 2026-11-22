import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Code shared with the API (../shared), e.g. the quick-entry parser.
const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': shared },
  },
  server: {
    port: 5173,
    fs: { allow: ['.', shared] },
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
