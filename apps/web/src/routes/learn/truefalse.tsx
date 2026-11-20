import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../../lib/api';
import { ROUTES } from '../../lib/routes';
import { weekTerms, type Term } from '../../lib/wordgame';
import type { UnifyNote } from '../../types/note';
import { play } from '../../lib/sound';
import BackButton from '../../components/BackButton';
import GameFinish from '../../components/GameFinish';
import GameLoading from '../../components/GameLoading';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label } from '../../components/redesign/ui';
import { useCheer } from '../../components/Cheer';
import { missLine, useIdleTease } from '../../lib/tease';

// True or False: a meaning from the week's notes and a key term. Does the
// meaning describe that term? About half are true; the false ones pair the
// meaning with another of the week's terms, so every statement is about real
// course words. A wrong answer shows the right term before moving on.
const MAX = 12;
type Statement = { clue: string; shown: Term; right: Term; truth: boolean };
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const short = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > 170 ? `${t.slice(0, 167).replace(/\s+\S*$/, '')}…` : t; };

function build(terms: Term[]): Statement[] {
  return shuffle(terms).slice(0, MAX).map((t, i) => {
    const truth = i % 2 === 0;
    // Never "digesters" for digester's meaning: that would be true, not false.
    const others = terms.filter((o) => !o.word.startsWith(t.word) && !t.word.startsWith(o.word));
    const shown = truth || !others.length ? t : others[Math.floor(Math.random() * others.length)];
    return { clue: t.clue, shown, right: t, truth: truth || !others.length };
  }).sort(() => Math.random() - 0.5);
}

export default function TrueFalseRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<Statement[]>([]);
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [finishedSecs, setFinishedSecs] = useState<number | null>(null);
  const started = useRef(Date.now());
  const [cheerNode, cheer] = useCheer();
  const [miss, setMiss] = useState('');

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const note = d.note_json as UnifyNote;
        const t = note && Array.isArray(note.topics) ? weekTerms(note) : [];
        setTerms(t);
        setItems(build(t));
        started.current = Date.now();
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);

  const now = items[at];
  const choose = (said: boolean) => {
    if (!now || answer !== null) return;
    setAnswer(said);
    const ok = said === now.truth;
    if (ok) {
      const s = streak + 1;
      setRight((r) => r + 1);
      setStreak(s);
      setBonus((b) => b + Math.min(s - 1, 5) * 20);
      if (s === 3 || s === 6 || s === 10) cheer('streak', { sub: `${s} in a row` });
      else play('correct');
    } else {
      setStreak(0);
      play('wrong');
      setMiss(missLine()); window.setTimeout(() => setMiss(''), 2500);
    }
    // A wrong answer stays up longer so the right term can be read.
    window.setTimeout(() => {
      setAnswer(null);
      if (at + 1 < items.length) setAt(at + 1);
      else {
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        setFinishedSecs(secs);
        const total = right + (ok ? 1 : 0);
        if (total === items.length) cheer('done', { text: 'Perfect!', sub: 'Every statement right' });
        else cheer('done', { sub: `${total} of ${items.length} right` });
      }
    }, ok ? 750 : 1700);
  };

  const tease = useIdleTease(at, !!terms && terms.length >= 4 && finishedSecs == null);
  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '16px 16px 40px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.games} /><Card style={{ marginTop: 8 }}><div className="t-14">{err}</div></Card></div>;
  if (!terms) return <div style={shell}><GameLoading text="Writing your statements…" /></div>;
  if (terms.length < 4) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.games} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-7">Not enough key terms this week</div>
          <div className="t-13 muted">True or False needs at least four terms with meanings in the notes. Try Keywords or Crossword for this week.</div>
        </Card>
      </div>
    );
  }

  const wrong = items.length - right;
  const score = right * 100 + bonus + Math.max(0, 240 - (finishedSecs || 0));
  const judged = answer !== null && now ? answer === now.truth : null;
  const big = (said: boolean) => {
    const picked = answer === said;
    const tone = picked ? (judged ? 'var(--u-good)' : 'var(--u-red)') : 'var(--border)';
    return (
      <button type="button" onClick={() => choose(said)} disabled={answer !== null}
        className={picked && judged === false ? 'g-shake' : 'g-tap'}
        style={{
          flex: 1, minHeight: 64, borderRadius: 16, fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: `2px solid ${tone}`, borderBottomWidth: 5,
          background: picked ? (judged ? 'var(--u-good-tint)' : 'var(--u-bad-tint)') : 'var(--surface)', color: 'var(--text)',
        }}>
        {said ? <Check size={22} strokeWidth={3} color="var(--u-good)" /> : <X size={22} strokeWidth={3} color="var(--u-red)" />}
        {said ? 'True' : 'False'}
      </button>
    );
  };

  return (
    <div style={shell} className="g-c-truefalse">
      {cheerNode}
      <BackButton to={ROUTES.games} />
      <Label>{courseCode} · Week {weekNum}</Label>
      <Display size={28}>True or False</Display>
      <div className="t-13 muted" style={{ marginTop: 4 }}>Does the meaning match the term? {finishedSecs == null ? `${Math.min(at + 1, items.length)} of ${items.length}` : ''}{streak >= 2 ? ` · ${streak} in a row` : ''}</div>
      <div style={{ height: 10, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden', margin: '12px 0' }} aria-label={`${at} of ${items.length} answered`}>
        <div className="g-fill" style={{ width: `${((finishedSecs != null ? items.length : at) / items.length) * 100}%`, height: '100%', borderRadius: 9999, transition: 'width .4s cubic-bezier(.34,1.56,.64,1)' }} />
      </div>
      {finishedSecs == null && (tease || miss) && <div className="t-13 w-7 g-in" key={tease || miss} style={{ textAlign: 'center', color: 'var(--u-good)', margin: '-4px 0 10px' }} aria-live="polite">{tease || miss}</div>}

      {finishedSecs == null && now ? (
        <div key={at} className="soft-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ gap: 10 }}>
            <div className="t-13 w-7" style={{ color: 'var(--text2)', letterSpacing: 1 }}>MEANING</div>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>{short(now.clue)}</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span className="t-13 muted">This describes </span>
              <span style={{ fontWeight: 900, fontSize: 18 }}>{now.shown.display}</span>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10 }}>{big(false)}{big(true)}</div>
          <div style={{ minHeight: 22, textAlign: 'center' }} aria-live="polite">
            {judged === true && <span className="t-14 w-7" style={{ color: 'var(--u-good)' }}>Right!</span>}
            {judged === false && <span className="t-14 w-7">{now.truth ? `It does describe ${now.right.display}.` : `That's ${now.right.display}.`}</span>}
          </div>
        </div>
      ) : finishedSecs != null ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <BoxBoy pose="cheer" width={90} />
          <div className="t-15 w-7">{wrong === 0 ? 'Perfect: every statement right' : `${right} of ${items.length} right`}</div>
          <div className="t-13 muted">{finishedSecs}s</div>
          <GameFinish game="truefalse" course={courseCode} week={weekNum} score={score} terms={right} hints={wrong} seconds={finishedSecs} />
          <button className="btn btn--white btn--sm" onClick={() => { setItems(build(terms)); setAt(0); setRight(0); setStreak(0); setBonus(0); setFinishedSecs(null); started.current = Date.now(); }}>Play again</button>
        </Card>
      ) : null}
    </div>
  );
}
