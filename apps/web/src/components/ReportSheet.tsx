import { useState } from 'react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';

// S27 "Report a problem" (students) and L13 "Review this week" (the course's
// lecturer). Same sheet look as ConfirmModal. Students stay anonymous to authors.
const REASONS = ['Wrong answer', 'Typo or formula', 'Hard to follow', 'Something else'];

export default function ReportSheet({ course, week, topics, current, review, onClose }: {
  course: string; week: number; topics: string[]; current: string; review: boolean; onClose: () => void;
}) {
  const [topic, setTopic] = useState(current || topics[0] || '');
  const [reason, setReason] = useState(review ? '' : REASONS[0]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };

  const send = async () => {
    setBusy(true);
    try {
      await api.contentReport({ course, week, topic, kind: review ? 'review' : 'problem', reason: review ? undefined : reason, text: text.trim() });
      toastSuccess(review ? 'Review sent to the authors.' : 'Thanks. The authors will fix it.');
      onClose();
    } catch (e) {
      errorToast(e, review ? 'send your review' : 'send that report');
      setBusy(false);
    }
  };

  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label={review ? 'Review this week' : 'Report a problem'}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
        <div className="modal-title">{review ? `Review Week ${week}` : 'Report a problem'}</div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span>{review ? 'Flag errors or suggest changes. The authors see your name.' : "Tell the authors what's wrong. They don't see your name."}</span>
          {topics.length > 1 && (
            <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Which topic" style={field}>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {!review && (
            <div role="radiogroup" aria-label="What kind of problem" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REASONS.map((r) => (
                <button key={r} role="radio" aria-checked={reason === r} className={`chip chip--sm${reason === r ? ' chip--on' : ''}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} placeholder={review ? 'e.g. Example 2 uses the wrong efficiency; it should be 0.85' : 'e.g. The answer to question 3 should be 12 kW'} style={{ ...field, resize: 'vertical' }} />
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="modal-go" onClick={() => void send()} disabled={busy || text.trim().length < 3} style={{ opacity: busy || text.trim().length < 3 ? 0.6 : 1 }}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
