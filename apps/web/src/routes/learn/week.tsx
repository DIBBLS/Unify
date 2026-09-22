import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { UnifyNote, Topic } from '../../types/note';
import { TopicSlice } from '../../components/TopicSlice';
import { useProgress } from '../../hooks/useProgress';
import Loading from '../../components/Loading';
import Mascot from '../../components/Mascot';

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
      try {
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
      } catch {
        // keep note null so the empty state renders instead of hanging
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseCode, weekNum]);

  if (loading) return <Loading text={`Loading Week ${weekNum}`} />;
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
      {note.topics.map((t: Topic, idx: number) => (
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
