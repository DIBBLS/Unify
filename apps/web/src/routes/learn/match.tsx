import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { ROUTES } from '../../lib/routes';
import { extractTerms, moreTerms, type Term } from '../../lib/wordgame';
import type { UnifyNote } from '../../types/note';
import { play } from '../../lib/sound';
import { sayPraise } from '../../lib/welcomeVoice';
import BackButton from '../../components/BackButton';
import GameFinish from '../../components/GameFinish';
import GameLoading from '../../components/GameLoading';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';
import { useCheer } from '../../components/Cheer';

// Match-up: pair each of the week's key terms with what it means, four pairs
// a round. Every term and meaning comes from the week's notes (the same terms
// Keywords and Crossword use). Tap a term, then its meaning (either order).
// Works offline for any week on the phone; the score saves when online.
const PER_ROUND = 4;
const MAX_TERMS = 12;
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const short = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > 120 ? `${t.slice(0, 117).replace(/\s+\S*$/, '')}…` : t; };

export default function MatchRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [err, setErr] = useState('');
  const [round, setRound] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [pick, setPick] = useState<{ side: 'term' | 'clue'; word: string } | null>(null);
  const [bad, setBad] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [finishedSecs, setFinishedSecs] = useState<number | null>(null);
  const started = useRef(Date.now());
  const [cheerNode, cheer] = useCheer();

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const note = d.note_json as UnifyNote;
        if (!note || !Array.isArray(note.topics)) { setTerms([]); return; }
        // Any length works here (no spelling), so allow long terms.
        const base = extractTerms(note, 30);
        const all = [...base, ...moreTerms(note, base, 30, MAX_TERMS)]
          .filter((t) => t.clue && t.clue.trim().length >= 8)
          // A clue that gives the term away isn't a clue.
          .filter((t) => !t.clue.toLowerCase().includes(t.display.toLowerCase()));
        const seen = new Set<string>();
        const uniq = all.filter((t) => (seen.has(t.word) ? false : (seen.add(t.word), true)));
        setTerms(shuffle(uniq).slice(0, MAX_TERMS));
        started.current = Date.now();
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);

  const rounds = useMemo(() => {
    if (!terms) return [];
    const out: Term[][] = [];
    for (let i = 0; i < terms.length; i += PER_ROUND) out.push(terms.slice(i, i + PER_ROUND));
    // A last round of one is no game: fold it into the round before.
    if (out.length > 1 && out[out.length - 1].length === 1) out[out.length - 2].push(...out.pop()!);
    return out;
  }, [terms]);
  const now = rounds[round] || [];
  // The meanings column is shuffled once per round.
  const clues = useMemo(() => shuffle(now), [now]);

  const tap = (side: 'term' | 'clue', word: string) => {
    if (matched.has(word) || finishedSecs != null) return;
    if (!pick || pick.side === side) { setPick({ side, word }); play('tap'); return; }
    if (pick.word === word) {
      const next = new Set(matched).add(word);
      setMatched(next);
      setPick(null);
      const roundDone = now.every((t) => next.has(t.word));
      if (!roundDone) { cheer('word'); return; }
      if (round + 1 < rounds.length) {
        cheer('level', { sub: `Round ${round + 1} of ${rounds.length}` });
        window.setTimeout(() => setRound((r) => r + 1), 900);
      } else {
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        setFinishedSecs(secs);
        if (mistakes === 0) { cheer('done', { text: 'Perfect!', sub: 'Every pair right first time' }); sayPraise('perfect'); }
        else cheer('done', { sub: 'Every term matched' });
      }
      return;
    }
    // Wrong pair: both shake, a soft bump, try again.
    setBad([pick.word, word]);
    setMistakes((m) => m + 1);
    setPick(null);
    play('wrong');
    window.setTimeout(() => setBad([]), 450);
  };

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '16px 16px 40px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.games} /><Card style={{ marginTop: 8 }}><div className="t-14">{err}</div></Card></div>;
  if (!terms) return <div style={shell}><GameLoading text="Pairing up your terms…" /></div>;
  if (terms.length < 3) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.games} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-7">Not enough key terms this week</div>
          <div className="t-13 muted">Match-up needs at least three terms with meanings in the notes. Try Keywords or Crossword for this week.</div>
        </Card>
      </div>
    );
  }

  const score = Math.max(0, terms.length * 100 - mistakes * 25 + Math.max(0, 300 - (finishedSecs || 0)));
  const btn = (side: 'term' | 'clue', t: Term) => {
    const on = matched.has(t.word);
    const picked = pick?.side === side && pick.word === t.word;
    const wrong = bad.includes(t.word) && (pick == null);
    return (
      <button key={`${side}-${t.word}`} type="button" disabled={on} onClick={() => tap(side, t.word)}
        className={wrong ? 'g-shake' : undefined}
        style={{
          textAlign: 'left', padding: side === 'term' ? '14px 12px' : '10px 12px', borderRadius: 12, minHeight: 56,
          fontWeight: side === 'term' ? 800 : 500, fontSize: side === 'term' ? 15 : 13, lineHeight: 1.35,
          border: `2px solid ${on ? 'var(--u-good)' : picked ? 'var(--u-amber)' : 'var(--border)'}`,
          borderBottomWidth: on ? 2 : 4,
          background: on ? 'var(--u-good-tint)' : picked ? 'rgba(251,191,36,.15)' : 'var(--surface)',
          color: 'var(--text)', opacity: on ? 0.55 : 1, transition: 'opacity .3s, background .2s',
        }}>
        {side === 'term' ? t.display : short(t.clue)}
      </button>
    );
  };

  return (
    <div style={shell}>
      {cheerNode}
      <BackButton to={ROUTES.games} />
      <Label>{courseCode} · Week {weekNum}</Label>
      <Display size={28}>Match-up</Display>
      <div className="t-13 muted" style={{ marginTop: 4 }}>Tap a term, then what it means. Round {Math.min(round + 1, rounds.length)} of {rounds.length}{mistakes ? ` · ${mistakes} miss${mistakes === 1 ? '' : 'es'}` : ''}</div>
      <div style={{ height: 10, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden', margin: '12px 0' }} aria-label={`${matched.size} of ${terms.length} matched`}>
        <div style={{ width: `${(matched.size / terms.length) * 100}%`, height: '100%', background: 'var(--u-green)', borderRadius: 9999, transition: 'width .4s cubic-bezier(.34,1.56,.64,1)' }} />
      </div>

      {finishedSecs == null ? (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{now.map((t) => btn('term', t))}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{clues.map((t) => btn('clue', t))}</div>
        </div>
      ) : (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <BoxBoy pose="cheer" width={90} />
          <div className="t-15 w-7">{mistakes === 0 ? 'Perfect: every pair right first time' : `All ${terms.length} terms matched`}</div>
          <div className="t-13 muted">{mistakes ? `${mistakes} miss${mistakes === 1 ? '' : 'es'} · ` : ''}{finishedSecs}s</div>
          <GameFinish game="match" course={courseCode} week={weekNum} score={score} terms={terms.length} hints={mistakes} seconds={finishedSecs} />
          <button className="btn btn--white btn--sm" onClick={() => { setTerms(shuffle(terms)); setRound(0); setMatched(new Set()); setMistakes(0); setFinishedSecs(null); started.current = Date.now(); }}>Play again</button>
        </Card>
      )}
    </div>
  );
}
