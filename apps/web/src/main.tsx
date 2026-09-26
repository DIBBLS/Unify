import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { warmupApi } from './lib/api';
import { bootTheme } from './hooks/useTheme';
import { log } from './lib/log';

bootTheme();

// Offline support: cache shell + readable content (see public/sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

warmupApi();
// Boot inventory: which connections exist (names only, never values).
// If supabaseUrl/Key is false here, sign-in cannot even attempt —
// that alone explains an empty Network tab beyond the warmup ping.
const _env = import.meta.env as unknown as Record<string, string | undefined>;
const _pick = (...keys: string[]) => keys.map((k) => _env[k]).find(Boolean);
log.info('boot', 'env', {
  supabaseUrl: _pick('VITE_SUPABASE_URL', 'SUPABASE_URL') ? 'env' : 'fallback',
  supabaseKey: _pick(
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  )
    ? 'env'
    : 'fallback',
  apiUrl: _pick('VITE_API_URL', 'API_URL') ? 'env' : 'fallback',
  backend: (_pick('VITE_USE_BACKEND', 'USE_BACKEND') ?? '1') === '1',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
