import { useEffect, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import type { EOQ } from '../types/note';
import { api } from '../lib/api';

const PASS_PCT = 60;

function mcqCorrectIndex(q: EOQ['questions'][number]): number | null {
  if (q.type !== 'mcq' || !q.options || !q.correct) return null;
  const i = q.correct.trim().toUpperCase().charCodeAt(0) - 65;
  return i >= 0 && i < q.options.length ? i : null;
}

function fitbAccepted(q: EOQ['questions'][number]): string[] {
  if (q.type !== 'fitb') return [];
  if (q.acceptedAnswers && q.acceptedAnswers.length) return q.acceptedAnswers;
  return q.correct ? [q.correct] : [];
}

export default function EoqQuiz({ eoq, course, week, preview = false }: { eoq: EOQ; course: string; week: number; preview?: boolean }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [recorded, setRecorded] = useState(false);
  const [fitb, setFitb] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const gradeable = eoq.questions.map((q, i) =>
    q.type === 'mcq' ? mcqCorrectIndex(q) !== null : fitbAccepted(q).length > 0 ? true : false
  );
  const answered = eoq.questions.map((q, i) =>
    q.type === 'mcq' ? picked[i] !== undefined : !!checked[i]
  );
  const correct = eoq.questions.map((q, i) => {
    if (!gradeable[i] || !answered[i]) return false;
    if (q.type === 'mcq') return picked[i] === mcqCorrectIndex(q);
    const v = (fitb[i] || '').trim().toLowerCase();
    return fitbAccepted(q).some((a) => a.trim().toLowerCase() === v);
  });

  const total = gradeable.filter(Boolean).length;
  const score = correct.filter(Boolean).length;
  const done = eoq.questions.every((_, i) => !gradeable[i] || answered[i]);
  const pct = total ? Math.round((score / total) * 100) : 0;
  const passed = done && total > 0 && pct >= PASS_PCT;

  useEffect(() => {
    if (!done || total === 0 || recorded || preview) return;
    setRecorded(true);
    api.quizAttempt(course, week, score, total).catch(() => {});
  }, [done, total, recorded, course, week, score, preview]);

  const reset = () => {
    setPicked({});
    setFitb({});
    setChecked({});
  };

  if (!eoq.questions.length) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 28 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>
        End-of-Week Quiz
      </div>
      <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
        {total} questions · {PASS_PCT}% to pass
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
        {eoq.questions.map((q, i) => (
          <div key={q.number ?? i}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#afafaf', letterSpacing: 1 }}>QUESTION {i + 1}</div>
            <div className="mc-q">{q.question}</div>
            {q.type === 'mcq' && q.options && (
              <div className="mc-mcq-opts">
                {q.options.map((opt, oi) => {
                  const show = picked[i] !== undefined;
                  const isCorrect = oi === mcqCorrectIndex(q);
                  const isSelected = picked[i] === oi;
                  return (
                    <div
                      key={oi}
                      className={`mc-mcq-opt ${show && isCorrect ? 'mc-correct' : ''} ${show && isSelected && !isCorrect ? 'mc-wrong' : ''} ${show ? 'mc-locked' : ''}`}
                      onClick={() => picked[i] === undefined && setPicked((p) => ({ ...p, [i]: oi }))}
                    >
                      <span className="mc-ltr">{String.fromCharCode(65 + oi)}</span> {opt}
                    </div>
                  );
                })}
              </div>
            )}
            {q.type === 'fitb' && (
              <div className="mc-fitb-row">
                <input
                  className="mc-fitb-input"
                  value={fitb[i] || ''}
                  disabled={!!checked[i]}
                  onChange={(e) => setFitb((f) => ({ ...f, [i]: e.target.value }))}
                  placeholder="Your answer…"
                />
                {!checked[i] && (
                  <button className="mc-fitb-btn" onClick={() => setChecked((c) => ({ ...c, [i]: true }))}>
                    Check
                  </button>
                )}
              </div>
            )}
            {answered[i] && gradeable[i] && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, marginTop: 6, color: correct[i] ? '#059669' : '#991b1b' }}>
                {correct[i] ? <Check size={14} /> : <X size={14} />}
                {correct[i] ? q.feedback?.correct || 'Correct!' : q.feedback?.wrong || 'Not quite.'}
              </div>
            )}
          </div>
        ))}
      </div>
      {done && total > 0 && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: passed ? '#ecfdf5' : '#fef2f2', border: `1px solid ${passed ? '#a7f3d0' : '#fecaca'}`, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 18, color: passed ? '#065f46' : '#991b1b' }}>
            {passed ? 'Passed!' : 'Not yet'} — {score}/{total} ({pct}%)
          </div>
          {!passed && (
            <button onClick={reset} style={{ marginTop: 10, padding: '8px 18px', borderRadius: 9999, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 800, fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <RotateCcw size={14} /> Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
