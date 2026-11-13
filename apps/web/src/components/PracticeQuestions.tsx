import { useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { api, type PracticeQuestion } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { Card, Label } from './redesign/ui';

// Practice questions the lecturer adds (design L11 "Add practice questions").
// Lecturer: add multiple-choice questions and see/remove them.
// Students: answer them one at a time with instant feedback (course Practice tab).
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };

export function PracticeEditor({ course, onClose }: { course: string; onClose: () => void }) {
  const [list, setList] = useState<PracticeQuestion[]>([]);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [right, setRight] = useState(0);
  const [why, setWhy] = useState('');
  const [week, setWeek] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.practice(course).then((r) => setList(r.questions)).catch(() => {});
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [course]);
  const filled = opts.map((o) => o.trim()).filter(Boolean);
  const add = async () => {
    const options = opts.map((o) => o.trim());
    const keep = options.map((o, i) => ({ o, i })).filter((x) => x.o);
    const correctIndex = keep.findIndex((x) => x.i === right);
    if (q.trim().length < 5 || keep.length < 2 || correctIndex < 0) { errorToast(new Error('Write the question, at least two options, and tick the right one.'), 'add that'); return; }
    setBusy(true);
    try {
      await api.practiceAdd({ course, question: q.trim(), options: keep.map((x) => x.o), correctIndex, explanation: why.trim() || undefined, week: week ? Number(week) : undefined });
      toastSuccess('Added. Students see it in Practice.');
      setQ(''); setOpts(['', '', '', '']); setRight(0); setWhy('');
      await load();
    } catch (e) { errorToast(e, 'add that question'); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 10, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className="t-15 w-7" style={{ flex: 1 }}>Practice questions for {course}</span>
        <button onClick={onClose} aria-label="Close" style={{ display: 'flex', background: 'none', border: 'none', color: 'var(--text2)' }}><X size={18} /></button>
      </div>
      <div className="t-13 muted">Multiple choice. Students answer them in the course's Practice tab and see the right answer straight away.</div>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={600} placeholder="Question, e.g. What are the eigenvalues of [[2, 1], [1, 2]]?" style={{ ...field, resize: 'vertical' }} />
      {opts.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setRight(i)} aria-label={`Option ${i + 1} is right`} style={{ width: 26, height: 26, borderRadius: 9999, border: `2px solid ${right === i ? 'var(--u-good)' : 'var(--border)'}`, background: right === i ? 'var(--u-good)' : 'transparent', color: 'var(--u-on-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{right === i && <Check size={14} />}</button>
          <input value={o} onChange={(e) => setOpts((x) => x.map((y, j) => (j === i ? e.target.value : y)))} maxLength={200} placeholder={`Option ${i + 1}${i < 2 ? '' : ' (optional)'}`} style={field} />
        </div>
      ))}
      <div className="t-12 muted">Tick the right answer.</div>
      <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={600} placeholder="Why it's right (optional, shown after they answer)" style={field} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={week} onChange={(e) => setWeek(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Week (optional)" inputMode="numeric" style={{ ...field, width: 140 }} />
        <button className="btn btn--amber btn--sm" disabled={busy || q.trim().length < 5 || filled.length < 2} onClick={() => void add()}><Plus size={14} /> Add question</button>
      </div>
      {list.length > 0 && (
        <>
          <Label>Added so far · {list.length}</Label>
          {list.map((x) => (
            <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-13 w-7" style={{ display: 'block' }}>{x.week ? `Week ${x.week} · ` : ''}{x.question}</span>
                <span className="t-12 muted">Answer: {x.options[x.correctIndex]}</span>
              </span>
              {x.mine && <button aria-label="Remove question" onClick={() => void api.practiceDelete(x.id).then(load).catch((e) => errorToast(e, 'remove that'))} style={{ display: 'flex', background: 'none', border: 'none', color: 'var(--text3)', padding: 2 }}><Trash2 size={15} /></button>}
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

export function PracticeRunner({ course }: { course: string }) {
  const [qs, setQs] = useState<PracticeQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.practice(course).then((r) => setQs(r.questions)).catch(() => setQs([])); }, [course]);
  if (!qs || qs.length === 0) return null;
  const q = qs[i];
  const done = i >= qs.length;
  const box: React.CSSProperties = { padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...box, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700 }}>Practice questions from your lecturer</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{qs.length} question{qs.length === 1 ? '' : 's'} · see the answer straight away</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--u-good)' }}>Start</span>
      </button>
    );
  }
  if (done) {
    return (
      <div style={{ ...box, textAlign: 'center' }}>
        <div className="t-15 w-7">You got {right} of {qs.length}</div>
        <button className="btn btn--white btn--sm" style={{ marginTop: 10 }} onClick={() => { setI(0); setPick(null); setRight(0); }}>Go again</button>
      </div>
    );
  }
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="t-12 muted">Question {i + 1} of {qs.length}{q.week ? ` · Week ${q.week}` : ''}</div>
      <div className="t-15 w-7">{q.question}</div>
      {q.options.map((o, k) => {
        const answered = pick !== null;
        const isRight = k === q.correctIndex;
        const tone = answered && isRight ? { background: 'var(--u-good-tint)', border: '1px solid var(--u-good)' } : answered && k === pick ? { background: 'var(--u-bad-tint)', border: '1px solid var(--u-red)' } : { background: 'var(--surface)', border: '1px solid var(--border)' };
        return (
          <button key={k} disabled={answered} onClick={() => { setPick(k); if (k === q.correctIndex) setRight((n) => n + 1); }} style={{ ...tone, padding: '10px 12px', borderRadius: 10, textAlign: 'left', color: 'var(--text)', fontSize: 14 }}>
            {o}{answered && isRight ? ' ✓' : ''}
          </button>
        );
      })}
      {pick !== null && q.explanation && <div className="t-13" style={{ padding: 10, borderRadius: 10, background: 'var(--surface2)' }}>{q.explanation}</div>}
      {pick !== null && <button className="btn btn--amber btn--sm" onClick={() => { setI(i + 1); setPick(null); }}>{i + 1 < qs.length ? 'Next' : 'See score'}</button>}
    </div>
  );
}
