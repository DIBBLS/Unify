import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'unify.theme.v1';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore — fall through to light
  }
  return 'light';
}

// App-wide theme (light default, persisted). Sets data-theme on <html>
// so the CSS variable system + dark overrides follow everywhere.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // ignore (private mode)
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  return { theme, toggle };
}

// Fire-and-forget boot: apply the saved theme before React paints so a
// returning dark-mode user never flashes light. Called once in main.tsx.
export function bootTheme(): void {
  try {
    const saved = localStorage.getItem(KEY);
    document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
  } catch {
    // ignore
  }
}
