import { useEffect, useSyncExternalStore } from 'react';
import type KatexType from 'katex';

// KaTeX (~75 KB gzipped with its stylesheet) is only needed on screens that
// show maths, so it loads on demand instead of sitting in the first-paint
// bundle. Until it arrives, callers show the plain text; they re-render the
// moment it is ready.
let mod: typeof KatexType | null = null;
let pending: Promise<void> | null = null;
const subs = new Set<() => void>();

export const getKatex = (): typeof KatexType | null => mod;

export function loadKatex(): Promise<void> {
  if (!pending) {
    pending = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([m]) => {
        mod = (m as unknown as { default?: typeof KatexType }).default ?? (m as unknown as typeof KatexType);
        subs.forEach((f) => f());
      })
      .catch(() => {
        pending = null; // offline: try again next time a maths screen mounts
      });
  }
  return pending;
}

/** True once KaTeX is loaded; starts loading it on first use. */
export function useKatexReady(): boolean {
  useEffect(() => {
    void loadKatex();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => mod !== null,
    () => false,
  );
}
