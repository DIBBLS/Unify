import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar, type PersonaKey } from './redesign/brand';

// A game leaderboard among students taking the course: one week (both games
// added up, or one game) or the whole course. Shows the top players and,
// when you're further down, your own place.
type Board = Awaited<ReturnType<typeof api.gameBoard>>;

export default function GameLeaderboard({ course, week, game, limit = 10, title }: { course: string; week?: number; game?: 'keywords' | 'crossword'; limit?: number; title?: string }) {
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  useEffect(() => {
    setBoard(undefined);
    api.gameBoard({ course, week, game }).then(setBoard).catch(() => setBoard(null));
  }, [course, week, game]);

  const head = title || (week ? `Week ${week} leaderboard` : `${course} leaderboard`);
  const rows = (board?.top || []).slice(0, limit);
  const meShownAbove = rows.some((p) => p.me);
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', fontSize: 12, fontWeight: 800 }}>
        <Trophy size={14} color="#fbbf24" /> {head}
        {board && board.players > 0 && <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontWeight: 700 }}>{board.players} player{board.players === 1 ? '' : 's'}</span>}
      </div>
      {board === undefined && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>Loading…</div>}
      {board === null && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>Couldn't load the leaderboard.</div>}
      {board && rows.length === 0 && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>Nobody has played yet. Be the first on the board.</div>}
      {rows.map((p) => (
        <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: '1px solid var(--border)', background: p.me ? 'var(--u-good-tint)' : undefined }}>
          <span style={{ width: 20, fontWeight: 800, fontSize: 13, color: p.rank <= 3 ? '#b45309' : 'var(--text2)' }}>{p.rank}</span>
          <Avatar persona={(p.persona || 'go-getter') as PersonaKey} size={26} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: p.me ? 800 : 600 }}>{p.me ? 'You' : p.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.terms} terms</span>
          <span style={{ fontWeight: 800, fontSize: 13, minWidth: 40, textAlign: 'right' }}>{p.score}</span>
        </div>
      ))}
      {board?.me && !meShownAbove && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>You're number {board.me.rank} with {board.me.score} points.</div>
      )}
    </div>
  );
}
