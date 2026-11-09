import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { startQrScan } from '../lib/qrscan';
import { errorToast, describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// Mark attendance: the lecturer shows a rotating QR in class and you scan it
// with the camera here. The 6-digit code underneath is the fallback (no camera,
// permission blocked). Scanning it with your phone's own camera also works: it
// opens this page with ?c= and marks you straight away.
export default function AttendancePassRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Scanning the lecturer's QR opens this page with ?c=123456.
  const [code, setCode] = useState(() => (params.get('c') || '').replace(/\D/g, '').slice(0, 6));
  const autoSent = useRef(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ course: string; already: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viaLink = !!params.get('c');
  const [showCode, setShowCode] = useState(viaLink);
  const [scanMsg, setScanMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const sending = useRef(false);

  // First time? Collect name + matric before the code.
  useEffect(() => {
    api
      .attendanceProfile()
      .then((p) => {
        if (!p.fullName || !p.matric) navigate(`${ROUTES.attendanceSetup}?next=${encodeURIComponent(ROUTES.attendancePass + (params.get('c') ? `?c=${params.get('c')}` : ''))}`, { replace: true });
        else setReady(true);
      })
      .catch(() => setReady(true));
  }, [navigate, params]);

  useEffect(() => {
    if (ready && showCode) inputRef.current?.focus();
  }, [ready, showCode]);

  // Camera: pull the 6 digits out of the class QR (a link with ?c=) and mark me.
  useEffect(() => {
    if (!ready || showCode || done || !videoRef.current) return;
    let handle: { stop: () => void } | null = null;
    let gone = false;
    void startQrScan(
      videoRef.current,
      async (text) => {
        if (sending.current) return;
        let digits = '';
        try { digits = (new URL(text).searchParams.get('c') || '').replace(/\D/g, ''); } catch { digits = text.replace(/\D/g, ''); }
        if (!/^\d{6}$/.test(digits)) { setScanMsg("That isn't a Unify attendance QR."); return; }
        sending.current = true;
        try {
          const r = await api.attendanceCheckin(digits);
          setDone({ course: r.course, already: r.already });
          try { navigator.vibrate?.(60); } catch { /* optional */ }
        } catch (e) {
          setScanMsg(describeError(e, 'mark attendance'));
          window.setTimeout(() => { sending.current = false; }, 2500); // let the next rotation be read
          return;
        }
        sending.current = false;
      },
      (m) => { setScanMsg(m); setShowCode(true); },
    ).then((h) => { if (gone) h.stop(); else handle = h; });
    return () => { gone = true; handle?.stop(); };
  }, [ready, showCode, done]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      errorToast(new Error('Enter the 6-digit code from your lecturer.'), 'mark attendance');
      return;
    }
    setBusy(true);
    try {
      const r = await api.attendanceCheckin(code);
      setDone({ course: r.course, already: r.already });
    } catch (e) {
      errorToast(e, 'mark attendance');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // Opened from the QR: submit straight away, once, as soon as we know the profile is set.
  useEffect(() => {
    if (ready && !autoSent.current && params.get('c') && /^\d{6}$/.test(code)) {
      autoSent.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;

  if (done)
    return (
      <div style={shell}>
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 24 }}>
          <BoxBoy pose="cheer" width={140} />
          <Display size={28}>{done.already ? 'Already marked' : "You're in!"}</Display>
          <div className="t-15">{done.already ? `You were already marked present for ${done.course}.` : `Marked present for ${done.course}.`}</div>
        </Card>
        <Link to={ROUTES.attendanceMine} className="btn btn--amber btn--block" style={{ marginTop: 20 }}>See my attendance</Link>
        <Link to={ROUTES.timetable} className="btn btn--white btn--block" style={{ marginTop: 12 }}>Back to timetable</Link>
      </div>
    );

  return (
    <div style={shell}>
      <BackButton to={ROUTES.timetable} />
      {!showCode ? (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8, gap: 10 }}>
            <BoxBoy pose="phoneOut" width={96} />
            <Display size={26}>Scan to mark attendance</Display>
            <div className="t-13 muted">Point your camera at the QR code your lecturer is showing.</div>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1 / 1', borderRadius: 18, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} aria-label="Camera" />
              <div style={{ position: 'absolute', inset: '14%', border: '3px solid var(--u-green)', borderRadius: 16, pointerEvents: 'none' }} />
            </div>
            <div role="status" aria-live="polite" className="t-13" style={{ minHeight: 20, color: scanMsg ? 'var(--u-red, #dc2626)' : 'var(--text2)' }}>
              {scanMsg || 'The QR changes every 30 seconds, so scan it while you are in class.'}
            </div>
          </Card>
          <button className="btn btn--white btn--block" onClick={() => setShowCode(true)} style={{ marginTop: 14 }}>Can't scan? Enter the code</button>
        </>
      ) : (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
            <BoxBoy pose="phoneOut" width={110} />
            <Display size={28}>Enter the class code</Display>
            <div className="t-13 muted">Type the 6-digit code under the QR on your lecturer's screen.</div>
            {scanMsg && !viaLink && <div className="t-12" style={{ color: 'var(--u-red, #dc2626)' }}>{scanMsg}</div>}
          </Card>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Attendance code"
            style={{ width: '100%', marginTop: 20, padding: 16, textAlign: 'center', fontSize: 34, letterSpacing: 10, fontWeight: 800, fontFamily: 'var(--font-body)', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <button className="btn btn--amber btn--block" disabled={busy || code.length !== 6} onClick={() => void submit()} style={{ marginTop: 18 }}>
            {busy ? 'Checking…' : 'Mark me present'}
          </button>
          {!viaLink && <button className="btn btn--white btn--block" onClick={() => { setScanMsg(''); setShowCode(false); }} style={{ marginTop: 12 }}>Scan the QR instead</button>}
        </>
      )}
      <Link to={ROUTES.attendanceMine} className="btn btn--white btn--block" style={{ marginTop: 12 }}>My attendance</Link>
    </div>
  );
}
