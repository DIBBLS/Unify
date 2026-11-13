import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, ChevronRight, ScanLine, Send } from 'lucide-react';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { api, type ClassSlot, type Profile } from '../lib/api';
import { ROUTES } from '../lib/routes';
import LiveWire from '../components/LiveWire';
import { CourseCardSkeletons } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';
import { timesOf, toMin } from '../components/TimetableGrid';

// Lecturer Home (Review Round 2, design L07/L08): the lecturer teaches, shares
// materials and posts to classes; they don't publish notes or set timetables.
// Top: today's class (now or next) with attendance and posting; a nudge to add
// a photo; then their courses, one level at a time (100L–500L tabs).
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
type Catalog = { code: string; title: string; levels?: string[] }[];

const fmt = (hhmm: string) => {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};

export default function LecturerDashboard({ profile, firstName, catalog, hasPhoto }: { profile: Profile; firstName: string; catalog: Catalog; hasPhoto: boolean }) {
  const [courses, setCourses] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [students, setStudents] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<string | null>(null);
  // Today's class: confirm it, or say it's running late / cancelled (design L07, L18).
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lateAt, setLateAt] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  // Courses the lecturer added themselves wait for each class's rep to confirm.
  const [claims, setClaims] = useState<Record<string, { waiting: boolean; confirmed: number }>>({});

  useEffect(() => {
    let gone = false;
    (async () => {
      const taught = (await api.teaching().catch(() => ({ courses: [] as string[] }))).courses;
      if (gone) return;
      setCourses(taught);
      const [tt, rosters, cl] = await Promise.all([
        Promise.allSettled(taught.map((c) => api.timetable(c))),
        Promise.allSettled(taught.map((c) => api.roster(c))),
        api.lecturerClaims().catch(() => ({ courses: [] as { course: string; claimed: boolean; waiting: boolean; confirmed: number }[] })),
      ]);
      if (gone) return;
      setClaims(Object.fromEntries(cl.courses.filter((c) => c.claimed).map((c) => [c.course, { waiting: c.waiting, confirmed: c.confirmed }])));
      setSlots(tt.flatMap((r) => (r.status === 'fulfilled' ? r.value.slots || [] : [])));
      const n: Record<string, number> = {};
      rosters.forEach((r, i) => { if (r.status === 'fulfilled') n[taught[i]] = r.value.students.length; });
      setStudents(n);
    })();
    return () => { gone = true; };
  }, []);

  const info = (code: string) => catalog.find((c) => c.code.toUpperCase() === code.toUpperCase());
  const levelOf = (code: string) => (info(code)?.levels || [])[0] || 'Other';
  const byLevel = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of courses || []) (m[levelOf(c)] ||= []).push(c);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, catalog]);
  const levels = [...LEVELS.filter((l) => byLevel[l]?.length), ...(byLevel.Other?.length ? ['Other'] : [])];
  const open = tab && levels.includes(tab) ? tab : levels[0];

  // Today's class: on now (or starting within 15 minutes), else the next one.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const today = slots
    .filter((s) => s.day === new Date().getDay())
    .sort((a, b) => toMin(timesOf(a).start) - toMin(timesOf(b).start));
  const live = today.find((s) => s.change?.status !== 'cancelled' && nowMin >= toMin(timesOf(s).start) - 15 && nowMin < toMin(timesOf(s).end));
  const next = live || today.find((s) => nowMin < toMin(timesOf(s).start));
  const later = today.filter((s) => s !== next && s.change?.status !== 'cancelled' && nowMin < toMin(timesOf(s).end));

  const plus = (hhmm: string, mins: number) => {
    const m = Math.min(23 * 60 + 59, toMin(hhmm) + mins);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  // One change for today's class; students taking the course get a bell + push.
  const change = async (slot: ClassSlot, payload: Parameters<typeof api.slotChange>[1], done: string) => {
    setBusy(true);
    try {
      await api.slotChange(slot.id, payload);
      const ch = payload.status === 'normal' ? null : { status: payload.status, start: payload.start || '', end: payload.end || '', venue: payload.venue || '', note: payload.note || '' };
      setSlots((all) => all.map((x) => (x.id === slot.id ? { ...x, change: ch } : x)));
      setChanging(false);
      setLateAt('');
      setCancelNote('');
      toastSuccess(done);
    } catch (e) {
      errorToast(e, 'update today\'s class');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <div className="card card--dark" style={{ margin: 16, padding: '22px 20px 26px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ color: 'var(--u-amber)' }}>Lecturer</div>
          <Display size={26} color="#fff">{firstName || 'Welcome'}</Display>
          <div className="t-13" style={{ marginTop: 6, color: '#ccc' }}>{[profile.department, profile.faculty].filter(Boolean).join(' · ') || 'Set your department in Me'}</div>
        </div>
        <BoxBoy pose="teaching" width={76} style={{ flexShrink: 0 }} />
      </div>

      <LiveWire />

      {next && (
        <div style={{ margin: '0 16px 12px' }}>
          <Card tone="dark" pad={18} gap={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span className="eyebrow" style={{ color: live ? 'var(--u-green)' : 'var(--u-amber)' }}>
                {live ? `Now · ${fmt(timesOf(next).start)}` : `Today · ${fmt(timesOf(next).start)}`}
              </span>
              {next.change?.status === 'cancelled' ? <span className="pill pill--bad">Cancelled</span>
                : next.change?.status === 'late' ? <span className="pill pill--amber">Running late · {fmt(timesOf(next).start)}</span>
                : next.change?.status === 'confirmed' ? <span className="pill pill--good">✓ Confirmed</span>
                : <span className="pill pill--amber">Not confirmed</span>}
            </div>
            <Display size={22} color="#fff">{next.course}{info(next.course)?.title ? ` · ${info(next.course)!.title}` : ''}</Display>
            <span className="t-13" style={{ color: '#aaa' }}>{[timesOf(next).venue, students[next.course] != null ? `${students[next.course]} students` : ''].filter(Boolean).join(' · ')}</span>
            {/* Before class: confirm it; or say it's running late / cancelled. */}
            {next.change?.status !== 'cancelled' && !live && next.change?.status !== 'confirmed' && (
              <button className="btn btn--green btn--sm" disabled={busy} onClick={() => void change(next, { status: 'confirmed' }, `${next.course} confirmed. Your students have been told.`)}>
                <Check size={15} /> Confirm class
              </button>
            )}
            {next.change?.status === 'cancelled' || next.change?.status === 'late' || next.change?.status === 'confirmed' ? (
              <button className="t-13 w-6" style={{ background: 'none', border: 'none', color: '#aaa', textAlign: 'left', padding: 0 }} disabled={busy} onClick={() => void change(next, { status: 'normal' }, 'Back to the usual time. Your students have been told.')}>
                Undo: back to the usual {fmt(next.start)}
              </button>
            ) : (
              <button className="t-13 w-6" style={{ background: 'none', border: 'none', color: '#aaa', textAlign: 'left', padding: 0 }} onClick={() => setChanging((v) => !v)}>
                Running late or cancelling?
              </button>
            )}
            {changing && next.change?.status !== 'cancelled' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.06)' }}>
                <span className="t-13 w-7" style={{ color: '#f5f4f0' }}>Running late: it now starts at</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[10, 15, 30, 45].map((m) => (
                    <button key={m} className="btn btn--ghost-dark btn--sm" disabled={busy} onClick={() => void change(next, { status: 'late', start: plus(next.start, m), note: `About ${m} minutes late.` }, `Students told: ${next.course} now starts at ${fmt(plus(next.start, m))}.`)}>
                      +{m} min · {fmt(plus(next.start, m))}
                    </button>
                  ))}
                  <input type="time" value={lateAt} onChange={(e) => setLateAt(e.target.value)} aria-label="Or pick the new start time" style={{ padding: '6px 8px', borderRadius: 10, border: '1px solid #444', background: '#1a1a1a', color: '#f5f4f0' }} />
                  {lateAt && <button className="btn btn--amber btn--sm" disabled={busy} onClick={() => void change(next, { status: 'late', start: lateAt }, `Students told: ${next.course} now starts at ${fmt(lateAt)}.`)}>Set {fmt(lateAt)}</button>}
                </div>
                <span className="t-13 w-7" style={{ color: '#f5f4f0', marginTop: 4 }}>Or cancel today's class</span>
                <input value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} maxLength={200} placeholder="Note to students (optional), e.g. we'll catch up on Thursday" style={{ padding: 10, borderRadius: 10, border: '1px solid #444', background: '#1a1a1a', color: '#f5f4f0', fontSize: 14 }} />
                <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => { if (window.confirm(`Cancel today's ${next.course} for every class taking it?`)) void change(next, { status: 'cancelled', note: cancelNote.trim() || undefined }, `${next.course} cancelled for today. Your students have been told.`); }}>
                  Cancel today's class
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {live && <Link to={`${ROUTES.scanner}?course=${encodeURIComponent(next.course)}&slot=${next.id}`} className="btn btn--green btn--sm"><ScanLine size={15} /> Open attendance scan</Link>}
              {next.meetLink && <a href={next.meetLink} target="_blank" rel="noreferrer" className="btn btn--white btn--sm">Open the meeting</a>}
              <Link to={`/lecturer/course/${encodeURIComponent(next.course)}?tab=post`} className="btn btn--ghost-dark btn--sm"><Send size={14} /> Post to students</Link>
            </div>
          </Card>
          {later.length > 0 && (
            <div className="t-13 muted" style={{ marginTop: 8 }}>Later today: {later.map((s) => `${s.course} at ${fmt(timesOf(s).start)}`).join(' · ')}</div>
          )}
        </div>
      )}

      {!profile.department && (
        <Link to="/lecturer/welcome" style={{ margin: '0 16px 12px', display: 'block', background: 'var(--u-warn-tint)', border: '1px solid var(--u-amber)', borderRadius: 12, padding: 14, color: 'var(--text)', textDecoration: 'none' }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Finish setting up</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>Your title, department and the courses you teach. Two minutes.</span>
        </Link>
      )}

      {!hasPhoto && (
        <Link to={ROUTES.me} style={{ margin: '0 16px 12px', display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, color: 'var(--text)', textDecoration: 'none' }}>
          <Camera size={18} color="var(--u-good)" />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Help students recognise you</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>Add a photo, a short bio and how to reach you</span>
          </span>
          <ChevronRight size={18} color="var(--u-good)" />
        </Link>
      )}

      <div style={{ margin: '16px 16px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800, flex: 1 }}>Your courses</h2>
        <Link to="/lecturer/welcome?step=courses" style={{ fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none' }}>+ Add a course</Link>
      </div>
      {/* One level at a time: tap a level to see its course cards. */}
      {levels.length > 1 && (
        <div role="tablist" aria-label="Levels" style={{ display: 'flex', gap: 6, margin: '10px 16px 0', overflowX: 'auto' }}>
          {levels.map((l) => (
            <button key={l} role="tab" aria-selected={open === l} className={`chip chip--sm${open === l ? ' chip--on' : ''}`} onClick={() => setTab(l)}>
              {l.replace(' Level', 'L')} · {byLevel[l].length}
            </button>
          ))}
        </div>
      )}
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {courses === null && <div style={{ margin: '-12px -16px' }}><CourseCardSkeletons rows={3} /></div>}
        {courses && courses.length === 0 && (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="peeking" width={90} />
            <div className="t-15 w-6">No courses yet</div>
            <div className="t-13 muted">Add the courses you teach, from any department and level.</div>
            <Link to="/lecturer/welcome?step=courses" className="btn btn--amber btn--block">Add your courses</Link>
          </Card>
        )}
        {open && (byLevel[open] || []).map((code) => {
          const [dept, num] = code.includes(' ') ? [code.split(' ')[0], code.split(' ').slice(1).join(' ')] : [code.replace(/\d.*$/, ''), code.replace(/^\D+/, '')];
          const n = students[code];
          const waiting = !!claims[code]?.waiting;
          return (
            <Link key={code} to={`/lecturer/course/${encodeURIComponent(code)}`} className="card rise" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, textDecoration: 'none', color: 'var(--text)', border: waiting ? '1.5px dashed var(--u-amber)' : undefined }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: waiting ? 'var(--surface2)' : 'var(--u-black)', color: waiting ? 'var(--text3)' : 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{dept}</span>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 17, lineHeight: 1 }}>{num}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{info(code)?.title || code}</span>
                <span style={{ display: 'block', fontSize: 12, color: waiting ? 'var(--u-warn-ink)' : 'var(--text2)', fontWeight: waiting ? 700 : 400 }}>
                  {waiting ? 'Waiting for Head of Class' : [n != null ? `${n} student${n === 1 ? '' : 's'}` : code, claims[code]?.confirmed ? `confirmed by ${claims[code].confirmed} class${claims[code].confirmed === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight size={18} color="var(--text3)" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
