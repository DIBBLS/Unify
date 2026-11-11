import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { pushSupported, pushState, enablePush, disablePush, type PushState } from '../lib/push';
import { ROUTES } from '../lib/routes';
import { APP_VERSION } from '../lib/version';
import { useTheme } from '../hooks/useTheme';
import BackButton from '../components/BackButton';

// S48 Settings and S49 Notification settings, in the Me page's plain list style.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 };
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '13px 16px', color: 'var(--text)', textDecoration: 'none', borderTop: '1px solid var(--border)' };
const head: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text2)', margin: '4px 0 6px' };

function Row({ to, title, sub, first }: { to: string; title: string; sub?: string; first?: boolean }) {
  return (
    <Link to={to} style={{ ...rowStyle, borderTop: first ? 'none' : rowStyle.borderTop }}>
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{title}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{sub}</span>}
      </span>
      <ChevronRight size={16} color="var(--text3)" />
    </Link>
  );
}

export default function SettingsRoute() {
  const { theme, toggle } = useTheme();
  const [isHoc, setIsHoc] = useState(false);
  const [isStudent, setIsStudent] = useState(true);
  useEffect(() => {
    api.me().then((m) => {
      setIsHoc(!!(m.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc);
      setIsStudent((m.profile?.role || 'student') === 'student');
    }).catch(() => {});
  }, []);
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton to={ROUTES.me} />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginBottom: 16 }}>Settings</h1>

      <div style={head}>ACCOUNT</div>
      <div style={card}>
        <Row first to={ROUTES.me} title="Profile and picture" sub="Name, class, Box Boy or photo" />
        {isStudent && <Row to={ROUTES.attendanceSetup} title="Attendance details" sub="Your entry on the class list" />}
        {isStudent && <Row to={isHoc ? ROUTES.classList : ROUTES.hocRequest} title={isHoc ? 'Class list' : 'Are you your class rep?'} />}
        {isStudent && <Row to="/cgpa-planner" title="CGPA plan" sub="Your target and what it takes" />}
      </div>

      <div style={head}>APP</div>
      <div style={card}>
        <Row first to="/settings/notifications" title="Notifications" sub="Push, email and quiet hours" />
        <button onClick={toggle} style={{ ...rowStyle, width: '100%', background: 'none', border: 'none', borderTop: rowStyle.borderTop, textAlign: 'left' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Theme</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      <div style={head}>ABOUT</div>
      <div style={card}>
        <div style={{ ...rowStyle, borderTop: 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Version</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{APP_VERSION}</span>
        </div>
        <Row to={ROUTES.me} title="Help, or delete my account" sub="At the bottom of Me" />
      </div>
    </div>
  );
}

export function NotificationSettingsRoute() {
  const [pushSt, setPushSt] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);
  const [emails, setEmails] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [from, setFrom] = useState('22:00');
  const [to, setTo] = useState('07:00');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pushSupported()) setPushSt('unsupported');
    else void pushState().then(setPushSt).catch(() => {});
    api.me().then((m) => {
      const p = m.profile;
      setEmails(p?.notify_new_notes !== false);
      if (p?.quiet_start && p?.quiet_end) { setQuiet(true); setFrom(p.quiet_start); setTo(p.quiet_end); }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const save = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    try { await api.updateMe(patch); toastSuccess(done); }
    catch (e) { errorToast(e, 'save that'); }
    finally { setBusy(false); }
  };
  const flipPush = async () => {
    setBusy(true);
    try {
      if (pushSt === 'on') { await disablePush(); setPushSt('off'); }
      else {
        const r = await enablePush();
        if (r.ok) setPushSt('on');
        else { if (r.kind === 'blocked') setPushSt('denied'); errorToast(new Error(r.reason || 'Could not turn on push.'), 'turn on push'); }
      }
    } finally { setBusy(false); }
  };
  const field: React.CSSProperties = { padding: 8, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton to="/settings" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginBottom: 16 }}>Notifications</h1>
      <div style={card}>
        <div style={{ ...rowStyle, borderTop: 'none' }}>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Push on this phone</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {pushSt === 'unsupported' ? "This browser can't do push. Install the app from the browser menu." : pushSt === 'denied' ? 'Blocked in your phone settings for this site.' : 'New notes, class changes and messages from your class rep.'}
            </span>
          </span>
          <input type="checkbox" aria-label="Push on this phone" checked={pushSt === 'on'} disabled={busy || pushSt === 'unsupported' || pushSt === 'denied'} onChange={() => void flipPush()} />
        </div>
        <div style={rowStyle}>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Email me when new notes land</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>For courses you take. Account and security emails always come.</span>
          </span>
          <input type="checkbox" aria-label="Email me when new notes land" checked={emails} disabled={busy || !loaded} onChange={(e) => { setEmails(e.target.checked); void save({ notifyNewNotes: e.target.checked }, e.target.checked ? 'New-note emails on.' : 'New-note emails off.'); }} />
        </div>
      </div>

      <div style={card}>
        <div style={{ ...rowStyle, borderTop: 'none' }}>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Quiet hours</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>No push in these hours. Everything still waits in Notifications, and a class going live always comes through.</span>
          </span>
          <input type="checkbox" aria-label="Quiet hours" checked={quiet} disabled={busy || !loaded} onChange={(e) => { setQuiet(e.target.checked); void save(e.target.checked ? { quietStart: from, quietEnd: to } : { quietStart: null, quietEnd: null }, e.target.checked ? `Quiet from ${from} to ${to}.` : 'Quiet hours off.'); }} />
        </div>
        {quiet && (
          <div style={{ ...rowStyle, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>From <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} style={field} /></label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>To <input type="time" value={to} onChange={(e) => setTo(e.target.value)} style={field} /></label>
            <button className="btn btn--amber btn--sm" disabled={busy || from === to} onClick={() => void save({ quietStart: from, quietEnd: to }, `Quiet from ${from} to ${to}.`)}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}
