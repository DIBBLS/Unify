import { useEffect, useState } from 'react';
import { BoxBoy } from './redesign/brand';
import Wordmark from './Wordmark';

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--u-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Wordmark />
      <BoxBoy pose="readingStanding" width={120} style={{ animation: 'boxboy-bob 1.8s ease-in-out infinite' }} />
      <div className="eyebrow" style={{ color: 'var(--u-green)' }}>Unify Learn is starting up</div>
    </div>
  );
}
