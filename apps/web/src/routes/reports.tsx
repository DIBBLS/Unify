import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Attendance reports for heads of department, the Dean and admins.
// Counts only, never names (review p.11).
type Data = Awaited<ReturnType<typeof api.attendanceReport>>;

export default function ReportsRoute() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.attendanceReport().then(setData).catch((e) => setErr(describeError(e, 'load the report')));
  }, []);
  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  return (
    <div style={shell}>
      <BackButton to={ROUTES.me} />
      <Label>{data?.scope === 'all' ? 'All classes' : data?.scope || 'Reports'}</Label>
      <Display size={28}>Attendance</Display>
      <div className="t-13 muted" style={{ marginTop: 6 }}>Counts only. Attendance rate = marks ÷ (classes held × students on the class list).</div>
      {err ? (
        <Card style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
          <BoxBoy pose="peeking" width={100} />
          <div className="t-13 muted">{err}</div>
        </Card>
      ) : !data ? (
        <SectionSkeleton rows={3} />
      ) : data.classes.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
          <BoxBoy pose="chairRelax" width={110} />
          <div className="t-15 w-6">No class lists yet</div>
          <div className="t-13 muted">Reports start once class reps upload their class lists and take attendance.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {data.classes.map((c) => (
            <Card key={`${c.department}-${c.level}`} style={{ gap: 8 }}>
              <div className="t-15 w-7">{c.department} · {c.level}</div>
              <div className="t-13 muted">{c.students} students on the class list · {c.onUnify} on Unify</div>
              {c.courses.length === 0 ? (
                <div className="t-13 muted">No attendance taken yet.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                        <th style={{ padding: '6px 4px' }}>Course</th>
                        <th style={{ padding: '6px 4px' }}>Classes held</th>
                        <th style={{ padding: '6px 4px' }}>Marks</th>
                        <th style={{ padding: '6px 4px' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.courses.map((r) => (
                        <tr key={r.course} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 700 }}>{r.course}</td>
                          <td style={{ padding: '6px 4px' }}>{r.held}</td>
                          <td style={{ padding: '6px 4px' }}>{r.marks}</td>
                          <td style={{ padding: '6px 4px' }}>{r.rate == null ? '–' : `${r.rate}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
