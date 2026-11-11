// In-app return memory: a trail of the screens the user walked through, so
// Back lands on the actual previous screen (admin → studio → admin), not a
// hardcoded hub. Going back pops the trail, so repeated Back keeps walking
// out instead of bouncing between the last two screens. Deep links have no
// history — the `to` fallback covers those. Tab/query switches (?t=,
// ?preview=) never count: Back must leave the page, not flip tabs.
const MAX_TRAIL = 50;
const trail: string[] = [];

export function recordNav(pathname: string): void {
  if (!pathname || pathname === trail[trail.length - 1]) return;
  if (pathname === trail[trail.length - 2]) {
    trail.pop();
    return;
  }
  trail.push(pathname);
  if (trail.length > MAX_TRAIL) trail.shift();
}

export function previousPath(): string | null {
  return trail.length > 1 ? trail[trail.length - 2] : null;
}
