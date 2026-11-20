import { api } from './api';
import { cheerEverywhere } from './cheerBus';

// Leaving a game or a topic midway costs 5 XP, taken at once (even below
// zero), and the student sees it right away in a cheer-style pop-up that
// stays up while the app moves to the next screen.
export const LEAVE_COST = 5;

export function penaliseLeave(kind: 'game' | 'topic', course: string, week: number, what: string): void {
  cheerEverywhere('penalty', { text: `−${LEAVE_COST} XP`, sub: kind === 'game' ? 'Left the game midway' : 'Left the topic midway' });
  void api.leftMidway({ kind, course, week, what }).catch(() => {});
}
