import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { api } from '../lib/api';

type WeekRow = { week: number; title: string; subtitle: string };

export default function CourseDetailRoute() {
  const { code = 'MEE 352' } = useParams();
  const courseCode = decodeURIComponent(code);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.courseWeeks(courseCode);
        setWeeks(res.weeks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load weeks.');
      } finally {
        setLoading(false);
      }
    })();
  }, [courseCode]);

  if (loading) return <Loading text={`Loading ${courseCode}…`} />;

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
