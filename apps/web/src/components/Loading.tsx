import { BoxBoy } from './redesign/brand';
import Wordmark from './Wordmark';

// The loading screen: Box Boy hopping, "Unify. Learn" beneath, nothing else.
// The caption is kept for screen readers only.
export default function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: '60vh', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}
    >
      <span className="boxboy--hop" style={{ display: 'inline-block', lineHeight: 0 }}>
        <BoxBoy full pose="wavePhone" width={110} />
      </span>
      <Wordmark size={24} />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
}
