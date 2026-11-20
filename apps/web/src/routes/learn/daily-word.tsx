import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Keyboard, Share2 } from 'lucide-react';
import { api } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { ROUTES } from '../../lib/routes';
import { CLUE_AFTER, MAX_GUESSES, dailyFor, dailyForAny, readStats, recordResult, score, shareText, today, type Daily, type DailyStats, type Mark } from '../../lib/dailyword';
import BackButton from '../../components/BackButton';
import GameLoading from '../../components/GameLoading';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';
import { useCheer } from '../../components/Cheer';
import PhoneKeys, { centreInView, type PhoneKeysHandle } from '../../components/PhoneKeys';
import { missLine, useIdleTease } from '../../lib/tease';
import GameNudge from '../../components/GameNudge';
import GameTimer, { useGameClock } from '../../components/GameTimer';

import { play } from '../../lib/sound';
// Term of the Day: guess one key term from your course in six tries. Same
// word for everyone in the course today; the clue from the notes shows after
// the third guess. Solving it counts as today's study (streak + XP).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLORS: Record<Mark, { bg: string; fg: string; border: string }> = {
  hit: { bg: 'var(--u-green)', fg: 'var(--u-black)', border: 'var(--u-green)' },
  near: { bg: 'var(--u-amber)', fg: 'var(--u-black)', border: 'var(--u-amber)' },
  miss: { bg: '#8a8a8a', fg: '#fff', border: '#8a8a8a' },
};
type Saved = { guesses: string[]; done: boolean; sent?: boolean; played?: number; timeUp?: boolean };
// Five minutes a day, counted from the first letter typed (only while on screen).
const DAILY_LIMIT = 300;
const keyOf = (course: string, day: string) => `unify:daily:${course}:${day}`;

