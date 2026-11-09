import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// One-time: the name and matric number lecturers see on the register.
const input: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 6, borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};

export default function AttendanceSetupRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [matric, setMatric] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.attendanceProfile().then((p) => { setFullName(p.fullName); setMatric(p.matric); }).catch(() => {});
  }, []);

  const save = async () => {
    if (fullName.trim().length < 2 || matric.trim().length < 3) {
      errorToast(new Error('Enter your full name and matric number.'), 'save your details');
      return;
    }
    setBusy(true);
    try {
      await api.attendanceSetProfile(fullName.trim(), matric.trim());
      navigate(params.get('next') ? decodeURIComponent(params.get('next') as string) : ROUTES.attendancePass, { replace: true });
    } catch (e) {
      errorToast(e, 'save your details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.timetable} />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="phoneOut" width={110} />
        <Display size={26}>Your attendance details</Display>
        <div className="t-13 muted">Your lecturer sees these on the register. You only do this once.</div>
      </Card>
      <div style={{ marginTop: 18 }}>
        <Label>Full name (as on your ID)</Label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Adaeze Okafor" autoComplete="name" style={input} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Label>Matric number</Label>
        <input value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="e.g. 190401001" autoCapitalize="characters" style={input} />
      </div>
      <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void save()} style={{ marginTop: 22 }}>
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </div>
  );
}
