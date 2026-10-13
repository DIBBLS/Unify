import { useState } from 'react';

// Visual equation builder: non-technical authors never see or type LaTeX.
// They tap structure (fraction, power, root) and fill boxes with digits,
// letters, operators and Greek glyphs; the tree compiles to the exact
// LaTeX string the reader renders. Invalid equations are unconstructible.
export type MNode =
  | { t: 'tok'; g: string; lx: string }
  | { t: 'frac'; n: MNode[]; d: MNode[] }
  | { t: 'sup'; b: MNode[]; e: MNode[] }
  | { t: 'sub'; b: MNode[]; e: MNode[] }
  | { t: 'sqrt'; x: MNode[] };

type Path = (number | string)[];

export function compileNodes(nodes: MNode[]): string {
  return nodes.map(compileOne).join('');
}

function compileList(nodes: MNode[]): string {
  return nodes.map(compileOne).join('');
}

function compileOne(n: MNode): string {
  switch (n.t) {
    case 'tok':
      return n.lx;
    case 'frac':
      return `\\frac{${compileList(n.n) || ' '}}{${compileList(n.d) || ' '}}`;
    case 'sup':
      return `{${compileList(n.b) || ' '}}^{${compileList(n.e) || ' '}}`;
    case 'sub':
      return `{${compileList(n.b) || ' '}}_{${compileList(n.e) || ' '}}`;
    case 'sqrt':
      return `\\sqrt{${compileList(n.x) || ' '}}`;
  }
}

export function compileEquation(nodes: MNode[]): string {
  const inner = compileNodes(nodes).trim();
  if (!inner) return '';
  // Plain words stay plain text (never force math mode on prose); anything
  // structural or symbolic gets display delimiters.
  const hasMath = (function walk(ns: MNode[]): boolean {
    return ns.some((n) => {
      if (n.t === 'tok') return n.lx.startsWith('\\');
      if (n.t === 'frac' || n.t === 'sqrt') return true;
      return walk(n.b) || walk(n.e);
    });
  })(nodes);
  return hasMath ? `\\[ ${inner} \\]` : inner;
}

// ---- one-way LaTeX subset parser ----
// Reads back the common shapes our own builder + AI emit
// (\frac, ^{}, _{}, \sqrt, \( \)/\[ \] wrappers, plain tokens) into a
// visual tree. Anything fancier returns null: the equation is then kept
// exactly as-is (never mangled), and the author rebuilds visually.
const CMD_MAP: Record<string, { g: string; lx: string }> = {
  alpha: { g: 'α', lx: '\\alpha' },
  beta: { g: 'β', lx: '\\beta' },
  gamma: { g: 'γ', lx: '\\gamma' },
  delta: { g: 'δ', lx: '\\delta' },
  epsilon: { g: 'ε', lx: '\\epsilon' },
  theta: { g: 'θ', lx: '\\theta' },
  lambda: { g: 'λ', lx: '\\lambda' },
  mu: { g: 'μ', lx: '\\mu' },
  rho: { g: 'ρ', lx: '\\rho' },
  sigma: { g: 'σ', lx: '\\sigma' },
  phi: { g: 'φ', lx: '\\phi' },
  omega: { g: 'ω', lx: '\\omega' },
  Omega: { g: 'Ω', lx: '\\Omega' },
  pi: { g: 'π', lx: '\\pi' },
  Delta: { g: 'Δ', lx: '\\Delta' },
  times: { g: '×', lx: '\\times' },
  cdot: { g: '·', lx: '\\cdot' },
  leq: { g: '≤', lx: '\\leq' },
  geq: { g: '≥', lx: '\\geq' },
  neq: { g: '≠', lx: '\\neq' },
  approx: { g: '≈', lx: '\\approx' },
  sum: { g: '∑', lx: '\\sum' },
  int: { g: '∫', lx: '\\int' },
  prod: { g: '∏', lx: '\\prod' },
};

type Cursor = { s: string; i: number };

