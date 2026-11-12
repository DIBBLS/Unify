// The first name of the last person who signed in on this device, so the
// sign-in screen can say "Welcome back, Tunde". First name only; "Not Tunde?"
// on the sign-in screen forgets it (for shared phones and laptops).
const KEY = 'unify.lastname.v1';

export function rememberLastName(firstName?: string | null) {
  const n = (firstName || '').trim().split(/\s+/)[0];
  if (!n) return;
  try { localStorage.setItem(KEY, n.slice(0, 40)); } catch { /* fine */ }
}
export function lastSignedInName(): string {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function forgetLastName() {
  try { localStorage.removeItem(KEY); } catch { /* fine */ }
}
