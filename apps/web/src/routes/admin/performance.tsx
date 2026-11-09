import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Mail } from 'lucide-react';
import { api, type PerfSnapshot, type PerfPoint } from '../../lib/api';
import { Bars, Spark } from '../../components/Charts';
import { SectionSkeleton } from '../../components/Skeletons';
import { describeError } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';

// Live performance, minute by minute, for every module of the app. Polls every
// 10 seconds while the tab is visible. All numbers come from the server's own
// per-minute buckets (memory only: a restart clears them) and from real users'
// browsers (Core Web Vitals).
const WINDOWS: { v: 15 | 60 | 180; label: string }[] = [
  { v: 15, label: '15 min' },
  { v: 60, label: '1 hour' },
  { v: 180, label: '3 hours' },
];
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 } as const;
const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dur = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

// Green when healthy, amber when watch, red when bad.
const tone = (v: number, warn: number, bad: number) => (v >= bad ? '#dc2626' : v >= warn ? '#d97706' : 'var(--u-good)');

const VITAL_NAMES: Record<string, { label: string; unit: string; warn: number; bad: number }> = {
  lcp: { label: 'Main content shows', unit: 'ms', warn: 2500, bad: 4000 },
  fcp: { label: 'First paint', unit: 'ms', warn: 1800, bad: 3000 },
  ttfb: { label: 'Server first byte', unit: 'ms', warn: 800, bad: 1800 },
  inp: { label: 'Tap response', unit: 'ms', warn: 200, bad: 500 },
  cls: { label: 'Layout jump', unit: '', warn: 0.1, bad: 0.25 },
};

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function perMinute(series: PerfPoint[], pick: (p: PerfPoint) => number) {
  return series.map((p) => ({ label: hm(p.t), value: pick(p) }));
}

