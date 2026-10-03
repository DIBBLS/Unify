import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

// Server-backed topic progress, keyed by lecture (Lecture 1 Topic 1 and
// Lecture 2 Topic 1 are different completions). Nothing is persisted
// client-side: completed topics load from the API on mount, completion
// POSTs to the API. Completing is one-way (like finished lessons) so local
// state always converges with the server (add-only on both sides).
export function useProgress(courseCode: string, weekNum: number) {
  const [done, setDone] = useState<Set<string>>(new Set());

  const key = (topic: number, lecture: number) => `${lecture}::${topic}`;

  useEffect(() => {
    let cancelled = false;
    api
      .progressGet(courseCode, weekNum)
      .then((d) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const r of d.done || []) {
          if (typeof r === 'number') set.add(key(r, 1));
          else if (r && typeof r.topic === 'number') set.add(key(r.topic, r.lecture || 1));
        }
        setDone(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseCode, weekNum]);

  const toggle = useCallback(
    (wi: number, ti: number, lecture: number) => {
      if (wi !== weekNum) return;
      const k = key(ti, lecture);
      setDone((prev) => {
        if (prev.has(k)) return prev;
        const next = new Set(prev);
        next.add(k);
        return next;
      });
      void api.progress(courseCode, weekNum, ti, lecture).catch(() => {});
    },
    [courseCode, weekNum]
  );

  const isDone = useCallback(
    (wi: number, ti: number, lecture: number) => wi === weekNum && done.has(key(ti, lecture)),
    [done, weekNum]
  );

  const doneInLecture = useCallback(
    (lecture: number) => {
      let n = 0;
      done.forEach((k) => {
        if (k.startsWith(`${lecture}::`)) n += 1;
      });
      return n;
    },
    [done]
  );

  return { toggle, isDone, doneCount: done.size, doneInLecture };
}
