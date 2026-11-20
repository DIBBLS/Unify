import { useCallback, useState, type ReactNode } from 'react';
import { useLeaveGuard } from './leaveGuard';
import { penaliseLeave } from './penalty';

// Leaving a topic midway in the notes: asked first, costs 5 XP on the spot,
// and is remembered so the week offers to take them back to it.
const key = (course: string, week: number) => `unify.left.notes.${course.toUpperCase()}.${week}`;
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
      body: "You haven't finished this topic yet. If you leave now, you lose 5 XP.",
      stay: 'Keep reading',
      leave: 'Leave anyway (−5 XP)',
    },
    () => {
      penaliseLeave('topic', course, week, `topic ${topic ?? ''}`);
      if (topic) try { localStorage.setItem(key(course, week), String(topic)); } catch { /* fine */ }
    },
  );
  return [prompt, left, clear];
}
