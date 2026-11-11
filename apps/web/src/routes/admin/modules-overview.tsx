import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

// Admin Overview: every module at a glance so nothing new is missed. What
// needs a decision (with where to act), this week's activity per module,
// setup gaps, and the release notes for the latest app updates.
type Data = Awaited<ReturnType<typeof api.adminOverview>>;
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 } as const;
const SEEN_KEY = 'unify:admin-notes-seen';

export default function ModulesOverview({ openModule }: { openModule: (id: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [seen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } });

  useEffect(() => {
    api.adminOverview().then(setData).catch(() => setFailed(true));
  }, []);

  const latest = data?.releaseNotes[0]?.version || '';
  useEffect(() => {
    if (!latest) return;
    try { localStorage.setItem(SEEN_KEY, latest); } catch { /* fine */ }
  }, [latest]);

  if (failed) return <div style={{ ...card, marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>Couldn't load the module overview. Pull to refresh or try again later.</div>;
  if (!data) return null;

  const go = (key: string, to: string | undefined, children: React.ReactNode, style: React.CSSProperties) => {
    if (!to) return <div key={key} style={style}>{children}</div>;
    if (to.startsWith('module:')) return <button key={key} onClick={() => openModule(to.slice(7))} style={{ ...style, textAlign: 'left', cursor: 'pointer', color: 'var(--text)', width: '100%' }}>{children}</button>;
    return <Link key={key} to={to} style={{ ...style, textDecoration: 'none', color: 'var(--text)' }}>{children}</Link>;
  };

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: 1, marginTop: 18 }}>NEEDS A DECISION</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 8 }}>
        {data.attention.map((t) => go(t.key, t.to, (
          <>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.n > 0 ? 'var(--u-warn-ink, #b45309)' : 'var(--u-good)' }}>{t.n}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t.label}</div>
          </>
        ), { ...card, display: 'block' }))}
      </div>

      {data.setup.length > 0 && (
        <div style={{ ...card, marginTop: 12, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 12px 4px', fontSize: 12, fontWeight: 800 }}>Still to set up</div>
          {data.setup.map((s, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {go('s' + i, s.to, (
                <>
                  <span style={{ flex: 1, fontSize: 13 }}>{s.label}</span>
                  {s.to && <ChevronRight size={16} color="var(--u-good)" />}
                </>
              ), { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'transparent' })}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: 1, marginTop: 18 }}>ACROSS THE MODULES</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginTop: 8 }}>
        {data.modules.map((m) => go(m.key, m.to, (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1 }}>{m.label}</span>
              {m.to && <ChevronRight size={14} color="var(--u-good)" />}
            </div>
            {m.lines.map((l) => <div key={l} style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{l}</div>)}
          </>
        ), { ...card, display: 'block' }))}
        <button onClick={() => openModule('session')} style={{ ...card, textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>Semester</span>
            <ChevronRight size={14} color="var(--u-good)" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{data.calendar.semester || 'Semester not named'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {data.calendar.start ? `Week 1 from ${new Date(data.calendar.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${data.calendar.weeks} weeks` : 'Calendar not set'}
          </div>
        </button>
      </div>

      {data.releaseNotes.length > 0 && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>What's new in the app</span>
            {seen !== latest && <span className="pill pill--good">New</span>}
          </div>
          {data.releaseNotes.map((r, i) => (
            <details key={r.version} open={i === 0} style={{ borderTop: i ? '1px solid var(--border)' : undefined, marginTop: 8, paddingTop: i ? 8 : 0 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                v{r.version}{r.date ? <span style={{ fontWeight: 400, color: 'var(--text2)' }}> · {r.date}</span> : null}
              </summary>
              <Notes body={r.body} />
            </details>
          ))}
        </div>
      )}
    </>
  );
}

// The changelog is plain markdown: "### Added" headings and "- " bullets.
function Notes({ body }: { body: string }) {
  const out: React.ReactNode[] = [];
  let items: string[] = [];
  const flush = (k: string) => {
    if (!items.length) return;
    out.push(<ul key={k} style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>);
    items = [];
  };
  body.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const h = /^#{3,4}\s+(.*)$/.exec(line);
    if (h) {
      flush('u' + i);
      out.push(<div key={'h' + i} style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, marginTop: 8, textTransform: 'uppercase' }}>{h[1]}</div>);
      return;
    }
    const b = /^[-*]\s+(.*)$/.exec(line);
    const text = (b ? b[1] : line).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    if (b || !items.length) items.push(text);
    else items[items.length - 1] += ' ' + text;
  });
  flush('end');
  return <>{out}</>;
}
