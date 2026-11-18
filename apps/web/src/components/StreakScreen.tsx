import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Flame } from 'lucide-react';
import { api } from '../lib/api';
import { BoxBoy } from './redesign/brand';

// Review 3 streak screens, shown on the day's first open (Home):
// - C14: green milestone screen, only at 3, 7, 14 and 30 days.
// - C5: black screen with "Continue studying" when there's somewhere to pick up.
// - C13: black screen with "Keep going" on any other ordinary day.
// Weekends are free: they never break a streak. No shaming: a student back
// after a week or more gets the Welcome back card on Home instead.
export const MILESTONES = [3, 7, 14, 30];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n: number) => (n < 10 ? WORDS[n] : String(n));
const FOR: Record<number, string> = { 3: 'your first milestone', 7: 'your first week', 14: 'two weeks', 30: 'a month' };
const STRONG: Record<number, string> = { 3: 'OFF THE MARK.', 7: 'ONE WEEK STRONG.', 14: 'TWO WEEKS STRONG.', 30: 'ONE MONTH STRONG.' };
const MILESTONE_LINE: Record<number, string> = {
  3: 'Three study days in a row. The habit has started.',
  7: "You showed up every class day this week. That's how it sticks.",
  14: 'Two weeks of showing up. Exams will feel like revision.',
  30: 'A month of steady work. This is how a semester gets won.',
};
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// This week's dates, Monday first (local time).
function thisWeek(): string[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function StreakScreen({ streak, resume, onClose }: {
  streak: number;
  resume: { course: string; week: number; topic: number } | null;
  onClose: () => void;
}) {
  const [active, setActive] = useState<Set<string> | null>(null);
  useEffect(() => {
    let gone = false;
    api.learnActivity(60).then((a) => {
      if (gone) return;
      const days = (a.active || a.days.map((d) => d.date)).slice().sort();
      // Back after 7+ days away: the Welcome back card says hello instead.
      const today = new Date().toISOString().slice(0, 10);
      const before = days.filter((d) => d < today);
      const last = before[before.length - 1];
      if (last && (Date.now() - new Date(`${last}T12:00:00`).getTime()) / 86400000 >= 7) return onClose();
      setActive(new Set(days));
    }).catch(() => { if (!gone) setActive(new Set()); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!active) return null;

  const milestone = MILESTONES.includes(streak);
  const next = MILESTONES.find((m) => m > streak);
  const resumeTo = resume ? `/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${resume.topic ? `?t=${resume.topic}` : ''}` : '';
  const shell: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto',
    padding: '48px 24px calc(24px + env(safe-area-inset-bottom))', textAlign: 'center',
  };
  const bigBtn = (dark: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', maxWidth: 420, padding: 16, borderRadius: 9999, border: 'none', fontWeight: 800, fontSize: 17, textDecoration: 'none',
    background: dark ? 'var(--u-black)' : 'var(--u-amber)', color: dark ? '#fff' : 'var(--u-black)',
  });

  if (milestone) {
    // C14: green milestone screen.
    return (
      <div role="dialog" aria-modal="true" aria-label={`${streak} day streak milestone`} className="soft-in" style={{ ...shell, background: 'var(--u-green)', color: 'var(--u-black)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>STREAK MILESTONE</div>
        <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 76, lineHeight: 1, marginTop: 8 }}>{streak} DAYS</div>
        <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24, marginTop: 14 }}>{STRONG[streak]}</div>
        <p style={{ fontSize: 16, maxWidth: 360, marginTop: 10 }}>{MILESTONE_LINE[streak]}</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
          {MILESTONES.map((m) => {
            const today = m === streak;
            const done = m < streak;
            const size = today ? 64 : 52;
            return (
              <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ width: size, height: size, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: today ? 22 : 18,
                  background: today || done ? 'var(--u-black)' : 'transparent', color: today ? 'var(--u-amber)' : done ? 'var(--u-green)' : 'var(--u-black)',
                  border: today || done ? 'none' : '2px dashed var(--u-black)' }}>{m}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{today ? 'Today' : done ? 'Done' : `${m} days`}</span>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, minHeight: 16 }} />
        <BoxBoy pose="cheer" width={170} />
        {resumeTo
          ? <Link to={resumeTo} onClick={onClose} style={{ ...bigBtn(true), marginTop: 16 }}>Keep going</Link>
          : <button onClick={onClose} style={{ ...bigBtn(true), marginTop: 16 }}>Keep going</button>}
        {next && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12 }}>Next milestone: {next} days</div>}
      </div>
    );
  }

  // C5 (somewhere to pick up) or C13 (an ordinary day): the black screen.
  const week = thisWeek();
  const left = next ? next - streak : 0;
  return (
    <div role="dialog" aria-modal="true" aria-label={`${streak} day streak`} className="soft-in" style={{ ...shell, background: 'var(--u-black)', color: '#fff' }}>
      <Flame size={64} color="var(--u-amber)" fill="var(--u-amber)" aria-hidden="true" />
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 96, lineHeight: 1, color: 'var(--u-amber)', marginTop: 8 }}>{streak}</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 28, marginTop: 6 }}>DAY STREAK</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }} aria-label="This week">
        {week.map((d, i) => {
          const on = active.has(d);
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 36, height: 36, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--u-amber)' : 'transparent', border: on ? 'none' : '1.5px dashed rgba(255,255,255,.3)' }}>
                {on && <Check size={18} color="var(--u-black)" strokeWidth={3} />}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.7)' }}>{DAYS[i]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', marginTop: 16 }}>{resumeTo || !next ? 'Weekends are free' : `Next milestone: ${next} days`}</div>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', marginTop: 8, maxWidth: 340 }}>
        {resumeTo
          ? `Your ${resume!.course} notes are where you left them.`
          : next ? `Day ${streak}. ${cap(num(left))} more for ${FOR[next]}.` : `Day ${streak}. Keep showing up.`}
      </p>
      <div style={{ flex: 1, minHeight: 16 }} />
      <BoxBoy pose="cheer" width={150} />
      {resumeTo ? (
        <>
          <Link to={resumeTo} onClick={onClose} style={{ ...bigBtn(false), marginTop: 16 }}>Continue studying</Link>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, padding: 12, marginTop: 4 }}>Go to Home</button>
        </>
      ) : (
        <button onClick={onClose} style={{ ...bigBtn(false), marginTop: 16 }}>Keep going</button>
      )}
    </div>
  );
}
