import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import LiveWire from '../../components/LiveWire';

// Admin › Live wire: send an urgent countdown message (it shows on Home,
// after the stats, with a bell + push), and see or end every live wire
// running across Unify, whoever sent it.
type Running = Awaited<ReturnType<typeof api.adminOverview>>['liveWires'];

export default function AdminLiveWire() {
  const [running, setRunning] = useState<Running | null>(null);
  const load = () => api.adminOverview().then((d) => setRunning(d.liveWires || [])).catch(() => setRunning([]));
  useEffect(() => { void load(); }, []);
  const end = async (id: string) => {
    if (!window.confirm('End this live wire for everyone?')) return;
    try { await api.liveWireEnd(id); setRunning((r) => (r || []).filter((x) => x.id !== id)); toastSuccess('Live wire ended.'); }
    catch (e) { errorToast(e, 'end that live wire'); }
  };
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 12, fontSize: 13, color: 'var(--text2)' }}>
        Urgent messages with a countdown. They sit on Home (after the stats) for the students you pick until the time runs out, and ring the bell with a push. Class reps, lecturers, contributors, level admins, HODs and deans can send them to their own students from Home; admins can reach anyone.
      </div>
      <LiveWire style={{ margin: 0 }} />
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 12px 4px', fontSize: 12, fontWeight: 800 }}>Running across Unify{running ? ` · ${running.length}` : ''}</div>
        {running === null && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>Loading…</div>}
        {running && running.length === 0 && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>No live wires running right now.</div>}
        {(running || []).map((w) => (
          <div key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{w.message}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{w.by} → {w.to} · ends {new Date(w.endsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </span>
            <button className="btn btn--white btn--sm" onClick={() => void end(w.id)}>End</button>
          </div>
        ))}
      </div>
    </div>
  );
}
