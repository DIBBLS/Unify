// In-app return memory: every route remembers where the user came from,
// so Back lands on the actual previous screen (admin → studio → admin),
// not a hardcoded hub. Deep links have no history — the `to` fallback
// covers those. Tab/query switches (?t=, ?preview=) never count: Back
// must leave the page, not flip tabs.
let prev: string | null = null;
let current: string | null = null;

export function recordNav(pathname: string): void {
  if (!pathname || pathname === current) return;
  prev = current;
  current = pathname;
}

export function previousPath(): string | null {
  return prev && prev !== current ? prev : null;
}