function parseGroup(c: Cursor): MNode[] | null {
  const out: MNode[] = [];
  let text = '';
  const flush = () => {
    for (const ch of text) {
      if (ch === ' ' || ch === '\n' || ch === '\t') continue;
      out.push({ t: 'tok', g: ch, lx: ch });
    }
    text = '';
  };
  while (c.i < c.s.length) {
    const ch = c.s[c.i];
    if (ch === '}') break;
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(c.s.slice(c.i));
      if (!m) return null;
      const cmd = m[1];
      c.i += m[0].length;
      if (cmd === 'frac') {
        if (c.s[c.i] !== '{') return null;
        c.i += 1;
        const n = parseGroup(c);
        if (!n || c.s[c.i] !== '}') return null;
        c.i += 1;
        if (c.s[c.i] !== '{') return null;
        c.i += 1;
        const d = parseGroup(c);
        if (!d || c.s[c.i] !== '}') return null;
        c.i += 1;
        flush();
        out.push({ t: 'frac', n, d });
        continue;
      }
      if (cmd === 'sqrt') {
        if (c.s[c.i] !== '{') return null;
        c.i += 1;
        const x = parseGroup(c);
        if (!x || c.s[c.i] !== '}') return null;
        c.i += 1;
        flush();
        out.push({ t: 'sqrt', x });
        continue;
      }
      const known = CMD_MAP[cmd];
      if (!known) return null;
      flush();
      out.push({ t: 'tok', g: known.g, lx: known.lx });
      continue;
    }
    if (ch === '^' || ch === '_') {
      const isSup = ch === '^';
      c.i += 1;
      let exp: MNode[];
      if (c.s[c.i] === '{') {
        c.i += 1;
        const g = parseGroup(c);
        if (!g || c.s[c.i] !== '}') return null;
        c.i += 1;
        exp = g;
      } else if (c.s[c.i] && /[0-9a-zA-Z]/.test(c.s[c.i])) {
        exp = [{ t: 'tok', g: c.s[c.i], lx: c.s[c.i] }];
        c.i += 1;
      } else {
        return null;
      }
      flush();
      const base = out.length ? [out.pop() as MNode] : [];
      out.push(isSup ? { t: 'sup', b: base, e: exp } : { t: 'sub', b: base, e: exp });
      continue;
    }
    text += ch;
    c.i += 1;
  }
  flush();
  return out;
}

export function parseLatex(latex: string): MNode[] | null {
  try {
    let s = (latex || '').trim();
    // Strip one display \[...\] or inline \(...\) wrapper.
    const disp = s.match(/^\\\[([\s\S]*)\\\]$/);
    if (disp) s = disp[1].trim();
    else {
      const inl = s.match(/^\\\(([\s\S]*)\\\)$/);
      if (inl) s = inl[1].trim();
    }
    if (!s) return [];
    const c: Cursor = { s, i: 0 };
    const out = parseGroup(c);
    if (!out || c.i !== s.length) return null;
    return out;
  } catch {
    return null;
  }
}

const GLYPHS: { g: string; lx: string }[] = [
  { g: 'α', lx: '\\alpha' },
  { g: 'β', lx: '\\beta' },
  { g: 'γ', lx: '\\gamma' },
  { g: 'δ', lx: '\\delta' },
  { g: 'ε', lx: '\\epsilon' },
  { g: 'θ', lx: '\\theta' },
  { g: 'λ', lx: '\\lambda' },
  { g: 'μ', lx: '\\mu' },
  { g: 'ρ', lx: '\\rho' },
  { g: 'σ', lx: '\\sigma' },
  { g: 'φ', lx: '\\phi' },
  { g: 'ω', lx: '\\omega' },
  { g: 'Ω', lx: '\\Omega' },
  { g: 'π', lx: '\\pi' },
  { g: 'Δ', lx: '\\Delta' },
  { g: '∑', lx: '\\sum' },
  { g: '∫', lx: '\\int' },
  { g: '∏', lx: '\\prod' },
];

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '='];
const LETTERS = ['x', 'y', 'z', 'a', 'b', 'c', 'm', 'n', 'P', 'Q', 'R', 'T'];
const OPS = ['+', '−', '×', '=', '(', ')'];

