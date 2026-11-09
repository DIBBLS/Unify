// Flag for the pre-auth welcome slides (routes/welcome.tsx): set when a
// visitor finishes or skips them, so they only appear once per device.
export const WELCOMED_KEY = 'unify.welcomed.v1';

/** True when the slides should be skipped (seen before, or storage blocked — never loop). */
export function hasSeenWelcome(): boolean {
  try {
    return !!localStorage.getItem(WELCOMED_KEY);
  } catch {
    return true;
  }
}
