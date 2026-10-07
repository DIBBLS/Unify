// Unify wordmark lockup (brand-kit ruling): "Unify" in Playfair 900, the
// full stop in green, "Learn" in the general body face. One component so
// every header renders the same lockup in both themes. `light` for dark
// grounds (auth hero); the dot stays green either way.
export default function Wordmark({ size = 20, light = false }: { size?: number; light?: boolean }) {
  const ink = light ? '#fff' : 'var(--text)';
  return (
    <span style={{ fontSize: size, lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900, color: ink }}>
        Unify
      </span>
      <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900, color: light ? '#4ade80' : 'var(--green-deep)' }}>
        .
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, color: ink }}>
        {' '}Learn
      </span>
    </span>
  );
}
