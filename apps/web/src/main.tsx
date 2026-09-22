import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { warmupApi } from './lib/api';
import { log } from './lib/log';

warmupApi();
// Boot inventory: which connections exist (names only, never values).
// If supabaseUrl/Key is false here, sign-in cannot even attempt —
// that alone explains an empty Network tab beyond the warmup ping.
log.info('boot', 'env', {
  supabaseUrl: Boolean(import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL),
  supabaseKey: Boolean(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.SUPABASE_ANON_KEY ||
      import.meta.env.SUPABASE_PUBLISHABLE_KEY
  ),
  apiUrl: Boolean(import.meta.env.VITE_API_URL || import.meta.env.API_URL),
  backend: ((import.meta.env.VITE_USE_BACKEND ?? import.meta.env.USE_BACKEND ?? '1') as string) === '1',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
