import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Class rep onboarding (review p.6): after approval, four short screens.
// 1 what you can do now, 2 upload the class list (first: classmates can't claim
// until it's in), 3 add the class timetable, 4 post the first announcement.
// Each step shows "Done" once it is, so coming back here works as a checklist.
type Status = { list: boolean; times: boolean; posted: boolean };

export default function HocWelcomeRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isHoc, setIsHoc] = useState<boolean | null>(null);
  const [done, setDone] = useState<Status>({ list: false, times: false, posted: false });

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const hoc = !!(me.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc;
        setIsHoc(hoc);
        if (!hoc) return;
        const [cl, posts, times] = await Promise.all([
          api.classList().catch(() => null),
          api.hocPosts().catch(() => null),
          Promise.allSettled((me.courses || []).map((c) => api.timetable(String(c)))),
        ]);
        const s: Status = {
          list: !!cl?.list && cl.entries.some((e) => !e.removed),
          times: times.some((t) => t.status === 'fulfilled' && t.value.slots.length > 0),
          posted: !!posts?.posts.some((p) => p.mine),
        };
        setDone(s);
        // Pick up where they left off.
        setStep(!s.list ? (sessionStorage.getItem('hocWelcomeSeen') ? 1 : 0) : !s.times ? 2 : !s.posted ? 3 : 0);
        try { sessionStorage.setItem('hocWelcomeSeen', '1'); } catch { /* optional */ }
      } catch {
        setIsHoc(false);
      }
    })();
  }, []);

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (isHoc === null) return <div style={shell} />;
  if (!isHoc)
    return (
      <div style={shell}>
        <BackButton to={ROUTES.me} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-6">This is for class reps</div>
          <div className="t-13 muted">Ask to be your class rep from Me → "Are you your class rep?".</div>
        </Card>
      </div>
    );

  const steps = [
    {
      pose: 'cheer' as const,
      title: "You're your class rep",
      body: (
        <ul className="t-15" style={{ margin: 0, paddingLeft: 20, textAlign: 'left', lineHeight: 1.6 }}>
          <li>Keep the class list: who's in your class, with matric numbers</li>
          <li>Set the class timetable everyone sees</li>
          <li>Take attendance from each course page by scanning passes</li>
          <li>Post announcements that reach your class only</li>
        </ul>
      ),
      action: null as null | { to: string; label: string },
      ok: false,
    },
    { pose: 'teaching' as const, title: 'Upload your class list', body: <p className="t-15">Names and matric numbers, from the Excel, Word or PDF your department gave you. Do this first: classmates can't confirm their place until it's in.</p>, action: { to: ROUTES.classList, label: 'Upload the class list' }, ok: done.list },
    { pose: 'phoneOut' as const, title: 'Add your class timetable', body: <p className="t-15">Add each class time once; it repeats every week on everyone's timetable, and each class gets its own attendance register.</p>, action: { to: ROUTES.timetable, label: 'Add class times' }, ok: done.times },
    { pose: 'wavePhone' as const, title: 'Post your first announcement', body: <p className="t-15">Say hello, share the timetable, or tell them to open My pass in class. Only your class gets it.</p>, action: { to: ROUTES.hoc, label: 'Write a post' }, ok: done.posted },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.hoc} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }} aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((x, i) => (
          <button
            key={i}
            aria-label={`Step ${i + 1}${x.ok ? ', done' : ''}`}
            onClick={() => setStep(i)}
            style={{ flex: 1, height: 6, borderRadius: 9999, background: i <= step || x.ok ? 'var(--u-green)' : 'var(--border)' }}
          />
        ))}
      </div>
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 12 }}>
        <BoxBoy pose={s.pose} width={120} />
        <Label>Step {step + 1} of {steps.length}</Label>
        <Display size={26}>{s.title}</Display>
        {s.body}
        {s.ok && (
          <div className="t-13 w-6" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--u-good)' }}>
            <Check size={16} /> Done
          </div>
        )}
      </Card>
      {s.action && (
        <Link to={s.action.to} className={`btn ${s.ok ? 'btn--white' : 'btn--amber'} btn--block`} style={{ marginTop: 16 }}>
          {s.ok ? `Open ${s.action.label.replace(/^(Upload|Add|Write) (the |a )?/, '').toLowerCase()}` : s.action.label}
        </Link>
      )}
      <button
        className={`btn ${s.action && !s.ok ? 'btn--white' : 'btn--amber'} btn--block`}
        style={{ marginTop: 10 }}
        onClick={() => (last ? navigate(ROUTES.hoc) : setStep(step + 1))}
      >
        {last ? 'Go to the class board' : s.action && !s.ok ? 'Later' : 'Next'}
      </button>
    </div>
  );
}
