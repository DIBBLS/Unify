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
  // Control sequences must not glue to a following letter (\pir is one
  // bad command, not \pi + r) — separate with a space (harmless in math).
  return nodes
    .map(compileOne)
    .join('')
    .replace(/(\\[a-zA-Z]+)(?=[a-zA-Z])/g, '$1 ');
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

// ---- reusable formula library ----
// Named presets authors drop in whole instead of rebuilding: categories +
// tap-to-insert into the active box. Same trees the builder makes, so
// everything stays editable after insertion.
const tk = (g: string, lx?: string): MNode => ({ t: 'tok', g, lx: lx ?? g });
const supN = (b: MNode[], e: MNode[]): MNode => ({ t: 'sup', b, e });
const subN = (b: MNode[], e: MNode[]): MNode => ({ t: 'sub', b, e });
const fracN = (n: MNode[], d: MNode[]): MNode => ({ t: 'frac', n, d });
const sqrtN = (x: MNode[]): MNode => ({ t: 'sqrt', x });
const G = (g: string): MNode => {
  const found = GLYPHS.find((x) => x.g === g);
  return found ? { t: 'tok', g: found.g, lx: found.lx } : tk(g);
};

export const FORMULA_LIBRARY: { category: string; items: { name: string; tree: MNode[] }[] }[] = [
  {
    category: 'Algebra',
    items: [
      { name: 'Pythagoras', tree: [supN([tk('a')], [tk('2')]), tk('+'), supN([tk('b')], [tk('2')]), tk('='), supN([tk('c')], [tk('2')])] },
      {
        name: 'Quadratic formula',
        tree: [tk('x'), tk('='), fracN([tk('−'), tk('b'), tk('±'), sqrtN([supN([tk('b')], [tk('2')]), tk('−'), tk('4'), tk('a'), tk('c')])], [tk('2'), tk('a')])],
      },
      {
        name: 'Slope',
        tree: [tk('m'), tk('='), fracN([subN([tk('y')], [tk('2')]), tk('−'), subN([tk('y')], [tk('1')])], [subN([tk('x')], [tk('2')]), tk('−'), subN([tk('x')], [tk('1')])])],
      },
    ],
  },
  {
    category: 'Geometry',
    items: [
      { name: 'Circle area', tree: [tk('A'), tk('='), G('π'), supN([tk('r')], [tk('2')])] },
      { name: 'Circumference', tree: [tk('C'), tk('='), tk('2'), G('π'), tk('r')] },
    ],
  },
  {
    category: 'Physics',
    items: [
      { name: "Ohm's law", tree: [tk('V'), tk('='), tk('I'), tk('R')] },
      { name: 'Density', tree: [G('ρ'), tk('='), fracN([tk('m')], [tk('V')])] },
      { name: 'Motion (v = u + at)', tree: [tk('v'), tk('='), tk('u'), tk('+'), tk('a'), tk('t')] },
      { name: 'Kinetic energy', tree: [subN([tk('E')], [tk('k')]), tk('='), fracN([tk('1')], [tk('2')]), tk('m'), supN([tk('v')], [tk('2')])] },
    ],
  },
  {
    category: 'Statistics',
    items: [
      { name: 'Mean', tree: [{ t: 'tok', g: 'x̄', lx: '\\bar{x}' }, tk('='), fracN([G('∑'), tk('x')], [tk('n')])] },
      {
        name: 'Std deviation',
        tree: [G('σ'), tk('='), sqrtN([fracN([G('∑'), tk('('), tk('x'), tk('−'), { t: 'tok', g: 'x̄', lx: '\\bar{x}' }, supN([tk(')')], [tk('2')])], [tk('N')])])],
      },
    ],
  },
  {
    category: 'Chemistry',
    items: [
      { name: 'Molarity', tree: [tk('M'), tk('='), fracN([tk('n')], [tk('V')])] },
      { name: 'Ideal gas', tree: [tk('P'), tk('V'), tk('='), tk('n'), tk('R'), tk('T')] },
    ],
  },
];

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
  const [libOpen, setLibOpen] = useState(false);
  const [libCat, setLibCat] = useState(FORMULA_LIBRARY[0].category);

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
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setLibOpen((v) => !v)}
          aria-expanded={libOpen}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 800, fontSize: 12 }}
        >
          {libOpen ? 'Hide formula library' : 'Reuse a saved formula instead of rebuilding'}
        </button>
        {libOpen && (
          <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {FORMULA_LIBRARY.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setLibCat(c.category)}
                  style={{ padding: '6px 12px', borderRadius: 9999, border: `1px solid ${libCat === c.category ? '#059669' : 'var(--border)'}`, background: libCat === c.category ? '#10b981' : 'var(--surface)', color: libCat === c.category ? '#fff' : 'var(--text2)', fontSize: 11, fontWeight: 800 }}
                >
                  {c.category}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(FORMULA_LIBRARY.find((c) => c.category === libCat)?.items || []).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    const next = setList(tree, active, [...getList(tree, active), ...item.tree]);
                    setTree(next);
                    onBuild(compileEquation(next));
                  }}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', fontSize: 12, fontWeight: 700 }}
                >
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ color: '#059669', fontWeight: 800 }}>Insert +</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Inserts into the green box — still fully editable after.</div>
          </div>
        )}
      </div>
    </div>
  );
}
