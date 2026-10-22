import { useEffect, useMemo, useRef } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { typesetMath } from '../lib/mathjax';
import { escHtml } from './Formula';

// TWO-STAGE paragraph math, same policy as Formula — no glyph fallback:
//  1. KaTeX renders each \(...\)/\[...\] segment synchronously (offline,
//     instant) — the common case;
//  2. segments KaTeX rejects are LEFT as source and handed to MathJax in
//     one pass over the subtree (complex/unsupported TeX — MathJax accepts
//     nearly everything). Only when MathJax itself is unreachable does
//     source stay visible, logged for diagnosis.
// Entities are decoded for the KaTeX attempt because MathPlain pre-escapes
// its text; MathJax reads the decoded DOM text, so leftovers also survive
// escaping.
const ENT: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' };

function kaTeXSegments(html: string): { html: string; leftover: boolean } {
  if (!html || !/\\\(|\\\[/.test(html)) return { html, leftover: false };
  let leftover = false;
  const out = html.replace(
    /\\\(([\s\S]*?)\\\)|\\\[[\s\S]*?\\\]/g,
    (m, g1?: string, g2?: string) => {
      const tex = (g1 ?? g2 ?? '')
        .replace(/&(lt|gt|amp);/g, (e) => ENT[e] ?? e)
        .trim();
      if (!tex) return m;
      try {
        return katex.renderToString(tex, {
          throwOnError: true,
          displayMode: g2 !== undefined,
          strict: false,
        });
      } catch {
        leftover = true;
        return m; // hand off to MathJax below
      }
    },
  );
  return { html: out, leftover };
}

export function MathText({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const stage1 = useMemo(() => kaTeXSegments(html), [html]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stage1.leftover) return;
    let dead = false;
    void (async () => {
      const ok = await typesetMath(el);
      if (dead || !el.isConnected) return;
      if (!ok) console.warn('[MathText] MathJax unavailable for complex segment — source shown');
    })();
    return () => {
      dead = true;
    };
  }, [stage1]);
  return <div ref={ref} className={className} style={style} dangerouslySetInnerHTML={{ __html: stage1.html }} />;
}

// Plain text that may contain \(...\) / \[...\] math.
export function MathPlain({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return <MathText html={escHtml(text)} className={className} style={style} />;
}
