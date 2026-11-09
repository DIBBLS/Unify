import LoadingQuote from '../components/LoadingQuote';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import ErrorState from '../components/ErrorState';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard, ListRow, Pill, ProgressBar } from '../components/redesign/ui';

type Data = Awaited<ReturnType<typeof api.attendanceMine>>;

// My attendance: attended / sessions held for each enrolled course.
export default function MyAttendanceRoute() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    api.attendanceMine().then(setData).catch((e) => { errorToast(e, 'load your attendance'); setFailed(true); });
  };
  useEffect(load, []);

  const shell = { maxWidth: 'min(var(--shell, 480px), 720px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (failed) return <div style={shell}><ErrorState message="We couldn't load your attendance." onRetry={load} /></div>;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.timetable} />
      <Label>Attendance</Label>
      <Display size={30}>My record</Display>
      <Link to={ROUTES.attendancePass} className="btn btn--amber btn--block" style={{ marginTop: 16 }}>Mark attendance</Link>

      {!data ? (
        <><div className="skel" style={{ height: 140, borderRadius: 24, marginTop: 16 }} /><LoadingQuote style={{ margin: '24px auto 0' }} /></>
      ) : data.courses.length === 0 ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-6">No courses yet</div>
          <div className="t-13 muted">Add your courses from Courses and your attendance shows up here.</div>
        </Card>
      ) : (
        <ListCard style={{ marginTop: 16 }}>
          {data.courses.map((c) => {
            const pct = c.held ? Math.round((c.attended / c.held) * 100) : 0;
            return (
              <div key={c.course} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div className="t-15 w-6">{c.course}</div>
                  {c.held === 0 ? <Pill>No classes yet</Pill> : <Pill tone={pct >= 75 ? 'good' : pct >= 50 ? 'amber' : 'bad'}>{pct}%</Pill>}
                </div>
                <div className="t-13 muted" style={{ margin: '4px 0 8px' }}>{c.attended} of {c.held} classes</div>
                <ProgressBar value={c.held ? c.attended / c.held : 0} color={pct >= 75 ? 'var(--u-green)' : 'var(--u-amber)'} />
              </div>
            );
          })}
        </ListCard>
      )}

      {data && data.recent.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <Label>Recently marked</Label>
          <ListCard style={{ marginTop: 8 }}>
            {data.recent.map((r, i) => (
              <ListRow key={i} title={r.course} sub={new Date(r.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} />
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}
