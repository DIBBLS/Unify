import { useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';

export type RecallItem = { badge: string; question: string; answer: string };

// Tap-to-reveal recall deck with self-grading. Answers render blurred
// (layout-stable, no jump); tapping sharpens one card and offers
// Got it / Review again. The header tracks recalled vs fuzzy.
export function RecallDeck({ items }: { items: RecallItem[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [grades, setGrades] = useState<Record<number, 'got' | 'fuzzy'>>({});

  if (!items.length) return null;

  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const grade = (i: number, g: 'got' | 'fuzzy') =>
    setGrades((prev) => ({ ...prev, [i]: g }));

  const reset = () => {
    setRevealed(new Set());
    setGrades({});
  };

  const got = Object.values(grades).filter((g) => g === 'got').length;
  const fuzzy = Object.values(grades).filter((g) => g === 'fuzzy').length;
  const graded = got + fuzzy;

  return (
    <div className="recall-section">
      <div className="recall-label">Topic Active Recall</div>
      <div className="recall-progress">
        <div className="progress-track" style={{ flex: 1 }}>
          <div className="progress-fill" style={{ width: `${items.length ? Math.round((graded / items.length) * 100) : 0}%` }} />
        </div>
        <span>
          {graded === 0 ? 'test yourself' : `${got} nailed${fuzzy ? ` · ${fuzzy} fuzzy` : ''}`}
        </span>
        {graded > 0 && (
          <button onClick={reset} aria-label="Restart recall deck" style={{ background: 'none', border: 'none', color: '#777', display: 'flex', padding: 4 }}>
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      {items.map((c, i) => {
        const open = revealed.has(i);
        const g = grades[i];
        return (
          <div key={i} className="recall-card">
            <span className="recall-badge">{c.badge}</span>
            <div className="recall-q">{c.question}</div>
            <div className={`recall-answer ${open ? 'open' : 'blurred'}`} dangerouslySetInnerHTML={{ __html: c.answer }} />
            {!open && (
              <button className="recall-veil" onClick={() => toggle(i)} style={{ position: 'relative', marginTop: 8, padding: 10 }}>
                <Eye size={14} /> Tap to reveal
              </button>
            )}
            {open && !g && (
              <div className="recall-grade">
                <button className="got" onClick={() => grade(i, 'got')}>Got it</button>
                <button className="fuzzy" onClick={() => grade(i, 'fuzzy')}>Review again</button>
              </div>
            )}
            {open && g && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <span className={`recall-status ${g}`}>{g === 'got' ? 'Nailed it' : 'Marked for review'}</span>
                <button onClick={() => toggle(i)} style={{ background: 'none', border: 'none', color: '#777', fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
                  Hide
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
