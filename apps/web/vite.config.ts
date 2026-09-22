import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Accept plain env names too (SUPABASE_URL, API_URL, USE_BACKEND) —
  // VITE_* equivalents keep working as fallback.
  envPrefix: ['VITE_', 'SUPABASE_', 'API_', 'USE_'],
  server: { port: 3000 },
  build: { outDir: 'dist', emptyOutDir: true },
  resolve: { alias: { '@': '/src' } }
});
