import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "#shared/*" subpath imports in package.json so both
      // Node (server/tests) and the browser bundle resolve shared/ the same way.
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
