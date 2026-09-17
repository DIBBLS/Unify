import { useCallback, useEffect, useState } from 'react';

export type ProgressMap = Record<string, { done: boolean; completedAt?: number }>;

export function topicKey(wi: number, ti: number) {
  return `w${wi}_t${ti}`;
}

export function useProgress(courseCode: string) {
  const storageKey = `unify-topic-${courseCode}`;
  const [map, setMap] = useState<ProgressMap>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {}
  }, [map, storageKey]);

  const toggle = useCallback((wi: number, ti: number) => {
    const k = topicKey(wi, ti);
    setMap((m) => {
      const wasDone = m[k]?.done;
      return { ...m, [k]: { done: !wasDone, completedAt: !wasDone ? Date.now() : undefined } };
    });
  }, []);

  const isDone = useCallback((wi: number, ti: number) => Boolean(map[topicKey(wi, ti)]?.done), [map]);

  return { map, toggle, isDone, doneCount: Object.values(map).filter((v) => v.done).length };
}
