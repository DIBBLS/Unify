import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';
import { MathPlain } from '../components/MathText';

// S35–S36: revision. Recall cards from topics you've finished, shuffled. Think
// of the answer, reveal it, then say whether you knew it. Cards you missed come
// back at the end of the round.
type CardT = Awaited<ReturnType<typeof api.revision>>['cards'][number];

export default function RevisionRoute() {
  const [deck, setDeck] = useState<CardT[] | null>(null);
  const [err, setErr] = useState('');
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [knew, setKnew] = useState(0);
  const [missed, setMissed] = useState<CardT[]>([]);
  const [round, setRound] = useState(1);

  const load = () => {
    setDeck(null); setI(0); setShown(false); setKnew(0); setMissed([]); setRound(1);
    api.revision(10).then((r) => setDeck(r.cards)).catch((e) => setErr(describeError(e, 'load your revision')));
  };
  useEffect(() => { load(); }, []);

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.home} /><Card style={{ marginTop: 8 }}><div className="t-13 muted">{err}</div></Card></div>;
  if (!deck) return <div style={shell}><SectionSkeleton rows={2} /></div>;

  if (deck.length === 0)
    return (
      <div style={shell}>
        <BackButton to={ROUTES.home} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-6">Nothing to revise yet</div>
          <div className="t-13 muted">Finish a topic in any course and its recall cards show up here.</div>
          <Link to={ROUTES.home} className="btn btn--amber">Back to my courses</Link>
        </Card>
      </div>
    );

  // S36: round done.
  if (i >= deck.length) {
    const total = deck.length;
    return (
      <div style={shell}>
        <BackButton to={ROUTES.home} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="cheer" width={130} />
          <Display size={30}>Revision done</Display>
          <div className="t-15">You knew {knew} of {total}{round > 1 ? ` (round ${round})` : ''}.</div>
          <div className="t-13 muted">{missed.length ? `${missed.length} card${missed.length === 1 ? '' : 's'} to go over again.` : 'Clean sweep. Come back tomorrow for a fresh set.'}</div>
        </Card>
        {missed.length > 0 && (
          <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => { setDeck(missed); setMissed([]); setI(0); setKnew(0); setShown(false); setRound((r) => r + 1); }}>
            Go over the {missed.length} I missed
          </button>
        )}
        <button className="btn btn--white btn--block" style={{ marginTop: 10 }} onClick={load}>New set of cards</button>
        <Link to={ROUTES.home} className="btn btn--white btn--block" style={{ marginTop: 10 }}>Done for now</Link>
      </div>
    );
  }

  const c = deck[i];
  const answer = (got: boolean) => {
    if (got) setKnew((k) => k + 1);
    else setMissed((m) => [...m, c]);
    setShown(false);
    setI((x) => x + 1);
  };

  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <Label>Revision · card {i + 1} of {deck.length}</Label>
      <div style={{ height: 6, borderRadius: 9999, background: 'var(--border)', marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${(i / deck.length) * 100}%`, height: '100%', background: 'var(--u-green)' }} />
      </div>
      <Card style={{ marginTop: 14, gap: 10, minHeight: 220 }}>
        <div className="t-12 muted">{c.course} · Week {c.week}{c.topic ? ` · ${c.topic}` : ''}{c.badge ? ` · ${c.badge}` : ''}</div>
        <div className="t-16 w-7" style={{ lineHeight: 1.45 }}><MathPlain text={c.question} /></div>
        {shown ? (
          <div className="t-15" style={{ borderTop: '1px solid var(--border)', paddingTop: 10, lineHeight: 1.5 }}><MathPlain text={c.answer.replace(/<[^>]+>/g, '')} /></div>
        ) : (
          <div className="t-13 muted">Say the answer in your head first.</div>
        )}
      </Card>
      {shown ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn--white" style={{ flex: 1 }} onClick={() => answer(false)}>Not yet</button>
          <button className="btn btn--amber" style={{ flex: 1 }} onClick={() => answer(true)}>I knew it</button>
        </div>
      ) : (
        <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => setShown(true)}>Show answer</button>
      )}
    </div>
  );
}
