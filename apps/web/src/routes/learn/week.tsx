import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UnifyNote } from '../types/note';
import { TopicSlice } from '../components/TopicSlice';
import { useProgress } from '../hooks/useProgress';

export default function LearnPage() {
  const { courseCode = 'MEE 352', week: weekParam } = useParams();
  const navigate = useNavigate();
  const weekNum = Number(weekParam) || 1;
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [loading, setLoading] = useState(true);
  const { toggle, isDone } = useProgress(`${courseCode}-w${weekNum}`);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const code = decodeURIComponent(courseCode).toUpperCase();
      const variants = [...new Set([code, code.replace(/\s/g, '')])];
      for (const v of variants) {
        const snap = await getDocs(query(collection(db, 'courseContent'), where('courseCode', '==', v), where('week', '==', weekNum)));
        if (!snap.empty) {
          const data: any = snap.docs[0].data();
          if (data.noteJson) setNote(data.noteJson as UnifyNote);
          else if (data.htmlContent) {
            // fallback: wrap htmlContent as single-topic note for lean migration
            setNote({
              course: code,
              week: weekNum,
              title: data.title || `Week ${weekNum}`,
              subtitle: '',
              learningOutcome: '',
              metaChips: [code, `Week ${weekNum}`],
              tags: [],
              topics: [
                {
                  number: 1,
                  title: data.title || `Week ${weekNum}`,
                  abbr: 't1',
                  subtopics: [{ number: '1.1', abbr: 'main', title: 'Content', content: [{ type: 'paragraph', text: data.htmlContent }], miniCheck: { questions: [] } }],
                },
              ],
              eoq: { questions: [] },
            });
          }
          break;
        }
      }
      setLoading(false);
    }
    load();
  }, [courseCode, weekNum]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Week {weekNum}…</div>;
  if (!note) return <div style={{ padding: 40, textAlign: 'center' }}>No content for {courseCode} Week {weekNum} yet.</div>;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 20px 100px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>
      <div className="hero" style={{ background: '#0a0a0a', color: '#f5f4f0', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#4ade80' }}>
          {note.course} · Week {note.week}
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, margin: '8px 0' }}>{note.title}</h1>
        <p style={{ fontStyle: 'italic', opacity: 0.7 }}>{note.subtitle}</p>
      </div>
      {note.topics.map((t, idx) => (
        <div key={t.number} style={{ marginBottom: 32 }}>
          <TopicSlice topic={t} />
          <button
            onClick={() => toggle(weekNum, idx)}
            style={{
              marginTop: 12,
              padding: '10px 18px',
              borderRadius: 8,
              background: isDone(weekNum, idx) ? '#16a34a' : '#111827',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isDone(weekNum, idx) ? '✓ Completed' : '✓ Mark Topic Complete'}
          </button>
        </div>
      ))}
    </div>
  );
}
