import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display } from '../components/redesign/ui';

// Online classes aren't built yet (needs session + check-in endpoints).
// This page says so instead of showing fake check-ins.
export default function OnlineClassRoute() {
  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.timetable} />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="chairRelax" width={120} />
        <Display size={26}>Online classes are coming</Display>
        <div className="t-15">For now, your lecturer shares a code in class: use Mark attendance on the Timetable tab.</div>
      </Card>
    </div>
  );
}
