import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { api } from '../lib/api';
import { log } from '../lib/log';

type WeekRow = { week: number; title: string; subtitle: string };

export default function CourseDetailRoute() {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  // React Router already URL-decodes params — never decode again here
  // (a stray % once crashed this screen). Trimmed for lookups, but the
  // empty-guard tests the RAW param: a whitespace code is "present but
  // unenrolled" (blocked screen with enroll button), not "nothing selected".
  const courseCode = (code || '').trim();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Weeks + profile load in parallel: a flaky profile check (cold
        // start) must never hide the weeks. The enrolled-only gate applies
        // only when the check succeeds (authors in ?preview=1 pass through).
        const preview = searchParams.get('preview') === '1';
        const [me, res] = await Promise.all([
          api.me().catch(() => null),
          api.courseWeeks(courseCode),
        ]);
        if (me && !preview) {
          const role = me.profile?.role || 'student';
          const enrolled = (me.courses || []).map((c) => c.toUpperCase().trim()).includes(courseCode.toUpperCase());
          if ((role === 'student' || !role) && !enrolled) {
            setBlocked(true);
            setLoading(false);
            return;
          }
        }
        setWeeks(res.weeks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load weeks.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode]);

  const enrollHere = async () => {
    setEnrolling(true);
    setError('');
    try {
      await api.enroll(courseCode, true);
      setBlocked(false);
      const res = await api.courseWeeks(courseCode);
      setWeeks(res.weeks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) return <Loading text={courseCode ? `Loading ${courseCode}…` : 'Loading…'} />;
  if (!code) {
    // Unreachable via router links (course code is always present), but if
    // it ever happens, send the student to their courses instead of a
    // dead-end message. Logged so a recurrence leaves a trace.
    log.warn('route', `course detail with empty code (url=${window.location.href})`);
    return <Navigate to="/course" replace />;
  }
  if (blocked)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px', textAlign: 'center' }}>
        <BackButton to="/course" />
        <Mascot size={110} />
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20, marginTop: 12 }}>You're not enrolled in {courseCode}</h1>
        <p style={{ color: '#777', fontSize: 14, margin: '8px 0 20px' }}>Enroll to unlock its weeks, topics and quizzes.</p>
        {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
        <button onClick={enrollHere} disabled={enrolling} style={{ padding: '12px 28px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', fontWeight: 800, fontSize: 14, opacity: enrolling ? 0.6 : 1 }}>
          {enrolling ? 'Enrolling…' : `Enroll in ${courseCode}`}
        </button>
        <div style={{ marginTop: 12 }}>
          <Link to="/explore" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
            or explore other courses
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/course" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>{courseCode}</h1>
      <p style={{ color: '#777', marginTop: 6, fontSize: 13 }}>
        {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'} · pick one to start learning
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weeks.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No weeks published yet.</div>
          </div>
        )}
        {weeks.map((w) => (
          <Link
            key={w.week}
            to={`/learn/${encodeURIComponent(courseCode)}/week/${w.week}`}
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
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, display: 'block' }}>Week {w.week}{w.title ? ` — ${w.title}` : ''}</span>
              {w.subtitle && <span style={{ fontSize: 12, color: '#777' }}>{w.subtitle}</span>}
            </span>
            <ChevronRight size={18} color="#059669" />
          </Link>
        ))}
      </div>
    </div>
  );
}
