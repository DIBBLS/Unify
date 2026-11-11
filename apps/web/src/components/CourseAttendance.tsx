import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api, type CourseAttendance as Data } from '../lib/api';
import { ROUTES } from '../lib/routes';

// Attendance on the course page (review p.5-6, p.10):
// - students: "Came to 3 of 4 classes held" and each week 1-12 at a glance;
// - the class rep / lecturer: Take attendance for this week's class on the
//   timetable (or an Extra class), and every register so far.
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CourseAttendance({ course, totalWeeks = 12, currentWeek = 0 }: { course: string; totalWeeks?: number; currentWeek?: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let gone = false;
    api.attendanceCourse(course).then((d) => { if (!gone) setData(d); }).catch(() => {});
    return () => { gone = true; };
  }, [course]);
  if (!data) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: 1 }}>ATTENDANCE</div>
      {data.canTake && <TakeAttendance data={data} course={course} totalWeeks={totalWeeks} currentWeek={currentWeek} />}
      <Mine data={data} totalWeeks={totalWeeks} currentWeek={currentWeek} canTake={data.canTake} />
      {data.canTake && data.registers.length > 0 && <Registers data={data} course={course} />}
    </section>
  );
}

const box: React.CSSProperties = { marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };

function Mine({ data, totalWeeks, currentWeek, canTake }: { data: Data; totalWeeks: number; currentWeek: number; canTake: boolean }) {
  const byWeek = new Map(data.mine.weeks.map((w) => [w.week, w]));
  // A class rep who hasn't been marked anywhere doesn't need their own row.
  if (canTake && data.mine.held > 0 && data.mine.attended === 0) return null;
  const other = byWeek.get(0);
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>
        {data.mine.held === 0 ? 'No classes marked yet' : `Came to ${data.mine.attended} of ${data.mine.held} class${data.mine.held === 1 ? '' : 'es'} held`}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
        {data.mine.held === 0 ? 'When your class rep or lecturer takes attendance, it shows here week by week.' : 'Week by week this semester'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6, marginTop: 10 }}>
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
          const r = byWeek.get(w);
          const full = r && r.held > 0 && r.attended === r.held;
          const none = r && r.held > 0 && r.attended === 0;
          return (
            <div
              key={w}
              title={r ? `Week ${w}: came to ${r.attended} of ${r.held}` : `Week ${w}: no classes marked`}
              style={{
                textAlign: 'center', padding: '6px 2px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                border: `1px solid ${w === currentWeek ? 'var(--text)' : 'var(--border)'}`,
                background: full ? 'var(--u-good-tint)' : none ? 'var(--u-bad-tint, #fee2e2)' : r ? 'var(--u-warn-tint, #fef3c7)' : 'transparent',
                color: r ? 'var(--text)' : 'var(--text3)',
              }}
            >
              <div>W{w}</div>
              <div style={{ fontSize: 12 }}>{r ? `${r.attended}/${r.held}` : '–'}</div>
            </div>
          );
        })}
      </div>
      {other && other.held > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Plus {other.attended} of {other.held} classes not tied to a week.</div>
      )}
    </div>
  );
}

function TakeAttendance({ data, course, totalWeeks, currentWeek }: { data: Data; course: string; totalWeeks: number; currentWeek: number }) {
  const navigate = useNavigate();
  const latest = useMemo(() => Math.max(0, ...data.registers.map((r) => r.week || 0)), [data.registers]);
  const [week, setWeek] = useState(currentWeek || latest || 1);
  const today = new Date().getDay();
  const todays = data.slots.filter((s) => s.day === today);
  const [which, setWhich] = useState<string>(todays[0]?.id || data.slots[0]?.id || 'extra');
  const live = data.registers.find((r) => r.open);

  const go = () => {
    const p = new URLSearchParams({ course, week: String(week) });
    if (which === 'extra') p.set('extra', '1');
    else p.set('slot', which);
    navigate(`${ROUTES.scanner}?${p.toString()}`);
  };

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>Take attendance</div>
      {live ? (
        <Link to={`${ROUTES.scanner}?course=${encodeURIComponent(course)}`} className="btn btn--amber btn--block">
          A register is open{live.label ? ` (${live.label})` : ''}: continue scanning
        </Link>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Week
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
              {Array.from({ length: Math.max(totalWeeks, latest) }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}{w === currentWeek ? ' (this week)' : ''}</option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Which class" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.slots.map((s) => (
              <button key={s.id} role="radio" aria-checked={which === s.id} className={`chip chip--sm${which === s.id ? ' chip--on' : ''}`} onClick={() => setWhich(s.id)}>
                {DAY[s.day]} {s.start}–{s.end}{s.day === today ? ' · today' : ''}
              </button>
            ))}
            <button role="radio" aria-checked={which === 'extra'} className={`chip chip--sm${which === 'extra' ? ' chip--on' : ''}`} onClick={() => setWhich('extra')}>
              Extra class
            </button>
          </div>
          {data.slots.length === 0 && <div style={{ fontSize: 12, color: 'var(--text2)' }}>No class times on the timetable for {course} yet, so this is an extra class. Add class times from the Timetable.</div>}
          <button className="btn btn--amber btn--block" onClick={go}>Take attendance</button>
        </>
      )}
    </div>
  );
}

function Registers({ data, course }: { data: Data; course: string }) {
  const [open, setOpen] = useState(false);
  const rows = open ? data.registers : data.registers.slice(0, 4);
  return (
    <div style={{ ...box, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 4px', fontWeight: 800, fontSize: 15 }}>Registers</div>
      {rows.map((r) => (
        <Link
          key={r.id}
          to={`${ROUTES.scanner}?course=${encodeURIComponent(course)}&session=${r.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>
              {r.week ? `Week ${r.week}` : 'No week'}{r.label ? ` · ${r.label}` : ''}{r.open ? ' · open now' : ''}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {new Date(r.opensAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {r.present} present{data.listed != null ? ` of ${data.listed}` : ''}
            </span>
          </span>
          <ChevronRight size={16} color="var(--u-good)" />
        </Link>
      ))}
      {data.registers.length > 4 && (
        <button onClick={() => setOpen((v) => !v)} style={{ width: '100%', padding: 10, borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--u-good)', background: 'transparent' }}>
          {open ? 'Show fewer' : `Show all ${data.registers.length}`}
        </button>
      )}
    </div>
  );
}
