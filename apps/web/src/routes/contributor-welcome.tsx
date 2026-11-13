import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { StepsSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Contributor onboarding (Review Round 2): an admin assigns a student to write
// notes for two courses; the first time they open the app after that (and
// whenever their courses change) these four short screens explain the job.
// Shown automatically from Home (see markContributorWelcomed), and reachable
// any time from the dashboard.
const KEY = (uid: string) => `unify:contrib-welcome:${uid}`;
export const contributorWelcomeKey = (courses: string[]) => [...courses].sort().join('|');
export function contributorNeedsWelcome(uid: string, courses: string[]): boolean {
  if (!uid || !courses.length) return false;
  try { return localStorage.getItem(KEY(uid)) !== contributorWelcomeKey(courses); } catch { return false; }
}
function markWelcomed(uid: string, courses: string[]) {
  try { localStorage.setItem(KEY(uid), contributorWelcomeKey(courses)); } catch { /* fine */ }
}

type Course = { course: string; level: string; semester: string; totalTopics: number };

export default function ContributorWelcomeRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [uid, setUid] = useState('');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [isContributor, setIsContributor] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const role = me.profile?.role || 'student';
        setIsContributor(role === 'contributor');
        setUid(me.profile?.id || '');
        if (role !== 'contributor') return;
        const c = await api.contributions().catch(() => ({ courses: [] as (Course & { assigned: boolean })[] }));
        setCourses(c.courses.filter((x) => x.assigned));
      } catch {
        setIsContributor(false);
      }
    })();
  }, []);

  const finish = () => {
    if (uid && courses) markWelcomed(uid, courses.map((c) => c.course));
    navigate(ROUTES.home, { replace: true });
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (isContributor === null) return <StepsSkeleton />;
  if (!isContributor) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.me} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-6">This is for contributors</div>
          <div className="t-13 muted">Contributors are chosen by the Unify team, who assign them their courses.</div>
        </Card>
      </div>
    );
  }

  const names = (courses || []).map((c) => c.course);
  const steps = [
    {
      pose: 'cheer' as const,
      title: "You're a contributor",
      body: (
        <>
          <p className="t-15">You write the weekly notes your coursemates learn from{names.length ? <> for <b>{names.join(' and ')}</b></> : ''}.</p>
          <ul className="t-15" style={{ margin: 0, paddingLeft: 20, textAlign: 'left', lineHeight: 1.6 }}>
            <li>Turn each week's lecture into clear notes in Studio</li>
            <li>Keep up with the semester, week by week</li>
            <li>Fix anything students report</li>
          </ul>
        </>
      ),
    },
    {
      pose: 'teaching' as const,
      title: 'Your courses',
      body: courses && courses.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {courses.map((c) => (
            <div key={c.course} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', textAlign: 'left' }}>
              <span>
                <span style={{ display: 'block', fontWeight: 800 }}>{c.course}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[c.level, (c.semester || '').replace(' Semester', ' semester')].filter(Boolean).join(' · ') || 'Level not set'}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>{c.totalTopics} note{c.totalTopics === 1 ? '' : 's'} live</span>
            </div>
          ))}
          <div className="t-13 muted">Assigned by an admin. Ask them if a course should change.</div>
        </div>
      ) : (
        <p className="t-15">No courses yet. An admin assigns them; they appear here and on your dashboard.</p>
      ),
    },
    {
      pose: 'readingStanding' as const,
      title: 'Write each week in Studio',
      body: <p className="t-15">Bring the lecturer's slides or your own class notes. Studio drafts the week, you check and fix it, then publish. Aim to have each week live before the next class; your class rep sees who is on track.</p>,
      action: { to: '/studio', label: 'Open Studio' },
    },
    {
      pose: 'thumbsUp' as const,
      title: 'Fix what students report',
      body: <p className="t-15">When a student taps Report on your notes, it lands on your dashboard. A quick fix keeps everyone learning the right thing.</p>,
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div style={shell}>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }} aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((_, i) => (
          <button key={i} aria-label={`Step ${i + 1}`} onClick={() => setStep(i)} style={{ flex: 1, height: 6, borderRadius: 9999, border: 'none', background: i <= step ? 'var(--u-green)' : 'var(--border)' }} />
        ))}
      </div>
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 12 }}>
        <BoxBoy pose={s.pose} width={120} />
        <Label>Step {step + 1} of {steps.length}</Label>
        <Display size={26}>{s.title}</Display>
        {s.body}
      </Card>
      {'action' in s && s.action && (
        <Link to={s.action.to} onClick={() => { if (uid && courses) markWelcomed(uid, names); }} className="btn btn--white btn--block" style={{ marginTop: 16 }}>{s.action.label}</Link>
      )}
      <button className="btn btn--amber btn--block" style={{ marginTop: 10 }} onClick={() => (last ? finish() : setStep(step + 1))}>
        {last ? 'Go to my dashboard' : 'Next'}
      </button>
      {!last && <button className="link-btn" style={{ display: 'block', margin: '6px auto 0', background: 'none', border: 'none', color: 'var(--text2)' }} onClick={finish}>Skip for now</button>}
    </div>
  );
}
