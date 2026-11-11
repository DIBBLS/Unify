import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { pushSupported, enablePush } from '../lib/push';
import { BoxBoy } from '../components/redesign/brand';
import { StepBars } from '../components/redesign/ui';

// The end of onboarding (S09, S10, S12, S13), after the Box Boy picker, in the
// onboarding's own look (green band, cards, amber buttons):
//   goal → study rhythm → "want a little push?" → "Bag that first class".
const GOALS = [
  ['grades', 'Improve my grades', 'See real progress toward my target'],
  ['habit', 'Build a reading habit', 'Stop leaving everything until exams'],
  ['understand', 'Understand my courses', 'Explanations that actually make sense'],
  ['together', 'Study better with others', 'Talking it through helps me learn'],
  ['balance', 'Balance school with other things', 'Work, business, projects, leadership'],
] as const;
const TIMES = [['morning', 'Early morning', '5 to 8 AM'], ['afternoon', 'Afternoon', '12 to 4 PM'], ['evening', 'Evening', '5 to 9 PM'], ['night', 'Night owl', 'after 10 PM'], ['any', 'Any time', '']] as const;
const FOCUS = [[15, '15 min'], [25, '25 min'], [45, '45 min'], [60, 'An hour+']] as const;

const amberBtn: React.CSSProperties = { padding: 14, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', width: '100%' };
const choice = (on: boolean): React.CSSProperties => ({ padding: 14, border: `1px solid ${on ? 'var(--u-amber)' : 'var(--border)'}`, borderRadius: 12, background: on ? 'var(--u-good-tint)' : 'var(--surface)', textAlign: 'left', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center', width: '100%' });

export default function OnboardingFinishRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<(typeof GOALS)[number][0]>('grades');
  const [time, setTime] = useState<(typeof TIMES)[number][0]>('night');
  const [focus, setFocus] = useState(25);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [firstCourse, setFirstCourse] = useState('');

  useEffect(() => {
    api.me().then((m) => { setName(m.profile?.first_name || ''); setFirstCourse((m.courses || [])[0] || ''); }).catch(() => {});
  }, []);

  const saveAnd = async (patch: Record<string, unknown>, next: number) => {
    setBusy(true);
    try { await api.updateMe(patch); setStep(next); }
    catch (e) { errorToast(e, 'save that'); setStep(next); }
    finally { setBusy(false); }
  };
  const push = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (!r.ok && r.reason) errorToast(new Error(r.reason), 'turn on reminders');
    } finally {
      setBusy(false);
      setStep(3);
    }
  };

  const titles = ['What are you working towards?', 'When do you read best?', 'Want a little push?', 'Bag that first class.'];
  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', minHeight: '100vh', background: 'var(--u-page)' }}>
      <div className="african-band" style={{ background: 'var(--u-green)', color: 'var(--u-black)', padding: '20px 20px 24px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ opacity: 0.7 }}>Almost done</div>
            <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginTop: 6 }}>{titles[step]}</h1>
          </div>
          <BoxBoy pose={step === 3 ? 'keyHandover' : step === 2 ? 'phoneOut' : 'peeking'} width={84} />
        </div>
        <div style={{ marginTop: 12 }}><StepBars step={step + 1} total={4} /></div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 0 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Pick one for this semester. We'll start you in the right place.</div>
            {GOALS.map(([k, t, s]) => (
              <button key={k} onClick={() => setGoal(k)} style={choice(goal === k)}>
                <span style={{ flex: 1 }}><span style={{ display: 'block', fontWeight: 700 }}>{t}</span><span style={{ fontSize: 12, color: 'var(--text2)' }}>{s}</span></span>
                {goal === k && <Check size={18} color="var(--u-good)" />}
              </button>
            ))}
            <button disabled={busy} onClick={() => void saveAnd({ studyGoal: goal }, 1)} style={amberBtn}>Continue <ArrowRight size={18} /></button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>We'll time your reminders and revision to fit your day.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TIMES.map(([k, t, s]) => (
                <button key={k} onClick={() => setTime(k)} style={{ ...choice(time === k), flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontWeight: 700 }}>{t}</span>{s && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s}</span>}
                </button>
              ))}
            </div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>How long can you focus in one go?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FOCUS.map(([m, l]) => <button key={m} className={`chip${focus === m ? ' chip--on' : ''}`} onClick={() => setFocus(m)}>{l}</button>)}
            </div>
            <div style={{ fontSize: 13, background: 'var(--u-good-tint)', color: 'var(--u-good)', borderRadius: 12, padding: 12, fontWeight: 600 }}>
              We'll suggest {focus} minutes of reading, then a 5-minute break with a few quick questions.
            </div>
            <button disabled={busy} onClick={() => void saveAnd({ studyTime: time, focusMinutes: focus }, pushSupported() ? 2 : 3)} style={amberBtn}>This is me <ArrowRight size={18} /></button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, boxShadow: '0 6px 18px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>Unify Learn · 7:02</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Good morning{name ? `, ${name}` : ''}. This week's notes are waiting. Five minutes is enough.</div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Good-morning messages, streak reminders, class changes, and a nudge when you start falling behind. You can set quiet hours in Settings.</div>
            <button disabled={busy} onClick={() => void push()} style={amberBtn}>{busy ? 'Turning on…' : 'Yes, remind me'}</button>
            <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontWeight: 700, padding: 10 }}>Not now</button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center' }}><BoxBoy pose="cheer" width={150} /></div>
            <div style={{ fontSize: 15, textAlign: 'center' }}>Welcome{name ? `, ${name}` : ''}. Your courses are set. Pick one and open this week's note.</div>
            {firstCourse ? (
              <Link to={`/course/${encodeURIComponent(firstCourse)}`} style={{ ...amberBtn, textDecoration: 'none' }}>Open {firstCourse} <ArrowRight size={18} /></Link>
            ) : null}
            <button onClick={() => navigate('/home')} style={firstCourse ? { background: 'none', border: 'none', color: 'var(--text2)', fontWeight: 700, padding: 10 } : amberBtn}>
              {firstCourse ? 'Go to Home' : <>Open my courses <ArrowRight size={18} /></>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
