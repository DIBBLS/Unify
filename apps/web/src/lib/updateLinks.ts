import { ROUTES } from './routes';

// Pages an admin can point a Home-slider button at, with who may open each.
// Mirrors the gates in App.tsx (RequireRole): student pages also admit admins
// unless `strict`; author pages admit lecturers, contributors and admins.
// Home hides a button from anyone the page would bounce, so every role can
// be targeted without sending someone to a page that throws them back.
export type LinkAudience = 'everyone' | 'students' | 'authors';
export type UpdateLink = { value: string; label: string; who: LinkAudience; strict?: boolean };

export const UPDATE_LINKS: UpdateLink[] = [
  { value: ROUTES.home, label: 'Home', who: 'everyone' },
  { value: ROUTES.notifications, label: 'Notifications', who: 'everyone' },
  { value: ROUTES.me, label: 'Profile', who: 'everyone' },
  { value: ROUTES.persona, label: 'Choose your Box Boy', who: 'everyone' },
  { value: ROUTES.courses, label: 'My courses', who: 'students' },
  { value: ROUTES.findCourses, label: 'Find courses', who: 'students' },
  { value: ROUTES.timetable, label: 'Timetable', who: 'students' },
  { value: ROUTES.cgpa, label: 'CGPA planner', who: 'students', strict: true },
  { value: ROUTES.attendancePass, label: 'Mark attendance', who: 'students' },
  { value: ROUTES.attendanceMine, label: 'My attendance', who: 'students' },
  { value: ROUTES.hocRequest, label: 'Become a class rep', who: 'students', strict: true },
  { value: ROUTES.studio, label: 'Studio', who: 'authors' },
  { value: ROUTES.browse, label: 'Browse notes', who: 'authors' },
  { value: ROUTES.myClasses, label: 'My classes', who: 'authors' },
];

export const AUDIENCE_LABEL: Record<LinkAudience, string> = {
  everyone: 'Everyone',
  students: 'Students',
  authors: 'Lecturers & contributors',
};

export function findUpdateLink(path: string | undefined): UpdateLink | undefined {
  return path ? UPDATE_LINKS.find((l) => l.value === path) : undefined;
}

/** Can this viewer open the page? Unknown paths and web links: yes. */
export function canOpenLink(path: string | undefined, role: string | undefined, isAdmin: boolean): boolean {
  const l = findUpdateLink(path);
  if (!l || l.who === 'everyone') return true;
  const r = role || 'student';
  if (l.who === 'students') return r === 'student' || (!l.strict && isAdmin);
  return r === 'lecturer' || r === 'contributor' || isAdmin;
}