export default function PerformancePanel() {
  const [win, setWin] = useState<15 | 60 | 180>(60);
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [updated, setUpdated] = useState(0);

  const load = useCallback(async () => {
    try {
      setSnap(await api.adminMetrics(win));
      setErr('');
      setUpdated(Date.now());
    } catch (e) {
      setErr(describeError(e, 'load live performance'));
    }
  }, [win]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  const testAlert = async () => {
    setTesting(true);
    try {
      const r = await api.adminTestAlert();
      if (r.ok) toastSuccess('Test alert emailed to the admins.');
      else setErr(`The test alert was not emailed: ${r.note || 'unknown reason'}`);
      void load();
    } catch (e) {
      setErr(describeError(e, 'send a test alert'));
    } finally {
      setTesting(false);
    }
  };

  const t = snap?.totals;
  const sys = snap?.system;
  const dbNow = sys?.db[sys.db.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Activity size={20} color="var(--u-good)" /> Live performance
        </h2>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button key={w.v} role="tab" aria-selected={win === w.v} className={`chip chip--sm${win === w.v ? ' chip--on' : ''}`} onClick={() => setWin(w.v)}>{w.label}</button>
          ))}
        </div>
        <button className="btn btn--white btn--sm" onClick={() => void load()} aria-label="Refresh now"><RefreshCw size={14} /></button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
        Updates every 10 seconds{updated ? ` · last ${hm(updated)}` : ''}. Kept in memory for the last 3 hours; a server restart clears it.
      </div>
      {err && <div role="alert" style={{ ...card, borderColor: '#fecaca', background: 'var(--u-bad-tint)', color: 'var(--u-red, #dc2626)', fontSize: 13 }}>{err}</div>}
      {!snap && !err && <SectionSkeleton rows={3} quote={false} />}

      {snap && t && sys && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
            <Stat label="Requests / min" value={String(t.rpm)} sub={`${t.n} in ${win} min`} />
            <Stat label="Server errors" value={`${t.errRate}%`} sub={`${t.e5} of ${t.n}`} color={tone(t.errRate, 2, 10)} />
            <Stat label="Typical speed (p50)" value={`${t.p50} ms`} color={tone(t.p50, 400, 1200)} />
            <Stat label="Slow 1 in 20 (p95)" value={`${t.p95} ms`} sub={`slowest ${t.max} ms`} color={tone(t.p95, 1500, 4000)} />
            <Stat label="Database" value={dbNow ? (dbNow.ok ? `${dbNow.ms} ms` : 'DOWN') : '…'} sub="checked each minute" color={dbNow ? (dbNow.ok ? tone(dbNow.ms, 500, 2000) : '#dc2626') : undefined} />
            <Stat label="Memory" value={`${sys.rssMb} MB`} sub={`heap ${sys.heapMb} MB · up ${dur(sys.uptimeSec)}`} color={tone(sys.rssMb, 350, 450)} />
            <Stat label="Server stalls" value={`${sys.lagMaxMs} ms`} sub="worst pause, last 5 min" color={tone(sys.lagMaxMs, 300, 1500)} />
          </div>

          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Requests per minute · whole app</div>
            <Bars data={perMinute(snap.total, (p) => p.n)} height={96} />
            <div style={{ fontSize: 12, fontWeight: 800, margin: '10px 0 2px' }}>Slow 1 in 20 (p95, ms) per minute</div>
            <Spark data={perMinute(snap.total, (p) => p.p95)} />
            <div style={{ fontSize: 12, fontWeight: 800, margin: '10px 0 2px' }}>Server errors per minute</div>
            <Bars data={perMinute(snap.total, (p) => p.e5)} height={56} />
          </div>

          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>By module (tap one for its minute-by-minute chart)</div>
            {snap.modules.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2)' }}>No traffic in this window yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {snap.modules.map((m) => (
                <div key={m.name} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpen(open === m.name ? null : m.name)}
                    aria-expanded={open === m.name}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, padding: '10px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)', minHeight: 48 }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>{m.n} req · {m.rpm}/min</span>
                    <span style={{ fontSize: 12, color: tone(m.errRate, 2, 10), fontWeight: 700 }}>{m.errRate}% errors ({m.e5})</span>
                    <span style={{ fontSize: 12, color: tone(m.p95, 1500, 4000), textAlign: 'right', fontWeight: 700 }}>p50 {m.p50} · p95 {m.p95} · max {m.max} ms</span>
                  </button>
                  {open === m.name && (
                    <div style={{ padding: '4px 12px 12px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, margin: '8px 0 2px' }}>Requests per minute</div>
                      <Bars data={perMinute(m.series, (p) => p.n)} height={72} />
                      <div style={{ fontSize: 11, fontWeight: 800, margin: '8px 0 2px' }}>p95 latency (ms)</div>
                      <Spark data={perMinute(m.series, (p) => p.p95)} />
                      <div style={{ fontSize: 11, fontWeight: 800, margin: '8px 0 2px' }}>Server errors</div>
                      <Bars data={perMinute(m.series, (p) => p.e5)} height={48} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>How pages feel to real users</div>
            {snap.vitals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>No readings yet. They arrive as people use the app (one visit in two reports).</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {snap.vitals.slice(0, 24).map((v) => {
                  const d = VITAL_NAMES[v.metric];
                  return (
                    <div key={v.page + v.metric} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'baseline', minHeight: 28 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{v.page}</b> · {d?.label || v.metric}</span>
                      <span style={{ color: d ? tone(v.p75, d.warn, d.bad) : 'var(--text)', fontWeight: 800 }}>{v.p75}{d?.unit}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>{v.n}×</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>The number shown is what 3 in 4 visits are at or under (p75).</div>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, flex: 1 }}>Alerts to the admin email</span>
              <button className="btn btn--white btn--sm" onClick={() => void testAlert()} disabled={testing} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Mail size={14} /> {testing ? 'Sending…' : 'Send test alert'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
              You are emailed when the server crashes, errors spike, responses get slow, the database is unreachable or slow, memory runs high, or users' browsers start reporting crashes. The same problem emails at most once every 15 minutes.
            </div>
            {snap.alerts.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--u-good)', fontWeight: 700 }}>No alerts since the server started.</div>
            ) : (
              snap.alerts.map((a, i) => (
                <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <div style={{ fontWeight: 800 }}>{a.kind} <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11 }}>· {new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {a.emailed ? 'emailed' : 'not emailed'}</span></div>
                  <div style={{ color: 'var(--text2)' }}>{a.message}</div>
                  {a.note && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.note}</div>}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
