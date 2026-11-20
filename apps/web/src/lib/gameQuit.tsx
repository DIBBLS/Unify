import type { ReactNode } from 'react';
import type { GameId } from './api';
import { useLeaveGuard } from './leaveGuard';

// Leaving a game midway: asked first ("before"), and the next finish of that
// game for that week scores 10% less, which the game says when it opens
// again and the finish screen shows ("after"). Finishing the round clears it.
export const QUIT_CUT = 0.1;
const key = (game: GameId, course: string, week: number) => `unify.quit.${game}.${course.toUpperCase()}.${week}`;

export function quitPending(game: GameId, course: string, week: number): boolean {
  try { return !!localStorage.getItem(key(game, course, week)); } catch { return false; }
}
export function markQuit(game: GameId, course: string, week: number): void {
  try { localStorage.setItem(key(game, course, week), String(Date.now())); } catch { /* fine */ }
}
export function clearQuit(game: GameId, course: string, week: number): void {
  try { localStorage.removeItem(key(game, course, week)); } catch { /* fine */ }
}
/** The score after the cut, when the last round was left midway. */
export const afterCut = (score: number) => Math.max(0, Math.round(score * (1 - QUIT_CUT)));

/**
 * For a game screen: `active` while a round is under way (started, not done).
 * Returns the leave prompt (render it) and a notice for the top of the game
 * when the last round was left midway.
 */
export function useGameQuit(game: GameId, course: string, week: number, active: boolean): [ReactNode, ReactNode] {
  const pending = quitPending(game, course, week);
  const prompt = useLeaveGuard(
    active,
    {
      title: 'Leave this round?',
      body: pending
        ? "You're midway. Leaving now keeps the 10% cut on your next finish of this game."
        : "You're midway. If you leave now, your next finish of this game for this week scores 10% less.",
      stay: 'Keep playing',
      leave: 'Leave anyway',
    },
    () => markQuit(game, course, week),
  );
  const notice = pending ? (
    <div className="g-in" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', margin: '8px 0', borderRadius: 12, background: 'var(--u-warn-tint)', color: 'var(--u-warn-ink)', fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
      You left your last round midway, so this round scores 10% less. Finish it to clear that.
    </div>
  ) : null;
  return [prompt, notice];
}
