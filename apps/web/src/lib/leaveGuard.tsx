import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoxBoy } from '../components/redesign/brand';

// "Leave midway?" for games and notes. While a round (or a topic) is under
// way, every way out asks first: the in-app Back button, any in-app link
// (the tab bar), and the phone's back gesture. Leave anyway runs `onLeave`
// (the screen records the quit, which costs something next time) and then
// goes where the student was heading.
//
// The back gesture can't be stopped once it happens, so while armed we sit
// one extra history entry deep (same address): Back lands on it, we ask, and
// put the extra entry back if they stay.

type Ask = (go: () => void) => void;
let ask: Ask | null = null;
// Set once they choose to leave, so stepping off the extra entry isn't taken as another Back.
let leaving = false;

/** For Back buttons: true when a guard took over (it will call `go` if they leave). */
export function askBeforeLeaving(go: () => void): boolean {
  if (!ask) return false;
  ask(go);
  return true;
}

const ARM = 'lg';
const onArmEntry = () => !!(window.history.state as Record<string, unknown> | null)?.[ARM];
const pushArm = () => window.history.pushState({ ...(window.history.state || {}), [ARM]: 1 }, '', window.location.href);
// Step off the extra entry (if we're on it), then run `then`.
// The step back is bookkeeping, not a page change: keep the reader exactly
// where they are. (Without this, finishing a topic - which switches the guard
// off - made the browser restore the scroll saved when the topic started, so
// "Mark Topic Complete" jumped the page up to the top of the topic.)
function disarm(then: () => void) {
  if (!onArmEntry()) { then(); return; }
  const x = window.scrollX;
  const y = window.scrollY;
  const hist = window.history as History & { scrollRestoration?: ScrollRestoration };
  const prev = hist.scrollRestoration;
  try { hist.scrollRestoration = 'manual'; } catch { /* older browsers */ }
  const keep = () => window.scrollTo(x, y);
  const done = () => {
    window.removeEventListener('popstate', done);
    keep();
    window.requestAnimationFrame(() => {
      keep();
      try { if (prev) hist.scrollRestoration = prev; } catch { /* fine */ }
    });
    window.setTimeout(then, 0);
  };
  window.addEventListener('popstate', done);
  window.history.back();
}

export type LeaveCopy = { title: string; body: string; stay?: string; leave?: string };

export function useLeaveGuard(active: boolean, copy: LeaveCopy, onLeave: () => void): ReactNode {
  const navigate = useNavigate();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const live = useRef({ active, onLeave, copy });
  live.current = { active, onLeave, copy };

  useEffect(() => {
    if (!active) return;
    let armed = true;
    leaving = false;
    // Already one deep (after a reload the entry keeps its mark): don't stack another.
    if (!onArmEntry()) pushArm();
    const open = (go: () => void) => setPending(() => go);
    ask = open;
    const onPop = () => {
      if (!armed || leaving || onArmEntry()) return;
      // They pressed Back: stay put (re-arm) and ask.
      pushArm();
      open(() => {
        // Leaving by Back: off the extra entry, then one more step back.
        window.history.back();
      });
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      open(() => navigate(url.pathname + url.search + url.hash));
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      armed = false;
      if (ask === open) ask = null;
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
      // Finished normally (still on this screen): drop the extra entry.
      if (onArmEntry()) disarm(() => {});
    };
  }, [active, navigate]);

  if (!pending) return null;
  const c = live.current.copy;
  const leave = () => {
    const go = pending;
    setPending(null);
    leaving = true;
    live.current.onLeave();
    ask = null;
    disarm(go);
  };
  return (
    <div className="leave-sheet-layer" role="dialog" aria-modal="true" aria-labelledby="leave-title" onClick={() => setPending(null)}>
      <div className="leave-sheet" onClick={(e) => e.stopPropagation()}>
        <BoxBoy pose="peeking" width={84} />
        <div id="leave-title" style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 20, lineHeight: 1.2 }}>{c.title}</div>
        <div className="t-14" style={{ color: 'var(--text2)', lineHeight: 1.45 }}>{c.body}</div>
        <button className="btn btn--block" autoFocus onClick={() => setPending(null)}>{c.stay || 'Keep going'}</button>
        <button className="btn btn--white btn--block" onClick={leave}>{c.leave || 'Leave anyway'}</button>
      </div>
    </div>
  );
}
