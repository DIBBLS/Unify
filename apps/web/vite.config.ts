import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
