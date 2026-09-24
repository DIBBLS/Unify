import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';

type MyCourse = { code: string; title: string; weeks: number };

// My Courses: only courses this student enrolled in. Browsing + joining
// new ones lives under Explore (/explore).
export default function CoursePage() {
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const enrolled = (me.courses || []).map((c) => c.toUpperCase());
        let titles: Record<string, string> = {};
        try {
          const list = await api.courses();
          titles = Object.fromEntries(list.map((c) => [c.code.toUpperCase(), c.title]));
        } catch {
          // titles fall back to codes
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

  if (loading) return <Loading text="Loading your courses…" />;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>My Courses</h1>
      <p style={{ color: '#777', marginTop: 6, fontSize: 13 }}>
        Your enrolled courses — open one to keep learning
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <Link to="/explore" style={{ marginTop: 12, padding: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: '#065f46', fontWeight: 700, fontSize: 14 }}>
        <Search size={18} /> Explore courses to enroll
      </Link>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No enrolled courses yet.</div>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
              Explore courses
            </Link>
          </div>
        )}
        {courses.map((c) => (
          <Link
            key={c.code}
            to={`/course/${encodeURIComponent(c.code)}`}
            style={{
              padding: '14px 16px',
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              textDecoration: 'none',
              color: '#3c3c3c',
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
              <span style={{ fontSize: 12, color: '#777' }}>{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
            </span>
            <ChevronRight size={18} color="#059669" />
          </Link>
        ))}
      </div>
    </div>
  );
}
