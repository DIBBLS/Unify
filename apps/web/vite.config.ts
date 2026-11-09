import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// One id per build: the commit when the host provides it, else the build time.
const BUILD_ID = ((process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || 'b') + '-' + Date.now().toString(36);

// Stamps the id into the service worker and publishes /version.json so open
// copies of the app can tell a newer build exists.
const stampBuild = (): Plugin => ({
  name: 'stamp-build',
  apply: 'build',
  closeBundle() {
    const dist = resolve(__dirname, 'dist');
    const sw = resolve(dist, 'sw.js');
    if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD_ID__', BUILD_ID));
    writeFileSync(resolve(dist, 'version.json'), JSON.stringify({ build: BUILD_ID }));
  },
});

export default defineConfig({
  plugins: [react(), stampBuild()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Accept plain env names too (SUPABASE_URL, API_URL, USE_BACKEND) —
  // VITE_* equivalents keep working as fallback.
  envPrefix: ['VITE_', 'SUPABASE_', 'API_', 'USE_'],
  server: { port: 3000 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Split vendor code out of the app chunk: first paint downloads the
    // small app shell immediately, heavy deps stream in parallel and cache
    // across releases (react/supabase rarely change with app code).
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  resolve: { alias: { '@': '/src' } }
});
