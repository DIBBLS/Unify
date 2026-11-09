import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// Ask to be your class's Head of Class. Admins get a notification and
// approve it; you're told when it happens.
export default function BecomeHocRoute() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await api.hocRequest();
      setSent(true);
    } catch (e) {
      errorToast(e, 'send your request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.hoc} />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose={sent ? 'cheer' : 'keyHandover'} width={130} />
        <Display size={26}>{sent ? 'Request sent' : 'Become your class HOC'}</Display>
        <div className="t-15">
          {sent
            ? "An admin will review it. You'll get a notification when it's approved."
            : 'The Head of Class posts announcements and tips to everyone in the same department and level. Ask an admin to make you yours.'}
        </div>
      </Card>
      {sent ? (
        <button className="btn btn--amber btn--block" onClick={() => navigate(ROUTES.timetable)} style={{ marginTop: 20 }}>Back to timetable</button>
      ) : (
        <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void send()} style={{ marginTop: 20 }}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      )}
    </div>
  );
}
