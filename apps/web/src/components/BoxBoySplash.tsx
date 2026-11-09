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
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!visible) {
      onDone?.();
      return;
    }
    // Hold, fade out softly, then hand over: the app below is already there,
    // so the green dissolves into it instead of cutting.
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        // storage blocked: the splash may replay, never blocks
      }
      setLeaving(true);
    }, 1500);
    const t2 = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2100);
    return () => { clearTimeout(t); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!visible) return null;
  return (
    <div role="status" aria-label="Loading" className={`african-band splash ${leaving ? 'splash--out' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <span className="boxboy--hop" style={{ display: 'inline-block', lineHeight: 0 }}>
        <BoxBoy full pose="readingStanding" width={150} />
      </span>
      <Wordmark size={28} onGreen />
      <LoadingQuote onGreen />
    </div>
  );
}
