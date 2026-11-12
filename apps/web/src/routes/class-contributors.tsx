import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// S56 Contributors: who is writing notes for your class's courses, and
// whether each course is keeping up with the semester. Class reps see their
// own class; admins can open any class with ?department=&level=.
type Data = Awaited<ReturnType<typeof api.classContributors>>;

const ago = (iso: string | null) => {
  if (!iso) return 'nothing published yet';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? 'published today' : d === 1 ? 'published yesterday' : `last published ${d} days ago`;
};

export default function ClassContributorsRoute() {
  const [params] = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const department = params.get('department');
    const level = params.get('level');
    api.classContributors(department && level ? { department, level } : undefined).then(setData).catch((e) => setErr(describeError(e, 'load contributors')));
  }, [params]);

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 640px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.me} />
      <Label>{data ? `${data.level} · ${data.department}` : 'Your class'}</Label>
      <Display size={28}>Contributors</Display>
      {err && <div className="t-13" style={{ color: 'var(--u-red)', marginTop: 12 }}>{err}</div>}
      {!data && !err && <div className="t-13 muted" style={{ marginTop: 12 }}>Loading…</div>}
      {data && (
        <>
          <Card tone="dark" pad={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 }}>
            <span className="display" style={{ fontSize: 48, color: 'var(--u-green)' }}>{data.contributors}</span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="t-15 w-7">contributor{data.contributors === 1 ? '' : 's'}</span>
              <span className="t-13" style={{ color: '#aaa' }}>
                {data.courses.length} course{data.courses.length === 1 ? '' : 's'} in your class
                {data.week != null ? ` · ${data.onTrack} on track · ${data.behind} behind` : ''}
              </span>
            </span>
          </Card>
          {data.week == null && <div className="t-13 muted" style={{ marginTop: 8 }}>The semester calendar isn't set yet, so on track and behind can't be worked out.</div>}
          {data.courses.length === 0 && (
            <div className="t-13 muted" style={{ marginTop: 12 }}>No courses yet. When your classmates add their courses, they show up here with who is writing them.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {data.courses.map((c) => (
              <Card key={c.course} pad={14} style={{ gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="t-15 w-7" style={{ flex: 1 }}>{c.course}</span>
                  {c.status === 'on_track' && <Pill tone="good">On track</Pill>}
                  {c.status === 'behind' && <Pill tone="warn">Behind</Pill>}
                </div>
                <div className="t-13 muted">
                  {c.latestWeek ? `Up to Week ${c.latestWeek}` : 'No weeks yet'}
                  {data.week != null ? ` · this is Week ${data.week}` : ''} · {ago(c.lastPublished)}
                </div>
                {c.people.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.people.map((p) => (
                      <span key={p.id} className={`pill ${p.role === 'contributor' ? 'pill--good' : 'pill--grey'}`}>{p.name}{p.role === 'lecturer' ? ' · lecturer' : ''}</span>
                    ))}
                  </div>
                ) : (
                  <div className="t-13" style={{ color: 'var(--u-warn-ink, #b45309)' }}>Nobody is writing this course yet. Know someone who is good at it? Tell the Unify team from Me → Help and they'll bring them on.</div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
