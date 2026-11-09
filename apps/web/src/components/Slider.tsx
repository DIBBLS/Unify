// Custom slider: a yellow filled track and a round thumb with the same "pressed edge" depth
// as the app's buttons, instead of the browser's native control. It is still a real
// <input type="range">, so keyboard, touch and screen readers work exactly as normal.
export default function Slider({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <input
      className="u-range"
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ '--p': `${pct}%` } as React.CSSProperties}
    />
  );
}
