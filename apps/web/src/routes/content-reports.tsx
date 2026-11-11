import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// Problems students reported (S27) and lecturers' reviews (L13), for the
// people who write and teach the course. Students are anonymous here.
type R = Awaited<ReturnType<typeof api.contentReports>>['reports'][number];

export default function ContentReportsRoute() {
  const [params] = useSearchParams();
  const course = params.get('course') || '';
  const [rows, setRows] = useState<R[] | null>(null);
  const [err, setErr] = useState('');
  const [showDone, setShowDone] = useState(false);
  const load = () => api.contentReports(course || undefined).then((r) => setRows(r.reports)).catch((e) => setErr(describeError(e, 'load the reports')));
  useEffect(() => { void load(); }, [course]);

  const resolve = async (id: string) => {
    try { await api.contentReportResolve(id); await load(); }
    catch (e) { errorToast(e, 'mark that fixed'); }
  };

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const open = (rows || []).filter((r) => r.status === 'open');
  const done = (rows || []).filter((r) => r.status !== 'open');
  return (
    <div style={shell}>
      <BackButton to="/home" />
      <Label>{course || 'Your courses'}</Label>
      <Display size={28}>Reports and reviews</Display>
      {err ? (
        <Card style={{ marginTop: 16 }}><div className="t-13 muted">{err}</div></Card>
      ) : rows === null ? (
        <SectionSkeleton rows={3} />
      ) : (
        <>
          {open.length === 0 && (
            <Card style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
              <BoxBoy pose="chairRelax" width={100} />
              <div className="t-15 w-6">Nothing open</div>
              <div className="t-13 muted">When a student reports a problem or a lecturer reviews a week, it lands here.</div>
            </Card>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {open.map((r) => (
              <Card key={r.id} style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pill tone={r.kind === 'review' ? 'amber' : 'warn'}>{r.kind === 'review' ? 'Lecturer review' : r.reason || 'Problem'}</Pill>
                  <span className="t-12 muted">{r.from} · {new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                </div>
                <Link to={`/learn/${encodeURIComponent(r.course)}/week/${r.week}`} className="t-15 w-7" style={{ color: 'var(--text)' }}>{r.course} · Week {r.week}{r.topic ? ` · ${r.topic}` : ''}</Link>
                <div className="t-14" style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Link to={`/studio?edit=${encodeURIComponent(r.course)}&week=${r.week}`} className="btn btn--white btn--sm">Open in Studio</Link>
                  <button className="btn btn--amber btn--sm" onClick={() => void resolve(r.id)}>Mark fixed</button>
                </div>
              </Card>
            ))}
          </div>
          {done.length > 0 && (
            <>
              <button className="btn btn--white btn--sm" style={{ marginTop: 16 }} onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'} fixed ({done.length})</button>
              {showDone && done.map((r) => (
                <div key={r.id} className="t-13 muted" style={{ marginTop: 8 }}>{r.course} Week {r.week}: {r.text.slice(0, 80)}</div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
