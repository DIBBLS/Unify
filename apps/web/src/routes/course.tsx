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
  const [activeSemester, setActiveSemester] = useState('First Semester');
  const [enrolledSet, setEnrolledSet] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
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
        const [me, settings] = await Promise.all([
          api.me(),
          api.settings().catch(() => ({ currentSemester: 'First Semester' })),
        ]);
        if (me.profile?.level) setMyLevel(me.profile.level);
        setEnrolledSet(new Set((me.courses || []).map((c) => c.toUpperCase())));
        if (settings.currentSemester) setActiveSemester(settings.currentSemester);
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

  // Strict scoping: your level + the admin's active semester, nothing else.
  const shown = courses.filter(
    (c) => (!myLevel || c.levels.includes(myLevel)) && c.semesters.includes(activeSemester)
  );

  const toggleEnroll = async (code: string) => {
    const isIn = enrolledSet.has(code.toUpperCase());
    setBusy(code);
    setError('');
    try {
      const res = await api.enroll(code, !isIn);
      setEnrolledSet(new Set((res.enrolled || []).map((c) => c.toUpperCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>Unify Learn</h1>
      <p style={{ color: '#777', marginTop: 6, fontSize: 13 }}>
        Guided paths, quizzes and XP{myLevel ? ` · ${myLevel}` : ''}
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>
        {myLevel || 'Your level'} · {activeSemester}
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses for this level yet. Check back soon.</div>
          </div>
        )}
        {shown.map((c) => {
          const isIn = enrolledSet.has(c.code.toUpperCase());
          return (
            <div
              key={c.code}
              style={{
                padding: '14px 16px',
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <Link
                to={`/course/${encodeURIComponent(c.code)}`}
                style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: '#3c3c3c', minWidth: 0 }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} color="#059669" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{c.code}</span>
                  <span style={{ fontSize: 12, color: '#777' }}>{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
                </span>
                <ChevronRight size={18} color="#059669" />
              </Link>
              <button
                onClick={() => toggleEnroll(c.code)}
                disabled={busy === c.code}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: `1px solid ${isIn ? '#059669' : '#e5e5e5'}`,
                  background: isIn ? '#10b981' : '#fff',
                  color: isIn ? '#fff' : '#059669',
                  fontWeight: 800,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  opacity: busy === c.code ? 0.6 : 1,
                }}
              >
                {busy === c.code ? '…' : isIn ? 'Enrolled ✓' : 'Enroll'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
