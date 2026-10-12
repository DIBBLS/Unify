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
  return nodes.map(compileOne).join(' ');
}

function compileList(nodes: MNode[]): string {
  return nodes.map(compileOne).join(' ');
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
  return inner ? `\\[ ${inner} \\]` : '';
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

export default function VisualEquation({ onBuild }: { onBuild: (latex: string) => void }) {
  const [tree, setTree] = useState<MNode[]>([]);
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
