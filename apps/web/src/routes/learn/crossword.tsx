import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { leaveTo } from '../../lib/navHistory';
import GameTimer, { TimeChoice, mmss, timeLimit, useGameClock } from '../../components/GameTimer';
import { useGameRoom } from '../../lib/gameRoom';
import { InviteButton, RoomBar } from '../../components/GameRoomBar';
import { Delete } from 'lucide-react';
import { api } from '../../lib/api';
import { buildCrossword, type Entry, type Puzzle } from '../../lib/crossword';
import type { UnifyNote } from '../../types/note';
import BackButton from '../../components/BackButton';
import { GameSkeleton } from '../../components/Skeletons';
import GameFinish from '../../components/GameFinish';
import { useCheer } from '../../components/Cheer';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';

// Crossword: the week's key terms crossing where they share a letter, with
// clues from the notes. Tap a square to choose it, tap again to switch
// between across and down, and type on the keyboard below the grid.
type Saved = { letters: Record<string, string>; reveals: number; checks: number; startedAt: number; finishedSecs?: number; played?: number; timeUp?: boolean; limit?: number };
// Time allowed: 50 seconds a word (4 to 12 minutes in all).
const PER_WORD = 50;
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const store = (c: string, w: number) => `unify:crossword:${c}:${w}`;
const enumeration = (display: string) => `(${display.split(/[\s-]+/).map((p) => p.replace(/[^A-Za-z]/g, '').length).join(', ')})`;

