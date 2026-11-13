import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { previousPath } from '../lib/navHistory';
import { ROUTES } from '../lib/routes';
import { APP_VERSION } from '../lib/version';
import { describeError } from '../lib/errors';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Report a bug: what went wrong, in the person's own words, plus what they
// were doing. The app adds the screen they came from, its version and the
// device, so they never have to know any of that. Reached from Me and from
// the error screens (?from=<path>&what=<the error>).
const field: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 15, resize: 'vertical',
};

function deviceSummary(): string {
  try {
    const ua = navigator.userAgent;
    const os = /Android [\d.]+/.exec(ua)?.[0] || /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, '.') || /Windows NT [\d.]+/.exec(ua)?.[0] || /Mac OS X [\d_]+/.exec(ua)?.[0]?.replace(/_/g, '.') || 'Unknown OS';
    const browser = /(Edg|OPR|SamsungBrowser|Chrome|Firefox|Version)\/[\d.]+/.exec(ua)?.[0]?.replace('Version', 'Safari') || 'Unknown browser';
    const installed = window.matchMedia?.('(display-mode: standalone)').matches ? ' · installed app' : '';
    return `${os} · ${browser} · ${window.innerWidth}×${window.innerHeight}${installed} · ${navigator.onLine ? 'online' : 'offline'}`;
  } catch {
    return '';
  }
}

export default function ReportBugRoute() {
  const [params] = useSearchParams();
  const from = params.get('from') || previousPath() || '';
  const [what, setWhat] = useState(params.get('what') || '');
  const [doing, setDoing] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (what.trim().length < 5) { setErr('Tell us a little more about what went wrong.'); return; }
    setBusy(true);
    setErr('');
    try {
      await api.bugReport({ what: what.trim(), doing: doing.trim() || undefined, page: from || undefined, appVersion: APP_VERSION, device: deviceSummary() });
      setSent(true);
    } catch (e) {
      setErr(describeError(e, 'send your report'));
    } finally {
      setBusy(false);
    }
  };

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (sent) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.me} />
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="thumbsUp" width={110} />
          <Display size={24}>Thanks, we've got it</Display>
          <div className="t-14 muted">Your report went straight to the Unify team. We'll look into it and fix it in an update.</div>
          <Link to={from || ROUTES.home} className="btn btn--amber btn--block">Back to where I was</Link>
        </Card>
      </div>
    );
  }
  return (
    <div style={shell}>
      <BackButton to={ROUTES.me} />
      <Label>Help us fix it</Label>
      <Display size={28}>Report a bug</Display>
      <div className="t-14 muted" style={{ marginTop: 6 }}>Something broken, stuck or looking wrong? Tell us in your own words.</div>
      <Card style={{ marginTop: 16, gap: 12 }}>
        <label className="t-13 w-7">What went wrong?
          <textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={4} maxLength={2000} placeholder="e.g. The quiz froze after question 3 and the Next button did nothing." style={{ ...field, marginTop: 6 }} />
        </label>
        <label className="t-13 w-7">What were you doing? <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
          <textarea value={doing} onChange={(e) => setDoing(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Doing the Week 3 quiz for MEE 301 on my phone." style={{ ...field, marginTop: 6 }} />
        </label>
        <div className="t-12 muted">We'll also send {from ? <>the screen you came from (<b>{from}</b>), </> : ''}the app version (v{APP_VERSION}) and your device type, so we can find it faster.</div>
        {err && <div className="t-13" style={{ color: 'var(--u-red)', fontWeight: 700 }}>{err}</div>}
        <button className="btn btn--amber btn--block" disabled={busy || !what.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send report'}</button>
      </Card>
    </div>
  );
}
