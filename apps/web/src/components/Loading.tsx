import { BoxBoy } from './redesign/brand';
import Wordmark from './Wordmark';
import LoadingQuote from './LoadingQuote';

// The loading screen: Box Boy, "Unify. Learn" beneath, then a proverb so a slow
// network never means dead air. The caption is kept for screen readers only.
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
      <LoadingQuote />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
}
