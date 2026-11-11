import { SectionSkeleton } from '../components/Skeletons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarCheck, ChevronRight, ClipboardCheck, Megaphone, MapPin, Video } from 'lucide-react';
import { api, type ClassSlot } from '../lib/api';
import { supabaseBrowser } from '../lib/supabase';
import { errorToast } from '../lib/errors';
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

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error('no client');
      const me = await api.me();
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

  if (failed) return <div style={shell}><ErrorState message="We couldn2019t load your timetable." onRetry={() => void load()} /></div>;

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
            <div className="t-15 w-6">No classes on {DAY_LONG[day]}</div>
            <div className="t-13 muted">
              {slots.length === 0
                ? 'Your class rep hasn’t posted times yet. They’ll appear here once they do.'
                : 'Enjoy the free day, or pick another day above.'}
            </div>
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

      <ListCard style={{ marginTop: 16 }}>
        <Link to={ROUTES.attendancePass} className="row" style={{ gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
          <ClipboardCheck size={20} />
          <div className="grow stack" style={{ gap: 2 }}>
            <div className="t-15 w-6">My pass</div>
            <div className="t-13 muted">Show your QR to your class rep or lecturer</div>
          </div>
          <ChevronRight size={18} />
        </Link>
        <Link to={ROUTES.attendanceMine} className="row" style={{ gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
          <CalendarCheck size={20} />
          <div className="grow stack" style={{ gap: 2 }}>
            <div className="t-15 w-6">My attendance</div>
            <div className="t-13 muted">Attended vs held, per course</div>
          </div>
          <ChevronRight size={18} />
        </Link>
        <Link to={ROUTES.hoc} className="row" style={{ gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
          <Megaphone size={20} />
          <div className="grow stack" style={{ gap: 2 }}>
            <div className="t-15 w-6">Class board</div>
            <div className="t-13 muted">Announcements and tips from your HOC</div>
          </div>
          <ChevronRight size={18} />
        </Link>
      </ListCard>

      {courses.length > 0 && (
        <Link
          to={ROUTES.courses}
          className="card"
          style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'var(--u-text)' }}
        >
          <BookOpen size={20} />
          <div style={{ flex: 1 }}>
            <div className="t-15 w-6">My courses</div>
            <div className="t-13 muted">{courses.length} enrolled · open notes and quizzes</div>
          </div>
          <ChevronRight size={18} />
        </Link>
      )}
    </div>
  );
}
