import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { api } from '../lib/api';
import type { UnifyNote } from '../types/note';
import { TopicSlice } from '../components/TopicSlice';
import { useProgress } from '../hooks/useProgress';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';

export default function LearnPage() {
  const { courseCode = 'MEE 352', week: weekParam } = useParams();
  const navigate = useNavigate();
  const weekNum = Number(weekParam) || 1;
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { toggle, isDone } = useProgress(decodeURIComponent(courseCode).toUpperCase(), weekNum);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.week(decodeURIComponent(courseCode), weekNum);
        const note = data.note_json as UnifyNote;
        setNote(note && Array.isArray(note.topics) ? note : null);
      } catch {
        setLoadError("Couldn't load this week. Check your connection and retry.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseCode, weekNum]);

  if (loading) return <Loading text={`Loading Week ${weekNum}`} />;
  if (loadError)
    return (
      <div style={{ padding: 40, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Mascot size={110} />
        </div>
        <Flash
          tone="error"
          message={loadError}
          ttl={0}
          action={
            <button onClick={() => window.location.reload()} style={{ padding: '8px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13 }}>
              Retry
            </button>
          }
        />
      </div>
    );
  if (!note)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#777' }}>
        <Mascot size={110} />
        <div style={{ marginTop: 12 }}>No content for {courseCode} Week {weekNum} yet.</div>
      </div>
    );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', color: '#777', fontSize: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div className="hero" style={{ background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
          {note.course} · Week {note.week}
        </div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24, margin: '8px 0' }}>{note.title}</h1>
        <p style={{ fontSize: 14, color: '#777' }}>{note.subtitle}</p>
      </div>
      {note.topics.map((t, idx) => (
        <div key={t.number} style={{ marginBottom: 32 }}>
          <TopicSlice topic={t} />
          <button
            onClick={() => toggle(weekNum, idx)}
            style={{
              marginTop: 12,
              padding: '10px 18px',
              borderRadius: 9999,
              background: isDone(weekNum, idx) ? '#059669' : '#fff',
              color: isDone(weekNum, idx) ? '#fff' : '#3c3c3c',
              border: `1px solid ${isDone(weekNum, idx) ? '#059669' : '#e5e5e5'}`,
              cursor: 'pointer',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              fontWeight: 600,
            }}
          >
            <Check size={16} /> {isDone(weekNum, idx) ? 'Completed' : 'Mark Topic Complete'}
          </button>
        </div>
      ))}
    </div>
  );
}
