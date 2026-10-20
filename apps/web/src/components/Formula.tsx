import { useEffect, useMemo, useRef, useState } from 'react';
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
// (\sqrt{x} → √(x)). No MathJax, no async — always shows something readable.
export function beautifyMath(latex: string): string {
  const t = (latex || '').trim();
  const inner = t
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1');
  return beautify(inner.trim());
}

// ---- saved-render cache (offline live preview) ----
// The Studio "live preview" used to depend on the MathJax CDN, so with no
// network it rendered nothing (or sat hidden waiting). Every successful
// typeset is now saved per-equation in localStorage and re-injected on the
// next mount — the preview renders instantly online AND offline. Entries
// are small MathJax outputs; capped so the quota is never hit.
const FX_CACHE = 'unify.fx.v1';
type FxEntry = { t: number; h: string };

function fxHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function fxCached(body: string): string | null {
  try {
    const raw = localStorage.getItem(FX_CACHE);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, FxEntry>;
    const e = map[fxHash(body)];
    return e && typeof e.h === 'string' ? e.h : null;
  } catch {
    return null;
  }
}

function fxSave(body: string, html: string) {
  if (!html || html.length > 40000) return;
  try {
    const raw = localStorage.getItem(FX_CACHE);
    const map: Record<string, FxEntry> = raw ? JSON.parse(raw) : {};
    map[fxHash(body)] = { t: Date.now(), h: html };
    const keys = Object.keys(map);
    if (keys.length > 80) {
      keys
        .sort((a, b) => map[a].t - map[b].t)
        .slice(0, keys.length - 80)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(FX_CACHE, JSON.stringify(map));
  } catch {
    /* quota or private mode — cache is best-effort */
  }
}

// innerHTML (not text children): MathJax rewrites the element's DOM, which
// would orphan React's text nodes — later updates would land on detached
// nodes and the preview would go stale. React's innerHTML diffing resets
// cleanly when the equation changes.
//
// Never-raw design: the card shows readable glyph math from first paint;
// the raw TeX lives in an off-screen, visibility:hidden twin that is only
// revealed once there is real math to show — a saved render (instant,
// works offline) or a fresh MathJax typeset. typesetMath resolves false on
// a missing CDN, a rejected typeset or a hung font fetch — all of which
// used to leave raw \( \frac .. \) code on screen forever. Raw TeX is
// therefore never shown, whatever the network is doing.
export default function Formula({ latex }: { latex: string }) {
  const rawRef = useRef<HTMLSpanElement>(null);
  const body = useMemo(() => normalize(latex), [latex]);
  const plain = useMemo(() => beautifyMath(body), [body]);
  // Per-body so a same-tick equation change never reveals stale raw TeX.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const revealed = revealedFor === body && body !== '';
  useEffect(() => {
    let dead = false;
    const el = rawRef.current;
    if (!el || !body) return () => { dead = true; };
    // Saved render from a previous session: instant, offline-proof — skip
    // the CDN round-trip entirely.
    const cached = fxCached(body);
    if (cached) {
      el.innerHTML = cached;
      setRevealedFor(body);
      return () => { dead = true; };
    }
    void (async () => {
      const ok = await typesetMath(el);
      if (dead || !el.isConnected) return;
      // A "successful" typeset that still shows TeX commands means some
      // segment was skipped — keep the glyphs rather than half-raw output.
      const txt = el.textContent || '';
      if (ok && !/\\[a-zA-Z(]/.test(txt)) {
        setRevealedFor(body);
        fxSave(body, el.innerHTML);
      }
    })();
    return () => { dead = true; };
  }, [body]);
  return (
    <div
      className="f-eq"
      style={{ position: 'relative', overflowX: 'auto', fontSize: 15, lineHeight: 2.2, minHeight: body ? undefined : 0 }}
    >
      <span
        aria-hidden={!revealed}
        ref={rawRef}
        style={revealed ? undefined : { position: 'absolute', left: -9999, top: 0, visibility: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: escHtml(body) }}
      />
      {!revealed && <span>{plain}</span>}
    </div>
  );
}
