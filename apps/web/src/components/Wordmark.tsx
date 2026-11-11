// Unify Learn wordmark (review 2026-11-10: "Unify. Learn" became "Unify Learn"):
// both words in Playfair 900, no full stop between them. Pass full={false} for
// "Unify." alone (the short mark keeps its green full stop). One component so
// every header renders the same lockup in both themes. `light` for dark
// grounds (auth hero), `onGreen` for the brand-green band.
export default function Wordmark({ size = 20, light = false, onGreen = false, full = true }: { size?: number; light?: boolean; onGreen?: boolean; full?: boolean }) {
  const ink = onGreen ? 'var(--u-black)' : light ? '#fff' : 'var(--text)';
  const dot = onGreen ? 'var(--u-black)' : light ? 'var(--u-green)' : 'var(--green-deep)';
  const face = { fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900, color: ink } as const;
  return (
    <span style={{ fontSize: size, lineHeight: 1, whiteSpace: 'nowrap' }}>
      {full ? (
        <span style={face}>Unify Learn</span>
      ) : (
        <>
          <span style={face}>Unify</span>
          <span className="dot-breathe" style={{ ...face, color: dot, display: 'inline-block' }}>.</span>
        </>
      )}
    </span>
  );
}