function lxOf(g: string): string {
  const found = GLYPHS.find((x) => x.g === g);
  if (found) return found.lx;
  if (g === '−') return '-';
  if (g === '×') return '\\times';
  return g;
}

function getList(tree: MNode[], path: Path): MNode[] {
  let list: MNode[] = tree;
  for (let i = 0; i < path.length; i += 2) {
    const idx = path[i] as number;
    const key = path[i + 1] as string;
    list = (list[idx] as unknown as Record<string, MNode[]>)[key];
  }
  return list;
}

function setList(tree: MNode[], path: Path, next: MNode[]): MNode[] {
  if (!path.length) return next;
  const [idx, key, ...rest] = path as [number, string, ...(number | string)[]];
  return tree.map((n, i) => {
    if (i !== idx) return n;
    const rec = n as unknown as Record<string, MNode[]>;
    return { ...n, [key]: setList(rec[key], rest, next) } as MNode;
  });
}

const boxStyle = (active: boolean): React.CSSProperties => ({
  minWidth: 30,
  minHeight: 30,
  padding: '4px 8px',
  borderRadius: 8,
  border: `1.5px ${active ? 'solid #059669' : 'dashed var(--border)'}`,
  background: active ? '#ecfdf5' : 'var(--surface)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  cursor: 'pointer',
  fontSize: 16,
});

function NodeView({ node, at, activeKey, onPick }: { node: MNode; at: Path; activeKey: string; onPick: (listPath: Path) => void }) {
  if (node.t === 'tok') {
    return <span style={{ fontSize: 17, padding: '0 1px' }}>{node.g}</span>;
  }
  if (node.t === 'frac') {
    const nk = [...at, 'n'].join('|');
    const dk = [...at, 'd'].join('|');
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', verticalAlign: 'middle', margin: '0 3px' }}>
        <span style={boxStyle(activeKey === nk)} onClick={(e) => { e.stopPropagation(); onPick([...at, 'n']); }}>
          {node.n.map((c, i) => (
            <NodeView key={i} node={c} at={[...at, 'n', i]} activeKey={activeKey} onPick={onPick} />
          ))}
          {!node.n.length && <span style={{ color: 'var(--text3)', fontSize: 11 }}>top</span>}
        </span>
        <span style={{ height: 2, background: 'var(--text)', borderRadius: 2, margin: '2px 0' }} />
        <span style={boxStyle(activeKey === dk)} onClick={(e) => { e.stopPropagation(); onPick([...at, 'd']); }}>
          {node.d.map((c, i) => (
            <NodeView key={i} node={c} at={[...at, 'd', i]} activeKey={activeKey} onPick={onPick} />
          ))}
          {!node.d.length && <span style={{ color: 'var(--text3)', fontSize: 11 }}>bottom</span>}
        </span>
      </span>
    );
  }
  if (node.t === 'sup' || node.t === 'sub') {
    const bk = [...at, 'b'].join('|');
    const ek = [...at, 'e'].join('|');
    return (
      <span style={{ display: 'inline-flex', alignItems: node.t === 'sup' ? 'flex-start' : 'flex-end', margin: '0 2px' }}>
        <span style={boxStyle(activeKey === bk)} onClick={(e) => { e.stopPropagation(); onPick([...at, 'b']); }}>
          {node.b.map((c, i) => (
            <NodeView key={i} node={c} at={[...at, 'b', i]} activeKey={activeKey} onPick={onPick} />
          ))}
          {!node.b.length && <span style={{ color: 'var(--text3)', fontSize: 11 }}>base</span>}
        </span>
        <span style={{ ...boxStyle(activeKey === ek), minWidth: 24, minHeight: 24, fontSize: 13, marginLeft: 2 }} onClick={(e) => { e.stopPropagation(); onPick([...at, 'e']); }}>
          {node.e.map((c, i) => (
            <NodeView key={i} node={c} at={[...at, 'e', i]} activeKey={activeKey} onPick={onPick} />
          ))}
          {!node.e.length && <span style={{ color: 'var(--text3)', fontSize: 10 }}>{node.t === 'sup' ? 'pow' : 'sub'}</span>}
        </span>
      </span>
    );
  }
  const xk = [...at, 'x'].join('|');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', margin: '0 2px' }}>
      <span style={{ fontSize: 18 }}>√</span>
      <span style={{ ...boxStyle(activeKey === xk), borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: 1 }} onClick={(e) => { e.stopPropagation(); onPick([...at, 'x']); }}>
        {node.x.map((c, i) => (
          <NodeView key={i} node={c} at={[...at, 'x', i]} activeKey={activeKey} onPick={onPick} />
        ))}
        {!node.x.length && <span style={{ color: 'var(--text3)', fontSize: 11 }}>…</span>}
      </span>
    </span>
  );
}

