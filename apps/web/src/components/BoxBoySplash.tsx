import { useEffect, useState } from 'react';
import { BoxBoy } from './redesign/brand';
import LoadingQuote from './LoadingQuote';
import Wordmark from './Wordmark';

// S01 — brand-green splash: Box Boy hopping, "Unify. Learn" beneath, nothing
// else. Auto-dismisses; never blocks sign-in.
const SEEN_KEY = 'unify.splash.v1';
const seenThisSession = () => {
  try {
    return !!sessionStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
};

// Plays once per browser session: coming back to /auth (after the welcome
// slides, a sign-out, an expired session) goes straight to the form.
export function BoxBoySplash({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(() => !seenThisSession());
  useEffect(() => {
    if (!visible) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        // storage blocked: the splash may replay, never blocks
      }
      setVisible(false);
      onDone?.();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!visible) return null;
  return (
    <div role="status" aria-label="Loading" className="african-band" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <span className="boxboy--hop" style={{ display: 'inline-block', lineHeight: 0 }}>
        <BoxBoy full pose="readingStanding" width={150} />
      </span>
      <Wordmark size={28} onGreen />
      <LoadingQuote onGreen />
    </div>
  );
}
