import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { firstMeetToday, getGoal, todayKey } from '../lib/goal';
import { play } from '../lib/sound';
import { sayPraise } from '../lib/welcomeVoice';

// Home's daily goal: a ring that fills with today's XP towards the goal the
// student picked in Settings. Full ring: "Goal met", with a chime and a
// spoken well done (if voice is on) the first time each day.
export default function DailyGoal() {
  const goal = getGoal();
  const [xp, setXp] = useState<number | null>(null);

  useEffect(() => {
    let gone = false;
    api.learnActivity(7)
      .then((a) => {
        if (gone) return;
        const today = a.days.find((d) => d.date === todayKey())?.xp || 0;
        setXp(today);
        if (today >= goal.xp && firstMeetToday()) {
          // After a tap has happened on this page load, or the browser stays quiet.
          play('goal');
          sayPraise('goal');
        }
      })
      .catch(() => { if (!gone) setXp(null); });
    return () => { gone = true; };
  }, [goal.xp]);

  if (xp == null) return null;
  const done = Math.min(xp, goal.xp);
  const met = xp >= goal.xp;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="rise" style={{ margin: '0 16px 12px', background: 'var(--surface)', border: `1px solid ${met ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={`Daily goal: ${done} of ${goal.xp} XP`} style={{ flexShrink: 0 }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={met ? 'var(--u-good)' : 'var(--u-amber)'} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - done / goal.xp)} transform="rotate(-90 26 26)" style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text)">{met ? '✓' : `${Math.round((done / goal.xp) * 100)}%`}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{met ? 'Daily goal met' : 'Daily goal'}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {met ? `${xp} XP today. Anything more is a bonus.` : `${done} of ${goal.xp} XP today · ${goal.label}`}
        </div>
      </div>
      <Link to="/settings#goal" style={{ fontSize: 12, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none', flexShrink: 0 }}>Change</Link>
    </div>
  );
}
