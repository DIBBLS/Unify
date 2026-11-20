import { useEffect, useState } from 'react';

// The games' encouragements and teases, in the same pop-up as the cheers
// (same shape, same spring-in and float-away), just smaller words and a
// little longer on screen so a sentence can be read. No sound.
export default function GameNudge({ text, tone = 'tease' }: { text: string; tone?: 'tease' | 'miss' }) {
  const [shown, setShown] = useState<{ id: number; text: string; tone: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    const id = Date.now();
    setShown({ id, text, tone });
    const t = window.setTimeout(() => setShown((s) => (s?.id === id ? null : s)), 2600);
    return () => window.clearTimeout(t);
  }, [text, tone]);
  if (!shown) return null;
  return (
    <div className="cheer-layer" aria-live="polite" key={shown.id}>
      <div className={`cheer cheer--nudge cheer--nudge-${shown.tone}`}>
        <span className="cheer-text">{shown.text}</span>
      </div>
    </div>
  );
}
