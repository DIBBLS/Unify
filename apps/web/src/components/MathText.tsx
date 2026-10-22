import { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { beautifyMath, escHtml } from './Formula';

// Paragraph math renders with KaTeX (v1.26.10) — the same engine as Formula
// boxes, bundled locally, fully synchronous. The old path handed the subtree
// to the MathJax CDN, so with no/blocked network every \( \sqrt{x} \) and
// \( \frac{a}{b} \) inside note text fell back to glyph text.
//
// TeX-looking markup (<tag…) is left alone rather than mangled — it was
// never TeX. Entities are decoded for the TeX attempt because MathPlain
// pre-escapes its text; failures are glyph-ified and escaped.
const ENT: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' };

function renderMathSegments(html: string): string {
  if (!html || !/\\\(|\\\[/.test(html)) return html;
  return html.replace(
    /\\\(([\s\S]*?)\\\)|\\\[[\s\S]*?\\\]/g,
    (m, g1?: string, g2?: string) => {
      if (/<\/?[a-zA-Z!]/.test(m)) return m;
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
        return escHtml(beautifyMath(tex));
      }
    },
  );
}

// HTML that may contain \(...\) / \[...\] math: rendered synchronously with
// KaTeX — no effect, no CDN, no typeset race. Unsupported TeX falls back to
// glyph math so nothing code-like stays on screen.
export function MathText({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const rendered = useMemo(() => renderMathSegments(html), [html]);
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: rendered }} />;
}

// Plain text that may contain \(...\) / \[...\] math.
export function MathPlain({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return <MathText html={escHtml(text)} className={className} style={style} />;
}
