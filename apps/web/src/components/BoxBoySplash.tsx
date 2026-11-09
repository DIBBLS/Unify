import { useEffect, useState } from 'react';
import { BoxBoy } from './redesign/brand';
import Wordmark from './Wordmark';

// S01 — brand-green splash. Black ink on the one brand green, Box Boy
// centred. Auto-dismisses; never blocks sign-in.
export function BoxBoySplash({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!visible) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--u-green)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Wordmark size={26} onGreen />
      <BoxBoy pose="readingStanding" width={150} style={{ animation: 'boxboy-bob 1.8s ease-in-out infinite' }} />
      <div className="eyebrow" style={{ color: 'var(--u-black)', opacity: 0.7 }}>Unify Learn is starting up</div>
    </div>
  );
}
