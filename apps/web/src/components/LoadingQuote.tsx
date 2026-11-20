import { useEffect, useState } from 'react';
import { loadingLines } from '../lib/naija';

// Shown under every loading state so waiting on a slow network is never dead
// air. It rotates every few seconds through proverbs and facts (Nigeria,
// engineering, study tips), shuffled so no two loads start the same way.
const SWAP_MS = 5000;
// One shuffle per visit, and the place in it is kept, so loading screens that
// follow each other carry on with the same line instead of jumping to a new one.
let shared: { lines: ReturnType<typeof loadingLines>; i: number } | null = null;

export default function LoadingQuote({ onGreen = false, style }: { onGreen?: boolean; style?: React.CSSProperties }) {
  const [lines] = useState(() => (shared ??= { lines: loadingLines(), i: 0 }).lines);
  const [i, setI] = useState(() => shared?.i ?? 0);
  const [first] = useState(i);
  useEffect(() => {
    const t = setInterval(() => setI((n) => { const next = (n + 1) % lines.length; if (shared) shared.i = next; return next; }), SWAP_MS);
    return () => clearInterval(t);
  }, [lines.length]);
  const line = lines[i];
  return (
    <figure
      key={i}
      // The line already showing on the screen before doesn't fade in again.
      className={i === first ? undefined : 'quote-fade'}
      aria-live="off"
      style={{ margin: 0, maxWidth: 300, minHeight: 92, textAlign: 'center', color: onGreen ? 'var(--u-black, #0a0a0a)' : 'var(--text2)', ...style }}
    >
      {line.kind === 'fact' ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Did you know? · {line.f.tag}</div>
          <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>{line.f.text}</div>
        </>
      ) : (
        <>
          <blockquote style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>
            “{line.p.text}”
            {line.p.meaning && <span style={{ display: 'block', fontSize: 13, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>{line.p.meaning}</span>}
          </blockquote>
          <figcaption style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>{line.p.from}</figcaption>
        </>
      )}
    </figure>
  );
}