export default function CrosswordRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roomCode = params.get('room');
  const room = useGameRoom('crossword', courseCode, weekNum, roomCode, params.get('mode') === 'team' ? 'team' : 'race', params.get('host') === '1');
  const skey = store(courseCode, weekNum) + (roomCode ? `:room:${roomCode}` : '');
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<Saved>(() => {
    try { return JSON.parse(localStorage.getItem(skey) || '') as Saved; } catch { return { letters: {}, reveals: 0, checks: 0, startedAt: Date.now() }; }
  });
  const [sel, setSel] = useState<{ r: number; c: number; dir: 'across' | 'down' } | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [cheerNode, cheer] = useCheer();
  // On a laptop the clue list sits open beside the grid.
  const [wide] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches);

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const note = d.note_json as UnifyNote;
        setPuzzle(note && Array.isArray(note.topics) ? buildCrossword(note) : null);
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);
  useEffect(() => {
    try { localStorage.setItem(skey, JSON.stringify(saved)); } catch { /* fine */ }
  }, [saved, skey]);
  // A session starts both players from the same empty grid.
  useEffect(() => {
    if (room.startedAt) { setSaved({ letters: {}, reveals: 0, checks: 0, startedAt: room.startedAt }); setSel(null); }
  }, [room.startedAt]);
  // Team up: letters from the teammate land on this grid too.
  useEffect(() => room.onEvent((e) => {
    if (room.mode !== 'team' || e.t !== 'cell') return;
    setSaved((s) => { const l = { ...s.letters }; if (e.v) l[e.k] = e.v; else delete l[e.k]; return { ...s, letters: l }; });
  }), [room]);
  const share = (k: string, v: string) => { if (room.mode === 'team' && room.startedAt && room.me) room.send({ t: 'cell', id: room.me.id, k, v }); };

  const entryAt = (r: number, c: number, dir: 'across' | 'down'): Entry | undefined =>
    puzzle?.entries.find((e) => e.dir === dir && (dir === 'across' ? e.row === r && c >= e.col && c < e.col + e.word.length : e.col === c && r >= e.row && r < e.row + e.word.length));
  const current = sel ? entryAt(sel.r, sel.c, sel.dir) || entryAt(sel.r, sel.c, sel.dir === 'across' ? 'down' : 'across') : undefined;
  const cellsOf = (e: Entry) => Array.from({ length: e.word.length }, (_, i) => (e.dir === 'across' ? { r: e.row, c: e.col + i } : { r: e.row + i, c: e.col }));
  const solved = useMemo(() => !!puzzle && puzzle.cells.every((row, r) => row.every((ch, c) => !ch || saved.letters[`${r},${c}`] === ch)), [puzzle, saved.letters]);

  // In a session, tell the other player when you finish.
  const announced = useRef(false);
  useEffect(() => {
    if (saved.finishedSecs == null || !room.startedAt || !room.me || !puzzle || announced.current) return;
    announced.current = true;
    const got = puzzle.entries.filter((e) => Array.from({ length: e.word.length }, (_, i) => (e.dir === 'across' ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`)).every((k, i) => saved.letters[k] === e.word[i])).length;
    const final = saved.timeUp ? got * 20 - saved.reveals * 10 : puzzle.entries.length * 20 + 50 - saved.reveals * 10;
    room.send({ t: 'finish', id: room.me.id, name: room.me.name, score: Math.max(0, final), seconds: saved.finishedSecs });
  }, [saved, room, puzzle]);
  useEffect(() => { announced.current = false; }, [room.startedAt]);
  useEffect(() => {
    if (solved && saved.finishedSecs == null) setSaved((s) => ({ ...s, finishedSecs: Math.max(1, s.played || 1) }));
  }, [solved, saved.finishedSecs]);
  // The clock: counts while the game is on screen; at the limit the grid locks.
  // The student picks how long to play before the clock starts; a session
  // with a coursemate uses the suggested time so both get the same.
  const suggested = timeLimit(puzzle?.entries.length || 8, PER_WORD);
  const limit = saved.limit || (roomCode ? suggested : 0);
  const choosing = !limit && saved.finishedSecs == null;
  const tick = useCallback(() => setSaved((s) => {
    if (s.finishedSecs != null || !limit) return s;
    const played = (s.played || 0) + 1;
    return played >= limit ? { ...s, played, timeUp: true, finishedSecs: played } : { ...s, played };
  }), [limit]);
  useGameClock(!!puzzle && !!limit && saved.finishedSecs == null && !(roomCode && !room.startedAt), tick);

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
    if (!sel || solved || saved.timeUp || choosing) return;
    setWrong([]);
    const k = `${sel.r},${sel.c}`;
    if (puzzle) celebrate(saved.letters, { ...saved.letters, [k]: ch }, k);
    setSaved((s) => ({ ...s, letters: { ...s.letters, [k]: ch } }));
    share(`${sel.r},${sel.c}`, ch);
    step(1);
  };
  // Cheer when this letter finishes a word right, crosses the halfway mark,
  // or completes the grid (the biggest moment wins).
  const celebrate = (before: Record<string, string>, after: Record<string, string>, k: string) => {
    if (!puzzle) return;
    const cells = puzzle.cells.flatMap((row, r) => row.map((c, cc) => (c ? { k: `${r},${cc}`, c } : null))).filter(Boolean) as { k: string; c: string }[];
    const right = (l: Record<string, string>) => cells.filter((x) => l[x.k] === x.c).length;
    const ok = (e: Entry, l: Record<string, string>) => cellsOf(e).every((x) => l[`${x.r},${x.c}`] === puzzle.cells[x.r][x.c]);
    const r0 = right(before);
    const r1 = right(after);
    if (r1 === cells.length) { cheer('done', { sub: 'Crossword complete' }); return; }
    const finished = puzzle.entries.filter((e) => cellsOf(e).some((x) => `${x.r},${x.c}` === k) && ok(e, after) && !ok(e, before));
    if (finished.length) {
      const doneCount = puzzle.entries.filter((e) => ok(e, after)).length;
      cheer(doneCount >= 3 && doneCount % 3 === 0 ? 'streak' : 'word', { sub: finished.map((e) => e.display).join(' + ') });
      return;
    }
    if (r0 < cells.length / 2 && r1 >= cells.length / 2) cheer('half');
  };
  const back = () => {
    if (!sel || solved || saved.timeUp || choosing) return;
    const k = `${sel.r},${sel.c}`;
    if (saved.letters[k]) { setSaved((s) => { const l = { ...s.letters }; delete l[k]; return { ...s, letters: l }; }); share(k, ''); }
    else step(-1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || choosing) return;
      if (/^[a-z]$/i.test(e.key)) { type(e.key.toUpperCase()); e.preventDefault(); }
      else if (e.key === 'Backspace') { back(); e.preventDefault(); }
      else if (e.key === ' ' && sel) { pick(sel.r, sel.c); e.preventDefault(); }
      else if (e.key.startsWith('Arrow') && puzzle) {
        // Move to the next letter square that way, and follow that direction.
        const [dr, dc] = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[e.key] || [0, 0];
        const dir = dr ? 'down' : 'across';
        let r = sel ? sel.r : 0;
        let c = sel ? sel.c : -1;
        for (;;) {
          r += dr; c += dc;
          if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) break;
          if (puzzle.cells[r][c]) { setWrong([]); setSel({ r, c, dir: entryAt(r, c, dir) ? dir : dir === 'across' ? 'down' : 'across' }); break; }
        }
        e.preventDefault();
      }
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
    share(`${target.r},${target.c}`, puzzle.cells[target.r][target.c] as string);
  };

  // Leaving a game always lands on Practice, opened on this course.
  const backTo = `/games?course=${encodeURIComponent(courseCode)}`;
  const weekPath = `/learn/${encodeURIComponent(courseCode)}/week/${weekNum}`;
  if (err) return <div className="g-shell"><BackButton to={backTo} fixed /><div className="t-14" style={{ color: 'var(--u-red)' }}>{err}</div></div>;
  if (puzzle === undefined) return <GameSkeleton grid />;
  if (!puzzle) {
    return (
      <div className="g-shell" style={{ maxWidth: 480 }}>
        <BackButton to={backTo} fixed />
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={24}>Not enough key terms yet</Display>
          <div className="t-14 muted">This week's terms don't cross each other enough for a crossword. Try Keywords instead.</div>
          <Link replace to={`${weekPath}/keywords`} className="btn btn--amber btn--block">Play Keywords</Link>
        </Card>
      </div>
    );
  }

  const active = new Set(current ? cellsOf(current).map((x) => `${x.r},${x.c}`) : []);
  const score = Math.max(0, puzzle.entries.length * 20 + 50 - saved.reveals * 10);
  const all = puzzle.cells.flatMap((row, r) => row.map((ch, c) => (ch ? `${r},${c}` : ''))).filter(Boolean);
  const right = all.filter((k) => { const [r, c] = k.split(',').map(Number); return saved.letters[k] === puzzle.cells[r][c]; }).length;
  const filled = all.filter((k) => saved.letters[k]).length;
  const entryDone = (e: Entry) => cellsOf(e).every((x) => saved.letters[`${x.r},${x.c}`] === puzzle.cells[x.r][x.c]);

  return (
    <div className="g-shell">
      {cheerNode}
      <BackButton to={backTo} fixed />
      <Label>Crossword · {courseCode} Week {weekNum}</Label>
      {roomCode && <RoomBar room={room} game="crossword" course={courseCode} week={weekNum} mine={{ done: right, total: all.length, label: `${Math.round((right / Math.max(1, all.length)) * 100)}%` }} />}
      {roomCode && !room.startedAt ? null : (<>
      <div className="g-head">
        <span className="g-head-title">{puzzle.entries.length} key terms</span>
        <div className="g-bar" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={filled} aria-label="Squares filled">
          <i style={{ width: `${(filled / Math.max(1, all.length)) * 100}%` }} />
        </div>
      </div>
      {saved.finishedSecs == null && !choosing && <GameTimer played={saved.played || 0} limit={limit} />}
      {choosing ? (
        <div style={{ marginTop: 16 }}><TimeChoice suggested={suggested} what={`${puzzle.entries.length} key terms to cross.`} onPick={(secs) => setSaved((s) => ({ ...s, limit: secs, played: 0 }))} /></div>
      ) : (

      <div className="g-layout">
        <div className="g-main">
          <div className="cw-wrap">
            <div role="grid" aria-label="Crossword grid" className="cw-grid" style={{ '--cols': puzzle.cols, '--rows': puzzle.rows } as React.CSSProperties}>
              {puzzle.cells.flatMap((row, r) => row.map((ch, c) => {
                const k = `${r},${c}`;
                if (!ch) return <span key={k} className="cw-gap" />;
                const isSel = sel?.r === r && sel?.c === c;
                const v = saved.letters[k] || '';
                const cls = solved ? 'won' : wrong.includes(k) ? 'bad' : isSel ? 'sel' : active.has(k) ? 'act' : '';
                return (
                  <button
                    key={k}
                    role="gridcell"
                    aria-label={`Row ${r + 1}, column ${c + 1}${v ? `, ${v}` : ', empty'}`}
                    onClick={() => pick(r, c)}
                    className={`cw-cell ${cls}`}
                    style={{ '--d': r + c } as React.CSSProperties}
                  >
                    {puzzle.nums[r][c] && <span className="cw-num">{puzzle.nums[r][c]}</span>}
                    {v && <span key={v} className="cw-ch">{v}</span>}
                  </button>
                );
              }))}
            </div>
          </div>
        </div>

        <div className="g-side">
          {saved.timeUp && !solved ? (() => {
            // Out of time: score the words you got fully right.
            const got = puzzle.entries.filter(entryDone).length;
            const partial = Math.max(0, got * 20 - saved.reveals * 10);
            return (
              <Card className="g-win" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
                <BoxBoy pose="thumbsUp" width={96} />
                <Display size={22}>Time's up</Display>
                <div className="t-14 muted">You played {mmss(saved.finishedSecs || limit)} and got {got} of {puzzle.entries.length} words. Take a break, or go again to finish the grid.</div>
                {saved.finishedSecs != null && <GameFinish game="crossword" course={courseCode} week={weekNum} score={partial} terms={got} hints={saved.reveals} seconds={saved.finishedSecs} />}
                <button className="btn btn--amber btn--block" onClick={() => leaveTo(navigate, backTo)}>Back to practice</button>
                <button className="btn btn--white btn--block" onClick={() => { setSaved({ letters: {}, reveals: 0, checks: 0, startedAt: Date.now() }); setSel(null); setWrong([]); }}>Play again</button>
              </Card>
            );
          })() : solved ? (
            <Card className="g-win" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
              <BoxBoy pose="cheer" width={96} />
              <Display size={22}>Crossword done</Display>
              {saved.finishedSecs != null && <GameFinish game="crossword" course={courseCode} week={weekNum} score={score} terms={puzzle.entries.length} hints={saved.reveals} seconds={saved.finishedSecs} />}
              <button className="btn btn--amber btn--block" onClick={() => leaveTo(navigate, backTo)}>Back to practice</button>
              <button className="btn btn--white btn--block" onClick={() => { setSaved({ letters: {}, reveals: 0, checks: 0, startedAt: Date.now() }); setSel(null); }}>Play again</button>
            </Card>
          ) : (
            <>
              <div className="g-clue g-clue--dark">
                {current ? (
                  <div className="g-in" key={`${current.num}${current.dir}`}>
                    <div className="g-clue-tag">{current.num} {current.dir} {enumeration(current.display)}</div>
                    <div className="g-clue-text">{current.clue}</div>
                  </div>
                ) : (
                  <div className="g-clue-text" style={{ color: '#aaa', marginTop: 0 }}>Tap a square to start. Tap it again to switch between across and down.</div>
                )}
              </div>
              <div className="g-tools">
                <button className="btn btn--white btn--sm" onClick={check}>Check</button>
                <button className="btn btn--white btn--sm" disabled={!current} onClick={reveal}>Reveal a letter</button>
              </div>
              {wrong.length > 0 && <div className="t-13 g-in" style={{ textAlign: 'center', color: 'var(--u-red)', fontWeight: 700 }}>{wrong.length} letter{wrong.length === 1 ? '' : 's'} not right yet</div>}
              <div className="g-kbd" aria-label="Keyboard">
                {KEYS.map((row, i) => (
                  <div key={row} className="g-kbd-row">
                    {row.split('').map((k) => <button key={k} className="g-key" onClick={() => type(k)}>{k}</button>)}
                    {i === 2 && <button className="g-key g-key--wide" onClick={back} aria-label="Delete"><Delete size={18} /></button>}
                  </div>
                ))}
              </div>
              <div className="g-tip g-kbd-tip">Type on your keyboard. Arrow keys move, Backspace deletes, Space switches across and down.</div>
              <details className="cw-clues" open={wide}>
                <summary>All clues</summary>
                {(['across', 'down'] as const).map((d) => (
                  <div key={d} style={{ marginTop: 8 }}>
                    <div className="g-clue-tag" style={{ color: 'var(--u-text-3)', marginBottom: 2 }}>{d}</div>
                    {puzzle.entries.filter((e) => e.dir === d).map((e) => (
                      <button
                        key={`${d}${e.num}`}
                        className={`cw-cl${current === e ? ' on' : ''}${entryDone(e) ? ' done' : ''}`}
                        onClick={() => setSel({ r: e.row, c: e.col, dir: d })}
                      >
                        <b>{e.num}.</b><span>{e.clue} {enumeration(e.display)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </details>
              {!roomCode && <InviteButton game="crossword" course={courseCode} week={weekNum} />}
            </>
          )}
        </div>
      </div>
      )}
      </>)}
    </div>
  );
}
