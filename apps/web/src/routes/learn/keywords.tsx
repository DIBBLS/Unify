import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useGameRoom } from '../../lib/gameRoom';
import { InviteButton, RoomBar } from '../../components/GameRoomBar';
import { Lightbulb, Shuffle } from 'lucide-react';
import { api } from '../../lib/api';
import { buildLevels, type Level } from '../../lib/wordgame';
import type { UnifyNote } from '../../types/note';
import BackButton from '../../components/BackButton';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';
import GameFinish from '../../components/GameFinish';

// Keywords: spell the week's key terms from a wheel of letters. Drag across
// the letters (or tap them one by one, then tap the centre) to make a word.
// The main word of each level is a term from the notes, with its clue; the
// other boxes are words the notes use that fit the same letters.
type Saved = { level: number; found: Record<number, string[]>; hints: Record<number, number>; bonus: number; startedAt?: number; finishedSecs?: number };
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
      setSaved((s) => ({ ...s, finishedSecs: Math.max(1, Math.round((Date.now() - (s.startedAt || Date.now())) / 1000)) }));
    }
  }, [levels, li, done, saved.finishedSecs]);
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
  }, [li, lv]);

  const word = path.map((i) => lv?.letters[i] || '').join('');
  const say = (text: string, tone: 'good' | 'bad' | 'grey') => {
    setFlash({ text, tone });
    window.setTimeout(() => setFlash((f) => (f?.text === text ? null : f)), 1600);
  };

  const submit = (w: string) => {
    setPath([]);
    tapMode.current = false;
    if (!lv || w.length < 3) return;
    if (found.includes(w)) return say('Already found', 'grey');
    if (lv.slots.includes(w)) {
      setSaved((s) => ({ ...s, found: { ...s.found, [li]: [...(s.found[li] || []), w] } }));
      if (room.mode === 'team' && room.startedAt && room.me) room.send({ t: 'found', id: room.me.id, level: li, word: w });
      return say(w === lv.term.word ? `${lv.term.display}!` : 'Nice one', 'good');
    }
    if (lv.bonus.includes(w)) {
      setSaved((s) => ({ ...s, bonus: s.bonus + 1 }));
      return say('Bonus word', 'good');
    }
    setShake((n) => n + 1);
    say('Not in this week’s notes', 'bad');
  };

  // The wheel: letters on a circle; positions follow the shuffled order.
  const size = 236;
  const r = 84;
  const pos = (slot: number, n: number) => {
    const a = (slot / n) * Math.PI * 2 - Math.PI / 2;
    return { x: size / 2 + r * Math.cos(a), y: size / 2 + r * Math.sin(a) };
  };
  const slotOf = (letterIdx: number) => order.indexOf(letterIdx);

  const letterAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const v = el?.closest('[data-letter]')?.getAttribute('data-letter');
    return v == null ? null : Number(v);
  };
  const onDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    // Tap mode keeps building the word; otherwise a press starts a new one.
    setPath((p) => (tapMode.current && p.length ? (p.includes(i) ? p : [...p, i]) : [i]));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
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
    // A drag across 3+ letters submits; a tap (1 letter) switches to tap mode.
    if (path.length >= 3 && !tapMode.current) submit(word);
    else tapMode.current = true;
  };

  const hint = () => {
    if (!lv || hintsUsed >= HINTS) return;
    const target = lv.slots.find((s) => !found.includes(s));
    if (!target) return;
    setSaved((s) => ({ ...s, hints: { ...s.hints, [li]: (s.hints[li] || 0) + 1 } }));
    say(`Starts with ${target.slice(0, hintsUsed + 1)}…`, 'grey');
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const back = `/learn/${encodeURIComponent(courseCode)}/week/${weekNum}`;

  if (err) return <div style={shell}><BackButton to={back} /><div className="t-14" style={{ color: 'var(--u-red)' }}>{err}</div></div>;
  if (!levels) return <div style={shell}><BackButton to={back} /><div className="t-13 muted">Loading the week…</div></div>;
  if (!levels.length || !lv) {
    return (
      <div style={shell}>
        <BackButton to={back} />
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={24}>Not enough key terms yet</Display>
          <div className="t-14 muted">This week's notes don't have enough single-word terms to build a game. Try another week.</div>
          <Link to={back} className="btn btn--amber btn--block">Back to the notes</Link>
        </Card>
      </div>
    );
  }

  const allDone = li === levels.length - 1 && done;
  const score = scoreOf(levels, saved);

  const termsSolved = levels.filter((l, i) => (saved.found[i] || []).includes(l.term.word)).length;
  const hintsTotal = Object.values(saved.hints).reduce((s, n) => s + n, 0);
  const pts = path.map((i) => pos(slotOf(i), lv.letters.length));

  return (
    <div style={shell}>
      <BackButton to={back} />
      <Label>Keywords · {courseCode} Week {weekNum}</Label>
      {roomCode && (
        <RoomBar
          room={room}
          game="keywords"
          course={courseCode}
          week={weekNum}
          mine={{ done: levels.reduce((n, _l, i) => n + (saved.found[i] || []).length, 0), total: levels.reduce((n, l) => n + l.slots.length, 0), label: `L${li + 1}/${levels.length}` }}
        />
      )}
      {roomCode && !room.startedAt ? null : (<>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Display size={26}>Level {li + 1} of {levels.length}</Display>
        {saved.bonus > 0 && <span className="pill pill--good" style={{ marginLeft: 'auto' }}>{saved.bonus} bonus</span>}
      </div>

      <Card pad={14} style={{ marginTop: 12, gap: 4 }}>
        <div className="t-13 w-7" style={{ color: 'var(--u-good)' }}>Clue for the key term</div>
        <div className="t-15">{lv.term.clue}</div>
      </Card>

      {/* Word boxes: the key term first and highlighted, then the others. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 14 }}>
        {lv.slots.map((s, si) => {
          const got = found.includes(s) || done;
          const main = si === 0;
          return (
            <div key={s} aria-label={got ? s : `${s.length} letters${main ? ', key term' : ''}`} style={{ display: 'flex', gap: 4 }}>
              {s.split('').map((c, ci) => (
                <span
                  key={ci}
                  style={{
                    width: main ? 30 : 26, height: main ? 34 : 30, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--fd)', fontWeight: 900, fontSize: main ? 18 : 15,
                    background: got ? (main ? 'var(--u-green)' : 'var(--u-good-tint)') : 'var(--surface)',
                    border: `1.5px solid ${main ? 'var(--u-good)' : 'var(--border)'}`,
                    color: got ? 'var(--u-black)' : 'transparent',
                    transition: 'background .2s',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        {flash ? (
          <span className={`pill pill--${flash.tone}`}>{flash.text}</span>
        ) : (
          <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, letterSpacing: 3 }}>{word}</span>
        )}
      </div>

      {done ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8, marginTop: 8 }}>
          <BoxBoy pose={allDone ? 'cheer' : 'thumbsUp'} width={96} />
          <Display size={22}>{lv.term.display}</Display>
          <div className="t-14 muted">{lv.term.clue.replace(/_____/g, lv.term.display)}</div>
          {allDone ? (
            <>
              <div className="t-15 w-7">You've cracked every key term this week.</div>
              {saved.finishedSecs != null && <GameFinish game="keywords" course={courseCode} week={weekNum} score={score} terms={termsSolved} hints={hintsTotal} seconds={saved.finishedSecs} />}
              <Link to={back} className="btn btn--amber btn--block">Back to the notes</Link>
              <button className="btn btn--white btn--block" onClick={() => setSaved({ level: 0, found: {}, hints: {}, bonus: 0, startedAt: Date.now() })}>Play again</button>
            </>
          ) : (
            <button className="btn btn--amber btn--block" onClick={() => { setSaved((s) => ({ ...s, level: li + 1 })); if (room.mode === 'team' && room.startedAt) room.send({ t: 'level', level: li + 1 }); }}>Next level</button>
          )}
        </Card>
      ) : (
        <>
          <div
            ref={wheelRef}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="no-select"
            style={{
              position: 'relative', width: size, height: size, margin: '6px auto 0', borderRadius: '50%',
              background: '#0a0a0a', boxShadow: '0 0 0 6px rgba(74,222,128,0.25)', touchAction: 'none',
              animation: shake ? 'kw-shake .35s' : undefined,
            }}
            key={shake}
          >
            <svg width={size} height={size} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
              {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#4ade80" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />}
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
                  style={{
                    position: 'absolute', left: p.x - 26, top: p.y - 26, width: 52, height: 52, borderRadius: '50%',
                    background: on ? '#4ade80' : '#f5f4f0', color: '#0a0a0a', border: 'none',
                    fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24, touchAction: 'none',
                  }}
                >
                  {c}
                </button>
              );
            })}
            {/* Centre: submit a tapped word, or clear it. */}
            {path.length > 0 && !isDragging && tapMode.current && (
              <button
                onClick={() => (path.length >= 3 ? submit(word) : (setPath([]), (tapMode.current = false)))}
                style={{ position: 'absolute', left: size / 2 - 30, top: size / 2 - 30, width: 60, height: 60, borderRadius: '50%', background: '#4ade80', color: '#0a0a0a', border: 'none', fontWeight: 800, fontSize: 13 }}
              >
                {path.length >= 3 ? 'Go' : 'Clear'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <button className="btn btn--white btn--sm" onClick={() => { setOrder((o) => [...o].sort(() => Math.random() - 0.5)); setPath([]); }} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Shuffle size={15} /> Shuffle
            </button>
            <button className="btn btn--white btn--sm" disabled={hintsUsed >= HINTS} onClick={hint} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Lightbulb size={15} /> Hint ({HINTS - hintsUsed} left)
            </button>
          </div>
          <div className="t-13 muted" style={{ textAlign: 'center', marginTop: 10 }}>
            Drag across the letters to spell a word, or tap them one by one and press Go.
          </div>
          {!roomCode && <InviteButton game="keywords" course={courseCode} week={weekNum} />}
        </>
      )}
      </>)}
      <style>{'@keyframes kw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}'}</style>
    </div>
  );
}
