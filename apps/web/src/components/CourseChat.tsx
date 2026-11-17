import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { SectionSkeleton } from './Skeletons';

// One course's thread between the people who teach it (lecturers and
// contributors). New messages ring the others' bell and push; it refreshes
// every 20 s while open.
type Thread = Awaited<ReturnType<typeof api.courseChat>>;

export default function CourseChat({ course }: { course: string }) {
  const [data, setData] = useState<Thread | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = () => api.courseChat(course).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(describeError(e, 'load the messages')));
  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [data?.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.courseChatPost(course, body);
      setText('');
      await load();
    } catch (e) {
      setErr(describeError(e, 'send that'));
    } finally {
      setBusy(false);
    }
  };

  if (err && !data) return <div className="t-13" style={{ color: 'var(--u-red)' }}>{err}</div>;
  if (!data) return <SectionSkeleton rows={3} quote={false} />;
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="t-13 muted">
        Between the people who teach {course}: {data.team.map((p) => `${p.name}${p.role === 'contributor' ? ' (contributor)' : p.role === 'lecturer' ? ' (lecturer)' : ''}`).join(', ') || 'nobody yet'}. Students never see this.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 16, background: 'var(--surface2)', border: '1px solid var(--border)', maxHeight: '55svh', overflowY: 'auto' }}>
        {data.messages.length === 0 && <div className="t-13 muted" style={{ textAlign: 'center', padding: 16 }}>No messages yet. Ask about a week, share a correction, or say what's coming next.</div>}
        {data.messages.map((m, i) => {
          const newDay = i === 0 || day(m.at) !== day(data.messages[i - 1].at);
          return (
            <div key={m.id}>
              {newDay && <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', margin: '6px 0' }}>{day(m.at)}</div>}
              <div style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', padding: '8px 12px', borderRadius: 14, borderBottomRightRadius: m.mine ? 4 : 14, borderBottomLeftRadius: m.mine ? 14 : 4, background: m.mine ? 'var(--u-black)' : 'var(--surface)', color: m.mine ? '#f5f4f0' : 'var(--text)', border: m.mine ? 'none' : '1px solid var(--border)' }}>
                  {!m.mine && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--u-good)', marginBottom: 2 }}>{m.author}{m.role === 'lecturer' ? ' · lecturer' : m.role === 'contributor' ? ' · contributor' : ''}</div>}
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'right', marginTop: 2 }}>{time(m.at)}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {err && <div className="t-13" style={{ color: 'var(--u-red)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }}
          rows={2}
          maxLength={2000}
          placeholder="Write a message…"
          style={{ flex: 1, padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, resize: 'vertical' }}
        />
        <button className="btn btn--amber btn--sm" disabled={busy || !text.trim()} onClick={() => void send()} aria-label="Send"><Send size={16} /></button>
      </div>
    </div>
  );
}
