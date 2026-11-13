import type { NavigateFunction } from 'react-router-dom';

// In-app return memory: a trail of the screens the user walked through, so
// Back lands on the actual previous screen (admin → studio → admin), not a
// hardcoded hub. Going back pops the trail, so repeated Back keeps walking
// out instead of bouncing between the last two screens. Tab/query switches
// (?t=, ?preview=) never add a stop: Back must leave the page, not flip tabs.
//
// Each stop also remembers its browser-history position, so Back really
// steps the browser back (history.go(-n)) rather than pushing the previous
// screen on top. Pushing left Notes → Game → Notes in the history, and the
// phone's back gesture then reopened the game from the notes.
type Stop = { path: string; idx: number | null };
const MAX_TRAIL = 50;
const trail: Stop[] = [];

// React Router keeps the history position in history.state.idx.
const historyIdx = (): number | null => {
  const i = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof i === 'number' ? i : null;
};

// Call on every location change (pathname or query): a query change on the
// same screen only updates where that screen sits in the history.
export function recordNav(pathname: string): void {
  if (!pathname) return;
  const idx = historyIdx();
  const top = trail[trail.length - 1];
  if (top && top.path === pathname) { top.idx = idx; return; }
  if (trail.length > 1 && trail[trail.length - 2].path === pathname) {
    trail.pop();
    trail[trail.length - 1].idx = idx;
    return;
  }
  // Same history slot as the top stop: this screen replaced the last one
  // (a redirect such as /course/X → /courses/X). Swap it rather than adding a
  // stop, or Back would land on the redirect and bounce straight back here.
  if (top && idx != null && top.idx === idx) {
    trail[trail.length - 1] = { path: pathname, idx };
    return;
  }
  trail.push({ path: pathname, idx });
  if (trail.length > MAX_TRAIL) trail.shift();
}

export function previousPath(): string | null {
  return trail.length > 1 ? trail[trail.length - 2].path : null;
}

// Back: step the browser back to the previous screen when we know where it
// sits; otherwise open it. With no trail at all (opened from a shared link,
// or after a reload) go up to `fallback`, replacing this screen so the next
// Back doesn't return here.
export function goBack(navigate: NavigateFunction, fallback: string): void {
  const prev = trail[trail.length - 2];
  const top = trail[trail.length - 1];
  const cur = historyIdx();
  if (prev && prev.idx != null && cur != null && top?.idx === cur && prev.idx < cur) {
    navigate(prev.idx - cur);
    return;
  }
  if (prev) { navigate(prev.path); return; }
  trail.pop();
  navigate(fallback, { replace: true });
}

// Leave this screen for `to` (a fixed parent, e.g. a game → Practice):
// step back if `to` is the previous screen, otherwise swap this screen for
// `to` in the history, so Back from `to` never returns here.
export function leaveTo(navigate: NavigateFunction, to: string): void {
  if (previousPath() === to.split('?')[0]) { goBack(navigate, to); return; }
  trail.pop();
  navigate(to, { replace: true });
}
