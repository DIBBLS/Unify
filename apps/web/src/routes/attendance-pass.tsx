import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// Mark attendance: the lecturer shows a 6-digit code in class, you enter it.
export default function AttendancePassRoute() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ course: string; already: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // First time? Collect name + matric before the code.
  useEffect(() => {
    api
      .attendanceProfile()
      .then((p) => {
        if (!p.fullName || !p.matric) navigate(`${ROUTES.attendanceSetup}?next=${ROUTES.attendancePass}`, { replace: true });
        else setReady(true);
      })
      .catch(() => setReady(true));
  }, [navigate]);

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

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
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="phoneOut" width={110} />
        <Display size={28}>Mark attendance</Display>
        <div className="t-13 muted">Enter the 6-digit code your lecturer is showing in class.</div>
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
      <Link to={ROUTES.attendanceMine} className="btn btn--white btn--block" style={{ marginTop: 12 }}>My attendance</Link>
    </div>
  );
}
