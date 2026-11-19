import { useCallback, useEffect, useRef, useState } from 'react';
import { askConfirm } from '../lib/dialog';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, type AttendancePass } from '../lib/api';
import { errorToast, describeError } from '../lib/errors';
import { resolvePicture } from '../lib/picture';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// My pass: in class, students never scan. They show this QR and the class rep
// (HOC) or lecturer scans it. The QR changes every 30 seconds (we don't say
// so on screen: Review 3, C2, mentioning screenshots invites people to try).
// Opened from a week on the course page (?course&week&class&title), it says
// which class it's for and goes back to the course.
// Online class (?online=1): there is no room to scan in, so the student types
// the 6-digit code the lecturer shares in the meeting chat.
export default function AttendancePassRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Old links (?c=) came from the lecturer's QR; that code now only exists for online classes.
  const [codeMode, setCodeMode] = useState(params.get('online') === '1' || !!params.get('c'));
  const onlineCourse = (params.get('course') || '').slice(0, 20);
  const rawMeet = params.get('m') || '';
  const meetHref = /^https:\/\/[^\s]+$/i.test(rawMeet) ? rawMeet : '';
  const [ready, setReady] = useState(false);
  const week = Number(params.get('week')) || 0;
  const forClass = week > 0 && onlineCourse ? {
    course: onlineCourse, week, n: Number(params.get('class')) || 0, title: (params.get('title') || '').slice(0, 80),
  } : null;
  const [waiting, setWaiting] = useState(false);

  // First time? Once the class rep has uploaded the class list, find yourself on it;
  // before that, give your name + matric so a class rep can type you in if your phone dies.
  useEffect(() => {
    const setup = () => navigate(`${ROUTES.attendanceSetup}?next=${encodeURIComponent(ROUTES.attendancePass + window.location.search)}`, { replace: true });
    Promise.all([api.attendanceProfile(), api.classListMe().catch(() => null)])
      .then(([p, cl]) => {
        if (cl?.list) {
          if (!cl.entry && !cl.request) return setup();
          setWaiting(!cl.entry && !!cl.request);
        } else if (!p.fullName || !p.matric) return setup();
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [navigate]);

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (!ready) return <div style={shell}><Loading text="Getting your pass ready…" /></div>;

  return (
    <div style={shell}>
      <BackButton to={forClass ? ROUTES.course(forClass.course) : ROUTES.timetable} label={forClass ? `Week ${forClass.week}${forClass.n ? ` · Class ${forClass.n}` : ''}` : undefined} />
      {forClass && !codeMode && (
        <div className="t-13 w-7" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--u-black)', color: '#fff' }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--u-green)', flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[forClass.course, forClass.title].filter(Boolean).join(' · ')}</span>
        </div>
      )}
      {waiting && !codeMode && (
        <Link to={ROUTES.attendanceSetup} className="t-13" style={{ display: 'block', marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none' }}>
          Your class rep is checking your class-list request. Your pass still works meanwhile.
        </Link>
      )}
      {codeMode ? (
        <OnlineCode course={onlineCourse} meetHref={meetHref} initial={(params.get('c') || '').replace(/\D/g, '').slice(0, 6)} onPass={() => setCodeMode(false)} />
      ) : (
        <MyPass onOnline={() => setCodeMode(true)} week={forClass?.week || 0} />
      )}
      <Link to={ROUTES.attendanceMine} className="btn btn--white btn--block" style={{ marginTop: 12 }}>My attendance</Link>
    </div>
  );
}

function MyPass({ onOnline, week }: { onOnline: () => void; week: number }) {
  const [pass, setPass] = useState<AttendancePass | null>(null);
  const [err, setErr] = useState('');
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    try {
      setPass(await api.attendancePass());
      setErr('');
    } catch (e) {
      setErr(describeError(e, 'load your pass'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // New QR the moment the old one rotates, and whenever the app comes back to the front.
  useEffect(() => {
    if (!pass) return;
    const ms = Math.max(500, new Date(pass.rotatesAt).getTime() - Date.now() + 300);
    const t = window.setTimeout(() => void load(), ms);
    return () => window.clearTimeout(t);
  }, [pass, load]);
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', onShow);
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('online', onShow); };
  }, [load]);
  useEffect(() => {
    if (!pass) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(pass.rotatesAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [pass]);

  // S62: once scanned, show who marked you (checked every 10 s while the pass is open)
  // so a student can flag someone who isn't their lecturer or class rep.
  const [marked, setMarked] = useState<{ course: string; at: string; by: string } | null>(null);
  const [flagged, setFlagged] = useState(false);
  useEffect(() => {
    let gone = false;
    const check = () =>
      api.attendanceMine().then((r) => {
        const m = r.recent.find((x) => x.method !== 'code' && Date.now() - new Date(x.at).getTime() < 30 * 60 * 1000);
        if (!gone) setMarked(m ? { course: m.course, at: m.at, by: m.by || '' } : null);
      }).catch(() => {});
    void check();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 10000);
    return () => { gone = true; window.clearInterval(t); };
  }, []);

  // Keep the screen awake while the pass is up (best effort; not every phone allows it).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wl?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, []);

  const s = pass?.student;
  const pic = s ? resolvePicture({ avatar_url: s.avatar, box_boy_persona: s.persona }) : null;
  // S74: offline past the scanner's grace window, the old QR no longer works:
  // say so instead of showing a code that will be refused.
  const stale = !!pass && left === 0 && Date.now() > new Date(pass.rotatesAt).getTime() + pass.rotateSeconds * 1000;

  return (
    <>
      <Card tone="dark" style={{ alignItems: 'center', textAlign: 'center', marginTop: 8, gap: 10 }}>
        <div className="eyebrow" style={{ color: 'var(--u-green)' }}>My pass</div>
        {s && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            {pic && pic.kind !== 'none' ? (
              <img src={pic.src} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <BoxBoy pose="phoneOut" width={52} />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="t-15 w-7">{s.name}</div>
              <div className="t-13" style={{ opacity: 0.75 }}>{[s.matric, s.level, s.department].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        )}
        <div style={{ background: '#fff', padding: 14, borderRadius: 18, lineHeight: 0, minWidth: 288, minHeight: 288, display: 'grid', placeItems: 'center' }} aria-label="Your attendance pass QR code">
          {pass && !stale ? (
            <QRCodeSVG value={pass.token} size={260} level="M" />
          ) : stale ? (
            <span style={{ display: 'grid', placeItems: 'center', gap: 8, color: '#0a0a0a', lineHeight: 1.4, padding: 12 }}>
              <BoxBoy pose="phoneOut" width={70} calm />
              <span className="t-15 w-7">Reconnect to refresh your pass</span>
              <span className="t-13" style={{ color: '#555' }}>Your pass changes every 30 seconds and needs the internet to get a new one. Turn on data or wifi.</span>
            </span>
          ) : (
            <span className="t-13" style={{ color: '#555', lineHeight: 1.4 }}>{err ? 'No pass yet' : 'Loading your pass…'}</span>
          )}
        </div>
        <div role="status" aria-live="polite" className="t-13" style={{ minHeight: 20, color: err ? 'var(--u-red, #dc2626)' : undefined, opacity: err ? 1 : 0.75 }}>
          {stale ? 'No connection.' : err || (pass ? `New code in 0:${String(left).padStart(2, '0')}` : '')}
        </div>
        {(err || stale) && <button className="btn btn--amber btn--sm" onClick={() => void load()}>Try again</button>}
      </Card>
      {marked && (
        <Card style={{ marginTop: 12, gap: 6 }}>
          <div className="t-15 w-7" style={{ color: 'var(--u-good)' }}>Marked present for {marked.course}</div>
          <div className="t-13">
            {new Date(marked.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{marked.by ? ` · by ${marked.by}` : ''}
          </div>
          {flagged ? (
            <div className="t-12 muted">Thanks. The Unify Learn team will check it.</div>
          ) : (
            <button
              className="t-12"
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text2)', textDecoration: 'underline' }}
              onClick={() => { void askConfirm({ title: 'Report this scan?', body: `Tell Unify Learn that ${marked.by || 'the person who scanned you'} isn't your lecturer or class rep.`, confirmLabel: 'Report' }).then((ok) => { if (ok) void api.attendanceFlag({ course: marked.course, at: marked.at, by: marked.by }).then(() => setFlagged(true)).catch((e) => errorToast(e, 'send that')); }); }}
            >
              Not your lecturer or class rep? Tell Unify Learn
            </button>
          )}
        </Card>
      )}
      <div className="t-13 muted" style={{ textAlign: 'center', marginTop: 12 }}>
        {week > 0
          ? `Hold this up to your class rep or lecturer at the door. Once you're scanned, Week ${week} shows a tick.`
          : 'Show this to your class rep or lecturer. They scan it to mark you present.'}{' '}Phone dead? They can type your matric number instead.
      </div>
      <button className="btn btn--white btn--block" onClick={onOnline} style={{ marginTop: 14 }}>Online class? Enter the code</button>
    </>
  );
}

function OnlineCode({ course, meetHref, initial, onPass }: { course: string; meetHref: string; initial: string; onPass: () => void }) {
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ course: string; already: boolean } | null>(null);
  // S72: a wrong or expired code says why, right under the box.
  const [wrong, setWrong] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      setWrong('Enter the 6-digit code from the meeting chat.');
      return;
    }
    setBusy(true);
    setWrong('');
    try {
      const r = await api.attendanceCheckin(code);
      setDone({ course: r.course, already: r.already });
    } catch (e) {
      setWrong(describeError(e, 'mark attendance'));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="cheer" width={140} />
        <Display size={28}>{done.already ? 'Already marked' : "You're in!"}</Display>
        <div className="t-15">{done.already ? `You were already marked present for ${done.course}.` : `Marked present for ${done.course}.`}</div>
      </Card>
    );

  return (
    <>
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="phoneOut" width={110} />
        <Display size={28}>Enter the code from the meeting</Display>
        <div className="t-13 muted">
          Your lecturer shares a 6-digit code in the meeting chat{course ? ` for ${course}` : ''}. Type it here to be marked present.
        </div>
        {meetHref && (
          <a href={meetHref} target="_blank" rel="noopener noreferrer" className="btn btn--amber btn--sm" style={{ marginTop: 4 }}>Open the meeting</a>
        )}
      </Card>
      <input
        ref={inputRef}
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setWrong(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label="Attendance code"
        aria-invalid={!!wrong}
        aria-describedby={wrong ? 'code-wrong' : undefined}
        style={{ width: '100%', marginTop: 20, padding: 16, textAlign: 'center', fontSize: 34, letterSpacing: 10, fontWeight: 800, fontFamily: 'var(--font-body)', borderRadius: 16, border: `1px solid ${wrong ? 'var(--u-red, #dc2626)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)' }}
      />
      {wrong && (
        <div id="code-wrong" role="alert" className="t-13" style={{ marginTop: 8, color: 'var(--u-red, #dc2626)', textAlign: 'center' }}>
          {wrong} Codes change every 10 minutes: check the meeting chat for the latest one.
        </div>
      )}
      <button className="btn btn--amber btn--block" disabled={busy || code.length !== 6} onClick={() => void submit()} style={{ marginTop: 18 }}>
        {busy ? 'Checking…' : 'Mark me present'}
      </button>
      <button className="btn btn--white btn--block" onClick={onPass} style={{ marginTop: 12 }}>In class? Show my pass</button>
    </>
  );
}
