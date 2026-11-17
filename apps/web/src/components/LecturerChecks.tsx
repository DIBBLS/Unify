import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { Card, Label } from './redesign/ui';

// Class rep (design S62): a lecturer added a course the class takes. The rep
// knows who teaches them, so they confirm it. Until they do, the lecturer sees
// "Waiting for Head of Class" and their posts and files don't reach the class.
type Check = Awaited<ReturnType<typeof api.hocLecturerChecks>>['checks'][number];

export default function LecturerChecks() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { api.hocLecturerChecks().then((r) => { setChecks(r.checks); setCls(r.class || ''); }).catch(() => {}); }, []);
  if (!checks.length) return null;

  const answer = async (c: Check, a: 'yes' | 'no') => {
    setBusy(c.id);
    try {
      await api.hocLecturerAnswer(c.id, a);
      toastSuccess(a === 'yes' ? `Confirmed. ${c.lecturer.name}'s posts for ${c.course} now reach your class.` : `Noted. ${c.lecturer.name} won't reach your class for ${c.course}.`);
      setChecks((x) => x.filter((y) => y.id !== c.id));
    } catch (e) {
      errorToast(e, 'answer that');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Label>Is this your lecturer?</Label>
      {checks.map((c) => {
        const initials = c.lecturer.name.split(/\s+/).filter((w) => !/\.$/.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <Card key={c.id} pad={16} style={{ gap: 10 }}>
            <div className="t-13 muted">A lecturer added a course your class takes. You know who teaches you, so you confirm it.</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {c.lecturer.avatar
                ? <img src={c.lecturer.avatar} alt="" style={{ width: 48, height: 48, borderRadius: 9999, objectFit: 'cover' }} />
                : <span style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{initials || '?'}</span>}
              <span>
                <span className="t-15 w-7" style={{ display: 'block' }}>{c.lecturer.name}</span>
                <span className="t-13 muted">{c.lecturer.department || 'Lecturer'}</span>
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="t-12 muted" style={{ fontWeight: 800, letterSpacing: 1 }}>ADDED THIS COURSE</div>
              <div className="t-15 w-7" style={{ marginTop: 2 }}>{c.course}{c.courseTitle ? ` · ${c.courseTitle}` : ''}</div>
              {cls && <div className="t-13 muted">for {cls}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn--green btn--sm" disabled={busy === c.id} onClick={() => void answer(c, 'yes')}><ShieldCheck size={15} /> Yes, {c.lecturer.name} teaches us</button>
              <button className="btn btn--white btn--sm" disabled={busy === c.id} onClick={() => void answer(c, 'no')}>No, not our lecturer</button>
            </div>
          </Card>
        );
      })}
      <div className="t-12 muted">Two lecturers share a course? Confirm both.</div>
    </section>
  );
}
