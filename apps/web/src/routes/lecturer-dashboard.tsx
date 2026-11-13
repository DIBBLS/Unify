import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronRight, ScanLine, Send } from 'lucide-react';
import { api, type ClassSlot, type Profile } from '../lib/api';
import { ROUTES } from '../lib/routes';
import LiveWire from '../components/LiveWire';
import { SectionSkeleton } from '../components/Skeletons';
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

  useEffect(() => {
    let gone = false;
    (async () => {
      const taught = (await api.teaching().catch(() => ({ courses: [] as string[] }))).courses;
      if (gone) return;
      setCourses(taught);
      const [tt, rosters] = await Promise.all([
        Promise.allSettled(taught.map((c) => api.timetable(c))),
        Promise.allSettled(taught.map((c) => api.roster(c))),
      ]);
      if (gone) return;
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
    .filter((s) => s.day === new Date().getDay() && s.change?.status !== 'cancelled')
    .sort((a, b) => toMin(timesOf(a).start) - toMin(timesOf(b).start));
  const live = today.find((s) => nowMin >= toMin(timesOf(s).start) - 15 && nowMin < toMin(timesOf(s).end));
  const next = live || today.find((s) => nowMin < toMin(timesOf(s).start));
  const later = today.filter((s) => s !== next && nowMin < toMin(timesOf(s).end));

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
            <span className="eyebrow" style={{ color: live ? 'var(--u-green)' : 'var(--u-amber)' }}>
              {live ? `Now · ${fmt(timesOf(next).start)}` : `Today · ${fmt(timesOf(next).start)}`}
            </span>
            <Display size={22} color="#fff">{next.course}{info(next.course)?.title ? ` · ${info(next.course)!.title}` : ''}</Display>
            <span className="t-13" style={{ color: '#aaa' }}>{[timesOf(next).venue, students[next.course] != null ? `${students[next.course]} students` : ''].filter(Boolean).join(' · ')}</span>
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
        {levels.length > 0 && <span className="t-12 muted">{levels.length} level{levels.length === 1 ? '' : 's'}</span>}
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
        {courses === null && <SectionSkeleton rows={2} quote={false} />}
        {courses && courses.length === 0 && (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="peeking" width={90} />
            <div className="t-15 w-6">No courses yet</div>
            <div className="t-13 muted">The Unify team adds the courses you teach. Tell them which from Me → Help, and they'll show up here.</div>
          </Card>
        )}
        {open && (byLevel[open] || []).map((code) => {
          const [dept, num] = code.includes(' ') ? [code.split(' ')[0], code.split(' ').slice(1).join(' ')] : [code.replace(/\d.*$/, ''), code.replace(/^\D+/, '')];
          const n = students[code];
          return (
            <Link key={code} to={`/lecturer/course/${encodeURIComponent(code)}`} className="card rise" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, textDecoration: 'none', color: 'var(--text)' }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--u-black)', color: 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{dept}</span>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 17, lineHeight: 1 }}>{num}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{info(code)?.title || code}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{n != null ? `${n} student${n === 1 ? '' : 's'}` : code}</span>
              </span>
              <ChevronRight size={18} color="var(--text3)" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
