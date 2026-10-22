import { useEffect, useMemo, useRef } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Normalize any equation string to bare TeX for KaTeX:
//  - bare builder output ("V=IR") — rendered as-is;
//  - \(...\), \[...\], $$...$$ — delimiters stripped (KaTeX gets the inner
//    TeX; display \[...\] still renders inline to keep the compact card
//    rhythm the old MathJax version had).
function stripTex(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  return t
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
    .trim();
}

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', varepsilon: 'ε', varphi: 'φ', vartheta: 'ϑ',
};
const SYM: Record<string, string> = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ldots: '…', cdots: '⋯',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  sim: '∼', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
  infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
  in: '∈', notin: '∉', subset: '⊂', supset: '⊃', subseteq: '⊆', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', emptyset: '∅', angle: '∠', perp: '⊥', parallel: '∥',
  degree: '°', bullet: '•', ast: '∗', oint: '∮', iint: '∬',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷',
  '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ', x: 'ˣ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇',
  '8': '₈', '9': '₉', n: 'ₙ', i: 'ᵢ', x: 'ₓ', m: 'ₘ', k: 'ₖ', a: 'ₐ', e: 'ₑ',
  p: 'ₚ', s: 'ₛ', t: 'ₜ',
};

function takeGroup(s: string, i: number): [string, number] | null {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return null;
}

function mapChars(s: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of s) {
    const t = table[ch];
    if (!t) return null;
    out += t;
  }
  return out;
}

// Fallback for TeX KaTeX can't parse: turn common commands into readable
// glyphs (\sqrt{x} → √(x)) so an unsupported equation never shows raw code.
function beautify(raw: string): string {
  let s = raw;
  // AI-pasted LaTeX often spaces the command from its group ("\frac {a}{b}",
  // "\sqrt {x}") — the matcher below only finds the canonical form, and a
  // missed \frac/\sqrt degrades to literal "frac ab"/"\sqrt x" with NO sign.
  // Collapse to canonical first so roots and fractions always glyph-ify.
  s = s
    .replace(/\\(dfrac|tfrac|frac)\s*\{/g, "\\frac{")
    .replace(/\\sqrt\s*\[/g, "\\sqrt[")
    .replace(/\\sqrt\s+\{/g, "\\sqrt{");
  for (let pass = 0; pass < 8; pass++) {
    const fi = s.indexOf('\\frac{');
    if (fi >= 0) {
      const a = takeGroup(s, fi + 5);
      const b = a ? takeGroup(s, a[1]) : null;
      if (a && b) {
        // U+2044 fraction slash reads as a real fraction sign, not a divide.
        const side = (t: string) => (/^[a-zA-Z0-9ΩΔ]+$/.test(t) ? t : `(${t})`);
        s = s.slice(0, fi) + `${side(a[0].trim())}⁄${side(b[0].trim())}` + s.slice(b[1]);
        continue;
      }
      s = s.slice(0, fi) + s.slice(fi + 6);
      continue;
    }
    const si = s.indexOf('\\sqrt');
    if (si >= 0) {
      let j = si + 5;
      let root = '√';
      if (s[j] === '[') {
        const close = s.indexOf(']', j);
        if (close > 0) {
          const idx = s.slice(j + 1, close).trim();
          root = idx === '3' ? '∛' : idx === '4' ? '∜' : '√';
          j = close + 1;
        }
      }
      const g = takeGroup(s, j);
      if (g) {
        const inner = g[0].trim();
        const one = /^[a-zA-Z0-9ΩΔ]$/.test(inner) ? inner : `(${inner})`;
        s = s.slice(0, si) + root + one + s.slice(g[1]);
        continue;
      }
      const next = s[j];
      if (next && /[a-zA-Z0-9]/.test(next)) {
        s = s.slice(0, si) + root + next + s.slice(j + 1);
        continue;
      }
      break;
    }
    break;
  }
  s = s
    .replace(/\\left\s*([()[\]|./\\])/g, '$1')
    .replace(/\\right\s*([()[\]|./\\])/g, '$1')
    .replace(/\^\{([^{}]*)\}/g, (_m, g: string) => mapChars(g, SUP) ?? `(${g})`)
    .replace(/\^(.)/g, (_m, g: string) => mapChars(g, SUP) ?? `(${g})`)
    .replace(/_\{([^{}]*)\}/g, (_m, g: string) => mapChars(g, SUB) ?? `(${g})`)
    .replace(/_(.)/g, (_m, g: string) => mapChars(g, SUB) ?? `(${g})`)
    .replace(/\\([a-zA-Z]+)/g, (m, name: string) => SYM[name] ?? GREEK[name] ?? m)
    .replace(/\\(displaystyle|textstyle|limits|nolimits|big|bigg|Big|Bigg|left|right)\b/g, '')
    .replace(/\\[,;:!]|\\quad\b|\\qquad\b|\\!|\\\\/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\/g, '') // unknown commands lose the backslash — never code-y
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// Plain-text math for previews: strip any delimiters, then glyph-ify
// (\sqrt{x} → √(x)). Always shows something readable.
export function beautifyMath(latex: string): string {
  const t = (latex || '').trim();
  const inner = t
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1');
  return beautify(inner.trim());
}

// Formula boxes render with KaTeX — the renderer this app used before
// MathJax, restored at the user's request. STATIC import: the engine ships
// inside the main bundle (one fetch the app already makes), so a flaky or
// absent network can never strand a formula on a missing code-split chunk
// (v1.26.9's failure mode — lazy katex chunk rejected → everything fell to
// glyphs). No CDN, no typeset race, offline by construction. TeX KaTeX
// can't parse falls back to glyph text — never raw commands.
export default function Formula({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tex = useMemo(() => stripTex(latex), [latex]);
  const plain = useMemo(() => beautifyMath(latex), [latex]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let html: string | null = null;
    if (tex) {
      try {
        html = katex.renderToString(tex, { throwOnError: true, displayMode: false, strict: false });
      } catch {
        html = null;
      }
    }
    if (html) el.innerHTML = html;
    else el.textContent = tex ? plain : '';
  }, [tex, plain]);
  return (
    <div
      ref={ref}
      className="f-eq"
      style={{ overflowX: 'auto', fontSize: 15, lineHeight: 2.2, minHeight: tex ? undefined : 0 }}
      dangerouslySetInnerHTML={{ __html: escHtml(latex || '') }}
    />
  );
}
