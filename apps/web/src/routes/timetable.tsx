import { SectionSkeleton } from '../components/Skeletons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ClassSlot } from '../lib/api';
import { supabaseBrowser } from '../lib/supabase';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import ErrorState from '../components/ErrorState';
import Drop from '../components/Drop';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Chip, Chips, Label, Display } from '../components/redesign/ui';
import { DayGrid, TodayCard, WeekGrid, timesOf, type SlotState } from '../components/TimetableGrid';

// Timetable tab (student): this week's classes across every enrolled
// course, one day at a time. Lecturers set slots under My classes; the
// slots repeat weekly, so there is no date arithmetic here.
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // week starts Monday

const toMin = (hhmm: string) => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const VIEW_KEY = 'unify:timetable-view';

export default function TimetableRoute() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState(new Date().getDay());
  const today = new Date().getDay();
  // Class reps set the class times (review p.5-6).
  const [isHoc, setIsHoc] = useState(false);
  const [adding, setAdding] = useState(false);
  // Day: the time grid for one day. Week: every day side by side (remembered).
  const [view, setView] = useState<'day' | 'week'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'day'; } catch { return 'day'; } });
  const pickView = (v: 'day' | 'week') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* fine */ } };

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error('no client');
      const me = await api.me();
      setIsHoc(!!(me.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc);
      const enrolled = (me.courses || []).map((c) => (c || '').toUpperCase().trim()).filter(Boolean);
      setCourses(enrolled);
      // One course failing must not blank the whole week.
      const settled = await Promise.allSettled(enrolled.map((c) => api.timetable(c)));
      setSlots(settled.flatMap((r) => (r.status === 'fulfilled' ? r.value.slots || [] : [])));
      if (settled.length && settled.every((r) => r.status === 'rejected')) throw new Error('timetable');
    } catch (e) {
      errorToast(e, 'load your timetable');
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const countByDay = useMemo(() => {
    const m: Record<number, number> = {};
    for (const s of slots) m[s.day] = (m[s.day] || 0) + 1;
    return m;
  }, [slots]);

  const daySlots = useMemo(
    () => slots.filter((s) => s.day === day).sort((a, b) => toMin(timesOf(a).start) - toMin(timesOf(b).start)),
    [slots, day]
  );

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  // Now / next / done for today's classes (a moved class counts at its new time;
  // a cancelled one is never "next").
  const state = (s: ClassSlot): SlotState => {
    if (s.day !== today) return 'later';
    const t = timesOf(s);
    if (nowMin >= toMin(t.end)) return 'done';
    if (nowMin >= toMin(t.start)) return 'now';
    const upcoming = slots
      .filter((x) => x.day === today && x.change?.status !== 'cancelled' && nowMin < toMin(timesOf(x).start))
      .sort((a, b) => toMin(timesOf(a).start) - toMin(timesOf(b).start));
    return upcoming[0]?.id === s.id ? 'next' : 'later';
  };
  // Today's call to action: the class on now, else the next one.
  const todayLive = slots.filter((s) => s.day === today && s.change?.status !== 'cancelled');
  const spotlight = todayLive.find((s) => state(s) === 'now') || todayLive.find((s) => state(s) === 'next');
  const open = (s: ClassSlot) => navigate(`/timetable/class/${encodeURIComponent(s.course)}/${s.id}`);
  const join = (s: ClassSlot) => {
    if (!s.meetLink) return;
    window.open(s.meetLink, '_blank', 'noopener');
    // The meeting opens in its own tab; this tab goes to the pass, ready for the attendance code.
    window.setTimeout(() => navigate(`/attendance/pass?online=1&course=${encodeURIComponent(s.course)}&m=${encodeURIComponent(s.meetLink || '')}`), 300);
  };
  const remove = (s: ClassSlot) => {
    if (window.confirm(`Remove ${s.course} on ${DAY_LONG[s.day]} at ${s.start} for the whole class?`)) void api.slotDelete(s.id).then(load).catch((e) => errorToast(e, 'remove that class time'));
  };
  // Week view columns: Monday to Friday, plus a weekend day that has classes.
  const weekDays = ORDER.filter((d) => (d >= 1 && d <= 5) || countByDay[d]);

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;

  if (failed) return <div style={shell}><ErrorState message="We couldn’t load your timetable." onRetry={() => void load()} /></div>;

  return (
    <div style={shell}>
      {/* Box Boy stays on the timetable whether or not there are classes. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Label>This week</Label>
          <Display size={30}>Timetable</Display>
          <div role="tablist" aria-label="Timetable view" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(['day', 'week'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} className={`chip chip--sm${view === v ? ' chip--on' : ''}`} onClick={() => pickView(v)}>
                {v === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>
        </div>
        <BoxBoy pose={spotlight ? 'teaching' : 'readingStanding'} width={72} style={{ flexShrink: 0 }} />
      </div>

      {!loading && spotlight && <TodayCard slot={spotlight} state={state(spotlight)} nowMin={nowMin} onOpen={() => open(spotlight)} onJoin={() => join(spotlight)} />}

      {view === 'day' && (
        <div style={{ margin: '16px -16px 0', padding: '0 16px', overflowX: 'auto' }}>
          <Chips>
            {ORDER.map((d) => (
              <Chip key={d} on={d === day} onClick={() => setDay(d)}>
                {DAY_SHORT[d]}
                {countByDay[d] ? ` · ${countByDay[d]}` : ''}
              </Chip>
            ))}
          </Chips>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <SectionSkeleton rows={3} />
        ) : courses.length === 0 ? (
          <>
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="peeking" width={110} />
            <div className="t-15 w-6">No courses yet</div>
            <div className="t-13 muted">Join your courses and their class times show up here.</div>
            <Link to={ROUTES.findCourses} className="btn btn--amber">Manage courses</Link>
          </Card>
          <EmptyDay label={DAY_LONG[day]} nowMin={day === today ? nowMin : null} />
          </>
        ) : view === 'week' && slots.length > 0 ? (
          <WeekGrid slots={slots} days={weekDays} today={today} nowMin={nowMin} labels={DAY_SHORT} onPickDay={(d) => { setDay(d); pickView('day'); }} />
        ) : daySlots.length === 0 ? (
          <>
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="chairRelax" width={120} />
            <div className="t-15 w-6">{isHoc && slots.length === 0 ? 'You haven’t added this week’s classes yet' : `No classes on ${DAY_LONG[day]}`}</div>
            <div className="t-13 muted">
              {isHoc && slots.length === 0
                ? 'Add your class times once; they repeat every week for the whole class.'
                : slots.length === 0
                  ? 'Your class rep hasn’t posted times yet. They’ll appear here once they do.'
                  : 'Enjoy the free day, or pick another day above.'}
            </div>
            {isHoc && slots.length === 0 && <button className="btn btn--amber" onClick={() => setAdding(true)}>Add class times</button>}
          </Card>
          <EmptyDay label={DAY_LONG[day]} nowMin={day === today ? nowMin : null} />
          </>
        ) : (
          <DayGrid
            slots={daySlots}
            stateOf={state}
            nowMin={day === today ? nowMin : null}
            isHoc={isHoc}
            onOpen={open}
            onRemove={remove}
            onJoin={join}
          />
        )}
      </div>

      {isHoc && courses.length > 0 && (
        adding ? (
          <AddClassTime courses={courses} day={day} onDone={() => { setAdding(false); void load(); }} onCancel={() => setAdding(false)} />
        ) : (
          slots.length > 0 && <button className="btn btn--white btn--block" style={{ marginTop: 14 }} onClick={() => setAdding(true)}>Add a class time</button>
        )
      )}
    </div>
  );
}

// Class rep: add a weekly class time for one of the class's courses.
function AddClassTime({ courses, day, onDone, onCancel }: { courses: string[]; day: number; onDone: () => void; onCancel: () => void }) {
  const [course, setCourse] = useState(courses[0] || '');
  const [d, setD] = useState(day);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [busy, setBusy] = useState(false);
  const field: React.CSSProperties = { width: '100%', padding: 10, marginTop: 4, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 };
  const save = async () => {
    if (end <= start) {
      errorToast(new Error('The class must end after it starts.'), 'add that class time');
      return;
    }
    setBusy(true);
    try {
      await api.slotAdd({ course, day: d, start, end, venue: venue.trim() });
      toastSuccess(`${course} added on ${DAY_LONG[d]} at ${start}. The class sees it now.`);
      onDone();
    } catch (e) {
      errorToast(e, 'add that class time');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginTop: 14, gap: 10 }}>
      <div className="t-15 w-7">Add a class time</div>
      <div className="t-13 muted">It repeats every week and shows on everyone's timetable.</div>
      <Drop value={course} onChange={setCourse} label="Course" options={courses.map((c) => ({ value: c, label: c }))} style={{ width: '100%' }} />
      <Drop value={String(d)} onChange={(v) => setD(Number(v))} label="Day" options={ORDER.map((x) => ({ value: String(x), label: DAY_LONG[x] }))} style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="t-13 w-6" style={{ flex: 1 }}>Starts<input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={field} /></label>
        <label className="t-13 w-6" style={{ flex: 1 }}>Ends<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={field} /></label>
      </div>
      <label className="t-13 w-6">Venue (optional)<input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. LT 2" maxLength={120} style={field} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn--amber" disabled={busy || !course} onClick={() => void save()}>{busy ? 'Adding…' : 'Add'}</button>
        <button className="btn btn--white" onClick={onCancel}>Cancel</button>
      </div>
    </Card>
  );
}

// A day with nothing on it still shows as a day: the hours from 8am to 6pm,
// with a line at the current time when it's today.
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
function EmptyDay({ label, nowMin }: { label: string; nowMin: number | null }) {
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i);
  const rowH = 36;
  const showNow = nowMin != null && nowMin >= DAY_START && nowMin <= DAY_END;
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  return (
    <div aria-label={`${label}: no classes scheduled`} style={{ position: 'relative', marginTop: 12, padding: '6px 12px 6px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
      {hours.map((h) => (
        <div key={h} style={{ display: 'flex', alignItems: 'flex-start', height: h === hours[hours.length - 1] ? 14 : rowH }}>
          <span style={{ width: 48, flex: 'none', textAlign: 'right', paddingRight: 8, fontSize: 11, fontWeight: 700, color: 'var(--text3)', lineHeight: '12px', transform: 'translateY(-1px)' }}>{fmt(h)}</span>
          <span style={{ flex: 1, borderTop: '1px dashed var(--border)', marginTop: 6 }} />
        </div>
      ))}
      {showNow && (
        <div aria-hidden="true" style={{ position: 'absolute', left: 44, right: 12, top: 6 + 6 + ((nowMin! - DAY_START) / 60) * rowH, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--u-red)' }} />
          <span style={{ flex: 1, height: 2, background: 'var(--u-red)' }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ padding: '6px 12px', borderRadius: 9999, background: 'var(--u-card-2)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Nothing scheduled</span>
      </div>
    </div>
  );
}
