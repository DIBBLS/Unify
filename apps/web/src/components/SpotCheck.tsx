import { useState } from 'react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { Card } from './redesign/ui';

// Spot check (design L16): call out 10 random names from the register. Anyone
// not in the room comes off the list, so a friend scanning someone's pass
// doesn't count them present.
type Person = { studentId: string; name: string; matric: string };

export default function SpotCheck({ sessionId, present, onChanged }: { sessionId: string; present: Person[]; onChanged: () => void }) {
  const [list, setList] = useState<Person[] | null>(null);
  const [i, setI] = useState(0);
  const [removed, setRemoved] = useState(0);
  const [busy, setBusy] = useState(false);

  const start = () => {
    const pool = present.filter((p) => p.studentId);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    setList(pool.slice(0, 10));
    setI(0);
    setRemoved(0);
  };
  const notHere = async (p: Person) => {
    setBusy(true);
    try {
      await api.attendanceRemove(sessionId, p.studentId);
      setRemoved((n) => n + 1);
      setI((x) => x + 1);
      onChanged();
    } catch (e) { errorToast(e, 'take them off the list'); }
    finally { setBusy(false); }
  };

  if (!list) {
    return (
      <Card tone="dark" pad={16} style={{ gap: 8, marginTop: 16 }}>
        <span className="eyebrow" style={{ color: 'var(--u-green)' }}>Spot check</span>
        <span className="t-14" style={{ color: '#f5f4f0' }}>Call out {Math.min(10, present.length)} random names. Anyone not in the room comes off the list.</span>
        <button className="btn btn--green btn--sm" style={{ alignSelf: 'flex-start' }} disabled={!present.length} onClick={start}>Start spot check</button>
      </Card>
    );
  }
  if (i >= list.length) {
    return (
      <Card tone="dark" pad={16} style={{ gap: 8, marginTop: 16 }}>
        <span className="eyebrow" style={{ color: 'var(--u-green)' }}>Spot check done</span>
        <span className="t-14" style={{ color: '#f5f4f0' }}>{removed ? `${removed} of ${list.length} weren't in the room and came off the list.` : `All ${list.length} were here.`}</span>
        <button className="btn btn--ghost-dark btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setList(null); if (removed) toastSuccess('Register updated.'); }}>Done</button>
      </Card>
    );
  }
  const p = list[i];
  return (
    <Card tone="dark" pad={16} style={{ gap: 10, marginTop: 16 }}>
      <span className="eyebrow" style={{ color: 'var(--u-green)' }}>Spot check · {i + 1} of {list.length}</span>
      <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 26, color: '#fff' }}>{p.name}</span>
      {p.matric && <span className="t-13" style={{ color: '#aaa' }}>{p.matric}</span>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn--green btn--sm" disabled={busy} onClick={() => setI(i + 1)}>Here</button>
        <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => void notHere(p)}>Not here</button>
      </div>
    </Card>
  );
}
