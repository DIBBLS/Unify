import { useEffect, useRef, useState } from 'react';
import { Share2, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar, type PersonaKey } from './redesign/brand';

// End of a course game: saves the run (best score kept, first finish earns
// XP), lets the student share it (phone share sheet, or WhatsApp), and shows
// the week's leaderboard among students taking the course.
type Board = Awaited<ReturnType<typeof api.gameBoard>>;
const NAME = { keywords: 'Keywords', crossword: 'Crossword' } as const;

export default function GameFinish({ game, course, week, score, terms, hints, seconds }: { game: 'keywords' | 'crossword'; course: string; week: number; score: number; terms: number; hints: number; seconds: number }) {
  const [result, setResult] = useState<{ best: number; newBest: boolean; xp: number } | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api.gameScore({ game, course, week, score, terms, hints, seconds })
      .then((r) => setResult(r))
      .catch(() => setResult(null))
      .finally(() => { api.gameBoard({ course, week, game }).then(setBoard).catch(() => {}); });
  }, [game, course, week, score, terms, hints, seconds]);

  const url = `${window.location.origin}/learn/${encodeURIComponent(course)}/week/${week}/${game}`;
  const text = `I scored ${score} on ${course} Week ${week} ${NAME[game]} on Unify Learn and got ${terms} key term${terms === 1 ? '' : 's'}. Can you beat me?`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `${NAME[game]} · ${course}`, text, url }); return; }
    } catch { return; /* closed the share sheet */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  };
  const mins = Math.floor(seconds / 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
        <div><div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 28 }}>{score}</div><div className="t-13 muted">points</div></div>
        <div><div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 28 }}>{terms}</div><div className="t-13 muted">key terms</div></div>
        <div><div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 28 }}>{mins ? `${mins}m` : `${seconds}s`}</div><div className="t-13 muted">time</div></div>
      </div>
      {result && (
        <div className="t-13" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--u-good)' }}>
          {result.xp ? `+${result.xp} XP · ` : ''}{result.newBest ? 'Your best for this week' : `Your best is still ${result.best}`}
        </div>
      )}
      <button className="btn btn--white btn--block" onClick={() => void share()} style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Share2 size={15} /> Challenge your coursemates
      </button>
      {board && board.top.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', fontSize: 12, fontWeight: 800 }}>
            <Trophy size={14} color="#fbbf24" /> Week {week} leaderboard · {board.players} player{board.players === 1 ? '' : 's'}
          </div>
          {board.top.map((p) => (
            <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: '1px solid var(--border)', background: p.me ? 'var(--u-good-tint)' : undefined }}>
              <span style={{ width: 20, fontWeight: 800, fontSize: 13, color: p.rank <= 3 ? '#b45309' : 'var(--text2)' }}>{p.rank}</span>
              <Avatar persona={(p.persona || 'go-getter') as PersonaKey} size={26} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: p.me ? 800 : 600 }}>{p.me ? 'You' : p.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.terms} terms</span>
              <span style={{ fontWeight: 800, fontSize: 13, minWidth: 40, textAlign: 'right' }}>{p.score}</span>
            </div>
          ))}
          {board.me && board.me.rank > 10 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>You're number {board.me.rank} with {board.me.score} points.</div>
          )}
        </div>
      )}
    </div>
  );
}
