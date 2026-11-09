// Unify wordmark lockup (brand-kit ruling): "Unify" in Playfair 900, the
// full stop in green, "Learn" in the general body face. One component so
// every header renders the same lockup in both themes. `light` for dark
// grounds (auth hero); the dot stays green either way.
export default function Wordmark({ size = 20, light = false, onGreen = false }: { size?: number; light?: boolean; onGreen?: boolean }) {
  // onGreen: sits on the brand-green band — black ink, white full stop.
  const ink = onGreen ? 'var(--u-black)' : light ? '#fff' : 'var(--text)';
  const dot = onGreen ? 'var(--u-black)' : light ? 'var(--u-green)' : 'var(--green-deep)';
  return (
    <span style={{ fontSize: size, lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900, color: ink }}>
        Unify
      </span>
      <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900, color: dot }}>
        .
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, color: ink }}>
        {' '}Learn
      </span>
    </span>
  );
}

