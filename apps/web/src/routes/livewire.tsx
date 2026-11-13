import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import LiveWire from '../components/LiveWire';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Live wire, on its own page for everyone who can send one: class reps,
// lecturers, contributors, level admins, HODs, deans and admins. Send an
// urgent countdown message to the students you look after, and see or end
// the ones you've sent. (They also show on Home.)
export default function LiveWireRoute() {
  const [canSend, setCanSend] = useState<boolean | null>(null);
  useEffect(() => {
    api.liveWires().then((r) => setCanSend(r.targets.length > 0)).catch(() => setCanSend(false));
  }, []);
  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 720px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.me} />
      <Label>Urgent messages</Label>
      <Display size={28}>Live wire</Display>
      <div className="t-14 muted" style={{ marginTop: 4, marginBottom: 14 }}>
        A message with a countdown (a test starting, a deadline, a venue change). It sits at the top of Home for the students you pick until the time runs out, and rings their bell with a push.
      </div>
      {canSend === null && <SectionSkeleton rows={2} quote={false} />}
      {canSend === false && (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="peeking" width={100} />
          <div className="t-15 w-7">Live wire is for the people who run a class</div>
          <div className="t-13 muted">Class reps, lecturers, contributors, level admins, HODs and deans can send one. Live wires sent to you show on Home.</div>
          <Link to={ROUTES.home} className="btn btn--amber btn--block">Go Home</Link>
        </Card>
      )}
      {canSend && <LiveWire style={{ margin: 0 }} />}
    </div>
  );
}