function untilMidnight(): string {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  const m = Math.max(0, Math.round((mid.getTime() - now.getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function DailyWordRoute() {
  const [params, setParams] = useSearchParams();
  const day = today();
  const [courses, setCourses] = useState<string[]>([]);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading');
  const [saved, setSaved] = useState<Saved>({ guesses: [], done: false });
  const [typing, setTyping] = useState('');
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState('');
  const [pop, setPop] = useState('');
  const [board, setBoard] = useState<{ played: number; solved: number } | null>(null);
  const [stats, setStats] = useState<DailyStats>(readStats);
  const [cheerNode, cheer] = useCheer();
  const keys = useRef<PhoneKeysHandle>(null);
  const activeRow = useRef<HTMLDivElement>(null);
  const [howTo, setHowTo] = useState(false);

  // Pick the course: ?course=, else today's course in the rotation that has a playable word.
  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const me = await api.me();
        const mine = (me.courses || []).map((c) => c.trim()).filter(Boolean);
        if (gone) return;
        setCourses(mine);
        const wanted = params.get('course');
        const d = wanted ? await dailyFor(wanted, day).catch(() => null) : await dailyForAny(mine, day);
        if (gone) return;
        if (!d) { setState('none'); return; }
        setDaily(d);
        try { setSaved(JSON.parse(localStorage.getItem(keyOf(d.course, day)) || '') as Saved); } catch { setSaved({ guesses: [], done: false }); }
        setState('ready');
        api.dailyWord(d.course, day).then((b) => { if (!gone) setBoard({ played: b.played, solved: b.solved }); }).catch(() => {});
      } catch (e) {
        errorToast(e, 'load today’s word');
        if (!gone) setState('none');
      }
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('course')]);

  const answer = daily?.term.word || '';
  const rows = saved.guesses.map((g) => score(g, answer));
  const solved = saved.guesses.includes(answer);
  const finished = solved || saved.guesses.length >= MAX_GUESSES || !!saved.timeUp;
  const showClue = saved.guesses.length >= CLUE_AFTER || finished;
  const tease = useIdleTease(`${saved.guesses.length}:${typing}`, state === 'ready' && !finished);

  // After each guess, the next row sits in the middle of what's visible (above the keyboard).
  useEffect(() => { if (saved.guesses.length) window.setTimeout(() => centreInView(activeRow.current), 60); }, [saved.guesses.length]);

  const persist = (s: Saved) => {
    setSaved(s);
    if (daily) try { localStorage.setItem(keyOf(daily.course, day), JSON.stringify(s)); } catch { /* fine */ }
  };

  // The clock: runs once they've started typing, saved with the day's game.
  const tick = useCallback(() => {
    setSaved((s) => {
      if (s.done) return s;
      const played = (s.played || 0) + 1;
      const n: Saved = played >= DAILY_LIMIT ? { ...s, played, done: true, timeUp: true } : { ...s, played };
      if (daily) try { localStorage.setItem(keyOf(daily.course, day), JSON.stringify(n)); } catch { /* fine */ }
      return n;
    });
  }, [daily, day]);
  useGameClock(state === 'ready' && !finished && (saved.guesses.length > 0 || typing.length > 0 || (saved.played || 0) > 0), tick);
  // Time's up: the day ends unsolved, recorded like running out of tries.
  useEffect(() => {
    if (!daily || !saved.timeUp || saved.sent) return;
    setTyping('');
    cheer('done', { text: "Time's up!", sub: `The word was ${daily.term.display.toUpperCase()}` });
    setStats(recordResult(day, false, saved.guesses.length));
    api.dailyWordSave({ course: daily.course, day, word: answer, guesses: Math.max(1, saved.guesses.length), solved: false })
      .then((r) => { setBoard((b) => ({ played: (b?.played || 0) + (r.first ? 1 : 0), solved: r.solved })); persist({ ...saved, sent: true }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.timeUp]);

  // Each new try pops up which one it is ("Try 2 of 6"), like a cheer.
  const triesSeen = useRef<number | null>(null);
  useEffect(() => {
    if (state !== 'ready') return;
    const n = saved.guesses.length;
    if (triesSeen.current === null) { triesSeen.current = n; return; } // opening the page: no pop
    if (n === triesSeen.current) return;
    triesSeen.current = n;
    if (finished) return;
    const left = MAX_GUESSES - n;
    window.setTimeout(() => cheer('try', { text: `Try ${n + 1} of ${MAX_GUESSES}`, sub: left === 1 ? 'Last try!' : `${left} tries left` }), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.guesses.length, state]);

  const submit = useCallback(() => {
    if (!daily || finished) return;
    if (typing.length !== answer.length) { setNote(`The word has ${answer.length} letters.`); setShake((n) => n + 1); play('wrong'); return; }
    const guesses = [...saved.guesses, typing];
    const win = typing === answer;
    const over = win || guesses.length >= MAX_GUESSES;
    setTyping('');
    setNote('');
    if (win) cheer(guesses.length <= 2 ? 'done' : 'level', { text: guesses.length === 1 ? 'First try!' : guesses.length <= 3 ? 'Brilliant!' : 'Got it!' });
    else if (!over) {
      play('wrong');
      // Near miss: one letter off.
      const hits = score(typing, answer).filter((m) => m === 'hit').length;
      setPop(hits === answer.length - 1 ? 'One letter away!' : missLine());
      window.setTimeout(() => setPop(''), 3400);
      if (guesses.length === CLUE_AFTER) setNote('The clue is open now.');
    }
    const next: Saved = { guesses, done: over };
    persist(next);
    if (over) {
      setStats(recordResult(day, win, guesses.length));
      api.dailyWordSave({ course: daily.course, day, word: answer, guesses: guesses.length, solved: win })
        .then((r) => { setBoard((b) => ({ played: (b?.played || 0) + (r.first ? 1 : 0), solved: r.solved })); persist({ ...next, sent: true }); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, finished, typing, answer, saved, day]);

  const press = useCallback((k: string) => {
    if (finished || !answer) return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') return setTyping((t) => t.slice(0, -1));
    if (/^[A-Z]$/.test(k)) setTyping((t) => (t.length < answer.length ? t + k : t));
  }, [finished, answer, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '16px 16px 32px' } as const;
  if (state === 'loading') return <div style={shell}><GameLoading text="Getting today's term…" /></div>;
  if (state === 'none' || !daily) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.games} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-7">No Term of the Day yet</div>
          <div className="t-13 muted">{courses.length ? 'It comes from your courses’ notes. Once a week’s notes are out, the word appears here.' : 'Add your courses and the word comes from their notes.'}</div>
          {!courses.length && <Link to={ROUTES.findCourses} className="btn btn--amber btn--sm">Find courses</Link>}
        </Card>
      </div>
    );
  }

  // Letter states for the keyboard: best result so far for each letter.
  const keyState: Record<string, Mark> = {};
  saved.guesses.forEach((g, r) => g.split('').forEach((ch, i) => {
    const m = rows[r][i];
    if (m === 'hit' || (m === 'near' && keyState[ch] !== 'hit') || (m === 'miss' && !keyState[ch])) keyState[ch] = m;
  }));
  // Tiles fit the width and leave room for the keyboard on short phones.
  const size = Math.max(30, Math.min(52, Math.floor((Math.min(window.innerWidth, 480) - 32 - (answer.length - 1) * 6) / answer.length), Math.floor((window.innerHeight - 420) / MAX_GUESSES) - 6));
  const share = async () => {
    const url = `${window.location.origin}${ROUTES.games}`;
    const text = shareText(daily.course, day, rows, solved, url);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div style={shell}>
      {cheerNode}
      <BackButton to={ROUTES.games} />
      <Label>{daily.course} · {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</Label>
      <Display size={28}>Term of the Day</Display>
      {courses.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {courses.map((c) => (
            <button key={c} className={`chip chip--sm${c === daily.course ? ' chip--on' : ''}`} onClick={() => setParams({ course: c })}>{c}</button>
          ))}
        </div>
      )}

      {/* The grid: six rows, one box per letter. */}
      {/* What to do first: shown until the first guess, then one tap away. */}
      {!finished && (saved.guesses.length === 0 || howTo) && (
        <Card pad={14} style={{ marginTop: 12, gap: 8 }}>
          <div className="t-14 w-7">How to play</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
            <li><b style={{ color: 'var(--text)' }}>Tap the boxes</b> and type any {answer.length}-letter word from your {daily.course} notes.</li>
            <li>Press <b style={{ color: 'var(--text)' }}>Enter</b> (or Go). The boxes change colour:</li>
          </ol>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            {(['hit', 'near', 'miss'] as Mark[]).map((m) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 5, background: COLORS[m].bg, color: COLORS[m].fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>A</span>
                <span>{m === 'hit' ? 'Right letter, right place' : m === 'near' ? 'In the word, wrong place' : 'Not in the word'}</span>
              </div>
            ))}
          </div>
          <div className="t-13 muted">Use the colours to guess again. You have {MAX_GUESSES} tries, and the clue opens after guess {CLUE_AFTER}.</div>
        </Card>
      )}

      {!finished && <GameTimer played={saved.played || 0} limit={DAILY_LIMIT} />}
      <div key={shake} className={shake ? 'shake' : undefined} onClick={() => keys.current?.focus()} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 16, cursor: finished ? undefined : 'text' }} aria-label="Your guesses">
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const word = r < saved.guesses.length ? saved.guesses[r] : r === saved.guesses.length ? typing : '';
          const marks = r < rows.length ? rows[r] : null;
          return (
            <div key={r} ref={r === saved.guesses.length ? activeRow : undefined} style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-label={marks ? `Try ${r + 1}, ${word}: ${marks.join(', ')}` : `Try ${r + 1}`}>
              {Array.from({ length: answer.length }, (_, i) => {
                const ch = word[i] || '';
                const c = marks ? COLORS[marks[i]] : null;
                return (
                  <span key={`${i}${ch}`} className={ch && !marks ? 'g-tile-pop' : undefined} style={{
                    width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                    fontWeight: 900, fontSize: size * 0.5, fontFamily: 'var(--fd)',
                    background: c ? c.bg : 'var(--surface)', color: c ? c.fg : 'var(--text)',
                    border: `2px solid ${c ? c.border : ch ? 'var(--text)' : r === saved.guesses.length && !finished ? 'var(--u-amber)' : 'var(--border)'}`,
                    transition: `background .25s ${i * 80}ms, border-color .25s ${i * 80}ms, filter .3s ${i * 80}ms, opacity .3s ${i * 80}ms`,
                    // Letters not in the word blur out, so the exact and close ones stand out.
                    ...(marks && marks[i] === 'miss' ? { filter: 'blur(2px)', opacity: 0.4 } : {}),
                  }}>{ch}</span>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ minHeight: 22, textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--u-good)' }} aria-live="polite">{note}</div>
      <GameNudge text={finished ? '' : pop || tease} tone={pop ? 'miss' : 'tease'} />

      {showClue ? (
        <Card pad={12} style={{ marginTop: 4, gap: 4 }}>
          <div className="t-12 w-7 muted">CLUE · WEEK {daily.week}</div>
          <div className="t-14">{daily.term.clue}</div>
        </Card>
      ) : (
        <div className="t-12 muted" style={{ textAlign: 'center' }}>The clue opens after guess {CLUE_AFTER}. {answer.length} letters, from your {daily.course} notes.</div>
      )}

      {finished ? (
        <Card style={{ marginTop: 14, alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <BoxBoy pose={solved ? 'cheer' : 'readingStanding'} width={90} />
          <div className="t-15 w-7">{solved ? `Solved in ${saved.guesses.length} of ${MAX_GUESSES}` : `${saved.timeUp ? "Time's up. " : ''}Today's word was ${daily.term.display.toUpperCase()}`}</div>
          {solved ? <div className="t-13 muted">That counts as today's study. +10 XP.</div> : <div className="t-13 muted">Read it again in Week {daily.week} and it'll stick.</div>}
          {board && board.played > 0 && <div className="t-13 w-7">{board.solved} of {board.played} in {daily.course} solved it today</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', marginTop: 4 }}>
            {[['Played', stats.played], ['Solve streak', stats.streak], ['Best streak', stats.best]].map(([k, v]) => (
              <div key={k as string}><div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22 }}>{v}</div><div className="t-12 muted">{k}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button className="btn btn--amber" style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }} onClick={() => void share()}><Share2 size={16} /> Share</button>
            <Link to={`/learn/${encodeURIComponent(daily.course)}/week/${daily.week}`} className="btn btn--white" style={{ flex: 1 }}>Open Week {daily.week}</Link>
          </div>
          <div className="t-12 muted">New word in {untilMidnight()}</div>
        </Card>
      ) : (
        // The phone's own keyboard types straight into the guess row.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <PhoneKeys ref={keys} target={activeRow} label="Type your guess" onLetter={(k) => press(k)} onBack={() => press('BACK')} onEnter={() => press('ENTER')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--white" style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }} onClick={() => keys.current?.focus()}><Keyboard size={16} /> Type a guess</button>
            <button type="button" className="btn btn--amber" style={{ flex: 1 }} disabled={typing.length !== answer.length} onClick={() => press('ENTER')}>Enter</button>
          </div>
          {saved.guesses.length > 0 && (
            <>
              {/* Letters tried so far, in their colours (what the drawn keyboard used to show). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }} aria-label="Letters tried">
                {ALPHABET.map((k) => {
                  const m = keyState[k];
                  return <span key={k} style={{ width: 24, height: 26, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: m ? COLORS[m].bg : 'var(--surface2)', color: m ? COLORS[m].fg : 'var(--text2)', opacity: m === 'miss' ? 0.55 : 1 }}>{k}</span>;
                })}
              </div>
              <button type="button" className="t-13 w-7" style={{ background: 'none', border: 0, color: 'var(--u-good)', alignSelf: 'center' }} onClick={() => setHowTo((v) => !v)}>{howTo ? 'Hide how to play' : 'How to play'}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
