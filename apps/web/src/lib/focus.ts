import { useSyncExternalStore } from 'react';

// Focus (reading) mode: when ON, the shell hides its sticky header and
// bottom tab bar so the note owns the full screen (mobile included).
// Retained per device (localStorage) like zoom — switching notes keeps it.
// The layout only HIDES chrome on note-reader routes; everywhere else the
// bars stay visible regardless of this flag, so focus can never leak.
const KEY = 'unify.focus.v1';
let on = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const subs = new Set<() => void>();

export function setFocusMode(v: boolean): void {
  if (v === on) return;
  on = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    // private mode — focus just won't persist
  }
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
