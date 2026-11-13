import { SectionSkeleton } from '../components/Skeletons';
import LiveWire from '../components/LiveWire';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Search, ChevronRight, Flag, FileUp } from 'lucide-react';
import SendPdf from '../components/SendPdf';
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
  { to: ROUTES.scanner, icon: ClipboardCheck, title: 'Take attendance', sub: 'Open a session and scan students’ passes', lecturerOnly: true },
  { to: ROUTES.timetable, icon: CalendarDays, title: 'Timetable', sub: 'Every class you teach, set by each class rep' },
  { to: ROUTES.browse, icon: Search, title: 'Browse content', sub: 'Everything at your level' },
  { to: '/content-reports', icon: Flag, title: 'Reports and reviews', sub: 'Problems students reported, and week reviews' },
];

export default function LecturerHomeRoute() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [today, setToday] = useState<ClassSlot[] | null>(null);
  const [taught, setTaught] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setName(me.profile?.first_name || '');
        setRole(me.profile?.role || '');
        setDept(me.profile?.department || '');
        const courses = (await api.teaching()).courses;
        setTaught(courses);
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
      <LiveWire style={{ margin: '12px 0 0' }} />
      {/* Send a PDF: shrunk on the phone, posted to every class taking the course, saved for the contributor. */}
      {(role === 'lecturer' || role === 'admin') && taught.length > 0 && (
        <button className="btn btn--amber btn--block" style={{ marginTop: 12 }} onClick={() => setSending(true)}>
          <FileUp size={16} /> Send a PDF to students
        </button>
      )}
      {sending && <SendPdf courses={taught} onClose={() => setSending(false)} />}

      {/* L01–L06: first-time lecturer setup, until they've set a department. */}
      {role === 'lecturer' && dept === '' && (
        <Link to="/lecturer/welcome" className="card" style={{ marginTop: 12, display: 'block', padding: 14, textDecoration: 'none', color: 'var(--text)' }}>
          <div className="t-15 w-7">Finish setting up</div>
          <div className="t-13 muted">Your department, your courses and how students see your name. Two minutes.</div>
        </Link>
      )}

      {/* L08: the class on right now (or starting within 15 minutes), one tap to take attendance. */}
      {(() => {
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const live = (today || []).find((s) => nowMin >= toMin(s.start) - 15 && nowMin < toMin(s.end));
        if (!live || !(role === 'lecturer' || role === 'admin')) return null;
        const started = nowMin >= toMin(live.start);
        return (
          <Card tone="dark" style={{ marginTop: 12, gap: 8 }}>
            <div className="eyebrow" style={{ color: 'var(--u-green)' }}>{started ? 'Class time' : 'Starting soon'}</div>
            <Display size={24} color="#fff">{live.course}</Display>
            <div className="t-13" style={{ opacity: 0.8 }}>{live.start}–{live.end}{live.venue ? ` · ${live.venue}` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to={`${ROUTES.scanner}?course=${encodeURIComponent(live.course)}&slot=${live.id}`} className="btn btn--amber btn--sm">Take attendance</Link>
              {live.meetLink && <a href={live.meetLink} target="_blank" rel="noreferrer" className="btn btn--white btn--sm">Open the meeting</a>}
              <Link to={`/lecturer/course/${encodeURIComponent(live.course)}?tab=post`} className="btn btn--white btn--sm">Post to students</Link>
            </div>
          </Card>
        );
      })()}

      <section style={{ marginTop: 22 }}>
        <Label>Today</Label>
        {today === null ? (
          <SectionSkeleton rows={2} />
        ) : today.length === 0 ? (
          <Card style={{ marginTop: 8 }}>
            <div className="t-15 w-6">No classes today</div>
            <div className="t-13 muted">Each class's rep sets its class times; they show up here once they do.</div>
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

      {/* S76: a lecturer with no courses yet. */}
      {today !== null && taught.length === 0 && role === 'lecturer' && (
        <Card style={{ marginTop: 22, alignItems: 'center', textAlign: 'center' }}>
          <BoxBoy pose="peeking" width={90} />
          <div className="t-15 w-6">No courses assigned yet</div>
          <div className="t-13 muted">The Unify team assigns the courses you teach. Tell them which from Me → Help, and they'll show up here with their weeks, reports and attendance.</div>
        </Card>
      )}
      {taught.length > 0 && (role === 'lecturer' || role === 'admin') && (
        <section style={{ marginTop: 22 }}>
          <Label>Your courses</Label>
          <ListCard style={{ marginTop: 8 }}>
            {taught.map((c) => (
              <Link key={c} to={`/lecturer/course/${encodeURIComponent(c)}`} className="row" style={{ gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
                <div className="grow stack" style={{ gap: 2 }}>
                  <div className="t-15 w-6">{c}</div>
                  <div className="t-13 muted">Weeks · report · attendance · post to students</div>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </ListCard>
        </section>
      )}

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
