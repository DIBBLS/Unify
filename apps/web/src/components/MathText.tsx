import { useEffect, useRef } from 'react';
import { typesetMath, escHtml } from '../lib/mathjax';
import { beautifyMath } from './Formula';

// Glyph-ify any \(...\) / \[...\] segments in failed HTML so a rejected
// or timed-out typeset never leaves raw TeX in a paragraph. Segments that
// contain markup are left alone rather than mangled.
function glyphifyMathSegments(html: string): string {
  return html.replace(
    /\\\(([\s\S]*?)\\\)|\\\[[\s\S]*?\\\]/g,
    (m) => (m.includes('<') ? m : beautifyMath(m)),
  );
}

// HTML that may contain \(...\) / \[...\] math: renders it, then asks
// MathJax to typeset this subtree only (cheap, no full-page reflow).
// typesetMath resolves false on a missing CDN / rejected typeset — the
// segments are then swapped for glyph math so nothing code-like stays.
export function MathText({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    void (async () => {
      const ok = await typesetMath(el);
      if (dead || !el.isConnected) return;
      if (!ok) el.innerHTML = glyphifyMathSegments(html);
    })();
    return () => { dead = true; };
  }, [html]);
  return <div ref={ref} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Plain text that may contain \(...\) / \[...\] math.
export function MathPlain({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return <MathText html={escHtml(text)} className={className} style={style} />;
}
