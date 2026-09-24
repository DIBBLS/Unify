import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';

type CatalogCourse = { code: string; title: string; weeks: number; levels: string[]; semesters: string[] };

export default function CoursePage() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [myLevel, setMyLevel] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSem, setFilterSem] = useState('');
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
        if (me.profile?.level) {
          setMyLevel(me.profile.level);
          setFilterLevel(me.profile.level);
        }
        const list = await api.courses();
        const withWeeks = await Promise.all(
          list.map(async (c) => {
            try {
              const w = await api.courseWeeks(c.code);
              return { code: c.code, title: c.title, weeks: w.weeks.length, levels: c.levels || [], semesters: c.semesters || [] };
            } catch {
              return { code: c.code, title: c.title, weeks: 0, levels: c.levels || [], semesters: c.semesters || [] };
            }
          })
        );
        setCourses(withWeeks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load courses.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading text="Loading courses…" />;

  const levelsAvailable = [...new Set(courses.flatMap((c) => c.levels))].sort();
  const shown = courses.filter(
    (c) =>
      (!filterLevel || c.levels.includes(filterLevel)) &&
      (!filterSem || c.semesters.includes(filterSem))
  );
  const pill = (active: boolean) => ({
    padding: '8px 14px',
    borderRadius: 9999,
    border: `1px solid ${active ? '#059669' : '#e5e5e5'}`,
    background: active ? '#10b981' : '#fff',
    color: active ? '#fff' : '#777',
    fontSize: 12,
    fontWeight: 700,
  });

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>Unify Learn</h1>
      <p style={{ color: '#777', marginTop: 6, fontSize: 13 }}>
        Guided paths, quizzes and XP{myLevel ? ` · ${myLevel}` : ''}
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {levelsAvailable.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={() => setFilterLevel('')} style={pill(!filterLevel)}>All levels</button>
          {levelsAvailable.map((l) => (
            <button key={l} onClick={() => setFilterLevel(l)} style={pill(filterLevel === l)}>
              {l.replace(' Level', '')}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {['', 'First Semester', 'Second Semester'].map((s) => (
          <button key={s || 'all'} onClick={() => setFilterSem(s)} style={{ ...pill(filterSem === s), flex: 1 }}>
            {s ? s.replace(' Semester', '') : 'Both semesters'}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses for this level yet. Check back soon.</div>
          </div>
        )}
        {shown.map((c) => (
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
