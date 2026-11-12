// Per-page title, description, canonical link and robots tag. Only the
// public pages (welcome, sign-in) are indexable; everything behind sign-in
// is marked noindex so a student's pages never show up in search results.
const SITE = 'https://unify-virid.vercel.app';
const NAME = 'Unify Learn';
const DEFAULT_DESC =
  'Weekly course notes, a CGPA planner, your timetable and QR attendance for Nigerian university students, starting with LASU Faculty of Engineering. Free, and works offline.';

type Meta = { title: string; desc?: string; index?: boolean };

function metaFor(path: string): Meta {
  const week = /^\/learn\/([^/]+)\/week\/(\d+)(?:\/(keywords|crossword))?/.exec(path);
  if (week) return { title: `${week[3] ? `${week[3] === 'keywords' ? 'Keywords' : 'Crossword'} · ` : ''}${decodeURIComponent(week[1])} Week ${week[2]}` };
  const course = /^\/courses\/(?!find)([^/]+)/.exec(path);
  if (course) return { title: decodeURIComponent(course[1]) };
  const fixed: Record<string, Meta> = {
    '/welcome': { title: `${NAME}: notes, CGPA planner and attendance for Nigerian students`, index: true },
    '/auth': { title: `Sign in or create your account · ${NAME}`, desc: 'Sign in to Unify Learn: your weekly notes, timetable, attendance and CGPA plan in one place. Free for students.', index: true },
    '/home': { title: 'Home' },
    '/courses': { title: 'My courses' },
    '/courses/find': { title: 'Find courses' },
    '/timetable': { title: 'Timetable' },
    '/class': { title: 'Class' },
    '/me': { title: 'Me' },
    '/settings': { title: 'Settings' },
    '/notifications': { title: 'Notifications' },
    '/cgpa-planner': { title: 'CGPA planner' },
    '/guide': { title: 'Guide' },
    '/studio': { title: 'Studio' },
    '/lecturer': { title: 'Classroom' },
    '/attendance/pass': { title: 'My pass' },
    '/attendance/my': { title: 'My attendance' },
    '/class-list': { title: 'Class list' },
    '/class/contributors': { title: 'Contributors' },
  };
  if (fixed[path]) return fixed[path];
  if (path.startsWith('/admin')) return { title: 'Admin' };
  if (path.startsWith('/s/')) return { title: `Shared notes · ${NAME}` };
  return { title: NAME };
}

function setTag(selector: string, make: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = make();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export function applyRouteMeta(path: string) {
  try {
    const m = metaFor(path);
    document.title = m.title.includes(NAME) ? m.title : `${m.title} · ${NAME}`;
    const desc = m.desc || DEFAULT_DESC;
    setTag('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', desc);
    setTag('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', m.index ? 'index, follow' : 'noindex, nofollow');
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', `${SITE}${path === '/' ? '/welcome' : path}`);
  } catch {
    // never let page titles break the app
  }
}
