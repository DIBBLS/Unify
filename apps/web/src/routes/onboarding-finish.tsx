import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { pushSupported, enablePush } from '../lib/push';
import { BoxBoy } from '../components/redesign/brand';
import { STICKY, StepBars } from '../components/redesign/ui';

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
// Review 3: "When do you usually find time to study?" Pick several, each with
// its own time (changeable later in Settings). Saved as the reminder times.
const TIMES = [
  ['morning', 'Morning', '5:00 to 11:59', '07:00', '05:00', '11:59'],
  ['afternoon', 'Afternoon', '12:00 to 17:59', '13:00', '12:00', '17:59'],
  ['evening', 'Evening', '18:00 to 21:59', '19:00', '18:00', '21:59'],
  ['night', 'Late night', '22:00 to 4:59', '22:30', '22:00', '04:59'],
] as const;
type Period = (typeof TIMES)[number][0];
const inPeriod = (k: Period, t: string) => {
  const [, , , , from, to] = TIMES.find((x) => x[0] === k)!;
  return from <= to ? t >= from && t <= to : t >= from || t <= to;
};
const FOCUS = [[15, '15 min'], [25, '25 min'], [45, '45 min'], [60, 'An hour+']] as const;

const amberBtn: React.CSSProperties = { padding: 14, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', width: '100%' };
const choice = (on: boolean): React.CSSProperties => ({ padding: 14, border: `1px solid ${on ? 'var(--u-amber)' : 'var(--border)'}`, borderRadius: 12, background: on ? 'var(--u-good-tint)' : 'var(--surface)', textAlign: 'left', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center', width: '100%' });

export default function OnboardingFinishRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<(typeof GOALS)[number][0]>('grades');
  const [times, setTimes] = useState<Partial<Record<Period, string>>>({ evening: '19:00' });
  const [lateOk, setLateOk] = useState(false);
  const picked = TIMES.filter(([k]) => times[k] !== undefined);
  const badTime = picked.find(([k]) => !inPeriod(k, times[k] || ''));
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
          {/* Review 3: the glowing-phone and glowing-key Box Boys looked AI-made; the cheering one replaces them. */}
          <BoxBoy pose={step >= 2 ? 'cheer' : 'peeking'} width={84} />
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
            <div style={STICKY}><button disabled={busy} onClick={() => void saveAnd({ studyGoal: goal }, 1)} style={amberBtn}>Continue <ArrowRight size={18} /></button></div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>When do you usually find time to study? Pick as many as fit, and set a time for each. We'll remind you then, only if you haven't studied yet. You can change it later.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TIMES.map(([k, t, s, def]) => {
                const on = times[k] !== undefined;
                return (
                  <div key={k} style={{ ...choice(on), padding: 0, overflow: 'hidden' }}>
                    <button aria-pressed={on} onClick={() => setTimes((m) => { const n = { ...m }; if (on) delete n[k]; else n[k] = def; return n; })}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-good)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={14} color="#fff" />}</span>
                      <span><span style={{ display: 'block', fontWeight: 700 }}>{t}</span><span style={{ fontSize: 12, color: 'var(--text2)' }}>{s}</span></span>
                    </button>
                    {on && <input type="time" aria-label={`${t} reminder time`} value={times[k]} onChange={(e) => setTimes((m) => ({ ...m, [k]: e.target.value }))} style={{ marginRight: 12, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontWeight: 700 }} />}
                  </div>
                );
              })}
            </div>
            {badTime && <div style={{ fontSize: 12, color: 'var(--u-red)' }}>Pick a {badTime[1].toLowerCase()} time between {badTime[2].replace(' to ', ' and ')}.</div>}
            {times.night !== undefined && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text2)', padding: '4px 2px' }}>
                <input type="checkbox" checked={lateOk} onChange={(e) => setLateOk(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18 }} />
                <span><b style={{ color: 'var(--text)' }}>Remind me late at night too.</b> Without this, we don't send study reminders between 10 PM and 6 AM.</span>
              </label>
            )}
            <div style={{ fontWeight: 700, marginTop: 6 }}>How long can you focus in one go?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FOCUS.map(([m, l]) => <button key={m} className={`chip${focus === m ? ' chip--on' : ''}`} onClick={() => setFocus(m)}>{l}</button>)}
            </div>
            <div style={{ fontSize: 13, background: 'var(--u-good-tint)', color: 'var(--u-good)', borderRadius: 12, padding: 12, fontWeight: 600 }}>
              We suggest {focus} minutes of reading, then a 5-minute break.
            </div>
            <div style={STICKY}><button disabled={busy || !picked.length || !!badTime} onClick={() => {
              void api.saveMyReminders({ times: picked.map(([k]) => times[k]!).slice(0, 4), lateNight: times.night !== undefined && lateOk }).catch(() => {});
              void saveAnd({ studyTime: picked[0][0], focusMinutes: focus }, pushSupported() ? 2 : 3);
            }} style={amberBtn}>This is me <ArrowRight size={18} /></button></div>
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
              <Link to={`/courses/${encodeURIComponent(firstCourse)}`} style={{ ...amberBtn, textDecoration: 'none' }}>Open {firstCourse} <ArrowRight size={18} /></Link>
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
