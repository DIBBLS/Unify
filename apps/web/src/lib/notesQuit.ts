import { useCallback, useState, type ReactNode } from 'react';
import { useLeaveGuard } from './leaveGuard';

// Leaving a topic midway in the notes: asked first, and remembered so the
// week says so when the student comes back (cleared once that topic is done).
const key = (course: string, week: number) => `unify.left.notes.${course.toUpperCase()}.${week}`;
/** The topic this week was left midway in, if any (it earns 5 XP, not 10, when finished). */
export const leftTopicOf = (course: string, week: number): number | null => read(course, week);
const read = (course: string, week: number): number | null => {
  try { const v = Number(localStorage.getItem(key(course, week))); return v > 0 ? v : null; } catch { return null; }
};

export function useNotesQuit(course: string, week: number, topic: number | undefined, midway: boolean): [ReactNode, number | null, () => void] {
  const [left, setLeft] = useState<number | null>(() => read(course, week));
  const clear = useCallback(() => {
    try { localStorage.removeItem(key(course, week)); } catch { /* fine */ }
    setLeft(null);
  }, [course, week]);
  const prompt = useLeaveGuard(
    midway,
    {
      title: `Leave Topic ${topic ?? ''} midway?`,
      body: "You haven't finished this topic yet. If you leave now, finishing it later earns 5 XP instead of 10.",
      stay: 'Keep reading',
      leave: 'Leave anyway',
    },
    () => { if (topic) try { localStorage.setItem(key(course, week), String(topic)); } catch { /* fine */ } },
  );
  return [prompt, left, clear];
}
