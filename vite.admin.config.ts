import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Platform Owner console (separate app). Dev: http://localhost:5174, API calls go to /admin-api.
 * Build: dist-admin/ — host it on its own (sub)domain, never next to the public site's files.
 */
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001';

export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: [repoRoot] },
    proxy: {
      '/admin-api': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4174,
    proxy: {
      '/admin-api': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-admin', import.meta.url)),
    emptyOutDir: true,
  },
});
