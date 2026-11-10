// Reports how pages really load for real users (Core Web Vitals), to the admin
// "Live performance" view. Tiny, sampled (1 in 2 visits), no personal data: a
// page pattern and up to five numbers, sent once as the page is left.
import { getApiUrl } from './api';

function pageGroup(path: string): string {
  return (
    '/' +
    path
      .split('/')
      .filter(Boolean)
      .map((seg, i) => (i > 0 && (/\d/.test(seg) || seg.length > 18) ? ':id' : seg))
      .slice(0, 3)
      .join('/')
  );
}

export function startVitals(): void {
  const base = getApiUrl();
  if (!base || typeof PerformanceObserver === 'undefined' || Math.random() > 0.5) return;
  const m: Record<string, number> = {};
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  try {
    new PerformanceObserver((l) => { const e = l.getEntries(); lcp = e[e.length - 1]?.startTime ?? lcp; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) inp = Math.max(inp, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {
    // older browsers: report what exists
  }
  let sent = false;
  const send = () => {
    if (sent) return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    if (nav) m.ttfb = Math.round(nav.responseStart);
    if (fcp) m.fcp = Math.round(fcp);
    if (lcp) m.lcp = Math.round(lcp);
    if (cls) m.cls = Math.round(cls * 1000) / 1000;
    if (inp) m.inp = Math.round(inp);
    if (!Object.keys(m).length) return;
    sent = true;
    try {
      // fetch + keepalive survives the page closing like sendBeacon, but unlike sendBeacon it can
      // omit cookies, which the API's CORS rules require (sendBeacon always sends them, so Chrome
      // blocked it with an Allow-Credentials error).
      void fetch(`${base}/v1/metrics/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pageGroup(location.pathname), metrics: m }),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } catch {
      // never matters to the user
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  window.addEventListener('pagehide', send);
}
