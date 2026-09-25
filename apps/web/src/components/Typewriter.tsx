import { useEffect, useState } from 'react';

// Typed-out line: types character by character, cursor blinks,
// then disappears shortly after the line completes.
export default function Typewriter({ text, speed = 45 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  const [cursorGone, setCursorGone] = useState(false);
  useEffect(() => {
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
    <span>
      {text.slice(0, n)}
      {!cursorGone && <span className="type-cursor" />}
    </span>
  );
}
