// Checking typed answers for number (S30) and maths (S31) quiz questions.
// Maths answers are compared by VALUE, not text: (8/27)ρV³ and 0.296ρV³ both
// count. Both expressions are evaluated at several random values of every
// variable; they match when every evaluation agrees within a small tolerance.
// A small hand-written parser (no eval): numbers, + - * / ^, brackets, implicit
// multiplication (2x, 3(x+1), xy), constants pi/π and e, a few functions, and
// any single letter (Latin or Greek) as a variable.

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; n: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'fn'; f: string; a: Node };

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
};
const SUPERS: Record<string, string> = { '²': '^2', '³': '^3', '¹': '^1', '⁴': '^4' };

function tokenize(src: string): string[] {
  let s = src
    .replace(/[²³¹⁴]/g, (c) => SUPERS[c])
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/\*\*/g, '^')
    .replace(/\s+/g, '');
  const out: string[] = [];
  while (s) {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s);
    if (m && !(m[2] && /^e[a-z]/i.test(s.slice(m[1].length)))) { out.push(m[0]); s = s.slice(m[0].length); continue; }
    const f = /^(sqrt|sin|cos|tan|ln|log|exp|abs|pi)/i.exec(s);
    if (f) { out.push(f[0].toLowerCase()); s = s.slice(f[0].length); continue; }
    out.push(s[0]);
    s = s.slice(1);
  }
  return out;
}

function parse(src: string): Node {
  const t = tokenize(src);
  let i = 0;
  const peek = () => t[i];
  const isAtomStart = (x?: string) => !!x && (/^[\d.]/.test(x) || x === '(' || x === 'pi' || x in FUNCS || /^\p{L}$/u.test(x));
  function expr(): Node {
    let a = term();
    while (peek() === '+' || peek() === '-') { const op = t[i++] as '+' | '-'; a = { k: 'bin', op, a, b: term() }; }
    return a;
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') { const op = t[i++] as '*' | '/'; a = { k: 'bin', op, a, b: unary() }; }
      else if (isAtomStart(peek())) a = { k: 'bin', op: '*', a, b: power() }; // implicit: 2x, x(y+1)
      else return a;
    }
  }
  function unary(): Node {
    if (peek() === '-') { i++; return { k: 'neg', a: unary() }; }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function power(): Node {
    const a = atom();
    if (peek() === '^') { i++; return { k: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function atom(): Node {
    const x = t[i++];
    if (x === undefined) throw new Error('unexpected end');
    if (/^[\d.]/.test(x)) return { k: 'num', v: Number(x) };
    if (x === '(') { const e = expr(); if (t[i++] !== ')') throw new Error('missing )'); return e; }
    if (x === 'pi' || x === 'π') return { k: 'num', v: Math.PI };
    if (x in FUNCS) return { k: 'fn', f: x, a: power() };
    if (/^\p{L}$/u.test(x)) return x === 'e' ? { k: 'num', v: Math.E } : { k: 'var', n: x };
    throw new Error(`unexpected ${x}`);
  }
  const n = expr();
  if (i !== t.length) throw new Error('extra input');
  return n;
}

function vars(n: Node, into = new Set<string>()): Set<string> {
  if (n.k === 'var') into.add(n.n);
  else if (n.k === 'neg' || n.k === 'fn') vars(n.a, into);
  else if (n.k === 'bin') { vars(n.a, into); vars(n.b, into); }
  return into;
}

function evaluate(n: Node, env: Record<string, number>): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': return env[n.n] ?? NaN;
    case 'neg': return -evaluate(n.a, env);
    case 'fn': return FUNCS[n.f](evaluate(n.a, env));
    case 'bin': {
      const a = evaluate(n.a, env);
      const b = evaluate(n.b, env);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
    }
  }
}

const close = (a: number, b: number, rel = 2e-3) => Math.abs(a - b) <= Math.max(1e-9, rel * Math.max(Math.abs(a), Math.abs(b)));

/** True when the typed expression equals one of the accepted ones. Decimal answers
 *  (0.296ρV³ for (8/27)ρV³) pass within 0.2%. */
export function mathsMatches(typed: string, accepted: string[]): boolean {
  let a: Node;
  try { a = parse(typed); } catch { return false; }
  for (const acc of accepted) {
    let b: Node;
    try { b = parse(acc); } catch { continue; }
    const names = [...new Set([...vars(a), ...vars(b)])];
    let ok = true;
    let tried = 0;
    for (let k = 0; k < 6 && ok; k++) {
      const env: Record<string, number> = {};
      for (const nm of names) env[nm] = 0.7 + Math.random() * 2.3; // positive, away from 0 and 1
      const x = evaluate(a, env);
      const y = evaluate(b, env);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      tried++;
      ok = close(x, y);
    }
    if (ok && tried > 0) return true;
  }
  return false;
}

/** Number answers: within the author's tolerance, or 1% of the answer by default.
 *  Accepts "1,250", "1.25e3" and a trailing unit the student typed anyway. */
export function numberMatches(typed: string, answer: number, tolerance?: number): boolean {
  const cleaned = typed.replace(/,/g, '').replace(/[a-zA-Zµ°%\/²³\s]+$/u, '').trim();
  if (!cleaned) return false;
  const v = Number(cleaned);
  if (!Number.isFinite(v)) return false;
  const tol = tolerance != null && tolerance >= 0 ? tolerance : Math.max(Math.abs(answer) * 0.01, 1e-9);
  return Math.abs(v - answer) <= tol;
}

/** Whether a string parses as an expression (for the keypad's "check" hint). */
export function parses(s: string): boolean {
  try { parse(s); return true; } catch { return false; }
}
