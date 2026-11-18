// Where a notification's link should go. Links arrive as app paths
// ("/timetable") or as full addresses of the app ("https://…/learn/…"), and a
// few old ones point at pages that moved. In-app links become paths for the
// router; anything else opens in the browser.
const APP_HOSTS = [/\.vercel\.app$/i, /^localhost$/i];
const MOVED: Record<string, string> = { '/dashboard': '/home' };

export function appPath(link?: string | null): { path: string } | { href: string } {
  const raw = (link || '').trim();
  if (!raw) return { path: '/home' };
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const ours = u.host === window.location.host || APP_HOSTS.some((h) => h.test(u.hostname));
      if (!ours) return { href: raw };
      path = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return { path: '/home' };
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const bare = path.split(/[?#]/)[0];
  if (MOVED[bare]) path = MOVED[bare] + path.slice(bare.length);
  return { path };
}

// Message the service worker sends when a notification is tapped while the
// app is already open (see public/sw.js).
export const OPEN_FROM_PUSH = 'unify-open';
