import { useEffect, useRef } from 'react';
import { typesetMath } from '../lib/mathjax';

// Formula box equation: raw TeX with \(...\) / \[...\] delimiters,
// typeset by the shared MathJax loader (same renderer as all notes).
export default function Formula({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void typesetMath(ref.current);
  }, [latex]);
  return (
    <div ref={ref} className="f-eq" style={{ overflowX: 'auto' }}>
      {latex}
    </div>
  );
}
