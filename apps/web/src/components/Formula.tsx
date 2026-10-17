import { useEffect, useMemo, useRef } from 'react';
import { typesetMath, escHtml } from '../lib/mathjax';

// Normalize any equation string to inline \(...\) so MathJax always has
// delimiters to work with:
//  - bare builder output ("V=IR") was never typeset — it sat as plain text
//    next to typeset neighbours (the "preview doesn't render" bug);
//  - display \[...\] / $$...$$ renders as centred block math with heavy
//    margins that looked broken inside narrow cards — inline keeps every
//    formula the same compact rhythm.
function normalize(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const disp = t.match(/^\\\[([\s\S]*)\\\]$/);
  if (disp) return `\\(${disp[1].trim()}\\)`;
  const dd = t.match(/^\$\$([\s\S]*)\$\$$/);
  if (dd) return `\\(${dd[1].trim()}\\)`;
  if (t.startsWith('\\(') && t.endsWith('\\)')) return t;
  if (t.includes('\\(') || t.includes('\\[')) return t; // mixed content: leave alone
  return `\\(${t}\\)`;
}

// innerHTML (not text children): MathJax rewrites the element's DOM, which
// orphans React's text nodes — later updates would land on detached nodes
// and the preview would go stale. React's innerHTML diffing resets cleanly.
export default function Formula({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useMemo(() => normalize(latex), [latex]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    void (async () => {
      await typesetMath(el);
      // Offline / CDN blocked: MathJax never arrives — show clean math text
      // instead of raw \( \) delimiters sitting in the card.
      const w = window as unknown as { MathJax?: { typesetPromise?: unknown } };
      if (!w.MathJax?.typesetPromise && el.isConnected) {
        el.textContent = body.replace(/^\\\(([\s\S]*)\\\)$/, '$1').trim();
      }
    })();
  }, [body]);
  return (
    <div
      ref={ref}
      className="f-eq"
      style={{ overflowX: 'auto', fontSize: 15, lineHeight: 2.2, minHeight: body ? undefined : 0 }}
      dangerouslySetInnerHTML={{ __html: escHtml(body) }}
    />
  );
}
