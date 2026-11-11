import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// "Are you your class rep?" (Me → Settings). The request goes to your class's
// level admin (or the Unify team); you're told when it's answered. Max 3 per class.
export default function BecomeHocRoute() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState('');

  const send = async () => {
    setBusy(true);
    try {
      await api.hocRequest(note.trim() || undefined);
      setSent(true);
    } catch (e) {
      errorToast(e, 'send your request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.me} />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose={sent ? 'cheer' : 'keyHandover'} width={130} />
        <Display size={26}>{sent ? 'Request sent' : 'Are you your class rep?'}</Display>
        <div className="t-15">
          {sent
            ? "Your class's level admin will check it. You'll get a notification when it's answered."
            : 'Class reps keep the class list, set the timetable, take attendance and post to the class. Each class can have up to 3.'}
        </div>
      </Card>
      {sent ? (
        <button className="btn btn--amber btn--block" onClick={() => navigate(ROUTES.me)} style={{ marginTop: 20 }}>Back to Me</button>
      ) : (
        <>
          <label className="t-13 w-6" style={{ display: 'block', marginTop: 18 }}>
            Anything the approver should know? (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="e.g. Elected class rep for 200L, 2026/27"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }}
            />
          </label>
          <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void send()} style={{ marginTop: 16 }}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </>
      )}
    </div>
  );
}
