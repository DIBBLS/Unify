import { useEffect, useState } from 'react';
import { PERSONAS, POSES } from './redesign/brand';
import Wordmark from './Wordmark';

// S01 — brand-green splash: the whole Box Boy crew pops in one after another,
// "Unify. Learn" arrives beneath them, everyone waits a moment, then it fades
// into sign-in. Tap to skip. Plays once per browser session; never blocks sign-in.
const CREW = [
  ...PERSONAS.map((p) => p.img),
  POSES.targetSign,
  POSES.sittingPhone,
  POSES.readingStanding,
];
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
    }, 3200);
    const t2 = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3800);
    return () => { clearTimeout(t); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!visible) return null;
  const skip = () => {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setLeaving(true);
    window.setTimeout(() => { setVisible(false); onDone?.(); }, 450);
  };
  return (
    <div role="status" aria-label="Loading" onClick={skip} className={`african-band splash ${leaving ? 'splash--out' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, cursor: 'pointer' }}>
      <div className="parade" aria-hidden="true">
        {CREW.map((src, i) => (
          <img key={src} src={src} alt="" decoding="async" style={{ ['--d' as string]: `${i * 140}ms` }} draggable={false} />
        ))}
      </div>
      <Wordmark size={30} onGreen />
      <div className="splash-tag">Built for the ones who build</div>
    </div>
  );
}
