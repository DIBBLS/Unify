import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

// Server-backed topic progress. Nothing is persisted client-side:
// completed topics load from the API on mount, completion POSTs to the API.
// Completing is one-way (like finished lessons) so local state always
// converges with the server (add-only on both sides).
export function useProgress(courseCode: string, weekNum: number) {
  const [done, setDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api
      .progressGet(courseCode, weekNum)
      .then((d) => {
        if (!cancelled) setDone(new Set(d.done));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseCode, weekNum]);

  const toggle = useCallback(
    (wi: number, ti: number) => {
      if (wi !== weekNum) return;
      setDone((prev) => {
        if (prev.has(ti)) return prev;
        const next = new Set(prev);
        next.add(ti);
        return next;
      });
      void api.progress(courseCode, weekNum, ti).catch(() => {});
    },
    [courseCode, weekNum]
  );

  const isDone = useCallback(
    (wi: number, ti: number) => wi === weekNum && done.has(ti),
    [done, weekNum]
  );

  return { toggle, isDone, doneCount: done.size };
}
