// Tiny dependency-free SVG charts for the admin analytics module.
// Theme-aware via currentColor/CSS vars; greens work in both themes.

export type Bar = { label: string; value: number };

const GREEN = '#16a34a';
const GREEN_SOFT = 'rgba(74,222,128,.35)';
const TRACK = 'var(--border)';

export function Bars({ data, height = 120 }: { data: Bar[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const gap = 4;
  const w = 100 / n;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {data.map((d, i) => {
          const h = Math.max(1.5, (d.value / max) * (height / 4 - 4));
          return (
            <rect
              key={i}
              x={i * w + gap / 4}
              y={height / 4 - h}
              width={Math.max(0.5, w - gap / 2)}
              height={h}
              rx={1}
              fill={d.value > 0 ? GREEN : TRACK}
              opacity={d.value > 0 ? 1 : 0.6}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
        <span>{data[0]?.label || ''}</span>
        <span>max {max}</span>
        <span>{data[data.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
}

export function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  let acc = 0;
  const R = 15.9155; // circumference 100
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <svg viewBox="0 0 42 42" style={{ width: 96, height: 96, flexShrink: 0 }}>
        <circle cx={21} cy={21} r={R} fill="none" strokeWidth={7} stroke={TRACK} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={i}
              cx={21}
              cy={21}
              r={R}
              fill="none"
              strokeWidth={7}
              stroke={s.color}
              strokeDasharray={`${frac * 100} ${100 - frac * 100}`}
              strokeDashoffset={25 - acc * 100}
              strokeLinecap="butt"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          acc += frac;
          return el;
        })}
        <text x={21} y={21} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={800} fill="var(--text)">
          {total}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.label} · <strong style={{ color: 'var(--text)' }}>{s.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Spark({ data, height = 44 }: { data: Bar[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
    const y = height / 4 - 1 - (d.value / max) * (height / 4 - 3);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={GREEN} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
        const y = height / 4 - 1 - (d.value / max) * (height / 4 - 3);
        return (
          <circle key={i} cx={x} cy={y} r={1.1} fill={GREEN_SOFT} stroke={GREEN} strokeWidth={0.4}>
            <title>{`${d.label}: ${d.value}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
