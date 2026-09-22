// Box Boy — Unify mascot as a flat emerald SVG (no binary assets needed).
// Gold box head with emerald U, dark hoodie, coffee cup. Scales via `size`.
// `animate="wave"` swings the right arm (auth greeting); `"float"` bobs gently.
export default function Mascot({
  size = 120,
  animate = 'none',
}: {
  size?: number;
  animate?: 'none' | 'wave' | 'float';
}) {
  const wave = animate === 'wave';
  return (
    <svg
      width={size}
      height={Math.round(size * 1.15)}
      viewBox="0 0 200 230"
      fill="none"
      role="img"
      aria-label="Box Boy, the Unify mascot"
      style={animate === 'float' ? { animation: 'mascot-float 3s ease-in-out infinite' } : undefined}
    >
      {/* ground shadow */}
      <ellipse cx="100" cy="218" rx="52" ry="9" fill="#000000" opacity="0.08" />

      {/* antenna */}
      <line x1="136" y1="28" x2="149" y2="9" stroke="#B97F1F" strokeWidth="5" strokeLinecap="round" />
      <circle cx="149" cy="9" r="7" fill="#10b981" />

      {/* left arm */}
      <rect x="36" y="134" width="17" height="46" rx="8.5" fill="#1F2937" />
      {/* right arm (waves when animate="wave"; pivot at the shoulder) */}
      {wave ? (
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: '50% 0%',
            animation: 'mascot-wave 1.4s ease-in-out infinite',
          }}
        >
          <rect x="147" y="134" width="17" height="46" rx="8.5" fill="#1F2937" />
          <circle cx="156" cy="182" r="8" fill="#F2C894" />
        </g>
      ) : (
        <>
          <rect x="147" y="134" width="17" height="46" rx="8.5" fill="#1F2937" />
          <circle cx="156" cy="182" r="8" fill="#F2C894" />
        </>
      )}
      {/* left hand */}
      <circle cx="44" cy="182" r="8" fill="#F2C894" />

      {/* hoodie body */}
      <rect x="58" y="108" width="84" height="106" rx="24" fill="#1F2937" />
      {/* hood opening */}
      <ellipse cx="100" cy="124" rx="21" ry="9" fill="#111827" />
      {/* drawstrings */}
      <line x1="89" y1="132" x2="87" y2="158" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
      <line x1="111" y1="132" x2="113" y2="158" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="87" cy="160" r="3" fill="#9CA3AF" />
      <circle cx="113" cy="160" r="3" fill="#9CA3AF" />
      {/* pocket */}
      <rect x="73" y="170" width="54" height="32" rx="10" fill="#374151" />
      {/* U badge */}
      <circle cx="126" cy="152" r="11" fill="#10b981" />
      <text
        x="126"
        y="157"
        textAnchor="middle"
        fontFamily="Nunito, sans-serif"
        fontWeight={800}
        fontSize="13"
        fill="#ffffff"
      >
        U
      </text>

      {/* coffee cup in left hand */}
      <rect x="26" y="148" width="26" height="32" rx="5" fill="#ffffff" stroke="#E5E5E5" strokeWidth="1.5" />
      <rect x="26" y="159" width="26" height="10" fill="#10b981" />
      <rect x="23" y="141" width="32" height="9" rx="4.5" fill="#E5E5E5" />

      {/* box head */}
      <rect x="54" y="26" width="92" height="84" rx="12" fill="#E9B44C" />
      {/* side vent slits */}
      <line x1="131" y1="58" x2="131" y2="78" stroke="#B97F1F" strokeWidth="3" strokeLinecap="round" />
      <line x1="138" y1="58" x2="138" y2="78" stroke="#B97F1F" strokeWidth="3" strokeLinecap="round" />
      {/* bottom grille */}
      <rect x="66" y="94" width="28" height="8" rx="4" fill="#B97F1F" />
      {/* big U */}
      <text
        x="99"
        y="84"
        textAnchor="middle"
        fontFamily="Nunito, sans-serif"
        fontWeight={800}
        fontSize="46"
        fill="#047857"
      >
        U
      </text>
      <style>{`@keyframes mascot-wave{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}@keyframes mascot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@media(prefers-reduced-motion:reduce){g{animation:none !important}}`}</style>
    </svg>
  );
}
