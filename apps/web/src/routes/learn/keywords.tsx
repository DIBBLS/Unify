import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { leaveTo } from '../../lib/navHistory';
import GameTimer, { TimeChoice, mmss, timeLimit, useGameClock } from '../../components/GameTimer';
import { useGameRoom } from '../../lib/gameRoom';
import { InviteButton, RoomBar } from '../../components/GameRoomBar';
import { Lightbulb, Shuffle } from 'lucide-react';
import { api } from '../../lib/api';
import { buildLevels, type Level } from '../../lib/wordgame';
import type { UnifyNote } from '../../types/note';
import BackButton from '../../components/BackButton';
import { GameSkeleton } from '../../components/Skeletons';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';
import GameFinish from '../../components/GameFinish';
import { useCheer } from '../../components/Cheer';

// Keywords: spell the week's key terms from a wheel of letters. Drag across
// the letters (or tap them one by one, then tap the centre) to make a word.
// The main word of each level is a term from the notes, with its clue; the
// other boxes are words the notes use that fit the same letters.
// reveal: hinted letters per word box, keyed `${level}:${word}`.
type Saved = { level: number; found: Record<number, string[]>; hints: Record<number, number>; bonus: number; reveal?: Record<string, number>; startedAt?: number; finishedSecs?: number; played?: number; timeUp?: boolean; limit?: number };
// Time allowed: 75 seconds a level (4 to 12 minutes in all).
const PER_LEVEL = 75;
const HINTS = 3;
// Points: each key term 50 (less 15 per hint, never under 10), each other word 10, each bonus word 5.
function scoreOf(levels: Level[], s: Saved): number {
  return levels.reduce((sum, l, i) => {
    const f = s.found[i] || [];
    const main = f.includes(l.term.word) ? Math.max(10, 50 - 15 * (s.hints[i] || 0)) : 0;
    return sum + main + 10 * f.filter((w) => w !== l.term.word).length;
  }, 0) + 5 * s.bonus;
}
const key = (c: string, w: number) => `unify:keywords:${c}:${w}`;

