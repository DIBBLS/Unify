import { useCallback, useRef, useState, type ReactNode } from 'react';

// Cheers: a big word that pops over the game when something goes right (a
// word found, a streak, a level cleared, the whole game done), with a burst
// of confetti for the big moments and a tiny buzz on phones that allow it.
export type CheerKind = 'word' | 'key' | 'streak' | 'bonus' | 'level' | 'half' | 'done';

const LINES: Record<CheerKind, string[]> = {
  word: ['Nice!', 'Great!', 'Sweet!', 'Good one!', 'Yes!', 'Spot on!'],
  key: ['Key term!', 'Brilliant!', 'Nailed it!', 'Superb!'],
  streak: ['On fire!', 'Unstoppable!', 'Keep going!', 'Hot streak!'],
  bonus: ['Bonus!', 'Sharp eyes!', 'Extra points!'],
  level: ['Level cleared!', 'Amazing!', 'Well done!', 'Smashed it!'],
  half: ['Halfway there!', 'Keep it up!', 'Looking good!'],
  done: ['You did it!', 'Champion!', 'Outstanding!', 'Legend!'],
};
const BIG: CheerKind[] = ['level', 'done', 'key'];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const COLORS = ['#50ff90', '#fbbf24', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c'];

type Shown = { id: number; text: string; sub?: string; kind: CheerKind };

export function useCheer(): [ReactNode, (kind: CheerKind, opts?: { text?: string; sub?: string }) => void] {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef(0);
  const cheer = useCallback((kind: CheerKind, opts?: { text?: string; sub?: string }) => {
    const id = Date.now() + Math.random();
    setShown({ id, kind, text: opts?.text || pick(LINES[kind]), sub: opts?.sub });
    try { if (BIG.includes(kind)) navigator.vibrate?.([18, 40, 18]); else navigator.vibrate?.(12); } catch { /* fine */ }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown((s) => (s?.id === id ? null : s)), kind === 'done' ? 2200 : 1300);
  }, []);

  const node = shown ? (
    <div className="cheer-layer" aria-live="assertive" key={shown.id}>
      <div className={`cheer cheer--${shown.kind}`}>
        <span className="cheer-text">{shown.text}</span>
        {shown.sub && <span className="cheer-sub">{shown.sub}</span>}
      </div>
      {BIG.includes(shown.kind) && (
        <div className="cheer-confetti" aria-hidden="true">
          {Array.from({ length: shown.kind === 'done' ? 36 : 22 }, (_, i) => (
            <i
              key={i}
              style={{
                '--x': `${(Math.random() * 2 - 1) * 46}vw`,
                '--y': `${30 + Math.random() * 50}vh`,
                '--r': `${Math.round(Math.random() * 720 - 360)}deg`,
                '--d': `${Math.round(Math.random() * 160)}ms`,
                background: COLORS[i % COLORS.length],
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;
  return [node, cheer];
}
