import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '../lib/routes';
import { Card, Display, Label, ListCard, Pill } from '../components/redesign/ui';

// Entry points for every screen, grouped the way the redesign groups them.
// Role tags say who can open a route; opening one you don't have access to
// just bounces you home. Dynamic routes use a sample course (CHE201, week 1).
type Role = 'student' | 'lecturer' | 'contributor' | 'admin' | 'any';
type Entry = { path: string; name: string; note: string; roles: Role[] };

const SAMPLE = 'CHE201';

const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Student tabs',
    entries: [
      { path: ROUTES.home, name: 'Home', note: 'Hero, CGPA target, resume, activity', roles: ['any'] },
      { path: ROUTES.timetable, name: 'Timetable', note: 'This week’s classes across your courses', roles: ['student'] },
      { path: ROUTES.class, name: 'Class', note: 'Your class board, attendance and Meet links', roles: ['student'] },
      { path: ROUTES.findCourses, name: 'Manage courses', note: 'Search, add and remove courses', roles: ['student'] },
      { path: ROUTES.me, name: 'Me', note: 'Profile, persona, theme, account', roles: ['any'] },
    ],
  },
  {
    title: 'Learning',
    entries: [
      { path: ROUTES.courses, name: 'My courses', note: 'Enrolled courses', roles: ['student'] },
      { path: ROUTES.course(SAMPLE), name: `Course · ${SAMPLE}`, note: 'Weeks and progress', roles: ['student'] },
      { path: ROUTES.week(SAMPLE, 1), name: 'Week reader', note: 'Notes, recall, quiz', roles: ['student'] },
      { path: ROUTES.cgpa, name: 'CGPA planner', note: 'Target and what it takes', roles: ['student'] },
      { path: ROUTES.notifications, name: 'Notifications', note: 'Alerts and announcements', roles: ['any'] },
    ],
  },
  {
    title: 'Attendance & classes',
    entries: [
      { path: ROUTES.attendanceSetup, name: 'Attendance details', note: 'Find yourself on the class list, once', roles: ['student'] },
      { path: ROUTES.attendancePass, name: 'My pass', note: 'Rotating QR the class rep or lecturer scans', roles: ['student'] },
      { path: ROUTES.attendanceMine, name: 'My attendance', note: 'Your record', roles: ['student'] },
      { path: ROUTES.onlineClass, name: 'Online class', note: 'Coming soon', roles: ['any'] },
      { path: ROUTES.hocRequest, name: 'Become HOC', note: 'Request head-of-class', roles: ['student'] },
      { path: ROUTES.hoc, name: 'Class board', note: 'HOC posts for your department and level', roles: ['student'] },
      { path: ROUTES.hocWelcome, name: 'Class rep setup', note: 'Four steps after approval: class list, timetable, first post', roles: ['student'] },
      { path: ROUTES.classList, name: 'Class list', note: 'Class rep uploads names and matric numbers; answers requests', roles: ['student'] },
      { path: ROUTES.scanner, name: 'Take attendance', note: 'Open a session, scan passes, see who is absent', roles: ['lecturer'] },
    ],
  },
  {
    title: 'Lecturer & contributor',
    entries: [
      { path: ROUTES.lecturer, name: 'Classroom', note: 'Today’s classes and lecturer actions', roles: ['lecturer'] },
      { path: ROUTES.studio, name: 'Studio', note: 'Write and publish notes', roles: ['lecturer', 'contributor'] },
      { path: ROUTES.browse, name: 'Browse', note: 'Level-scoped content', roles: ['lecturer', 'contributor'] },
      { path: ROUTES.myClasses, name: 'My classes', note: 'Timetable slots and live roster', roles: ['lecturer', 'contributor'] },
    ],
  },
  {
    title: 'Admin',
    entries: [
      { path: ROUTES.admin, name: 'Admin panel', note: 'Users, requests, announcements', roles: ['admin'] },
      { path: ROUTES.adminContent, name: 'All content', note: 'Read everything', roles: ['admin'] },
    ],
  },
  {
    title: 'Before sign-in',
    entries: [
      { path: ROUTES.welcome, name: 'Welcome slides', note: 'Four intro slides, shown once per device', roles: ['any'] },
      { path: ROUTES.auth, name: 'Sign in / up', note: 'Box Boy splash first', roles: ['any'] },
      { path: ROUTES.onboarding, name: 'Onboarding', note: 'Full-screen Box Boy flow', roles: ['any'] },
      { path: ROUTES.persona, name: 'Persona picker', note: 'Choose your Box Boy', roles: ['any'] },
    ],
  },
];

const TONE: Record<Role, 'good' | 'amber' | 'grey' | 'dark' | 'warn'> = {
  student: 'good', lecturer: 'amber', contributor: 'amber', admin: 'dark', any: 'grey',
};

export default function ScreensRoute() {
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <Label>Index</Label>
      <Display size={30}>Screens</Display>
      <p className="t-13 muted" style={{ marginTop: 6 }}>
        Every route in the app. Old paths (/dashboard, /profile, /course, /explore, /classes) redirect here automatically.
      </p>
      {GROUPS.map((g) => (
        <section key={g.title} style={{ marginTop: 22 }}>
          <Label>{g.title}</Label>
          <ListCard style={{ marginTop: 8 }}>
            {g.entries.map((e) => (
              <Link
                key={e.path}
                to={e.path}
                className="row"
                style={{ gap: 12, padding: '13px 16px', textDecoration: 'none', color: 'var(--u-text)' }}
              >
                <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                  <div className="t-15 w-6">{e.name}</div>
                  <div className="t-13 muted">{e.note}</div>
                  <code className="t-13 muted" style={{ fontSize: 11 }}>{e.path}</code>
                </div>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {e.roles.map((r) => (
                    <Pill key={r} tone={TONE[r]}>{r}</Pill>
                  ))}
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </ListCard>
        </section>
      ))}
      <Card tone="light" style={{ marginTop: 22 }}>
        <div className="t-13 muted">Not on this list: /s/:token (public share link) and any unknown path (404).</div>
      </Card>
    </div>
  );
}
