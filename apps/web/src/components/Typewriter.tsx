import { useEffect, useState } from 'react';

// Typed-out line: types character by character, cursor blinks, then goes away
// shortly after the line completes. The full line is laid out invisibly first so
// nothing below it jumps while it types; reduced-motion users get it at once.
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Typewriter({ text, speed = 45 }: { text: string; speed?: number }) {
  const [n, setN] = useState(() => (reduced() ? text.length : 0));
  const [cursorGone, setCursorGone] = useState(() => reduced());
  useEffect(() => {
    if (reduced()) { setN(text.length); setCursorGone(true); return; }
    setN(0);
    setCursorGone(false);
  }, [text]);
  useEffect(() => {
    if (n >= text.length) {
      const t = setTimeout(() => setCursorGone(true), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [n, text, speed]);
  return (
    <span aria-label={text} style={{ display: 'inline-grid' }}>
      <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{text}</span>
      <span aria-hidden="true" style={{ gridArea: '1 / 1' }}>
        {text.slice(0, n)}
        {!cursorGone && <span className="type-cursor" />}
      </span>
    </span>
  );
}
