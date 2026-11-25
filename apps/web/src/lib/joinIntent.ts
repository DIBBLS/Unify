import { api, clearMeCache, type MeResponse } from './api';

// Review 4: separate sign-up links. /join (students), /join/lecturer and
// /join/contributor all lead to the one sign-in page (/auth). The link only
// remembers which role the person is joining as; it never grants it. Once
// their profile is complete the app files a role request, and the role is
// given on the server only when an admin approves it.
export type JoinRole = 'lecturer' | 'contributor';
/** Fired when a role request is filed or withdrawn, so the tabs re-check. */
export const ROLE_EVENT = 'unify:role-request';
const KEY = 'unify.join.v1';

export function setJoinIntent(role: JoinRole | null): void {
  try {
    if (role) localStorage.setItem(KEY, role);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the link just acts like the student one */ }
}

export function getJoinIntent(): JoinRole | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'lecturer' || v === 'contributor' ? v : null;
  } catch {
    return null;
  }
}

/** File the remembered request once (student account, complete profile, nothing pending). */
export async function fileJoinIntent(me: MeResponse): Promise<JoinRole | null> {
  const role = getJoinIntent();
  if (!role || !me.onboarded || !me.profile) return null;
  // Already staff, or a request already waits: nothing to file.
  if ((me.profile.role && me.profile.role !== 'student') || me.pendingRole) {
    setJoinIntent(null);
    return null;
  }
  await api.roleRequest({ role, level: role === 'contributor' ? me.profile.level || '' : '', courses: [] });
  setJoinIntent(null);
  clearMeCache();
  window.dispatchEvent(new Event(ROLE_EVENT));
  return role;
}
