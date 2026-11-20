import { useEffect } from 'react';
import { BoxBoy } from './redesign/brand';
import Wordmark from './Wordmark';
import LoadingQuote from './LoadingQuote';

// The loading screen: Box Boy, "Unify Learn" beneath, then a proverb so a slow
// network never means dead air. The caption is kept for screen readers only.
//
// Opening the app can pass through several waits in a row (the page's code,
// the sign-in check, the profile, the next page's code). Each shows this same
// screen, and a screen that follows another within a moment does not fade in
// again, so the student sees one calm screen instead of a run of flashes.
let lastGone = 0;
let sequenceStart = 0;
const CONTINUES_MS = 1200;

/** How long the current run of loading screens has been showing, in ms. */
export function loaderAge(): number {
  return sequenceStart ? performance.now() - sequenceStart : 0;
}

export default function Loading({ text = 'Loading…' }: { text?: string }) {
  const continuing = lastGone > 0 && performance.now() - lastGone < CONTINUES_MS;
  useEffect(() => {
    if (!continuing) sequenceStart = performance.now();
    return () => {
      lastGone = performance.now();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className={continuing ? 'loading-screen' : 'soft-in soft-in--late loading-screen'}
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
