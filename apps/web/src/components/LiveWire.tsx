import { useEffect, useState } from 'react';
import { Radio, X } from 'lucide-react';
import { api, type LiveWire as Wire, type LiveWireTarget } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import Drop from './Drop';

// Live wire: urgent messages with a countdown, at the top of Home until the
// time runs out. Class reps, lecturers, contributors, level admins, HODs,
// deans and Unify admins can send one to the students they look after.
const LABEL = { starts: 'Starts in', deadline: 'Deadline in', ends: 'Ends in' } as const;
const DURATIONS = [
  { m: 15, t: '15 min' }, { m: 30, t: '30 min' }, { m: 60, t: '1 hour' }, { m: 120, t: '2 hours' },
  { m: 360, t: '6 hours' }, { m: 1440, t: '1 day' }, { m: 4320, t: '3 days' },
];
const SEEN = 'unify:livewire-collapsed';

function left(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
const scopeText = (w: Wire) =>
  w.scope === 'course' ? w.course : w.scope === 'class' ? `${w.level} ${w.department}` : w.scope === 'department' ? w.department : w.scope === 'faculty' ? 'Your faculty' : 'Everyone';

export default function LiveWire({ allowSend = true, style }: { allowSend?: boolean; style?: React.CSSProperties }) {
  const [wires, setWires] = useState<Wire[]>([]);
  const [targets, setTargets] = useState<LiveWireTarget[]>([]);
  const [now, setNow] = useState(Date.now());
  const [composing, setComposing] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; } });

  const load = () => api.liveWires().then((r) => { setWires(r.wires); setTargets(r.targets); }).catch(() => {});
  useEffect(() => {
    void load();
    // Light on data: re-check every two minutes while the app is open and visible.
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 120000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, []);

  const live = wires.filter((w) => Date.parse(w.endsAt) > now);
  const collapse = (id: string) => {
    const next = [...collapsed, id].slice(-50);
    setCollapsed(next);
    try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch { /* fine */ }
  };
  const end = async (id: string) => {
    if (!window.confirm('End this live wire now? It disappears for everyone.')) return;
    try { await api.liveWireEnd(id); setWires((w) => w.filter((x) => x.id !== id)); toastSuccess('Live wire ended.'); }
    catch (e) { errorToast(e, 'end that live wire'); }
  };

  if (!live.length && !(allowSend && targets.length)) return null;

  return (
    <div style={{ margin: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {live.map((w) => {
        const small = collapsed.includes(w.id) && !w.mine;
        const ms = Date.parse(w.endsAt) - now;
        if (small) {
          return (
            <button key={w.id} onClick={() => setCollapsed((c) => c.filter((x) => x !== w.id))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: '#0a0a0a', color: '#f5f4f0', border: 'none', borderLeft: '4px solid #fbbf24', fontSize: 12, fontWeight: 700, textAlign: 'left' }}>
              <span className="lw-dot" aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.message}</span>
              <span style={{ color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{left(ms)}</span>
            </button>
          );
        }
        return (
          <section key={w.id} role="alert" aria-label="Live wire" style={{ background: '#0a0a0a', color: '#f5f4f0', borderRadius: 14, borderLeft: '4px solid #fbbf24', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="lw-dot" aria-hidden="true" />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#4ade80' }}>LIVE WIRE</span>
              <span style={{ fontSize: 11, color: '#aaa', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {w.role}{w.author ? ` ${w.author}` : ''} · {scopeText(w)}</span>
              {w.canEnd ? (
                <button onClick={() => void end(w.id)} style={{ background: 'none', border: '1px solid #444', color: '#f5f4f0', borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>End now</button>
              ) : (
                <button onClick={() => collapse(w.id)} aria-label="Got it, make it smaller" style={{ display: 'flex', background: 'none', border: 'none', color: '#aaa', padding: 2 }}><X size={15} /></button>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginTop: 6, whiteSpace: 'pre-wrap' }}>{w.message}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#aaa', fontWeight: 700 }}>{LABEL[w.label]}</span>
              <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{left(ms)}</span>
            </div>
          </section>
        );
      })}
      {allowSend && targets.length > 0 && (
        composing ? (
          <Compose targets={targets} onClose={() => setComposing(false)} onSent={() => { setComposing(false); void load(); }} />
        ) : (
          <button onClick={() => setComposing(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 700 }}>
            <Radio size={14} /> Send a live wire
          </button>
        )
      )}
      <style>{'.lw-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 0 rgba(74,222,128,.6);animation:lw-pulse 1.6s infinite;flex-shrink:0}@keyframes lw-pulse{0%{box-shadow:0 0 0 0 rgba(74,222,128,.6)}70%{box-shadow:0 0 0 8px rgba(74,222,128,0)}100%{box-shadow:0 0 0 0 rgba(74,222,128,0)}}@media (prefers-reduced-motion:reduce){.lw-dot{animation:none}}'}</style>
    </div>
  );
}

function Compose({ targets, onClose, onSent }: { targets: LiveWireTarget[]; onClose: () => void; onSent: () => void }) {
  const key = (t: LiveWireTarget) => [t.scope, t.faculty || '', t.department || '', t.level || '', t.course || ''].join('|');
  const [to, setTo] = useState(key(targets[0]));
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState<Wire['label']>('ends');
  const [minutes, setMinutes] = useState(60);
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);

  const mins = until ? Math.round((Date.parse(until) - Date.now()) / 60000) : minutes;
  const okTime = mins >= 5 && mins <= 7 * 24 * 60;

  const send = async () => {
    const t = targets.find((x) => key(x) === to);
    if (!t) return;
    setBusy(true);
    try {
      await api.liveWireSend({ scope: t.scope, faculty: t.faculty, department: t.department, level: t.level, course: t.course, message: message.trim(), minutes: mins, label });
      toastSuccess('Live wire sent. It shows on their Home now.');
      onSent();
    } catch (e) {
      errorToast(e, 'send the live wire');
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, border: `1px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-good-tint)' : 'var(--surface)', color: 'var(--text)' });
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Send a live wire</span>
        <button onClick={onClose} aria-label="Close" style={{ display: 'flex', background: 'none', border: 'none', color: 'var(--text3)' }}><X size={16} /></button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>For urgent things only: a venue change, a test moved, a deadline today. It sits at the top of their Home with a countdown and pings their phones.</div>
      {targets.length > 1 ? (
        <Drop value={to} onChange={setTo} label="Who gets it" options={targets.map((t) => ({ value: key(t), label: t.label }))} style={{ width: '100%' }} />
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700 }}>To: {targets[0].label}</div>
      )}
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        Message
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 280))} rows={3} placeholder="CHE 201 test has moved to LT2. Same time, bring your calculator." style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>{280 - message.length} characters left</span>
      </label>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>The countdown says</div>
        <div role="radiogroup" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['starts', 'deadline', 'ends'] as const).map((l) => <button key={l} role="radio" aria-checked={label === l} onClick={() => setLabel(l)} style={chip(label === l)}>{LABEL[l]}…</button>)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Counts down for</div>
        <div role="radiogroup" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DURATIONS.map((d) => <button key={d.m} role="radio" aria-checked={!until && minutes === d.m} onClick={() => { setMinutes(d.m); setUntil(''); }} style={chip(!until && minutes === d.m)}>{d.t}</button>)}
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginTop: 8 }}>
          Or until an exact time
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} style={{ display: 'block', marginTop: 4, padding: 8, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
        </label>
        {!okTime && <div style={{ fontSize: 12, color: 'var(--u-red)', marginTop: 4 }}>Pick a time between 5 minutes and 7 days from now.</div>}
      </div>
      <button className="btn btn--amber btn--block" disabled={busy || message.trim().length < 5 || !okTime} onClick={() => void send()}>{busy ? 'Sending…' : 'Send live wire'}</button>
    </div>
  );
}
