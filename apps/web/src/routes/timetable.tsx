import { SectionSkeleton } from '../components/Skeletons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Video, X } from 'lucide-react';
import { api, type ClassSlot } from '../lib/api';
import { supabaseBrowser } from '../lib/supabase';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import ErrorState from '../components/ErrorState';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Chip, Chips, Label, ListCard, ListRow, Pill, Display } from '../components/redesign/ui';

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
    () => slots.filter((s) => s.day === day).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [slots, day]
  );

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const state = (s: ClassSlot): 'now' | 'next' | 'done' | 'later' => {
    if (day !== today) return 'later';
    if (nowMin >= toMin(s.end)) return 'done';
    if (nowMin >= toMin(s.start)) return 'now';
    return daySlots.find((x) => nowMin < toMin(x.start))?.id === s.id ? 'next' : 'later';
  };

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;

  if (failed) return <div style={shell}><ErrorState message="We couldn’t load your timetable." onRetry={() => void load()} /></div>;

  return (
    <div style={shell}>
      <Label>This week</Label>
      <Display size={30}>Timetable</Display>

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

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <SectionSkeleton rows={3} />
        ) : courses.length === 0 ? (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="peeking" width={110} />
            <div className="t-15 w-6">No courses yet</div>
            <div className="t-13 muted">Join your courses and their class times show up here.</div>
            <Link to={ROUTES.findCourses} className="btn btn--amber">Manage courses</Link>
          </Card>
        ) : daySlots.length === 0 ? (
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
        ) : (
          <ListCard>
            {daySlots.map((s) => {
              const st = state(s);
              return (
                <ListRow
                  key={s.id}
                  title={<span style={{ opacity: st === 'done' ? 0.5 : 1 }}>{s.course}</span>}
                  sub={
                    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{s.start}–{s.end}</span>
                      {s.venue && (
                        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                          <MapPin size={12} /> {s.venue}
                        </span>
                      )}
                      {s.lecturer && <span>{s.lecturer}</span>}
                    </span>
                  }
                  right={
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {st === 'now' ? <Pill tone="good">Now</Pill> : st === 'next' ? <Pill tone="amber">Next</Pill> : null}
                      {isHoc && (
                        <button
                          aria-label={`Remove ${s.course} ${DAY_SHORT[s.day]} ${s.start}`}
                          onClick={() => { if (window.confirm(`Remove ${s.course} on ${DAY_LONG[s.day]} at ${s.start} for the whole class?`)) void api.slotDelete(s.id).then(load).catch((e) => errorToast(e, 'remove that class time')); }}
                          style={{ display: 'flex', padding: 4, color: 'var(--text3)' }}
                        >
                          <X size={16} />
                        </button>
                      )}
                      {s.meetLink && (
                        <a
                          href={s.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--amber btn--sm"
                          style={{ gap: 6 }}
                          onClick={() => {
                            // The meeting opens in its own tab; this tab stays on Unify, ready for the attendance code.
                            window.setTimeout(() => navigate(`/attendance/pass?online=1&course=${encodeURIComponent(s.course)}&m=${encodeURIComponent(s.meetLink || '')}`), 300);
                          }}
                        >
                          <Video size={14} /> Join
                        </a>
                      )}
                    </span>
                  }
                />
              );
            })}
          </ListCard>
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
      <label className="t-13 w-6">Course
        <select value={course} onChange={(e) => setCourse(e.target.value)} style={field}>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="t-13 w-6">Day
        <select value={d} onChange={(e) => setD(Number(e.target.value))} style={field}>
          {ORDER.map((x) => <option key={x} value={x}>{DAY_LONG[x]}</option>)}
        </select>
      </label>
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
