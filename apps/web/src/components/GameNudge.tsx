import { useEffect, useState } from 'react';
import { BoxBoy } from './redesign/brand';

// The games' encouragements and teases, popped up in a little bubble with Box
// Boy instead of sitting in a line of text: it springs in at the top of the
// screen, wobbles once, then floats away after a few seconds. A new line
// replaces the old one with a fresh pop.
export default function GameNudge({ text, tone = 'tease' }: { text: string; tone?: 'tease' | 'miss' }) {
  const [shown, setShown] = useState<{ id: number; text: string; tone: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    const id = Date.now();
    setShown({ id, text, tone });
    const t = window.setTimeout(() => setShown((s) => (s?.id === id ? null : s)), 3400);
    return () => window.clearTimeout(t);
  }, [text, tone]);
  if (!shown) return null;
  return (
    <div className="g-nudge-layer" aria-live="polite">
      <div key={shown.id} className={`g-nudge g-nudge--${shown.tone}`}>
        <span className="g-nudge-face"><BoxBoy pose={shown.tone === 'miss' ? 'cheer' : 'peeking'} width={34} /></span>
        <span>{shown.text}</span>
      </div>
    </div>
  );
}
