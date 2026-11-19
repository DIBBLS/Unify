import { useEffect, useState } from 'react';
import { Award, BookOpen, Flame, Gamepad2, ListChecks, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { readStats } from '../lib/dailyword';

// Badges for milestones (Duolingo-style), worked out from what the app
// already records: longest streak, XP, topics finished, quizzes taken, game
// terms mastered and Term of the Day wins. Earned ones are in colour; the
// next ones show what it takes. Nothing new is stored.
type Facts = { longest: number; xp: number; topics: number; quizzes: number; terms: number; daily: number };
type Badge = { id: string; label: string; need: string; Icon: typeof Flame; got: (f: Facts) => boolean };

const BADGES: Badge[] = [
  { id: 'streak3', label: '3-day streak', need: 'Study 3 days in a row', Icon: Flame, got: (f) => f.longest >= 3 },
  { id: 'streak7', label: 'Week streak', need: 'A 7-day streak', Icon: Flame, got: (f) => f.longest >= 7 },
  { id: 'streak14', label: 'Fortnight', need: 'A 14-day streak', Icon: Flame, got: (f) => f.longest >= 14 },
  { id: 'streak30', label: 'Month strong', need: 'A 30-day streak', Icon: Flame, got: (f) => f.longest >= 30 },
  { id: 'topic1', label: 'First topic', need: 'Finish a topic', Icon: BookOpen, got: (f) => f.topics >= 1 },
  { id: 'topic25', label: '25 topics', need: 'Finish 25 topics', Icon: BookOpen, got: (f) => f.topics >= 25 },
  { id: 'quiz1', label: 'First quiz', need: 'Take a weekly quiz', Icon: ListChecks, got: (f) => f.quizzes >= 1 },
  { id: 'quiz10', label: 'Quiz regular', need: 'Take 10 quizzes', Icon: ListChecks, got: (f) => f.quizzes >= 10 },
  { id: 'terms25', label: 'Term hunter', need: 'Master 25 key terms in games', Icon: Gamepad2, got: (f) => f.terms >= 25 },
  { id: 'daily5', label: 'Word sharp', need: 'Solve 5 Terms of the Day', Icon: Sparkles, got: (f) => f.daily >= 5 },
  { id: 'xp500', label: '500 XP', need: 'Earn 500 XP', Icon: Award, got: (f) => f.xp >= 500 },
  { id: 'xp1000', label: '1,000 XP', need: 'Earn 1,000 XP', Icon: Award, got: (f) => f.xp >= 1000 },
];

export default function Badges() {
  const [facts, setFacts] = useState<Facts | null>(null);
  useEffect(() => {
    let gone = false;
    Promise.all([
      api.stats().catch(() => null),
      api.learnActivity(120).catch(() => null),
      api.gameMine().catch(() => null),
    ]).then(([s, a, g]) => {
      if (gone || !s) return;
      setFacts({
        longest: Math.max(a?.longest || 0, s.streak || 0),
        xp: s.xp || 0,
        topics: (s.courses || []).reduce((n, c) => n + (c.topics || 0), 0),
        quizzes: s.quizzesTaken || 0,
        terms: g?.termsMastered || 0,
        daily: readStats().solved || 0,
      });
    });
    return () => { gone = true; };
  }, []);
  if (!facts) return null;
  const earned = BADGES.filter((b) => b.got(facts)).length;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text2)' }}>BADGES</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{earned} of {BADGES.length}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {BADGES.map((b) => {
          const got = b.got(facts);
          return (
            <div key={b.id} title={got ? b.label : b.need} aria-label={got ? `${b.label}, earned` : `${b.label}: ${b.need}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', opacity: got ? 1 : 0.55 }}>
              <span style={{ width: 36, height: 36, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: got ? 'var(--u-amber)' : 'var(--surface2)', color: got ? 'var(--u-black)' : 'var(--text3)' }}>
                <b.Icon size={18} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{b.label}</span>
              {!got && <span style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.2 }}>{b.need}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
