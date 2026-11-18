import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Zap } from 'lucide-react';
import Wordmark from '../components/Wordmark';
import { BoxBoy, type Pose } from '../components/redesign/brand';
import { Display, ProgressDots } from '../components/redesign/ui';
import { ROUTES } from '../lib/routes';
import { WELCOMED_KEY } from '../lib/welcome';

// S02–S05: four intro slides before sign-up, rewritten in Review 3 from the
// 22 student interviews so each says what Unify Learn does. Shown once per
// device (flag in lib/welcome); /auth sends first-time visitors here, Skip and
// the last slide hand off to /auth. Green and black bands alternate: a short
// line on top, a big headline, one line at the bottom, a big Box Boy.
// Slide 4 ships because class changes and live wires reach students at once.
type Slide = { pose: Pose; top: string; title: string; body: string; extra?: 'course' | 'streak' | 'buzz' };
const SLIDES: Slide[] = [
  { pose: 'phoneOut', top: 'Outline. Notes. Past questions.', title: 'ALL IN ONE PLACE.', body: 'Every course you take, laid out week by week. No more asking around for the note.', extra: 'course' },
  { pose: 'sittingPhone', top: 'No more snapping the slides.', title: 'YOUR PHONE IS YOUR NOTE.', body: 'Every class is already on your phone, ready to read whenever you want.' },
  { pose: 'thumbsUpPhone', top: 'A few minutes a day.', title: 'REMEMBER WHAT YOU LEARNED.', body: "Quick quizzes bring back last week's class, so exam week feels like revision, not cramming.", extra: 'streak' },
  { pose: 'thumbsUp', top: 'Test moved? Outline changed?', title: "YOU'LL KNOW FIRST.", body: 'Class updates reach you the same time as everyone else, not through who you know.', extra: 'buzz' },
];

// Slide 1's phone screen, drawn in code so it's readable at any size.
function CourseMock() {
  return (
    <div aria-hidden="true" style={{ width: 150, background: '#fff', color: '#0a0a0a', borderRadius: 18, padding: 10, boxShadow: '0 12px 30px rgba(0,0,0,.25)', border: '3px solid #0a0a0a', fontSize: 10, textAlign: 'left' }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>MEE 301</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {['Outline', 'Notes', 'Past Qs'].map((t, i) => (
          <span key={t} style={{ padding: '2px 6px', borderRadius: 9999, fontWeight: 800, background: i === 1 ? '#0a0a0a' : '#f0efeb', color: i === 1 ? '#4ade80' : '#0a0a0a' }}>{t}</span>
        ))}
      </div>
      {['Week 1 · Basics', 'Week 2 · Forces', 'Week 3 · Energy'].map((w, i) => (
        <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '5px 6px', borderRadius: 8, background: '#f5f4f0', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: i < 2 ? '#16a34a' : '#e0deda' }} />{w}
        </div>
      ))}
    </div>
  );
}
export default function WelcomeRoute() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];
  const dark = i % 2 === 1;

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
      <div className="african-band" style={{ background: dark ? 'var(--u-black)' : 'var(--u-green)', color: dark ? '#fff' : 'var(--u-black)', borderRadius: '0 0 32px 32px', padding: '18px 20px 0', minHeight: 360, display: 'flex', flexDirection: 'column', transition: 'background .3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {i > 0 ? (
            <button onClick={() => setI(i - 1)} aria-label="Back" style={{ color: 'inherit', display: 'flex', padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Wordmark size={18} onGreen={!dark} />
          )}
          {!last && (
            <button onClick={() => finish('signup')} className="link-btn" style={{ color: 'inherit', padding: 6, fontSize: 14 }}>
              Skip
            </button>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, overflow: 'hidden', position: 'relative' }}>
          {s.extra === 'course' && <div key="mock" className="soft-in" style={{ alignSelf: 'center' }}><CourseMock /></div>}
          <span key={s.pose} className="soft-in" style={{ display: 'block', lineHeight: 0 }}><BoxBoy pose={s.pose} width={s.extra === 'course' ? 190 : 240} style={{ animation: 'boxboy-bob 2.2s ease-in-out infinite' }} /></span>
          {s.extra === 'streak' && (
            <span aria-hidden="true" style={{ position: 'absolute', top: 16, right: 24, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', fontWeight: 900 }}><Flame size={18} fill="currentColor" /> 5</span>
          )}
          {s.extra === 'buzz' && (
            <span aria-hidden="true" style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 14, background: '#fff', color: '#0a0a0a', fontSize: 12, fontWeight: 700, boxShadow: '0 8px 20px rgba(0,0,0,.2)', textAlign: 'left' }}>
              <Zap size={16} color="#d97706" fill="#fbbf24" /> MEE 352 moved to LT 3, 10:00 as planned
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProgressDots step={i + 1} total={SLIDES.length} color="var(--u-text)" />
        <div key={i} className="soft-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--u-text-2)' }}>{s.top}</div>
          <Display size={32}>{s.title}</Display>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--u-text-2)' }}>{s.body}</p>
        </div>
        <div style={{ flex: 1 }} />
        {/* Review 3 (C12): the main button always visible, in a bar at the bottom. */}
        <div style={{ position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 calc(8px + env(safe-area-inset-bottom))', background: 'linear-gradient(to bottom, transparent, var(--u-page) 24%)' }}>
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
    </div>
  );
}