export default function KeywordsRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const navigate = useNavigate();
  // Play with a coursemate: ?room=CODE&mode=race|team (&host=1 for the one who made it).
  const [params] = useSearchParams();
  const roomCode = params.get('room');
  const room = useGameRoom('keywords', courseCode, weekNum, roomCode, params.get('mode') === 'team' ? 'team' : 'race', params.get('host') === '1');
  const skey = key(courseCode, weekNum) + (roomCode ? `:room:${roomCode}` : '');
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<Saved>(() => {
    try { return JSON.parse(localStorage.getItem(skey) || '') as Saved; } catch { return { level: 0, found: {}, hints: {}, bonus: 0 }; }
  });
  const [order, setOrder] = useState<number[]>([]);
  const [path, setPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ text: string; tone: 'good' | 'bad' | 'grey' } | null>(null);
  const [shake, setShake] = useState(0);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  // Tap mode: after a single tap, further taps add letters until Go.
  const tapMode = useRef(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  // Where the finger is (wheel %), so the line stretches after it while dragging.
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  // The last drawn line, fading out in the colour of the result.
  const [trail, setTrail] = useState<{ pts: { x: number; y: number }[]; tone: 'good' | 'bad' | 'grey'; id: number } | null>(null);
  // The word just found: its boxes flip in one letter after another.
  const [justFound, setJustFound] = useState<string | null>(null);
  // Cheers, and words found in a row without a miss (3+ is a streak).
  const [cheerNode, cheer] = useCheer();
  const streak = useRef(0);
  // The word box whose clue is showing (tap a box to pick it).
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!justFound) return;
    const t = window.setTimeout(() => setJustFound(null), 1200);
    return () => window.clearTimeout(t);
  }, [justFound]);

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const note = d.note_json as UnifyNote;
        setLevels(note && Array.isArray(note.topics) ? buildLevels(note) : []);
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);

  useEffect(() => {
    try { localStorage.setItem(skey, JSON.stringify(saved)); } catch { /* fine */ }
  }, [saved, skey]);

  // A session starts both players from the same blank board.
  useEffect(() => {
    if (room.startedAt) setSaved({ level: 0, found: {}, hints: {}, bonus: 0, startedAt: room.startedAt });
  }, [room.startedAt]);
  // Team up: words and level changes from the teammate land on this board too.
  useEffect(() => room.onEvent((e) => {
    if (room.mode !== 'team') return;
    if (e.t === 'found') setSaved((s) => ((s.found[e.level] || []).includes(e.word) ? s : { ...s, found: { ...s.found, [e.level]: [...(s.found[e.level] || []), e.word] } }));
    if (e.t === 'level') setSaved((s) => (e.level > s.level ? { ...s, level: e.level } : s));
  }), [room]);

  const li = Math.min(saved.level, Math.max((levels?.length || 1) - 1, 0));
  const lv = levels?.[li];
  const found = saved.found[li] || [];
  const hintsUsed = saved.hints[li] || 0;
  const done = !!lv && lv.slots.every((s) => found.includes(s));
  // Time the run: from the first open to the last word of the last level.
  useEffect(() => {
    if (levels?.length && !saved.startedAt) setSaved((s) => ({ ...s, startedAt: Date.now() }));
  }, [levels, saved.startedAt]);
  useEffect(() => {
    if (levels?.length && li === levels.length - 1 && done && saved.finishedSecs == null) {
      setSaved((s) => ({ ...s, finishedSecs: Math.max(1, s.played || 1) }));
    }
  }, [levels, li, done, saved.finishedSecs]);
  // The clock: counts while the game is on screen; at the limit the run ends
  // with whatever you've found.
  // The student picks how long to play before the clock starts; a session
  // with a coursemate uses the suggested time so both get the same.
  const suggested = timeLimit(levels?.length || 8, PER_LEVEL);
  const limit = saved.limit || (roomCode ? suggested : 0);
  const choosing = !limit && saved.finishedSecs == null;
  const tick = useCallback(() => setSaved((s) => {
    if (s.finishedSecs != null || !limit) return s;
    const played = (s.played || 0) + 1;
    return played >= limit ? { ...s, played, timeUp: true, finishedSecs: played } : { ...s, played };
  }), [limit]);
  useGameClock(!!levels?.length && !!limit && saved.finishedSecs == null && !(roomCode && !room.startedAt), tick);
  // In a session, tell the other player when you finish.
  const announced = useRef(false);
  useEffect(() => {
    if (saved.finishedSecs == null || !room.startedAt || !room.me || !levels || announced.current) return;
    announced.current = true;
    room.send({ t: 'finish', id: room.me.id, name: room.me.name, score: scoreOf(levels, saved), seconds: saved.finishedSecs });
  }, [saved, room, levels]);
  useEffect(() => { announced.current = false; }, [room.startedAt]);

  useEffect(() => {
    if (lv) setOrder(lv.letters.map((_, i) => i));
    setPath([]);
    setFocus(null);
  }, [li, lv]);

  // Shuffle: the letters glide straight to their new places (CSS transition
  // on left/top). The new order always differs from the old one.
  const shuffleLetters = () => {
    if (!lv) return;
    const n = lv.letters.length;
    let next = [...order];
    for (let tries = 0; tries < 6 && next.join() === order.join(); tries++) {
      next = [...order];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    }
    setPath([]);
    tapMode.current = false;
    setOrder(next);
  };

  const word = path.map((i) => lv?.letters[i] || '').join('');
  const say = (text: string, tone: 'good' | 'bad' | 'grey') => {
    setFlash({ text, tone });
    window.setTimeout(() => setFlash((f) => (f?.text === text ? null : f)), 1600);
  };

  // The wheel, in percent of its own size so it scales with the screen.
  const R = 35.6;
  const pos = (slot: number, n: number) => {
    const a = (slot / n) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  };
  const slotOf = (letterIdx: number) => order.indexOf(letterIdx);

  const submit = (w: string) => {
    // The line you drew lingers for a moment in the colour of the result.
    const drawn = lv ? path.map((i) => pos(slotOf(i), lv.letters.length)) : [];
    const out = (text: string, tone: 'good' | 'bad' | 'grey') => {
      if (drawn.length > 1) { const id = Date.now(); setTrail({ pts: drawn, tone, id }); window.setTimeout(() => setTrail((t) => (t?.id === id ? null : t)), 560); }
      say(text, tone);
    };
    setPath([]);
    setPtr(null);
    tapMode.current = false;
    if (!lv || w.length < 3) return;
    if (found.includes(w)) return out('Already found', 'grey');
    if (lv.slots.includes(w)) {
      setSaved((s) => ({ ...s, found: { ...s.found, [li]: [...(s.found[li] || []), w] } }));
      setJustFound(w);
      // The biggest moment wins: game done, level cleared, key term, streak, word.
      streak.current += 1;
      const now = [...found, w];
      const cleared = lv.slots.every((x) => now.includes(x));
      if (cleared && levels && li === levels.length - 1) cheer('done', { sub: 'Every key term cracked' });
      else if (cleared) cheer('level', { sub: `Level ${li + 1} of ${levels?.length || 1}` });
      else if (w === lv.term.word) cheer('key', { sub: lv.term.display });
      else if (streak.current >= 3) cheer('streak', { text: `${streak.current} in a row!` });
      else cheer('word');
      if (room.mode === 'team' && room.startedAt && room.me) room.send({ t: 'found', id: room.me.id, level: li, word: w });
      return out(w === lv.term.word ? `${lv.term.display}!` : 'Nice one', 'good');
    }
    if (lv.bonus.includes(w)) {
      setSaved((s) => ({ ...s, bonus: s.bonus + 1 }));
      streak.current += 1;
      cheer('bonus', { sub: '+5' });
      return out('Bonus word', 'good');
    }
    setShake((n) => n + 1);
    streak.current = 0;
    out('Not in this week’s notes', 'bad');
  };

  // On a laptop: type the letters, Enter to try the word, Backspace to undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lv || done || saved.timeUp || choosing || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (/^[a-z]$/i.test(e.key)) {
        const ch = e.key.toUpperCase();
        const i = lv.letters.findIndex((c, idx) => c === ch && !path.includes(idx));
        if (i >= 0) { tapMode.current = true; setPath([...path, i]); }
        e.preventDefault();
      } else if (e.key === 'Backspace') { setPath(path.slice(0, -1)); e.preventDefault(); }
      else if (e.key === 'Enter') { if (path.length >= 3) submit(word); e.preventDefault(); }
      else if (e.key === 'Escape') { setPath([]); tapMode.current = false; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toWheel = (x: number, y: number) => {
    const b = wheelRef.current?.getBoundingClientRect();
    return b ? { x: ((x - b.left) / b.width) * 100, y: ((y - b.top) / b.height) * 100 } : null;
  };
  const letterAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const v = el?.closest('[data-letter]')?.getAttribute('data-letter');
    return v == null ? null : Number(v);
  };
  const onDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    setPtr(toWheel(e.clientX, e.clientY));
    // Tap mode keeps building the word; otherwise a press starts a new one.
    setPath((p) => (tapMode.current && p.length ? (p.includes(i) ? p : [...p, i]) : [i]));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPtr(toWheel(e.clientX, e.clientY));
    const i = letterAt(e.clientX, e.clientY);
    if (i == null) return;
    setPath((p) => {
      if (p[p.length - 2] === i) return p.slice(0, -1); // slide back to undo the last letter
      return p.includes(i) ? p : [...p, i];
    });
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    setPtr(null);
    // A drag across 3+ letters submits; a tap (1 letter) switches to tap mode.
    if (path.length >= 3 && !tapMode.current) submit(word);
    else tapMode.current = true;
  };

  // The word being worked on: the box you tapped, else the first one not found yet.
  const target = lv ? (focus && !found.includes(focus) ? focus : lv.slots.find((s) => !found.includes(s))) : undefined;
  const hint = () => {
    if (!lv || hintsUsed >= HINTS || !target) return;
    const k = `${li}:${target}`;
    const shown = Math.min(target.length, (saved.reveal?.[k] || 0) + 1);
    setSaved((s) => ({ ...s, hints: { ...s.hints, [li]: (s.hints[li] || 0) + 1 }, reveal: { ...s.reveal, [k]: shown } }));
    say(`Starts with ${target.slice(0, shown)}…`, 'grey');
  };

  // Leaving a game always lands on Practice, opened on this course.
  const back = `/games?course=${encodeURIComponent(courseCode)}`;

  if (err) return <div className="g-shell"><BackButton to={back} fixed /><div className="t-14" style={{ color: 'var(--u-red)' }}>{err}</div></div>;
  if (!levels) return <GameSkeleton />;
  if (!levels.length || !lv) {
    return (
      <div className="g-shell" style={{ maxWidth: 480 }}>
        <BackButton to={back} fixed />
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={24}>Not enough key terms yet</Display>
          <div className="t-14 muted">This week's notes don't have enough single-word terms to build a game. Try another week.</div>
          <button className="btn btn--amber btn--block" onClick={() => leaveTo(navigate, back)}>Back to practice</button>
        </Card>
      </div>
    );
  }

  const allDone = li === levels.length - 1 && done;
  const score = scoreOf(levels, saved);

  const termsSolved = levels.filter((l, i) => (saved.found[i] || []).includes(l.term.word)).length;
  const hintsTotal = Object.values(saved.hints).reduce((s, n) => s + n, 0);
  const pts = path.map((i) => pos(slotOf(i), lv.letters.length));
  const last = pts[pts.length - 1];
  // Overall progress: every word box across every level.
  const totalSlots = levels.reduce((n, l) => n + l.slots.length, 0);
  const foundSlots = levels.reduce((n, l, i) => n + (saved.found[i] || []).filter((w) => l.slots.includes(w)).length, 0);
  const longest = Math.max(...lv.slots.map((s) => s.length));
  const clue = target ? lv.clues?.[target] || (target === lv.term.word ? lv.term.clue : '') : lv.term.clue;

  return (
    <div className="g-shell">
      {cheerNode}
      <BackButton to={back} fixed />
      <Label>Keywords · {courseCode} Week {weekNum}</Label>
      {roomCode && (
        <RoomBar
          room={room}
          game="keywords"
          course={courseCode}
          week={weekNum}
          mine={{ done: levels.reduce((n, _l, i) => n + (saved.found[i] || []).length, 0), total: totalSlots, label: `L${li + 1}/${levels.length}` }}
        />
      )}
      {roomCode && !room.startedAt ? null : (<>
      <div className="g-head">
        <span className="g-head-title">Level {li + 1}<span style={{ color: 'var(--u-text-3)' }}>/{levels.length}</span></span>
        <div className="g-bar" role="progressbar" aria-valuemin={0} aria-valuemax={totalSlots} aria-valuenow={foundSlots} aria-label="Words found">
          <i style={{ width: `${(foundSlots / Math.max(1, totalSlots)) * 100}%` }} />
        </div>
        {saved.bonus > 0 && <span className="g-count">+{saved.bonus} bonus</span>}
      </div>
      {saved.finishedSecs == null && !choosing && <GameTimer played={saved.played || 0} limit={limit} />}
      {choosing ? (
        <div style={{ marginTop: 16 }}><TimeChoice suggested={suggested} what={`${levels.length} level${levels.length === 1 ? '' : 's'} of this week's key terms.`} onPick={(secs) => setSaved((s) => ({ ...s, limit: secs, played: 0 }))} /></div>
      ) : (

      <div className="g-layout">
        <div className="g-main">
          <div className="g-clue g-in" key={`clue${li}:${target || ''}`}>
            <div className="g-clue-tag">{!target || target === lv.term.word ? 'Clue for the key term' : `Clue for a ${target.length}-letter word`}</div>
            <div className="g-clue-text">{clue || `A ${target?.length}-letter word from this week's notes.`}</div>
          </div>

          {/* Word boxes: the key term first, on its own row, then the others. */}
          <div className="g-slots" style={{ '--n': longest } as React.CSSProperties}>
            {lv.slots.map((s, si) => {
              const got = found.includes(s) || done;
              const main = si === 0;
              const fresh = justFound === s;
              const shown = got ? s.length : saved.reveal?.[`${li}:${s}`] || 0;
              const on = !done && s === target;
              return (
                <div
                  key={s}
                  className={`g-slot${main ? ' g-slot--main' : ''}${on ? ' g-slot--on' : ''}${got ? '' : ' g-slot--pick'}`}
                  aria-label={got ? s : `${s.length} letters${main ? ', key term' : ''}${on ? ', clue showing' : ''}`}
                  role={got ? undefined : 'button'}
                  tabIndex={got ? undefined : 0}
                  onClick={got ? undefined : () => setFocus(s)}
                  onKeyDown={got ? undefined : (e) => { if (e.key === ' ') { e.preventDefault(); setFocus(s); } }}
                >
                  {s.split('').map((c, ci) => (
                    <span
                      key={ci}
                      className={`g-tile${main ? ' g-tile--main' : ''}${got ? ' g-tile--got' : ci < shown ? ' g-tile--hint' : ''}${fresh ? ' g-tile--flip' : ''}`}
                      style={{ '--i': ci } as React.CSSProperties}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="g-side">
          {saved.timeUp ? (
            <Card className="g-win" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
              <BoxBoy pose="thumbsUp" width={96} />
              <Display size={22}>Time's up</Display>
              <div className="t-14 muted">You played {mmss(saved.finishedSecs || limit)} and cracked {termsSolved} of {levels.length} key terms. Take a break, or go again to beat your score.</div>
              {saved.finishedSecs != null && <GameFinish game="keywords" course={courseCode} week={weekNum} score={score} terms={termsSolved} hints={hintsTotal} seconds={saved.finishedSecs} />}
              <button className="btn btn--amber btn--block" onClick={() => leaveTo(navigate, back)}>Back to practice</button>
              <button className="btn btn--white btn--block" onClick={() => setSaved({ level: 0, found: {}, hints: {}, bonus: 0, startedAt: Date.now() })}>Play again</button>
            </Card>
          ) : done ? (
            <Card className="g-win" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
              <BoxBoy pose={allDone ? 'cheer' : 'thumbsUp'} width={96} />
              <Display size={22}>{lv.term.display}</Display>
              <div className="t-14 muted">{lv.term.clue.replace(/_____/g, lv.term.display)}</div>
              {allDone ? (
                <>
                  <div className="t-15 w-7">You've cracked every key term this week.</div>
                  {saved.finishedSecs != null && <GameFinish game="keywords" course={courseCode} week={weekNum} score={score} terms={termsSolved} hints={hintsTotal} seconds={saved.finishedSecs} />}
                  <button className="btn btn--amber btn--block" onClick={() => leaveTo(navigate, back)}>Back to practice</button>
                  <button className="btn btn--white btn--block" onClick={() => setSaved({ level: 0, found: {}, hints: {}, bonus: 0, startedAt: Date.now() })}>Play again</button>
                </>
              ) : (
                <button className="btn btn--amber btn--block" onClick={() => { setSaved((s) => ({ ...s, level: li + 1 })); if (room.mode === 'team' && room.startedAt) room.send({ t: 'level', level: li + 1 }); }}>Next level</button>
              )}
            </Card>
          ) : (
            <>
              {/* What you're spelling, or how the last try went. */}
              <div className="g-status" aria-live="polite">
                {flash ? (
                  <span key={flash.text + flash.tone} className={`g-toast g-toast--${flash.tone}`}>{flash.text}</span>
                ) : (
                  <span key={shake} className={`g-slot${shake ? ' g-shake' : ''}`} style={{ gap: 4 }}>
                    {word.split('').map((c, i) => <span key={i} className="g-tile kw-chip">{c}</span>)}
                  </span>
                )}
              </div>

              <div
                ref={wheelRef}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                onPointerCancel={onUp}
                className={`kw-wheel no-select${shake ? ' g-shake' : ''}`}
                key={shake}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  {trail && <polyline className={`kw-trail kw-trail--${trail.tone}`} points={trail.pts.map((p) => `${p.x},${p.y}`).join(' ')} />}
                  {pts.slice(1).map((p, i) => (
                    <line key={`${path[i]}-${path[i + 1]}`} className="kw-seg" pathLength={1} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} />
                  ))}
                  {isDragging && last && ptr && <line className="kw-band" x1={last.x} y1={last.y} x2={ptr.x} y2={ptr.y} />}
                </svg>
                {lv.letters.map((c, i) => {
                  const p = pos(slotOf(i), lv.letters.length);
                  const on = path.includes(i);
                  return (
                    <button
                      key={i}
                      data-letter={i}
                      onPointerDown={(e) => onDown(e, i)}
                      aria-label={`Letter ${c}`}
                      aria-pressed={on}
                      className={`kw-letter${on ? ' on' : ''}`}
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    >
                      {c}
                    </button>
                  );
                })}
                {/* Centre: submit a tapped word, or clear it. */}
                {path.length > 0 && !isDragging && tapMode.current && (
                  <button className="kw-go" onClick={() => (path.length >= 3 ? submit(word) : (setPath([]), (tapMode.current = false)))}>
                    {path.length >= 3 ? 'Go' : 'Clear'}
                  </button>
                )}
              </div>
              <div className="g-tools" style={{ marginTop: 6 }}>
                <button className="btn btn--white btn--sm" onClick={shuffleLetters}>
                  <Shuffle size={15} /> Shuffle
                </button>
                <button className="btn btn--white btn--sm" disabled={hintsUsed >= HINTS} onClick={hint}>
                  <Lightbulb size={15} /> Hint ({HINTS - hintsUsed} left)
                </button>
              </div>
              <div className="g-tip">Drag across the letters to spell a word, or tap them one by one and press Go. On a keyboard, type the word and press Enter.</div>
              {!roomCode && <InviteButton game="keywords" course={courseCode} week={weekNum} />}
            </>
          )}
        </div>
      </div>
      )}
      </>)}
    </div>
  );
}
