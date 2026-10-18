import { useSyncExternalStore } from 'react';

// Focus (reading) mode: when ON, the shell hides its sticky header and
// bottom tab bar so the note owns the full screen (mobile included).
// Only the reader (learn/week) sets it; it resets on reader unmount.
let on = false;
const subs = new Set<() => void>();

export function setFocusMode(v: boolean): void {
  if (v === on) return;
  on = v;
  subs.forEach((f) => f());
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => on,
    () => false,
  );
}