export default function VisualEquation({ initial, onBuild }: { initial: MNode[]; onBuild: (latex: string) => void }) {
  const [tree, setTree] = useState<MNode[]>(initial);
  const [active, setActive] = useState<Path>([]);

  const mutate = (fn: (list: MNode[]) => MNode[]) => {
    const next = setList(tree, active, fn(getList(tree, active)));
    setTree(next);
    onBuild(compileEquation(next));
  };

  const addTok = (g: string) => mutate((list) => [...list, { t: 'tok', g, lx: lxOf(g) }]);
  const back = () => mutate((list) => list.slice(0, -1));
  const clear = () => {
    setTree([]);
    setActive([]);
    onBuild('');
  };
  const insertStruct = (kind: 'frac' | 'sup' | 'sub' | 'sqrt') => {
    const node: MNode =
      kind === 'frac'
        ? { t: 'frac', n: [], d: [] }
        : kind === 'sup'
          ? { t: 'sup', b: [], e: [] }
          : kind === 'sub'
            ? { t: 'sub', b: [], e: [] }
            : { t: 'sqrt', x: [] };
    mutate((list) => [...list, node]);
  };

  const key: React.CSSProperties = {
    minWidth: 38,
    padding: '8px 4px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
  };
  const structBtn: React.CSSProperties = { ...key, borderColor: '#059669', color: '#059669' };
  const activeKey = active.join('|');

  return (
    <div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 64, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text3)', marginBottom: 6 }}>
          TAP A BOX, THEN THE KEYS — NO TYPING, NO CODE
        </div>
        <div onClick={() => setActive([])} style={boxStyle(activeKey === '')}>
          {tree.map((n, i) => (
            <NodeView key={i} node={n} at={[i]} activeKey={activeKey} onPick={setActive} />
          ))}
          {!tree.length && <span style={{ color: 'var(--text3)', fontSize: 12 }}>Tap a structure below to start…</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }} role="toolbar" aria-label="Structures">
        <button type="button" onClick={() => insertStruct('frac')} style={structBtn}>a⁄b</button>
        <button type="button" onClick={() => insertStruct('sup')} style={structBtn}>x²</button>
        <button type="button" onClick={() => insertStruct('sub')} style={structBtn}>x₂</button>
        <button type="button" onClick={() => insertStruct('sqrt')} style={structBtn}>√</button>
        <button type="button" onClick={back} style={{ ...key, color: '#991b1b' }}>Del</button>
        <button type="button" onClick={clear} style={{ ...key, color: 'var(--text2)', fontSize: 12 }}>Clear</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }} role="toolbar" aria-label="Numbers and letters">
        {[...KEYS, ...LETTERS].map((k) => (
          <button key={k} type="button" onClick={() => addTok(k)} style={key}>{k}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }} role="toolbar" aria-label="Operators">
        {OPS.map((k) => (
          <button key={k} type="button" onClick={() => addTok(k)} style={key}>{k}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="toolbar" aria-label="Greek letters">
        {GLYPHS.map((g) => (
          <button key={g.lx} type="button" onClick={() => addTok(g.g)} style={{ ...key, color: '#059669' }}>{g.g}</button>
        ))}
      </div>
    </div>
  );
}
