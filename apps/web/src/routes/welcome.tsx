import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Wordmark from '../components/Wordmark';
import { BoxBoy, type Pose } from '../components/redesign/brand';
import { Display, ProgressDots } from '../components/redesign/ui';
import { ROUTES } from '../lib/routes';
import { WELCOMED_KEY } from '../lib/welcome';

// S02–S05 — four intro slides before sign-up. Shown once per device
// (flag in lib/welcome); /auth sends first-time visitors here, Skip and the
// last slide hand off to /auth. Brand-green band + Box Boy on top, one
// amber action below.
const SLIDES: { pose: Pose; title: string; body: string }[] = [
  { pose: 'readingStanding', title: 'Notes that make sense', body: 'Guided weekly notes for every course, written for your level and your semester.' },
  { pose: 'thumbsUp', title: 'Remember it for good', body: 'Recall decks, quick quizzes and streaks that pull you back the next day.' },
  { pose: 'armsCrossed', title: 'Know your CGPA target', body: 'Set a target and see exactly what each course needs to get you there.' },
  { pose: 'phoneOut', title: 'Never miss a class', body: 'Your timetable, your attendance pass and a nudge the moment new notes land.' },
];

export default function WelcomeRoute() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  const finish = (tab: 'signin' | 'signup') => {
    try {
      localStorage.setItem(WELCOMED_KEY, '1');
    } catch {
      // private mode: the slides simply show again next visit
    }
    navigate(`${ROUTES.auth}?tab=${tab}`, { replace: true });
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 'var(--shell, 480px)', margin: '0 auto', background: 'var(--u-page)' }}>
      <div style={{ background: 'var(--u-green)', borderRadius: '0 0 32px 32px', padding: '18px 20px 0', minHeight: 360, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {i > 0 ? (
            <button onClick={() => setI(i - 1)} aria-label="Back" style={{ color: 'var(--u-black)', display: 'flex', padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Wordmark size={18} onGreen />
          )}
          {!last && (
            <button onClick={() => finish('signup')} className="link-btn" style={{ color: 'var(--u-black)', padding: 6, fontSize: 14 }}>
              Skip
            </button>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <BoxBoy key={s.pose} pose={s.pose} width={240} style={{ animation: 'boxboy-bob 2.2s ease-in-out infinite' }} />
        </div>
      </div>

      <div style={{ padding: '24px 24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProgressDots step={i + 1} total={SLIDES.length} color="var(--u-text)" />
        <Display size={32}>{s.title}</Display>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--u-text-2)' }}>{s.body}</p>
        <div style={{ flex: 1 }} />
        {last ? (
          <>
            <button className="btn btn--amber btn--block" onClick={() => finish('signup')}>Create my account</button>
            <button className="btn btn--white btn--block" onClick={() => finish('signin')}>I already have an account</button>
          </>
        ) : (
          <button className="btn btn--amber btn--block" onClick={() => setI(i + 1)}>Next</button>
        )}
      </div>
    </div>
  );
}
