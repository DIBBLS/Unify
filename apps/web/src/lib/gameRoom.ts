import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseBrowser } from './supabase';
import { api } from './api';

// Play with a coursemate: two people in one game session over Supabase
// Realtime (broadcast + presence; nothing is stored, a few bytes per move).
//  - race: same puzzle, separate boards, each sees the other's progress live;
//  - team: one shared board, every word or letter shows on both screens.
// A session is a 4-letter code in the link (?room=KXQP&mode=race). The host
// starts it once both are in; both boards reset to the same start.
export type RoomMode = 'race' | 'team';
export type Player = { id: string; name: string; persona: string | null; host: boolean };
export type RoomEvent =
  | { t: 'start'; at: number }
  | { t: 'progress'; id: string; done: number; total: number; label: string }
  | { t: 'finish'; id: string; name: string; score: number; seconds: number }
  | { t: 'found'; id: string; level: number; word: string }
  | { t: 'level'; level: number }
  | { t: 'cell'; id: string; k: string; v: string };

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L, O: easy to read out
export const newRoomCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export function useGameRoom(game: 'keywords' | 'crossword', course: string, week: number, room: string | null, mode: RoomMode, host: boolean) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'failed'>(room ? 'connecting' : 'idle');
  const chan = useRef<RealtimeChannel | null>(null);
  const handlers = useRef<((e: RoomEvent) => void)[]>([]);

  useEffect(() => {
    if (!room) return;
    const sb = supabaseBrowser();
    if (!sb) { setStatus('failed'); return; }
    let gone = false;
    void (async () => {
      const m = await api.me().catch(() => null);
      const self: Player = { id: m?.profile?.id || Math.random().toString(36).slice(2), name: (m?.profile?.first_name || 'A coursemate').split(' ')[0], persona: (m?.profile as { box_boy_persona?: string | null } | undefined)?.box_boy_persona || null, host };
      if (gone) return;
      setMe(self);
      const c = sb.channel(`game-${game}-${course.replace(/[^A-Za-z0-9]/g, '')}-${week}-${room.replace(/[^A-Z]/g, '')}`, { config: { broadcast: { self: false }, presence: { key: self.id } } });
      c.on('presence', { event: 'sync' }, () => {
        const state = c.presenceState<Player>();
        setPlayers(Object.values(state).map((v) => v[0]).filter(Boolean).slice(0, 2));
      });
      c.on('broadcast', { event: 'g' }, ({ payload }) => {
        const e = payload as RoomEvent;
        if (e.t === 'start') setStartedAt(e.at);
        handlers.current.forEach((h) => h(e));
      });
      c.subscribe(async (s) => {
        if (s === 'SUBSCRIBED') { setStatus('live'); await c.track(self); }
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('failed');
      });
      chan.current = c;
    })();
    return () => {
      gone = true;
      if (chan.current) void sb.removeChannel(chan.current);
      chan.current = null;
    };
  }, [game, course, week, room, host]);

  const send = useCallback((e: RoomEvent) => {
    void chan.current?.send({ type: 'broadcast', event: 'g', payload: e });
  }, []);
  const onEvent = useCallback((h: (e: RoomEvent) => void) => {
    handlers.current.push(h);
    return () => { handlers.current = handlers.current.filter((x) => x !== h); };
  }, []);
  const start = useCallback(() => {
    const at = Date.now();
    setStartedAt(at);
    send({ t: 'start', at });
  }, [send]);

  const other = players.find((p) => p.id !== me?.id) || null;
  return { room, mode, players, me, other, startedAt, status, send, onEvent, start };
}

export function roomLink(game: 'keywords' | 'crossword', course: string, week: number, room: string, mode: RoomMode) {
  return `${window.location.origin}/learn/${encodeURIComponent(course)}/week/${week}/${game}?room=${room}&mode=${mode}`;
}
