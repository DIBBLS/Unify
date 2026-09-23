import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Download } from 'lucide-react';
import { api } from '../../lib/api';
import type { UnifyNote, Topic } from '../../types/note';
import { TopicSlice } from '../../components/TopicSlice';
import EoqQuiz from '../../components/EoqQuiz';
import { useProgress } from '../../hooks/useProgress';
import Loading from '../../components/Loading';
import Mascot from '../../components/Mascot';
import Flash from '../../components/Flash';

export default function LearnPage() {
  const { courseCode = 'MEE 352', week: weekParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekNum = Number(weekParam) || 1;
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { toggle, isDone } = useProgress(decodeURIComponent(courseCode).toUpperCase(), weekNum);
  const [tab, setTab] = useState(0);
  const topics = note?.topics ?? [];
  const hasQuiz = (note?.eoq?.questions?.length || 0) > 0;
  const tabCount = topics.length + (hasQuiz ? 1 : 0);

  useEffect(() => {
    if (!note) return;
    const t = Math.min(Math.max(Number(searchParams.get('t')) || 0, 0), Math.max(tabCount - 1, 0));
    setTab((cur) => (cur === t ? cur : t));
  }, [note, searchParams, tabCount]);

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

  const goTab = (t: number) => {
    const clamped = Math.min(Math.max(t, 0), tabCount - 1);
    setTab(clamped);
    setSearchParams(clamped ? { t: String(clamped) } : {}, { replace: true });
  };

  return (
    <div className="screen-only" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
      <button onClick={() => navigate('/course')} style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', color: '#777', fontSize: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => window.print()} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#059669' }}>
          <Download size={14} /> Save PDF
        </button>
      </div>
      <div className="hero" style={{ background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
          {note.course} · Week {note.week}
        </div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24, margin: '8px 0' }}>{note.title}</h1>
        <p style={{ fontSize: 14, color: '#777' }}>{note.subtitle}</p>
        {note.learningOutcome && <p style={{ fontSize: 13, color: '#3c3c3c', marginTop: 10 }}>{note.learningOutcome}</p>}
        {(note.metaChips?.length || 0) > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {note.metaChips.map((chip) => (
              <span key={chip} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: '#ecfdf5', color: '#059669' }}>
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="print-only">
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22 }}>{note.course} · Week {note.week}: {note.title}</h1>
        <p style={{ fontSize: 13, color: '#555' }}>{note.subtitle}</p>
        {topics.map((t) => (
          <TopicSlice key={t.number} topic={t} />
        ))}
      </div>

      {tabCount > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 2px 12px' }}>
          {topics.map((t, idx) => (
            <button
              key={t.number}
              onClick={() => goTab(idx)}
              style={{
                flex: '1 0 auto',
                padding: '8px 14px',
                borderRadius: 9999,
                border: `1px solid ${idx === tab ? '#059669' : '#e5e5e5'}`,
                background: idx === tab ? '#10b981' : '#fff',
                color: idx === tab ? '#fff' : '#777',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDone(weekNum, idx) && <Check size={12} />} Topic {t.number}
            </button>
          ))}
          {hasQuiz && (
            <button
              onClick={() => goTab(topics.length)}
              style={{
                flex: '1 0 auto',
                padding: '8px 14px',
                borderRadius: 9999,
                border: `1px solid ${topics.length === tab ? '#059669' : '#e5e5e5'}`,
                background: topics.length === tab ? '#10b981' : '#fff',
                color: topics.length === tab ? '#fff' : '#777',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Quiz
            </button>
          )}
        </div>
      )}

      {tab < topics.length ? (
        <TopicTab
          topic={topics[tab]}
          done={isDone(weekNum, tab)}
          onToggle={() => toggle(weekNum, tab)}
        />
      ) : (
        <EoqQuiz eoq={note.eoq ?? { questions: [] }} />
      )}

      {tabCount > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => goTab(tab - 1)}
            disabled={tab === 0}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 800, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: tab === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => goTab(tab + 1)}
            disabled={tab >= tabCount - 1}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 800, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: tab >= tabCount - 1 ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function TopicTab({ topic, done, onToggle }: { topic: Topic; done: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <TopicSlice topic={topic} />
      <button
        onClick={onToggle}
        style={{
          marginTop: 12,
          padding: '10px 18px',
          borderRadius: 9999,
          background: done ? '#059669' : '#fff',
          color: done ? '#fff' : '#3c3c3c',
          border: `1px solid ${done ? '#059669' : '#e5e5e5'}`,
          cursor: 'pointer',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        <Check size={16} /> {done ? 'Completed' : 'Mark Topic Complete'}
      </button>
    </div>
  );
}
