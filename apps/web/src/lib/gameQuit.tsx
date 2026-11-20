import type { ReactNode } from 'react';
import type { GameId } from './api';
import { useLeaveGuard } from './leaveGuard';
import { penaliseLeave } from './penalty';

// Leaving a game midway: asked first, and leaving anyway costs 5 XP on the
// spot, shown straight away with a "−5 XP" pop-up.
export function useGameQuit(game: GameId, course: string, week: number, active: boolean): ReactNode {
  return useLeaveGuard(
    active,
    {
      title: 'Leave this round?',
      body: "You're midway. If you leave now, you lose 5 XP.",
      stay: 'Keep playing',
      leave: 'Leave anyway (−5 XP)',
    },
    () => penaliseLeave('game', course, week, game),
  );
}
