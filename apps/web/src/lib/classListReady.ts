import { useEffect, useState } from 'react';
import { api } from './api';

// Has the class rep uploaded this student's class list yet? My pass only
// means something once it has (a scan checks the student against the list),
// so the pass is offered with attendance from then on and hidden before.
// One request per app session, shared by every screen that asks.
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function load(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api.classListMe()
      .then((r) => { cached = !!r.list; return cached; })
      .catch(() => false)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useClassListReady(): boolean {
  const [ready, setReady] = useState(cached === true);
  useEffect(() => {
    let gone = false;
    void load().then((r) => { if (!gone) setReady(r); });
    return () => { gone = true; };
  }, []);
  return ready;
}
