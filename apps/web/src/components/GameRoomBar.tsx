import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Swords, Users, X } from 'lucide-react';
import { newRoomCode, roomLink, type RoomEvent, type RoomMode, type useGameRoom } from '../lib/gameRoom';
import { Avatar, type PersonaKey } from './redesign/brand';

// Play with a coursemate: the invite button (outside a session), the lobby
// (code, send the link, waiting, Start) and, while playing, both players'
// progress (race) or who you're playing with (team).
type Room = ReturnType<typeof useGameRoom>;
const NAME = { keywords: 'Keywords', crossword: 'Crossword' } as const;

export function InviteButton({ game, course, week }: { game: 'keywords' | 'crossword'; course: string; week: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const go = (mode: RoomMode) => navigate(`/learn/${encodeURIComponent(course)}/week/${week}/${game}?room=${newRoomCode()}&mode=${mode}&host=1`);
  if (!open) {
    return (
      <button className="btn btn--white btn--sm" onClick={() => setOpen(true)} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '10px auto 0' }}>
        <Users size={15} /> Play with a coursemate
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>Play with a coursemate</span>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ display: 'flex', background: 'none', border: 'none', color: 'var(--text3)' }}><X size={16} /></button>
      </div>
      <button onClick={() => go('race')} style={{ textAlign: 'left', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800 }}><Swords size={15} /> Race</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Same puzzle, your own boards. You see each other's progress; first to finish wins.</span>
      </button>
      <button onClick={() => go('team')} style={{ textAlign: 'left', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800 }}><Users size={15} /> Team up</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>One shared board. Whatever either of you gets shows on both phones.</span>
      </button>
    </div>
  );
}

export function RoomBar({ room, game, course, week, mine }: { room: Room; game: 'keywords' | 'crossword'; course: string; week: number; mine: { done: number; total: number; label: string } }) {
  const navigate = useNavigate();
  const [theirs, setTheirs] = useState<{ done: number; total: number; label: string } | null>(null);
  const [winner, setWinner] = useState<{ name: string; seconds: number; me: boolean } | null>(null);

  useEffect(() => room.onEvent((e: RoomEvent) => {
    if (e.t === 'progress') setTheirs({ done: e.done, total: e.total, label: e.label });
    if (e.t === 'finish') setWinner((w) => w || { name: e.name, seconds: e.seconds, me: false });
    if (e.t === 'start') { setTheirs(null); setWinner(null); }
  }), [room]);
  // Tell the other player how far along you are (race), whenever it changes.
  useEffect(() => {
    if (room.startedAt && room.me && room.mode === 'race') room.send({ t: 'progress', id: room.me.id, done: mine.done, total: mine.total, label: mine.label });
  }, [mine.done, mine.total, mine.label, room.startedAt, room.me, room.mode, room.send]);

  const leave = () => navigate(`/learn/${encodeURIComponent(course)}/week/${week}/${game}`, { replace: true });
  const link = room.room ? roomLink(game, course, week, room.room, room.mode) : '';
  const invite = async () => {
    const text = `Play ${NAME[game]} with me: ${course} Week ${week} on Unify Learn (${room.mode === 'race' ? 'race' : 'team'}, code ${room.room}).`;
    try { if (navigator.share) { await navigator.share({ title: NAME[game], text, url: link }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank', 'noopener');
  };

  const box: React.CSSProperties = { background: '#0a0a0a', color: '#f5f4f0', borderRadius: 14, padding: '12px 14px', marginTop: 10 };
  const other = room.other;

  if (room.status === 'failed') {
    return <div style={{ ...box, fontSize: 13 }}>Couldn't connect to the session. Check your network, then open the link again. <button onClick={leave} style={{ color: '#4ade80', background: 'none', border: 'none', fontWeight: 700 }}>Play alone</button></div>;
  }

  // Lobby: before the host starts.
  if (!room.startedAt) {
    return (
      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#4ade80', flex: 1 }}>{room.mode === 'race' ? 'RACE' : 'TEAM UP'} · CODE {room.room}</span>
          <button onClick={leave} style={{ background: 'none', border: '1px solid #444', color: '#f5f4f0', borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Leave</button>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[room.me, other].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: p ? 1 : 0.5 }}>
              {p ? <Avatar persona={(p.persona || 'go-getter') as PersonaKey} size={30} /> : <span style={{ width: 30, height: 30, borderRadius: '50%', border: '2px dashed #555' }} />}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p ? (i === 0 ? 'You' : p.name) : 'Waiting…'}</span>
            </div>
          ))}
        </div>
        {!other && (
          <button onClick={() => void invite()} className="btn btn--amber btn--block" style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <Share2 size={15} /> Send the link to a coursemate
          </button>
        )}
        {other && (room.me?.host
          ? <button className="btn btn--amber btn--block" onClick={room.start}>Start {room.mode === 'race' ? 'the race' : 'together'}</button>
          : <div style={{ fontSize: 13, color: '#aaa' }}>Waiting for {other.name} to start…</div>)}
      </div>
    );
  }

  // Playing.
  if (room.mode === 'team') {
    return (
      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <Users size={14} color="#4ade80" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{other ? `Teamed up with ${other.name}` : 'Your teammate left'}</span>
        <button onClick={leave} style={{ background: 'none', border: '1px solid #444', color: '#f5f4f0', borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Leave</button>
      </div>
    );
  }
  const bar = (p: { done: number; total: number } | null) => (
    <span style={{ flex: 1, height: 6, borderRadius: 4, background: '#333', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${p && p.total ? Math.round((p.done / p.total) * 100) : 0}%`, background: '#4ade80', transition: 'width .3s' }} />
    </span>
  );
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ width: 70, fontWeight: 700 }}>You</span>{bar(mine)}<span style={{ width: 54, textAlign: 'right', color: '#aaa' }}>{mine.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ width: 70, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{other?.name || 'Left'}</span>{bar(theirs)}<span style={{ width: 54, textAlign: 'right', color: '#aaa' }}>{theirs?.label || '…'}</span>
      </div>
      {winner && !winner.me && <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{winner.name} finished first in {Math.floor(winner.seconds / 60)}m {winner.seconds % 60}s. Keep going, your score still counts.</div>}
    </div>
  );
}
