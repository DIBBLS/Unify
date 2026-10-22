import { useEffect, useMemo, useRef } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { typesetMath } from '../lib/mathjax';

export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Normalize any equation string to bare TeX for the renderers:
//  - bare builder output ("V=IR") — rendered as-is;
//  - \(...\), \[...\], $$...$$ — delimiters stripped (always inline layout
//    to keep the compact card rhythm);
//  - AI-pasted "\frac {a}{b}" / "\sqrt {x}" — command bound back to its
//    group (canonical form both renderers accept).
function stripTex(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  return t
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
    .replace(/\\(dfrac|tfrac|frac|sqrt|text|textbf|mathrm|left|right)\s+\{/g, '\\$1{')
    .replace(/\\(left|right)\s+/g, '\\$1')
    .trim();
}

// TWO-STAGE RENDERER — KaTeX and MathJax work hand in hand, no glyph
// fallback anywhere:
//  1. KaTeX (statically bundled): instant, offline, handles builder output
//     and ordinary note TeX — the 95% case, zero network.
//  2. MathJax (on-demand, service-worker cached): anything KaTeX rejects
//     (complex/unsupported TeX) is handed to MathJax, which accepts nearly
//     all valid TeX. The preview and the reader run this SAME component, so
//     what the author sees is exactly what students get.
// Only if BOTH renderers fail (MathJax CDN unreachable AND never cached)
// does the source remain visible — logged for diagnosis, never a styled
// fake-out.
export default function Formula({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tex = useMemo(() => stripTex(latex), [latex]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    if (!tex) {
      el.textContent = '';
      return;
    }
    // Stage 1 — KaTeX.
    try {
      el.innerHTML = katex.renderToString(tex, { throwOnError: true, displayMode: false, strict: false });
      return;
    } catch {
      /* complex TeX → stage 2 */
    }
    // Stage 2 — MathJax over the raw source (it reads \(...\) in place).
    el.innerHTML = `\\(${escHtml(tex)}\\)`;
    void (async () => {
      const ok = await typesetMath(el);
      if (dead || !el.isConnected) return;
      if (!ok) console.warn('[Formula] MathJax unavailable for complex TeX — source shown', tex);
    })();
    return () => {
      dead = true;
    };
  }, [tex]);
  return <div ref={ref} className="f-eq" style={{ overflowX: 'auto', fontSize: 15, lineHeight: 2.2, minHeight: tex ? undefined : 0 }} />;
}
