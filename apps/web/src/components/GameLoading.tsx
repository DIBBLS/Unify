// While a course game gets ready: five letter tiles flip over one after
// another, in the games' own colours (right, close, right…), like a board
// being dealt. Replaces the grey skeleton blocks, which looked like a broken
// page rather than a game about to start.
const TILES: [string, string][] = [
  ['P', 'var(--u-green)'],
  ['L', 'var(--u-amber)'],
  ['A', 'var(--u-green)'],
  ['Y', 'var(--u-amber)'],
  ['!', 'var(--u-green)'],
];

export default function GameLoading({ text = 'Dealing your words…' }: { text?: string }) {
  return (
    <div role="status" aria-live="polite" className="soft-in" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <style>{`
        @keyframes g-deal { 0%, 15% { transform: rotateX(90deg); opacity: .2 } 35%, 80% { transform: rotateX(0); opacity: 1 } 100% { transform: rotateX(0); opacity: 1 } }
        .g-deal { animation: g-deal 2.4s cubic-bezier(.34,1.56,.64,1) infinite; backface-visibility: hidden }
        @media (prefers-reduced-motion: reduce) { .g-deal { animation: none } }
      `}</style>
      <div style={{ display: 'flex', gap: 8, perspective: 400 }} aria-hidden="true">
        {TILES.map(([l, c], i) => (
          <span key={i} className="g-deal" style={{ animationDelay: `${i * 0.16}s`, width: 44, height: 50, borderRadius: 10, background: c, color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.15)' }}>{l}</span>
        ))}
      </div>
      <div className="t-14 w-7" style={{ color: 'var(--text2)' }}>{text}</div>
    </div>
  );
}
