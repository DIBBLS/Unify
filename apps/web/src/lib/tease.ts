import { useEffect, useState } from 'react';

// Little voices for the games: a kind word after a miss, and a tease when the
// student goes quiet mid-game. Short, warm, never mocking.
const MISS = [
  'Close one. Go again.',
  'Shake it off. Next one.',
  "Nearly! You've seen this in the notes.",
  'Wrong answers are free here.',
  'Good guess. Not this time.',
  'Keep going, it clicks with practice.',
];
const IDLE = [
  'Still with me? Take a guess.',
  'No rush. But the clock is winking at you.',
  "Stuck? A guess teaches you more than staring.",
  'Your brain is warming up. Try one.',
  'Box Boy is waiting… patiently. Mostly.',
];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

/** A kind line after a wrong answer. */
export const missLine = () => pick(MISS);

/**
 * A tease after `ms` with no activity. `poke` is anything that changes when
 * the student does something (a count of moves); `on` turns it off (finished).
 */
export function useIdleTease(poke: unknown, on: boolean, ms = 25000): string {
  const [line, setLine] = useState('');
  useEffect(() => {
    setLine('');
    if (!on) return;
    const t = window.setTimeout(() => setLine(pick(IDLE)), ms);
    return () => window.clearTimeout(t);
  }, [poke, on, ms]);
  return line;
}
