import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// Class rep requests: the level admin (or a Unify admin) approves or declines.
// Up to 3 class reps per class.
type Req = Awaited<ReturnType<typeof api.hocRequests>>['requests'][number];

export default function HocRequestsRoute() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => api.hocRequests().then((r) => { setRows(r.requests); setErr(''); }).catch((e) => setErr(describeError(e, 'load the requests')));
  useEffect(() => { void load(); }, []);

  const answer = async (r: Req, approve: boolean) => {
    let note: string | undefined;
    if (!approve) {
      const n = window.prompt('Tell them why (optional):', '');
      if (n === null) return;
      note = n.trim() || undefined;
    }
    setBusy(r.id);
    try {
      await api.hocAnswer(r.id, approve, note);
      toastSuccess(approve ? `${r.name} is now a class rep for ${r.department} ${r.level}.` : 'Declined. They were told.');
      await load();
    } catch (e) {
      errorToast(e, 'answer that request');
    } finally {
      setBusy('');
    }
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 640px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const pending = (rows || []).filter((r) => r.status === 'pending');
  const done = (rows || []).filter((r) => r.status !== 'pending').slice(0, 20);
  return (
    <div style={shell}>
      <BackButton to={ROUTES.me} />
      <Label>Level admin</Label>
      <Display size={28}>Class rep requests</Display>
      {err ? (
        <Card style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
          <BoxBoy pose="peeking" width={100} />
          <div className="t-13 muted">{err}</div>
        </Card>
      ) : rows === null ? (
        <SectionSkeleton rows={3} />
      ) : (
        <>
          {pending.length === 0 && (
            <Card style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
              <BoxBoy pose="chairRelax" width={110} />
              <div className="t-15 w-6">No requests waiting</div>
              <div className="t-13 muted">When a student asks to be class rep for a class you look after, it shows here and you get a notification.</div>
            </Card>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {pending.map((r) => (
              <Card key={r.id} style={{ gap: 6 }}>
                <div className="t-15 w-7">{r.name}</div>
                <div className="t-13 muted">{r.email} · {r.department} · {r.level}</div>
                <div className="t-13">{r.repsInClass} of 3 class reps already{r.repsInClass >= 3 ? ': full, remove one first' : ''}</div>
                {r.note && <div className="t-13">"{r.note}"</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn--amber btn--sm" disabled={busy === r.id || r.repsInClass >= 3} onClick={() => void answer(r, true)}>Approve</button>
                  <button className="btn btn--white btn--sm" disabled={busy === r.id} onClick={() => void answer(r, false)}>Decline</button>
                </div>
              </Card>
            ))}
          </div>
          {done.length > 0 && (
            <section style={{ marginTop: 22 }}>
              <Label>Answered</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {done.map((r) => (
                  <div key={r.id} className="t-13" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{r.name} · {r.department} {r.level}</span>
                    <Pill tone={r.status === 'approved' ? 'good' : 'grey'}>{r.status}</Pill>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
