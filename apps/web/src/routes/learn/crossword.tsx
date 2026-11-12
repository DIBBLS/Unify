import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Delete } from 'lucide-react';
import { api } from '../../lib/api';
import { buildCrossword, type Entry, type Puzzle } from '../../lib/crossword';
import type { UnifyNote } from '../../types/note';
import BackButton from '../../components/BackButton';
import GameFinish from '../../components/GameFinish';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';

// Crossword: the week's key terms crossing where they share a letter, with
// clues from the notes. Tap a square to choose it, tap again to switch
// between across and down, and type on the keyboard below the grid.
type Saved = { letters: Record<string, string>; reveals: number; checks: number; startedAt: number; finishedSecs?: number };
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const store = (c: string, w: number) => `unify:crossword:${c}:${w}`;
const enumeration = (display: string) => `(${display.split(/[\s-]+/).map((p) => p.replace(/[^A-Za-z]/g, '').length).join(', ')})`;

export default function CrosswordRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<Saved>(() => {
    try { return JSON.parse(localStorage.getItem(store(courseCode, weekNum)) || '') as Saved; } catch { return { letters: {}, reveals: 0, checks: 0, startedAt: Date.now() }; }
  });
  const [sel, setSel] = useState<{ r: number; c: number; dir: 'across' | 'down' } | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const note = d.note_json as UnifyNote;
        setPuzzle(note && Array.isArray(note.topics) ? buildCrossword(note) : null);
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);
  useEffect(() => {
    try { localStorage.setItem(store(courseCode, weekNum), JSON.stringify(saved)); } catch { /* fine */ }
  }, [saved, courseCode, weekNum]);

  const entryAt = (r: number, c: number, dir: 'across' | 'down'): Entry | undefined =>
    puzzle?.entries.find((e) => e.dir === dir && (dir === 'across' ? e.row === r && c >= e.col && c < e.col + e.word.length : e.col === c && r >= e.row && r < e.row + e.word.length));
  const current = sel ? entryAt(sel.r, sel.c, sel.dir) || entryAt(sel.r, sel.c, sel.dir === 'across' ? 'down' : 'across') : undefined;
  const cellsOf = (e: Entry) => Array.from({ length: e.word.length }, (_, i) => (e.dir === 'across' ? { r: e.row, c: e.col + i } : { r: e.row + i, c: e.col }));
  const solved = useMemo(() => !!puzzle && puzzle.cells.every((row, r) => row.every((ch, c) => !ch || saved.letters[`${r},${c}`] === ch)), [puzzle, saved.letters]);

  useEffect(() => {
    if (solved && saved.finishedSecs == null) setSaved((s) => ({ ...s, finishedSecs: Math.max(1, Math.round((Date.now() - s.startedAt) / 1000)) }));
  }, [solved, saved.finishedSecs]);

  const pick = (r: number, c: number) => {
    if (!puzzle?.cells[r][c]) return;
    setWrong([]);
    setSel((s) => {
      const has = (d: 'across' | 'down') => !!entryAt(r, c, d);
      if (s && s.r === r && s.c === c) {
        const other = s.dir === 'across' ? 'down' : 'across';
        return has(other) ? { r, c, dir: other } : s;
      }
      return { r, c, dir: s && has(s.dir) ? s.dir : has('across') ? 'across' : 'down' };
    });
  };
  const step = (delta: 1 | -1) => {
    if (!sel || !current) return;
    const cs = cellsOf(current);
    const i = cs.findIndex((x) => x.r === sel.r && x.c === sel.c);
    const n = cs[i + delta];
    if (n) setSel({ ...sel, r: n.r, c: n.c, dir: current.dir });
  };
  const type = (ch: string) => {
    if (!sel || solved) return;
    setWrong([]);
    setSaved((s) => ({ ...s, letters: { ...s.letters, [`${sel.r},${sel.c}`]: ch } }));
    step(1);
  };
  const back = () => {
    if (!sel || solved) return;
    const k = `${sel.r},${sel.c}`;
    if (saved.letters[k]) setSaved((s) => { const l = { ...s.letters }; delete l[k]; return { ...s, letters: l }; });
    else step(-1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) { type(e.key.toUpperCase()); e.preventDefault(); }
      else if (e.key === 'Backspace') { back(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const check = () => {
    if (!puzzle) return;
    const bad: string[] = [];
    puzzle.cells.forEach((row, r) => row.forEach((ch, c) => { const v = saved.letters[`${r},${c}`]; if (ch && v && v !== ch) bad.push(`${r},${c}`); }));
    setWrong(bad);
    setSaved((s) => ({ ...s, checks: s.checks + 1 }));
  };
  const reveal = () => {
    if (!puzzle || !current) return;
    const target = cellsOf(current).find((x) => saved.letters[`${x.r},${x.c}`] !== puzzle.cells[x.r][x.c]);
    if (!target) return;
    setSaved((s) => ({ ...s, reveals: s.reveals + 1, letters: { ...s.letters, [`${target.r},${target.c}`]: puzzle.cells[target.r][target.c] as string } }));
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 640px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const backTo = `/learn/${encodeURIComponent(courseCode)}/week/${weekNum}`;
  if (err) return <div style={shell}><BackButton to={backTo} /><div className="t-14" style={{ color: 'var(--u-red)' }}>{err}</div></div>;
  if (puzzle === undefined) return <div style={shell}><BackButton to={backTo} /><div className="t-13 muted">Building the crossword…</div></div>;
  if (!puzzle) {
    return (
      <div style={shell}>
        <BackButton to={backTo} />
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={24}>Not enough key terms yet</Display>
          <div className="t-14 muted">This week's terms don't cross each other enough for a crossword. Try Keywords instead.</div>
          <Link to={`${backTo}/keywords`} className="btn btn--amber btn--block">Play Keywords</Link>
        </Card>
      </div>
    );
  }

  const size = Math.max(22, Math.min(36, Math.floor(Math.min(window.innerWidth - 32, 600) / puzzle.cols)));
  const active = new Set(current ? cellsOf(current).map((x) => `${x.r},${x.c}`) : []);
  const score = Math.max(0, puzzle.entries.length * 20 + 50 - saved.reveals * 10);

  return (
    <div style={shell}>
      <BackButton to={backTo} />
      <Label>Crossword · {courseCode} Week {weekNum}</Label>
      <Display size={26}>{puzzle.entries.length} key terms</Display>

      <div role="grid" aria-label="Crossword grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${puzzle.cols}, ${size}px)`, gap: 2, justifyContent: 'center', marginTop: 12, userSelect: 'none' }}>
        {puzzle.cells.flatMap((row, r) => row.map((ch, c) => {
          const k = `${r},${c}`;
          if (!ch) return <span key={k} style={{ width: size, height: size }} />;
          const isSel = sel?.r === r && sel?.c === c;
          const v = saved.letters[k] || '';
          return (
            <button
              key={k}
              role="gridcell"
              aria-label={`Row ${r + 1}, column ${c + 1}${v ? `, ${v}` : ', empty'}`}
              onClick={() => pick(r, c)}
              style={{
                position: 'relative', width: size, height: size, padding: 0, borderRadius: 4,
                border: `1.5px solid ${isSel ? '#0a0a0a' : 'var(--border)'}`,
                background: wrong.includes(k) ? 'var(--u-bad-tint, #fee2e2)' : solved ? 'var(--u-good-tint)' : isSel ? '#fbbf24' : active.has(k) ? 'rgba(74,222,128,0.25)' : 'var(--surface)',
                fontFamily: 'var(--fd)', fontWeight: 900, fontSize: Math.round(size * 0.55), color: 'var(--text)',
              }}
            >
              {puzzle.nums[r][c] && <span style={{ position: 'absolute', top: 1, left: 2, fontSize: Math.max(8, Math.round(size * 0.28)), fontFamily: 'inherit', fontWeight: 700, lineHeight: 1 }}>{puzzle.nums[r][c]}</span>}
              {v}
            </button>
          );
        }))}
      </div>

      {solved ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8, marginTop: 14 }}>
          <BoxBoy pose="cheer" width={96} />
          <Display size={22}>Crossword done</Display>
          {saved.finishedSecs != null && <GameFinish game="crossword" course={courseCode} week={weekNum} score={score} terms={puzzle.entries.length} hints={saved.reveals} seconds={saved.finishedSecs} />}
          <Link to={backTo} className="btn btn--amber btn--block">Back to the notes</Link>
          <button className="btn btn--white btn--block" onClick={() => { setSaved({ letters: {}, reveals: 0, checks: 0, startedAt: Date.now() }); setSel(null); }}>Play again</button>
        </Card>
      ) : (
        <>
          <div style={{ minHeight: 64, marginTop: 12, background: '#0a0a0a', color: '#f5f4f0', borderRadius: 12, padding: '10px 12px' }}>
            {current ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#4ade80' }}>{current.num} {current.dir.toUpperCase()} {enumeration(current.display)}</div>
                <div style={{ fontSize: 14, marginTop: 2 }}>{current.clue}</div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: '#aaa' }}>Tap a square to start. Tap it again to switch between across and down.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <button className="btn btn--white btn--sm" onClick={check}>Check</button>
            <button className="btn btn--white btn--sm" disabled={!current} onClick={reveal}>Reveal a letter</button>
          </div>
          {wrong.length > 0 && <div className="t-13" style={{ textAlign: 'center', marginTop: 6, color: 'var(--u-red)' }}>{wrong.length} letter{wrong.length === 1 ? '' : 's'} not right yet</div>}
          <div aria-label="Keyboard" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {KEYS.map((row, i) => (
              <div key={row} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {row.split('').map((k) => (
                  <button key={k} onClick={() => type(k)} style={{ flex: '1 1 0', maxWidth: 40, height: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 15 }}>{k}</button>
                ))}
                {i === 2 && (
                  <button onClick={back} aria-label="Delete" style={{ flex: '1.5 1 0', maxWidth: 60, height: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Delete size={18} /></button>
                )}
              </div>
            ))}
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="t-13 w-7" style={{ cursor: 'pointer' }}>All clues</summary>
            {(['across', 'down'] as const).map((d) => (
              <div key={d} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text2)' }}>{d.toUpperCase()}</div>
                {puzzle.entries.filter((e) => e.dir === d).map((e) => (
                  <button key={`${d}${e.num}`} onClick={() => setSel({ r: e.row, c: e.col, dir: d })} style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', fontSize: 13, color: 'var(--text)' }}>
                    <b>{e.num}.</b> {e.clue} {enumeration(e.display)}
                  </button>
                ))}
              </div>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
