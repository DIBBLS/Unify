import { useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

// The app's own dialogs in place of the browser's confirm() and prompt()
// popups (which look foreign, can't be styled and block the page):
//   if (!(await askConfirm({ title: 'Remove this?', body: '…' }))) return;
//   const why = await askText({ title: 'Tell them why', optional: true });  // null = cancelled
// <DialogHost /> is mounted once in App.
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'go' };
type TextOpts = { title: string; body?: string; placeholder?: string; confirmLabel?: string; optional?: boolean; initial?: string };
type Req =
  | { kind: 'confirm'; opts: ConfirmOpts; done: (v: boolean) => void }
  | { kind: 'text'; opts: TextOpts; done: (v: string | null) => void };

let push: ((r: Req) => void) | null = null;

export function askConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false); // host not mounted: never act without a yes
    push({ kind: 'confirm', opts, done: resolve });
  });
}

export function askText(opts: TextOpts): Promise<string | null> {
  return new Promise((resolve) => {
    if (!push) return resolve(null);
    push({ kind: 'text', opts, done: resolve });
  });
}

export function DialogHost() {
  const [queue, setQueue] = useState<Req[]>([]);
  const [text, setText] = useState('');
  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r]);
    return () => { push = null; };
  }, []);
  const cur = queue[0];
  useEffect(() => { if (cur?.kind === 'text') setText(cur.opts.initial || ''); }, [cur]);
  if (!cur) return null;
  const close = () => setQueue((q) => q.slice(1));

  if (cur.kind === 'confirm') {
    const o = cur.opts;
    return (
      <ConfirmModal
        title={o.title}
        body={o.body || ''}
        confirmLabel={o.confirmLabel || 'Yes'}
        cancelLabel={o.cancelLabel || 'Cancel'}
        tone={o.tone || 'danger'}
        onConfirm={() => { cur.done(true); close(); }}
        onCancel={() => { cur.done(false); close(); }}
      />
    );
  }
  const o = cur.opts;
  const cancel = () => { cur.done(null); close(); };
  const ok = () => { if (!o.optional && !text.trim()) return; cur.done(text.trim()); close(); };
  return (
    <div className="modal-veil" onClick={cancel} role="dialog" aria-modal="true" aria-label={o.title}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{o.title}</div>
        {o.body && <div className="modal-body">{o.body}</div>}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder={o.placeholder || (o.optional ? 'Optional' : '')}
          rows={3}
          style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div className="modal-actions">
          <button className="modal-cancel" onClick={cancel}>Cancel</button>
          <button className="modal-go" onClick={ok} disabled={!o.optional && !text.trim()}>{o.confirmLabel || 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
