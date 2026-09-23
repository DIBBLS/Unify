import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Renders LaTeX with \(...\) inline and \[...\] display segments.
// Anything unparseable falls back to raw text (never a blank box).
function renderMixed(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const asMath = (inner: string, display: boolean) => {
    try {
      return katex.renderToString(inner, { displayMode: display, throwOnError: false });
    } catch {
      return `<span>${esc(inner)}</span>`;
    }
  };
  const parts: string[] = [];
  const re = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(`<span>${esc(src.slice(last, m.index))}</span>`);
    const raw = m[0];
    parts.push(asMath(raw.slice(2, -2), raw.startsWith('\\[')));
    last = m.index + raw.length;
  }
  if (last < src.length) {
    const rest = src.slice(last);
    parts.push(/\\[a-zA-Z]/.test(rest) ? asMath(rest, true) : `<span>${esc(rest)}</span>`);
  }
  return parts.join('');
}

export default function Formula({ latex }: { latex: string }) {
  const html = useMemo(() => renderMixed(latex || ''), [latex]);
  return <div className="f-eq" style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
