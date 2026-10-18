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

// Offline / CDN-blocked fallback: turn common TeX into readable glyphs
// (\sqrt{x} → √(x)) so a failed MathJax load never shows raw commands.
function beautify(raw: string): string {
  let s = raw;
  for (let pass = 0; pass < 8; pass++) {
    const fi = s.indexOf('\\frac{');
    if (fi >= 0) {
      const a = takeGroup(s, fi + 5);
      const b = a ? takeGroup(s, a[1]) : null;
      if (a && b) {
        s = s.slice(0, fi) + `(${a[0]})/(${b[0]})` + s.slice(b[1]);
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
    .replace(/\s+/g, ' ')
    .trim();
  return s;
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
        el.textContent = beautify(body.replace(/^\\\(([\s\S]*)\\\)$/, '$1').trim());
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
