import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { ROUTES } from '../../lib/routes';
import { gapSentences, weekTerms, type Gap } from '../../lib/wordgame';
import type { UnifyNote } from '../../types/note';
import { play } from '../../lib/sound';
import BackButton from '../../components/BackButton';
import GameFinish from '../../components/GameFinish';
import { useGameQuit } from '../../lib/gameQuit';
import GameLoading from '../../components/GameLoading';
import { BoxBoy } from '../../components/redesign/brand';
import { Card, Display, Label, ProgressBar } from '../../components/redesign/ui';
import { useCheer } from '../../components/Cheer';
import { missLine, useIdleTease } from '../../lib/tease';
import GameNudge from '../../components/GameNudge';

// Fill the gap: a sentence from the week's notes with a key term taken out.
// Pick the missing term from four of the week's terms. Unlike Match-up (term
// to meaning) this asks for the term in use, the way it reads in the notes.
export default function GapFillRoute() {
  const { courseCode = '', week = '1' } = useParams();
  const weekNum = Number(week) || 1;
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [finishedSecs, setFinishedSecs] = useState<number | null>(null);
  const started = useRef(Date.now());
  const [cheerNode, cheer] = useCheer();
  const [miss, setMiss] = useState('');

  useEffect(() => {
    api.week(courseCode, weekNum)
      .then((d) => {
        const n = d.note_json as UnifyNote;
        if (!n || !Array.isArray(n.topics)) { setGaps([]); return; }
        setNote(n);
        setGaps(gapSentences(n, weekTerms(n, 20)));
        started.current = Date.now();
      })
      .catch(() => setErr("Couldn't load this week. Check your network and try again."));
  }, [courseCode, weekNum]);

  const now = gaps?.[at];
  const choose = (word: string) => {
    if (!now || picked) return;
    setPicked(word);
    const ok = word === now.answer.word;
    if (ok) {
      const s = streak + 1;
      setRight((r) => r + 1);
      setStreak(s);
      if (s === 3 || s === 6) cheer('streak', { sub: `${s} in a row` });
      else play('correct');
    } else {
      setStreak(0);
      play('wrong');
      setMiss(missLine()); window.setTimeout(() => setMiss(''), 2500);
    }
    window.setTimeout(() => {
      setPicked(null);
      if (gaps && at + 1 < gaps.length) setAt(at + 1);
      else if (gaps) {
        setFinishedSecs(Math.max(1, Math.round((Date.now() - started.current) / 1000)));
        const total = right + (ok ? 1 : 0);
        if (total === gaps.length) cheer('done', { text: 'Perfect!', sub: 'Every gap filled first time' });
        else cheer('done', { sub: `${total} of ${gaps.length} right` });
      }
    }, ok ? 900 : 1800);
  };

  const tease = useIdleTease(at, !!gaps && gaps.length >= 3 && finishedSecs == null);
  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '16px 16px 40px' } as const;
  const [leavePrompt, quitNotice] = useGameQuit('gapfill', courseCode, weekNum, !!gaps && finishedSecs == null && (at > 0 || picked !== null));
  if (err) return <div style={shell}><BackButton to={ROUTES.games} /><Card style={{ marginTop: 8 }}><div className="t-14">{err}</div></Card></div>;
  if (!gaps) return <div style={shell}><GameLoading text="Finding sentences in your notes…" /></div>;
  if (gaps.length < 3) {
    return (
      <div style={shell}>
        <BackButton to={ROUTES.games} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-7">Not enough sentences this week</div>
          <div className="t-13 muted">Fill the gap needs at least three sentences that use the week's key terms. Try Match-up or Keywords for this week.</div>
        </Card>
      </div>
    );
  }

  const wrong = gaps.length - right;
  const score = right * 120 + Math.max(0, 300 - (finishedSecs || 0));
  const gapText = picked && now ? now.answer.display : '';
  const isRight = picked && now ? picked === now.answer.word : null;

  return (
    <div style={shell} className="g-c-gapfill">
      {cheerNode}
      {leavePrompt}
      <BackButton to={ROUTES.games} />
      <Label>{courseCode} · Week {weekNum}</Label>
      <Display size={28}>Fill the gap</Display>
      {finishedSecs == null && quitNotice}
      <div className="t-13 muted" style={{ marginTop: 4 }}>Pick the term that completes the sentence. {finishedSecs == null ? `${Math.min(at + 1, gaps.length)} of ${gaps.length}` : ''}{streak >= 2 ? ` · ${streak} in a row` : ''}</div>
      <ProgressBar value={(finishedSecs != null ? gaps.length : at) / gaps.length} label={`${at} of ${gaps.length} answered`} style={{ margin: '12px 0' }} />
      <GameNudge text={finishedSecs == null ? miss || tease : ''} tone={miss ? 'miss' : 'tease'} />

      {finishedSecs == null && now ? (
        <div key={at} className="soft-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ fontSize: 16, lineHeight: 1.7 }}>
              {now.before}
              <span style={{
                display: 'inline-block', minWidth: 96, padding: '0 8px', margin: '0 2px', borderRadius: 8, textAlign: 'center', fontWeight: 800,
                borderBottom: `3px solid ${isRight == null ? 'var(--u-amber)' : isRight ? 'var(--u-good)' : 'var(--u-red)'}`,
                background: isRight == null ? 'rgba(251,191,36,.15)' : isRight ? 'var(--u-good-tint)' : 'var(--u-bad-tint)',
              }}>{gapText || ' '}</span>
              {now.after}
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {now.options.map((o) => {
              const mine = picked === o.word;
              const isAnswer = picked && o.word === now.answer.word;
              return (
                <button key={o.word} type="button" disabled={!!picked} onClick={() => choose(o.word)}
                  className={mine && !isAnswer ? 'g-shake' : 'g-tap'}
                  style={{
                    minHeight: 56, padding: '10px 12px', borderRadius: 14, fontWeight: 800, fontSize: 15,
                    border: `2px solid ${isAnswer ? 'var(--u-good)' : mine ? 'var(--u-red)' : 'var(--border)'}`, borderBottomWidth: 4,
                    background: isAnswer ? 'var(--u-good-tint)' : mine ? 'var(--u-bad-tint)' : 'var(--surface)', color: 'var(--text)',
                  }}>
                  {o.display}
                </button>
              );
            })}
          </div>
        </div>
      ) : finishedSecs != null ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <BoxBoy pose="cheer" width={90} />
          <div className="t-15 w-7">{wrong === 0 ? 'Perfect: every gap filled first time' : `${right} of ${gaps.length} right`}</div>
          <div className="t-13 muted">{finishedSecs}s</div>
          <GameFinish game="gapfill" course={courseCode} week={weekNum} score={score} terms={right} hints={wrong} seconds={finishedSecs} />
          <button className="btn btn--white btn--sm" onClick={() => { if (note) setGaps(gapSentences(note, weekTerms(note, 20))); setAt(0); setRight(0); setStreak(0); setFinishedSecs(null); started.current = Date.now(); }}>Play again</button>
        </Card>
      ) : null}
    </div>
  );
}
