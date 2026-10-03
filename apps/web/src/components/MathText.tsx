import { useEffect, useRef } from 'react';
import { typesetMath, escHtml } from '../lib/mathjax';

// HTML that may contain \(...\) / \[...\] math: renders it, then asks
// MathJax to typeset this subtree only (cheap, no full-page reflow).
export function MathText({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void typesetMath(ref.current);
  }, [html]);
  return <div ref={ref} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Plain text that may contain \(...\) / \[...\] math.
export function MathPlain({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return <MathText html={escHtml(text)} className={className} style={style} />;
}
