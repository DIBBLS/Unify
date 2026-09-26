import { useEffect, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import type { EOQ } from '../types/note';
import { api } from '../lib/api';
import Mascot from './Mascot';

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

// End-of-week exam on the dark card: progress dots, instant per-question
// verdicts with author feedback, topic refs on misses, and a pass/fail
// score screen. Recording is unchanged (one quizAttempt on completion).
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
  const missed = eoq.questions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => gradeable[i] && answered[i] && !correct[i]);

  useEffect(() => {
    if (!done || total === 0 || recorded || preview) return;
    setRecorded(true);
    api.quizAttempt(course, week, score, total).catch(() => {});
  }, [done, total, recorded, course, week, score, preview]);

  const reset = () => {
    setPicked({});
    setFitb({});
    setChecked({});
    setRecorded(false);
  };

  if (!eoq.questions.length) return null;

  return (
    <div className="eoq-card">
      <div className="eoq-eyebrow">End-of-Week Quiz</div>
      <div className="eoq-title">Prove it.</div>
      <div className="eoq-sub">
        {total} questions · {PASS_PCT}% to pass{preview ? ' · preview — not recorded' : ''}
      </div>
      <div className="eoq-dots" aria-label="Quiz progress">
        {eoq.questions.map((q, i) => (
          <span
            key={q.number ?? i}
            className={`eoq-dot ${answered[i] ? (correct[i] ? 'correct' : gradeable[i] ? 'wrong' : 'answered') : ''}`}
          >
            {answered[i] && gradeable[i] ? (correct[i] ? <Check size={12} /> : <X size={12} />) : i + 1}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {eoq.questions.map((q, i) => (
          <div key={q.number ?? i} className="eoq-question">
            <div className="eoq-qnum">Question {i + 1}</div>
            <div className="eoq-q-text">{q.question}</div>
            {q.type === 'mcq' && q.options && (
              <div className="eoq-options">
                {q.options.map((opt, oi) => {
                  const show = picked[i] !== undefined;
                  const isCorrect = oi === mcqCorrectIndex(q);
                  const isSelected = picked[i] === oi;
                  return (
                    <div
                      key={oi}
                      className={`eoq-option ${show && isCorrect ? 'correct-reveal' : ''} ${show && isSelected && !isCorrect ? 'wrong-reveal' : ''} ${!show ? '' : 'locked'} ${!show && isSelected ? 'selected' : ''}`}
                      onClick={() => picked[i] === undefined && setPicked((p) => ({ ...p, [i]: oi }))}
                    >
                      <span className="eoq-letter">{String.fromCharCode(65 + oi)}</span> {opt}
                    </div>
                  );
                })}
              </div>
            )}
            {q.type === 'fitb' && (
              <div className="eoq-fitb-row">
                <input
                  value={fitb[i] || ''}
                  disabled={!!checked[i]}
                  onChange={(e) => setFitb((f) => ({ ...f, [i]: e.target.value }))}
                  placeholder="Type the missing word…"
                  className={checked[i] ? (correct[i] ? 'correct-input' : 'wrong-input') : undefined}
                />
                {!checked[i] && (
                  <button
                    className="eoq-submit-btn"
                    style={{ marginTop: 0 }}
                    onClick={() => setChecked((c) => ({ ...c, [i]: true }))}
                  >
                    Check
                  </button>
                )}
              </div>
            )}
            {answered[i] && gradeable[i] && (
              <div className={`eoq-feedback ${correct[i] ? 'correct-fb' : 'wrong-fb'}`}>
                {correct[i] ? <Check size={14} /> : <X size={14} />}
                {correct[i] ? q.feedback?.correct || 'Correct!' : q.feedback?.wrong || 'Not quite.'}
              </div>
            )}
            {answered[i] && gradeable[i] && !correct[i] && q.topicRef && (
              <div className="eoq-topicref">
                Review: <button onClick={() => document.querySelector('.screen-only')?.scrollTo?.({ top: 0, behavior: 'smooth' })}>Topic {q.topicRef} ↑</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!done && (
        <div className="eoq-submit-hint">
          {answered.filter(Boolean).length}/{total} answered — finish every question to lock your score.
        </div>
      )}
      {done && total > 0 && (
        <div className={`eoq-result ${passed ? 'pass' : 'fail'}`}>
          <Mascot size={84} animate={passed ? 'wave' : undefined} />
          <div style={{ marginTop: 8 }}>
            <span className={`result-pill ${passed ? 'pill-pass' : 'pill-fail'}`}>{passed ? 'PASSED' : 'NOT YET'}</span>
          </div>
          <div className="result-score-big">{score}/{total}</div>
          <div className="result-msg">
            {passed
              ? `You scored ${pct}%. This week is yours — the next one builds on it.`
              : `You scored ${pct}% (need ${PASS_PCT}%). The misses below point at exactly what to re-read.`}
          </div>
          {passed ? (
            <div className="unlock-banner">Week cleared — XP banked on every completed topic.</div>
          ) : (
            <div className="review-nudge">
              <p>Review these, then retry:</p>
              <ul>
                {missed.map(({ q, i }) => (
                  <li key={i}>Q{i + 1}{q.topicRef ? ` · Topic ${q.topicRef}` : ''}</li>
                ))}
              </ul>
              <button onClick={reset} className="eoq-submit-btn" style={{ marginTop: 12, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
