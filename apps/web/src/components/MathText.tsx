import { useEffect, useMemo, useRef } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { typesetMath } from '../lib/mathjax';
import { escHtml } from './Formula';

// TWO-STAGE paragraph math, same policy as Formula — no glyph fallback:
//  1. KaTeX renders each math span synchronously (offline, instant): \(..\),
//     \[..\], $$..$$ AND bare TeX like \frac{a}{b} that AI output leaves
//     undelimited — the common case;
//  2. spans KaTeX rejects are LEFT as source and handed to MathJax in one
//     pass over the subtree (complex/unsupported TeX — MathJax accepts
//     nearly everything). Only source stays visible.
// Entities are decoded for the KaTeX attempt because MathPlain pre-escapes
// its text; MathJax reads the decoded DOM text, so leftovers also survive
// escaping.
const ENT: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' };

const DELIM = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;

function renderTex(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex, { throwOnError: true, displayMode, strict: false });
  } catch {
    return null;
  }
}

// Where a bare TeX span ends (starting at its backslash). Balanced braces
// are respected, prose boundaries are not crossed: in "…{b} the mass" the
// space-then-letter rule stops the span at {b}, so words never get eaten.
const OPERATORS = "()[]|.,+-*/=<>!%;:'\"_^~";

function scanEnd(text: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const cmd = /^\\([a-zA-Z]+)/.exec(text.slice(i));
      if (!cmd) break;
      i += cmd[0].length;
      continue;
    }
    if (c === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === '}') {
      if (depth === 0) break;
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth > 0) {
      i += 1;
      continue;
    }
    if (c === '\n' || c === '&' || c === '<' || c === '>') break;
    if (c === ' ') {
      let j = i;
      while (j < text.length && text[j] === ' ') j += 1;
      const prev = text[i - 1] ?? '';
      const next = text[j] ?? '';
      const word = /^[A-Za-z]+/.exec(text.slice(j))?.[0] ?? '';
      // A one-letter token is a math variable ("\sum x"), a longer word is
      // prose ("\frac{a}{b} the mass") — stop before prose, keep the variable.
      if (word.length > 1 && /[A-Za-z0-9}\]\)]/.test(prev)) break;
      if (next && !/[A-Za-z0-9\\{([+\-*/=<>^_|.,;:!?]/.test(next)) break;
      i = j;
      continue;
    }
    if (/[A-Za-z0-9]/.test(c) || OPERATORS.includes(c)) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function renderBareText(text: string, state: { leftover: boolean }): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const bs = text.indexOf('\\', i);
    if (bs < 0) {
      out += text.slice(i);
      break;
    }
    const cmd = /^\\([a-zA-Z]+)/.exec(text.slice(bs));
    if (!cmd) {
      out += text.slice(i, bs + 1);
      i = bs + 1;
      continue;
    }
    const after = scanEnd(text, bs);
    if (after <= bs) {
      out += text.slice(i, bs + 1);
      i = bs + 1;
      continue;
    }
    let expr = text.slice(bs, after);
    const tailMatch = /([.,;:!?]+)$/.exec(expr);
    const tail = tailMatch ? tailMatch[1] : '';
    if (tail) expr = expr.slice(0, -tail.length);
    out += text.slice(i, bs);
    const rendered = renderTex(expr.trim(), false);
    if (rendered) out += rendered;
    else if (expr.trim().length > cmd[0].length) {
      // Longer than the bare command → a real expression KaTeX refused:
      // hand it to MathJax wrapped so it can take a second look.
      state.leftover = true;
      out += `\\(${expr.trim()}\\)`;
    } else out += expr;
    out += tail;
    i = after;
  }
  return out;
}

// Only text nodes are scanned (never tag attributes); <code>/<pre> content
// stays literal, so code samples are not turned into math.
function bareScan(chunk: string, state: { leftover: boolean }): string {
  let out = '';
  let skip = 0;
  let last = 0;
  const tag = /<[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(chunk))) {
    const text = chunk.slice(last, m.index);
    out += skip ? text : renderBareText(text, state);
    const t = m[0].toLowerCase();
    if (/^<(code|pre)\b/.test(t)) skip += 1;
    else if (/^<\/(code|pre)>/.test(t)) skip = Math.max(0, skip - 1);
    out += m[0];
    last = m.index + m[0].length;
  }
  const tail = chunk.slice(last);
  out += skip ? tail : renderBareText(tail, state);
  return out;
}

export function kaTeXSegments(html: string): { html: string; leftover: boolean } {
  if (!html || !/[\\$]/.test(html)) return { html, leftover: false };
  const state = { leftover: false };
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  DELIM.lastIndex = 0;
  while ((m = DELIM.exec(html))) {
    out += bareScan(html.slice(last, m.index), state);
    const tex = (m[1] ?? m[2] ?? m[3] ?? '')
      .replace(/&(lt|gt|amp);/g, (e) => ENT[e] ?? e)
      .trim();
    const displayMode = m[2] !== undefined || m[3] !== undefined;
    if (!tex) out += m[0];
    else {
      const rendered = renderTex(tex, displayMode);
      if (rendered) out += rendered;
      else {
        state.leftover = true;
        out += m[0];
      }
    }
    last = m.index + m[0].length;
  }
  out += bareScan(html.slice(last), state);
  return { html: out, leftover: state.leftover };
}

export function MathText({
  html,
  className,
  style,
  inline,
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);
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
  const inner = { dangerouslySetInnerHTML: { __html: stage1.html } };
  if (inline) {
    return <span ref={ref as React.RefObject<HTMLSpanElement>} className={className} style={style} {...inner} />;
  }
  return <div ref={ref as React.RefObject<HTMLDivElement>} className={className} style={style} {...inner} />;
}

// Plain text that may contain \(...\) / \[...\] / $$...$$ or bare TeX.
export function MathPlain({
  text,
  className,
  style,
  inline,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}) {
  return <MathText html={escHtml(text)} className={className} style={style} inline={inline} />;
}
