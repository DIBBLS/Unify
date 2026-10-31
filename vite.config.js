import { defineConfig } from 'vite';

// Keep Unify as static multi-page app — Vite just serves/builds the existing HTML files
// No framework transform needed; Vercel will detect "Vite" from package.json
export default defineConfig({
  appType: 'mpa',
  server: { port: 3000 },
  build: { outDir: 'dist', emptyOutDir: true }
});
