import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// S34: your streak. Days you studied over the last five weeks, current and
// longest run, XP and quizzes. Kind, not shaming: missing a day just restarts it.
export default function StreakRoute() {
  const [act, setAct] = useState<Awaited<ReturnType<typeof api.learnActivity>> | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.stats>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api.learnActivity(35), api.stats()]).then(([a, s]) => { setAct(a); setStats(s); }).catch((e) => setErr(describeError(e, 'load your streak')));
  }, []);

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.home} /><Card style={{ marginTop: 8 }}><div className="t-13 muted">{err}</div></Card></div>;
  if (!act || !stats) return <div style={shell}><SectionSkeleton rows={3} /></div>;

  const studied = new Set(act.days.filter((d) => d.xp > 0).map((d) => d.date));
  // Five rows of seven, oldest first, ending today.
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(Date.now() - (34 - i) * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }), today: i === 34 };
  });

  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose={act.streak > 0 ? 'cheer' : 'readingStanding'} width={110} />
        <Label>Your streak</Label>
        <Display size={44}>{act.streak} day{act.streak === 1 ? '' : 's'}</Display>
        <div className="t-13 muted">{act.streak > 0 ? 'Study a little today to keep it going.' : 'Finish one topic today to start a new one.'}</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
        {[['Longest', `${act.longest} day${act.longest === 1 ? '' : 's'}`], ['XP', String(stats.xp)], ['Quizzes', stats.quizzesTaken ? `${stats.quizzesTaken} · ${stats.quizAvg}%` : '0']].map(([k, v]) => (
          <Card key={k} pad={12} style={{ alignItems: 'center', textAlign: 'center', gap: 2 }}>
            <div className="t-15 w-7">{v}</div>
            <div className="t-12 muted">{k}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 12, gap: 8 }}>
        <div className="t-15 w-7">Last five weeks</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {days.map((d) => (
            <span
              key={d.key}
              title={`${d.label}${studied.has(d.key) ? ': studied' : ''}`}
              aria-label={`${d.label}${studied.has(d.key) ? ', studied' : ''}`}
              style={{ aspectRatio: '1 / 1', borderRadius: 8, background: studied.has(d.key) ? 'var(--u-green)' : 'var(--surface2)', border: `1px solid ${d.today ? 'var(--text)' : 'var(--border)'}` }}
            />
          ))}
        </div>
        <div className="t-12 muted">Green means you finished a topic, a quiz or checked in that day.</div>
      </Card>

      <Link to="/revision" className="btn btn--amber btn--block" style={{ marginTop: 16 }}>Revise for 5 minutes</Link>
    </div>
  );
}
