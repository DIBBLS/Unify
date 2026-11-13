import { useEffect, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import type { EOQ } from '../types/note';
import { api } from '../lib/api';
import { BoxBoy } from './redesign/brand';
import { MathPlain } from './MathText';
import { mathsMatches, numberMatches } from '../lib/mathAnswer';

const PASS_PCT = 60;

function mcqCorrectIndex(q: EOQ['questions'][number]): number | null {
  if (q.type !== 'mcq' || !q.options || !q.correct) return null;
  const i = q.correct.trim().toUpperCase().charCodeAt(0) - 65;
  return i >= 0 && i < q.options.length ? i : null;
}

function fitbAccepted(q: EOQ['questions'][number]): string[] {
  if (q.type !== 'fitb' && q.type !== 'maths') return [];
  if (q.acceptedAnswers && q.acceptedAnswers.length) return q.acceptedAnswers;
  return q.correct ? [q.correct] : [];
}

// Written answers: a word (fitb), a number within tolerance (S30), or a maths
// expression checked by value (S31).
function writtenCorrect(q: EOQ['questions'][number], typed: string): boolean {
  const v = typed.trim();
  if (!v) return false;
  if (q.type === 'number') return typeof q.answer === 'number' && numberMatches(v, q.answer, q.tolerance);
  if (q.type === 'maths') return mathsMatches(v, fitbAccepted(q));
  return fitbAccepted(q).some((a) => a.trim().toLowerCase() === v.toLowerCase());
}
const gradeableQ = (q: EOQ['questions'][number]) =>
  q.type === 'mcq' ? mcqCorrectIndex(q) !== null : q.type === 'number' ? typeof q.answer === 'number' : fitbAccepted(q).length > 0;

// S31 maths keypad: the symbols a phone keyboard hides. Typing still works.
const KEYS = ['7', '8', '9', '/', '(', ')', '4', '5', '6', '*', '^', '√', '1', '2', '3', '-', 'π', 'x', '0', '.', '⌫', '+', 'ρ', 'V'];
function MathKeypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div role="group" aria-label="Maths keypad" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 8 }}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === '⌫' ? 'Delete' : k === '√' ? 'Square root' : k === '^' ? 'Power' : k}
          style={{ padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#f5f4f0', fontWeight: 700, fontSize: 15 }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// End-of-week exam on the dark card. BUG-005: NO feedback while
// answering — picks are neutral until the student taps Check score after
// all questions are answered; only then do verdicts, dots, feedback and
// the score screen appear. Recording fires on submit, never before.
export default function EoqQuiz({ eoq, course, week, preview = false }: { eoq: EOQ; course: string; week: number; preview?: boolean }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [recorded, setRecorded] = useState(false);
  const [fitb, setFitb] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  // Score surfaces as an overlay, never buried down the quiz sheet.
  const [showResult, setShowResult] = useState(true);
  // Optional timer: starts at the first answer, ends the quiz at zero.
  const timerSec = Math.max(0, Math.round((eoq.timerMinutes || 0) * 60));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const gradeable = eoq.questions.map((q) => gradeableQ(q));
  const answered = eoq.questions.map((q, i) =>
    q.type === 'mcq' ? picked[i] !== undefined : (fitb[i] || '').trim().length > 0
  );
  const correct = eoq.questions.map((q, i) => {
    if (!gradeable[i] || !answered[i]) return false;
    if (q.type === 'mcq') return picked[i] === mcqCorrectIndex(q);
    return writtenCorrect(q, fitb[i] || '');
  });
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const total = gradeable.filter(Boolean).length;
  const score = correct.filter(Boolean).length;
  const done = eoq.questions.every((_, i) => !gradeable[i] || answered[i]);
  const pct = total ? Math.round((score / total) * 100) : 0;
  // Pass mark: an exact count when the author set one, otherwise 60%.
  const passAt = eoq.passMark && eoq.passMark > 0 ? Math.min(eoq.passMark, Math.max(total, 1)) : Math.ceil((total * PASS_PCT) / 100);
  const passed = submitted && done && total > 0 && (eoq.passMark ? score >= passAt : pct >= PASS_PCT);
  const timeLeft = timerSec && startedAt && !submitted ? Math.max(0, timerSec - Math.floor((now - startedAt) / 1000)) : null;
  const missed = eoq.questions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => submitted && gradeable[i] && answered[i] && !correct[i]);

  // The clock starts at the first answer (never in a preview).
  useEffect(() => {
    if (preview || !timerSec || startedAt || submitted) return;
    if (Object.keys(picked).length || Object.values(fitb).some((v) => v.trim())) setStartedAt(Date.now());
  }, [picked, fitb, preview, timerSec, startedAt, submitted]);
  useEffect(() => {
    if (!startedAt || submitted) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, submitted]);
  // Time is up: submit what is there. Unanswered questions mean "not yet".
  useEffect(() => {
    if (timeLeft === 0 && !submitted) { setSubmitted(true); setShowResult(true); setFinishedAt(Date.now()); }
  }, [timeLeft, submitted]);

  useEffect(() => {
    if (!submitted || !done || total === 0 || recorded || preview) return;
    setRecorded(true);
    // Which gradeable questions were asked and missed, for the lecturer's most-missed report.
    const asked = eoq.questions.map((_, i) => i).filter((i) => gradeable[i]);
    const wrong = asked.filter((i) => !correct[i]);
    api.quizAttempt(course, week, score, total, { asked, wrong }).catch(() => {});
  }, [submitted, done, total, recorded, course, week, score, preview]);

  const reset = () => {
    setPicked({});
    setFitb({});
    setSubmitted(false);
    setShowResult(true);
    setRecorded(false);
    setStartedAt(null);
    setFinishedAt(null);
  };

  if (!eoq.questions.length) return null;

  return (
    <div className="eoq-card">
      <div className="eoq-eyebrow">End-of-Week Quiz</div>
      <div className="eoq-title">Prove it.</div>
      <div className="eoq-sub">
        {total} questions · pass mark {passAt} of {total}{timerSec ? ` · ${Math.round(timerSec / 60)} min` : ''}{preview ? ' · preview — not recorded' : ''}
        {timeLeft !== null && (
          <span role="timer" aria-live="off" style={{ marginLeft: 8, fontWeight: 800, color: timeLeft <= 60 ? '#fca5a5' : 'var(--u-green)' }}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="eoq-dots" aria-label="Quiz progress">
        {eoq.questions.map((q, i) => (
          <span
            key={q.number ?? i}
            className={`eoq-dot ${answered[i] ? 'answered' : ''} ${submitted && answered[i] && gradeable[i] ? (correct[i] ? 'correct' : 'wrong') : ''}`}
          >
            {submitted && answered[i] && gradeable[i] ? (correct[i] ? <Check size={12} /> : <X size={12} />) : i + 1}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {eoq.questions.map((q, i) => (
          <div key={q.number ?? i} className="eoq-question">
            <div className="eoq-qnum">Question {i + 1}</div>
            <div className="eoq-q-text">
              <MathPlain text={q.question} />
            </div>
            {q.type === 'mcq' && q.options && (
              <div className="eoq-options">
                {q.options.map((opt, oi) => {
                  const isCorrect = submitted && oi === mcqCorrectIndex(q);
                  const isSelected = picked[i] === oi;
                  return (
                    <div
                      key={oi}
                      className={`eoq-option ${isCorrect ? 'correct-reveal' : ''} ${submitted && isSelected && !isCorrect ? 'wrong-reveal' : ''} ${submitted ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => !submitted && picked[i] === undefined && setPicked((p) => ({ ...p, [i]: oi }))}
                    >
                      <span className="eoq-letter">{String.fromCharCode(65 + oi)}</span> <MathPlain text={opt} />
                    </div>
                  );
                })}
              </div>
            )}
            {(q.type === 'fitb' || q.type === 'number' || q.type === 'maths') && (
              <div className="eoq-fitb-row" style={{ alignItems: 'center' }}>
                <input
                  value={fitb[i] || ''}
                  disabled={submitted}
                  onChange={(e) => setFitb((f) => ({ ...f, [i]: e.target.value }))}
                  onFocus={() => q.type === 'maths' && setKeypadFor(i)}
                  placeholder={q.type === 'number' ? 'Your answer' : q.type === 'maths' ? 'e.g. (8/27)ρV^3' : 'Type the missing word…'}
                  inputMode={q.type === 'number' ? 'decimal' : undefined}
                  aria-label={`Answer to question ${i + 1}`}
                  className={submitted ? (correct[i] ? 'correct-input' : 'wrong-input') : undefined}
                />
                {q.type === 'number' && q.unit && <span style={{ marginLeft: 8, fontWeight: 700, opacity: 0.85 }}>{q.unit}</span>}
              </div>
            )}
            {q.type === 'maths' && !submitted && keypadFor === i && (
              <MathKeypad onKey={(k) => setFitb((f) => ({ ...f, [i]: k === '⌫' ? (f[i] || '').slice(0, -1) : (f[i] || '') + (k === '√' ? '√(' : k) }))} />
            )}
            {q.type === 'maths' && !submitted && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Any equivalent form counts: 8ρV³/27 and 0.296ρV³ are both right.</div>
            )}
            {submitted && !correct[i] && gradeable[i] && q.type === 'number' && typeof q.answer === 'number' && (
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Answer: {q.answer}{q.unit ? ` ${q.unit}` : ''}</div>
            )}
            {submitted && !correct[i] && gradeable[i] && q.type === 'maths' && (
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Answer: <MathPlain text={fitbAccepted(q)[0]} inline /></div>
            )}
            {submitted && answered[i] && gradeable[i] && (
              <div className={`eoq-feedback ${correct[i] ? 'correct-fb' : 'wrong-fb'}`}>
                {correct[i] ? <Check size={14} /> : <X size={14} />}
                <MathPlain text={correct[i] ? q.feedback?.correct || 'Correct!' : q.feedback?.wrong || 'Not quite.'} />
              </div>
            )}
            {submitted && answered[i] && gradeable[i] && !correct[i] && q.topicRef && (
              <div className="eoq-topicref">
                Review: <button onClick={() => document.querySelector('.screen-only')?.scrollTo?.({ top: 0, behavior: 'smooth' })} style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', color: '#4ade80', borderRadius: 9999, fontSize: 11, fontWeight: 700, padding: '3px 12px', margin: '2px 4px 2px 0', cursor: 'pointer' }}>Topic {q.topicRef} ↑</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!done && !submitted && (
        <div className="eoq-submit-hint">
          {answered.filter(Boolean).length}/{total} answered — no answers shown until you check your score.
        </div>
      )}
      {done && !submitted && (
        <button onClick={() => { setSubmitted(true); setShowResult(true); setFinishedAt(Date.now()); setKeypadFor(null); }} className="eoq-submit-btn" style={{ width: '100%', marginTop: 16 }}>
          Check score
        </button>
      )}
      {submitted && total > 0 && showResult && (
        <div className="modal-veil" onClick={() => setShowResult(false)} role="dialog" aria-modal="true" aria-label="Quiz result">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto', background: '#0a0a0a', border: '1px solid rgba(255,255,255,.1)' }}>
        <div className={`eoq-result ${passed ? 'pass' : 'fail'}`} style={{ marginTop: 0 }}>
          <BoxBoy pose={passed ? "wavePhone" : "readingStanding"} width={55} />
          <div style={{ marginTop: 8 }}>
            <span className={`result-pill ${passed ? 'pill-pass' : 'pill-fail'}`}>{passed ? 'PASSED' : 'NOT YET'}</span>
          </div>
          <div className="result-score-big">{score}/{total}</div>
          {/* S32: question by question, and how long it took. */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', margin: '8px 0' }} aria-label="Question by question">
            {eoq.questions.map((q, qi) => gradeable[qi] && (
              <span key={qi} title={`Question ${qi + 1}: ${correct[qi] ? 'right' : answered[qi] ? 'wrong' : 'not answered'}`} style={{ width: 22, height: 22, borderRadius: 9999, display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 800, background: correct[qi] ? 'var(--u-green)' : 'rgba(255,255,255,.12)', color: correct[qi] ? '#0a0a0a' : '#fca5a5' }}>
                {qi + 1}
              </span>
            ))}
          </div>
          {startedAt && finishedAt && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Finished in {Math.max(1, Math.round((finishedAt - startedAt) / 60000))} min</div>
          )}
          {/* S75: offline, the score is kept on the phone and sent when the connection is back. */}
          {!preview && typeof navigator !== 'undefined' && !navigator.onLine && (
            <div style={{ fontSize: 12, marginTop: 6, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,.08)' }}>
              You're offline. Your score is saved on this phone and sends itself when you're back online.
            </div>
          )}
          <div className="result-msg">
            {passed
              ? `You scored ${pct}%. This week is yours — the next one builds on it.`
              : `You scored ${pct}% (need ${passAt} of ${total}). The misses below point at exactly what to re-read.`}
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
          <button onClick={() => setShowResult(false)} className="eoq-submit-btn" style={{ width: '100%', marginTop: 12, background: 'rgba(255,255,255,.08)', borderBottom: '3px solid rgba(255,255,255,.15)' }}>
            Review answers
          </button>
        </div>
          </div>
        </div>
      )}
    </div>
  );
}

