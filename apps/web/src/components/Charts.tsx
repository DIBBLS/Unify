import { useEffect, useRef, useState } from 'react';

// Dependency-free SVG charts for the admin panels. Drawn in real pixels (not a
// stretched viewBox) so bars and lines keep a readable thickness at any width:
// bars are never thinner than 3px or thicker than 26px, long series are merged
// into buckets that fit the width, and the line has a steady 2px stroke.
// Theme-aware via CSS vars; hover or touch a chart to read an exact value.

export type Bar = { label: string; value: number };

const GREEN = '#16a34a';
const TRACK = 'var(--border)';

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Merge a long series into at most `max` buckets: counts add up, latencies keep their peak.
function fit(data: Bar[], max: number, agg: 'sum' | 'max'): Bar[] {
  if (data.length <= max) return data;
  const size = Math.ceil(data.length / max);
  const out: Bar[] = [];
  for (let i = 0; i < data.length; i += size) {
    const part = data.slice(i, i + size);
    const value = agg === 'sum' ? part.reduce((s, d) => s + d.value, 0) : Math.max(...part.map((d) => d.value));
    out.push({ label: size > 1 ? `${part[0].label} to ${part[part.length - 1].label}` : part[0].label, value });
  }
  return out;
}

const niceMax = (v: number): number => {
  if (v <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

function Axis({ data, max, hover }: { data: Bar[]; max: number; hover: number | null }) {
  const h = hover !== null ? data[hover] : null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text3)', marginTop: 4, minHeight: 16 }}>
      {h ? (
        <span style={{ color: 'var(--text)', fontWeight: 800 }}>{h.label}: {h.value.toLocaleString()}</span>
      ) : (
        <>
          <span>{data[0]?.label || ''}</span>
          <span>peak {max.toLocaleString()}</span>
          <span>{data[data.length - 1]?.label || ''}</span>
        </>
      )}
    </div>
  );
}

export function Bars({ data, height = 120, agg = 'sum' }: { data: Bar[]; height?: number; agg?: 'sum' | 'max' }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 6, b: 2 };
  const maxBars = Math.max(8, Math.floor(w / 5)); // at least 5px per slot
  const pts = fit(data, maxBars, agg);
  const n = Math.max(1, pts.length);
  const slot = w / n;
  const gap = slot >= 8 ? 2 : slot >= 5 ? 1.5 : 1;
  const bw = Math.min(26, Math.max(3, slot - gap));
  const peak = Math.max(...pts.map((d) => d.value), 0);
  const top = niceMax(peak);
  const H = height - pad.t - pad.b;
  const locate = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n))));
  };
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Bar chart" style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => locate(e.clientX)} onPointerDown={(e) => locate(e.clientX)} onPointerLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={w} y1={pad.t + H * (1 - f)} y2={pad.t + H * (1 - f)} stroke={TRACK} strokeDasharray={f === 1 ? undefined : '3 4'} strokeWidth={1} opacity={0.7} />
        ))}
        {pts.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / top) * H) : 2;
          const x = i * slot + (slot - bw) / 2;
          return <rect key={i} x={x} y={pad.t + H - h} width={bw} height={h} rx={Math.min(3, bw / 2)} fill={d.value > 0 ? GREEN : TRACK} opacity={hover === null || hover === i ? (d.value > 0 ? 1 : 0.7) : 0.45} />;
        })}
      </svg>
      <Axis data={pts} max={peak} hover={hover} />
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

export function Spark({ data, height = 44, agg = 'max' }: { data: Bar[]; height?: number; agg?: 'sum' | 'max' }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pts = fit(data, Math.max(8, Math.floor(w / 4)), agg);
  const n = pts.length;
  const peak = Math.max(...pts.map((d) => d.value), 0);
  const top = niceMax(peak);
  const padX = 4;
  const padY = 6;
  const H = height - padY * 2;
  const xAt = (i: number) => (n === 1 ? w / 2 : padX + (i / (n - 1)) * (w - padX * 2));
  const yAt = (v: number) => padY + H - (v / top) * H;
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(d.value).toFixed(1)}`).join(' ');
  const area = n > 1 ? `${line} L${xAt(n - 1).toFixed(1)},${padY + H} L${xAt(0).toFixed(1)},${padY + H} Z` : '';
  const id = useRef('g' + Math.random().toString(36).slice(2, 7)).current;
  const locate = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n < 1) return;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left - padX) / Math.max(1, r.width - padX * 2)) * (n - 1)))));
  };
  const last = n ? pts[n - 1] : null;
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Line chart" style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => locate(e.clientX)} onPointerDown={(e) => locate(e.clientX)} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <line x1={0} x2={w} y1={padY + H} y2={padY + H} stroke={TRACK} strokeWidth={1} />
        <line x1={0} x2={w} y1={padY + H / 2} y2={padY + H / 2} stroke={TRACK} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
        {area && <path d={area} fill={`url(#${id})`} />}
        {n > 1 ? <path d={line} fill="none" stroke={GREEN} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" /> : n === 1 && <circle cx={xAt(0)} cy={yAt(pts[0].value)} r={3.5} fill={GREEN} />}
        {hover !== null && (
          <>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padY} y2={padY + H} stroke="var(--text3)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={xAt(hover)} cy={yAt(pts[hover].value)} r={4} fill="var(--surface)" stroke={GREEN} strokeWidth={2.25} />
          </>
        )}
        {hover === null && last && n > 1 && <circle cx={xAt(n - 1)} cy={yAt(last.value)} r={3.5} fill={GREEN} />}
      </svg>
      <Axis data={pts} max={peak} hover={hover} />
    </div>
  );
}
