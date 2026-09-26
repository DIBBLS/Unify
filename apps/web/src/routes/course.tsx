import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import BackButton from '../components/BackButton';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';

type MyCourse = { code: string; title: string; weeks: number };

// My Courses: only courses this student enrolled in. Browsing + joining
// new ones lives under Explore (/explore).
export default function CoursePage() {
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [repairing, setRepairing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        let titles: Record<string, string> = {};
        try {
          const list = await api.courses();
          titles = Object.fromEntries(list.map((c) => [c.code.toUpperCase(), c.title]));
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
        const rows = await Promise.all(
          enrolled.map(async (code) => {
            try {
              const w = await api.courseWeeks(code);
              return { code, title: titles[code] || code, weeks: w.weeks.length };
            } catch {
              return { code, title: titles[code] || code, weeks: 0 };
            }
          })
        );
        setCourses(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load courses.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
        <BackButton to="/dashboard" />
        <div className="skel" style={{ height: 32, width: '50%', marginTop: 4 }} />
        <div className="skel" style={{ height: 14, width: '70%', marginTop: 10 }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="skel" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ height: 16, width: '45%' }} />
                <div className="skel" style={{ height: 12, width: '80%', marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 12 }}>Loading your courses…</div>
      </div>
    );

  const repair = async () => {
    setRepairing(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.repairEnrollments();
      const titleMap = Object.fromEntries(courses.map((c) => [c.code, c.title]));
      const rows = await Promise.all(
        (res.enrolled || []).map(async (code) => {
          const clean = (code || '').toUpperCase().trim();
          try {
            const w = await api.courseWeeks(clean);
            return { code: clean, title: titleMap[clean] || clean, weeks: w.weeks.length };
          } catch {
            return { code: clean, title: titleMap[clean] || clean, weeks: 0 };
          }
        })
      );
      setCourses(rows.filter((c) => c.code));
      setActivity([]);
      setSuccess(
        res.restored > 0
          ? `Restored ${res.restored} course${res.restored === 1 ? '' : 's'} from your learning activity.`
          : 'Nothing to restore — your enrollments already match your activity.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>My Courses</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        Your enrolled courses — open one to keep learning
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}
      <Link to="/explore" style={{ marginTop: 12, padding: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: '#065f46', fontWeight: 700, fontSize: 14 }}>
        <Search size={18} /> Explore courses to enroll
      </Link>
      {activity.length > 0 && (
        <div style={{ marginTop: 12, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>You learned in {activity.length} course{activity.length === 1 ? '' : 's'} not on your list</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{activity.join(' · ')}</div>
          <button onClick={repair} disabled={repairing} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', fontWeight: 800, fontSize: 13, opacity: repairing ? 0.6 : 1 }}>
            {repairing ? 'Restoring…' : 'Restore my courses'}
          </button>
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No enrolled courses yet.</div>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
              Explore courses
            </Link>
          </div>
        )}
        {courses.map((c, i) => (
          <Link
            key={c.code}
            to={`/course/${encodeURIComponent(c.code.trim())}`}
            className="rise"
            style={{
              animationDelay: `${Math.min(i, 6) * 40}ms`,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              textDecoration: 'none',
              color: 'var(--text)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} color="#059669" />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, display: 'block' }}>{c.code}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
            </span>
            <ChevronRight size={18} color="#059669" />
          </Link>
        ))}
      </div>
    </div>
  );
}
