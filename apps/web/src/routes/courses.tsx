import { ListSkeleton } from '../components/Skeletons';
import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import Loading from '../components/Loading';

type MyCourse = { code: string; title: string; weeks: number };

// My Courses: only courses this student enrolled in. Browsing + joining
// new ones lives under Class (/class).
export default function CoursesRoute() {
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [repairing, setRepairing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [success, setSuccess] = useState('');

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
        const enrolled = (me.courses || []).map((c) => (c || '').toUpperCase().trim()).filter(Boolean);
        // Titles + week counts come from the single catalog call — no
        // per-course fan-out.
        let titles: Record<string, string> = {};
        let weekCounts: Record<string, number> = {};
        try {
          const list = await api.courses();
          titles = Object.fromEntries(list.map((c) => [c.code.toUpperCase(), c.title]));
          weekCounts = Object.fromEntries(list.map((c) => [c.code.toUpperCase(), c.weeks || 0]));
        } catch {
          // titles fall back to codes
        }
        // Learning activity outside enrollments (wiped enrollments, legacy
        // progress): offered back as one-tap restore below.
        try {
          const stats = await api.stats();
          const have = new Set(enrolled);
          setActivity(
            (stats.courses || [])
              .map((c) => (c.course || '').toUpperCase().trim())
              .filter((c) => c && !have.has(c))
          );
        } catch {
          // activity notice optional
        }
        const rows = enrolled.map((code) => ({
          code,
          title: titles[code] || code,
          weeks: weekCounts[code] || 0,
        }));
        setCourses(rows);
      } catch (err) {
        setError(describeError(err, 'load courses'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <ListSkeleton titleWidth="45%" />;

  const repair = async () => {
    setRepairing(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.repairEnrollments();
      const titleMap = Object.fromEntries(courses.map((c) => [c.code, c.title]));
      const weekMap = Object.fromEntries(courses.map((c) => [c.code, c.weeks]));
      const rows = (res.enrolled || []).map((code) => {
        const clean = (code || '').toUpperCase().trim();
        return { code: clean, title: titleMap[clean] || clean, weeks: weekMap[clean] || 0 };
      });
      setCourses(rows.filter((c) => c.code));
      setActivity([]);
      setSuccess(
        res.restored > 0
          ? `Restored ${res.restored} course${res.restored === 1 ? '' : 's'} from your learning activity.`
          : 'Nothing to restore — your enrollments already match your activity.'
      );
    } catch (err) {
      setError(describeError(err, 'restore that'));
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/home" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>My Courses</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        Your enrolled courses — open one to keep learning
      </p>
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}
      <Link to="/courses/find" className="card" style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--u-green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Search size={18} color="var(--u-green)" />
        </span>
        <span className="t-14 w-7">Add courses to enroll</span>
      </Link>
      {activity.length > 0 && (
        <div style={{ marginTop: 12, padding: 14, background: 'var(--u-warn-tint)', border: '1px solid #fde68a', borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>You learned in {activity.length} course{activity.length === 1 ? '' : 's'} not on your list</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{activity.join(' · ')}</div>
          <button onClick={repair} disabled={repairing} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', fontWeight: 800, fontSize: 13, opacity: repairing ? 0.6 : 1 }}>
            {repairing ? 'Restoring…' : 'Restore my courses'}
          </button>
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.length === 0 && !error && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <BoxBoy pose="peeking" width={72} />
            <div className="t-15" style={{ marginTop: 12 }}>No enrolled courses yet.</div>
            <Link to="/courses/find" className="btn btn--amber" style={{ marginTop: 12, display: 'inline-block' }}>
              Add courses
            </Link>
          </div>
        )}
        {courses.map((c, i) => (
          <Link
            key={c.code}
            to={`/course/${encodeURIComponent(c.code.trim())}`}
            className="card rise"
            style={{
              animationDelay: `${Math.min(i, 6) * 40}ms`,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--u-green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} color="var(--u-green)" />
            </span>
            <span style={{ flex: 1 }}>
              <span className="t-15 w-7" style={{ display: 'block' }}>{c.code}</span>
              <span className="t-13 muted">{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
            </span>
            <ChevronRight size={18} color="var(--u-green)" />
          </Link>
        ))}
      </div>
    </div>
  );
}

