import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, MapPin, Trash2, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { ClassesSkeleton } from '../components/Skeletons';
import ErrorState from '../components/ErrorState';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import ConfirmModal from '../components/ConfirmModal';
import { supabaseBrowser } from '../lib/supabase';
import { api, type ClassSlot, type RosterStudent } from '../lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Lecturer class management: my teaching courses, each with a recurring
// weekly timetable (set once, repeats every week) and a live roster
// (enrolled students + topics done + quizzes taken + last activity).
// Students read the same slots on their course pages.
export default function ClassesRoute() {
  const [courses, setCourses] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [venue, setVenue] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState<string | null>(null);
  // Admins run the platform from the admin panel + content browser —
  // classes and timetables are the lecturer's room, not theirs.
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        setError('Please sign in again.');
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if ((me.profile?.role || '') === 'admin') {
          setForbidden(true);
          setLoading(false);
          return;
        }
        const t = await api.teaching();
        setCourses(t.courses || []);
        if (t.courses && t.courses.length) setSelected(t.courses[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your classes.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setSlots([]);
      setRoster([]);
      return;
    }
    let cancelled = false;
    setRefreshing(true);
    (async () => {
      try {
        const [tt, rs] = await Promise.all([api.timetable(selected), api.roster(selected)]);
        if (!cancelled) {
          setSlots(tt.slots || []);
          setRoster(rs.students || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load class details.');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const addSlot = async () => {
    if (!selected || adding) return;
    if (end <= start) {
      setError('End time must be after start time.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await api.slotAdd({ course: selected, day, start, end, venue: venue.trim() });
      setVenue('');
      const tt = await api.timetable(selected);
      setSlots(tt.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that slot.');
    } finally {
      setAdding(false);
    }
  };

  const removeSlot = async (id: string) => {
    setError('');
    try {
      await api.slotDelete(id);
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that slot.');
    }
  };

  if (loading) return <ClassesSkeleton />;

  if (forbidden)
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
        <BackButton to="/dashboard" />
        <ErrorState title="Lecturers only" message="Classes and timetables belong to lecturers. Admins oversee the platform from the admin panel and content browser." />
      </div>
    );

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>My Classes</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        Weekly timetable + live roster for every course you teach
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {courses.length === 0 ? (
        <div style={{ marginTop: 16, padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <Mascot size={96} />
          <div style={{ marginTop: 8 }}>No teaching courses assigned yet. Ask an admin to assign your courses.</div>
        </div>
      ) : (
        <>
          <div className="segbar" role="tablist" aria-label="Teaching courses" style={{ marginTop: 12 }}>
            {courses.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={c === selected}
                className={c === selected ? 'current' : ''}
                onClick={() => setSelected(c)}
                style={{ flex: 1 }}
              >
                {c}
              </button>
            ))}
          </div>
          {refreshing && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Refreshing…</div>}
          <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800, marginTop: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
            <CalendarDays size={16} color="#059669" /> Weekly timetable
          </h2>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: 14 }}>
                No class times set. Add the first slot below — students see it on the course page.
              </div>
            )}
            {slots.map((s) => (
              <div key={s.id} style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{DAYS[s.day] || `Day ${s.day}`} · {s.start}–{s.end}</div>
                  {s.venue ? (
                    <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                      <MapPin size={12} /> {s.venue}
                    </div>
                  ) : null}
                </div>
                <button onClick={() => setConfirmSlot(s.id)} aria-label={`Remove ${DAYS[s.day]} ${s.start} slot`} style={{ padding: 8, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: '#991b1b' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>ADD WEEKLY SLOT · {selected}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
                Day
                <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700 }}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
                Start
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 9, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
                End
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 9, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              </label>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
              Venue
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. LT1, Engineering block" style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            </label>
            <button onClick={addSlot} disabled={adding} style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 14, border: 'none', borderBottom: '4px solid #059669', background: '#10b981', color: '#fff', fontWeight: 800, opacity: adding ? 0.6 : 1 }}>
              {adding ? 'Adding…' : 'Add slot'}
            </button>
          </div>
          <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800, marginTop: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Users size={16} color="#059669" /> Roster · {roster.length} student{roster.length === 1 ? '' : 's'}
          </h2>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roster.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: 14 }}>
                No students enrolled yet.
              </div>
            )}
            {roster.map((s) => (
              <div key={s.id} className="cv-row" style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {(s.name || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    <BookOpen size={10} style={{ verticalAlign: -1 }} /> {s.topicsDone} topics · {s.quizzesTaken} quizzes{s.level ? ` · ${s.level}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {confirmSlot && (
        <ConfirmModal
          title="Remove this slot?"
          body="Students stop seeing this class time immediately."
          confirmLabel="Remove"
          onConfirm={() => {
            const id = confirmSlot;
            setConfirmSlot(null);
            void removeSlot(id);
          }}
          onCancel={() => setConfirmSlot(null)}
        />
      )}
    </div>
  );
}
