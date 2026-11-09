import LoadingQuote from '../components/LoadingQuote';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, PenTool, Search, ChevronRight } from 'lucide-react';
import { api, type ClassSlot } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard, ListRow, Pill } from '../components/redesign/ui';

// Classroom (lecturer / contributor hub): today's classes for the courses I
// teach, plus one tap to each thing a lecturer does.
const toMin = (hhmm: string) => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const ACTIONS = [
  { to: ROUTES.scanner, icon: ClipboardCheck, title: 'Take attendance', sub: 'Open a session and share the code', lecturerOnly: true },
  { to: ROUTES.myClasses, icon: CalendarDays, title: 'My classes', sub: 'Timetable slots and live roster' },
  { to: ROUTES.studio, icon: PenTool, title: 'Studio', sub: 'Write and publish notes' },
  { to: ROUTES.browse, icon: Search, title: 'Browse content', sub: 'Everything at your level' },
];

export default function LecturerHomeRoute() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [today, setToday] = useState<ClassSlot[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setName(me.profile?.first_name || '');
        setRole(me.profile?.role || '');
        const courses = (await api.teaching()).courses;
        const day = new Date().getDay();
        const settled = await Promise.allSettled(courses.map((c) => api.timetable(c)));
        const slots = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value.slots || [] : []));
        setToday(slots.filter((s) => s.day === day).sort((a, b) => toMin(a.start) - toMin(b.start)));
      } catch (e) {
        errorToast(e, 'load your classes');
        setToday([]);
      }
    })();
  }, []);

  const actions = ACTIONS.filter((a) => !a.lecturerOnly || role === 'lecturer' || role === 'admin');

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 900px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <Card tone="dark" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <BoxBoy pose="teaching" width={84} />
        <div>
          <div className="eyebrow" style={{ color: 'var(--u-amber)' }}>Classroom</div>
          <Display size={26} color="#fff">{name ? `Hi, ${name}` : 'Welcome'}</Display>
        </div>
      </Card>

      <section style={{ marginTop: 22 }}>
        <Label>Today</Label>
        {today === null ? (
          <><div className="skel" style={{ height: 90, borderRadius: 24, marginTop: 8 }} /><LoadingQuote style={{ margin: '24px auto 0' }} /></>
        ) : today.length === 0 ? (
          <Card style={{ marginTop: 8 }}>
            <div className="t-15 w-6">No classes today</div>
            <div className="t-13 muted">Add weekly slots under My classes and they show up here.</div>
          </Card>
        ) : (
          <ListCard style={{ marginTop: 8 }}>
            {today.map((s) => (
              <ListRow
                key={s.id}
                title={s.course}
                sub={`${s.start}–${s.end}${s.venue ? ` · ${s.venue}` : ''}`}
                right={
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {s.meetLink && <a href={s.meetLink} target="_blank" rel="noreferrer" className="btn btn--white btn--sm">Open link</a>}
                    {role === 'lecturer' || role === 'admin' ? <Link to={ROUTES.scanner} className="btn btn--amber btn--sm">Attendance</Link> : <Pill>Today</Pill>}
                  </span>
                }
              />
            ))}
          </ListCard>
        )}
      </section>

      <section style={{ marginTop: 22 }}>
        <Label>Do</Label>
        <ListCard style={{ marginTop: 8 }}>
          {actions.map((a) => (
            <Link key={a.to} to={a.to} className="row" style={{ gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
              <a.icon size={22} />
              <div className="grow stack" style={{ gap: 2 }}>
                <div className="t-15 w-6">{a.title}</div>
                <div className="t-13 muted">{a.sub}</div>
              </div>
              <ChevronRight size={18} />
            </Link>
          ))}
        </ListCard>
      </section>
    </div>
  );
}
