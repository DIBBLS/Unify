import type { CSSProperties, ReactNode } from 'react';
import { Check } from 'lucide-react';

type Div = { children?: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void };

/* ---------- Text ---------- */
export function Display({ children, size = 40, color, style, className = '' }: Div & { size?: number; color?: string }) {
  return <h1 className={`display ${className}`} style={{ fontSize: size, color, ...style }}>{children}</h1>;
}

export function Label({ children, style }: Div) {
  return <div className="label" style={style}>{children}</div>;
}

/* ---------- Buttons ---------- */
type BtnVariant = 'amber' | 'dark' | 'green' | 'white' | 'outline' | 'danger' | 'ghost-dark';
export function Button({ children, variant = 'amber', block = true, small, onClick, style, disabled }: {
  children: ReactNode; variant?: BtnVariant; block?: boolean; small?: boolean; onClick?: () => void; style?: CSSProperties; disabled?: boolean;
}) {
  return (
    <button
      className={`btn btn--${variant}${block ? ' btn--block' : ''}${small ? ' btn--sm' : ''}`}
      onClick={onClick}
      style={{ opacity: disabled ? 0.45 : 1, ...style }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ children, tone = 'light', pad = 18, gap = 12, style, className = '', onClick }: Div & {
  tone?: 'light' | 'dark' | 'green' | 'tint'; pad?: number | string; gap?: number;
}) {
  return (
    <div
      className={`card card--${tone} stack ${className}`}
      style={{ padding: pad, gap, cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** A card whose children are rows separated by hairlines. */
export function ListCard({ children, style }: Div) {
  return <div className="card list stagger" style={{ overflow: 'hidden', ...style }}>{children}</div>;
}

export function ListRow({ title, sub, leading, right, onClick, titleStyle }: {
  title: ReactNode; sub?: ReactNode; leading?: ReactNode; right?: ReactNode; onClick?: () => void; titleStyle?: CSSProperties;
}) {
  return (
    <div className="row" style={{ gap: 12, padding: '13px 16px', cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      {leading}
      <div className="grow stack" style={{ gap: 2 }}>
        <div className="t-15 w-6" style={titleStyle}>{title}</div>
        {sub && <div className="t-13 muted">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Chips & pills ---------- */
export function Chip({ children, on, off, small, onClick }: { children: ReactNode; on?: boolean; off?: boolean; small?: boolean; onClick?: () => void }) {
  return (
    <button className={`chip${on ? ' chip--on' : ''}${off ? ' chip--off' : ''}${small ? ' chip--sm' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'grey', style }: { children: ReactNode; tone?: 'good' | 'amber' | 'warn' | 'bad' | 'grey' | 'dark'; style?: CSSProperties }) {
  return <span className={`pill pill--${tone}`} style={style}>{children}</span>;
}

export function Chips({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <div className="row wrap" style={{ gap }}>{children}</div>;
}

/* ---------- Controls ---------- */
export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      style={{ width: 46, height: 28, borderRadius: 14, background: on ? 'var(--u-green)' : '#d6d4ce', position: 'relative', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: on ? 'var(--u-black)' : '#fff', transition: 'left .15s' }} />
    </button>
  );
}

/** Segmented control: one of several options, e.g. Week | Day. */
export function Segmented<T extends string>({ options, value, onChange, dark }: {
  /** Plain strings, or {value, label} when the label differs from the value. */
  options: readonly (T | { value: T; label: ReactNode })[]; value: T; onChange?: (v: T) => void; dark?: boolean;
}) {
  return (
    <div className="row" style={{ background: 'var(--u-card-2)', border: '1px solid var(--u-border)', borderRadius: 22, padding: 4, gap: 4 }}>
      {options.map((raw) => {
        const o = typeof raw === 'string' ? { value: raw as T, label: raw as ReactNode } : raw;
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange?.(o.value)}
            className="t-14 w-6"
            style={{
              flex: 1, padding: '7px 16px', borderRadius: 18,
              background: on ? (dark ? 'var(--u-black)' : '#fff') : 'transparent',
              color: on ? (dark ? '#fff' : 'var(--u-black)') : 'var(--u-text-2)',
              boxShadow: on && !dark ? '0 1px 2px rgba(0,0,0,.08)' : undefined,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{ width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', flexShrink: 0, background: checked ? 'var(--u-black)' : '#fff', border: checked ? 0 : '1.5px solid var(--u-border)' }}>
      {checked && <Check size={15} color="#50ff90" strokeWidth={3} />}
    </span>
  );
}

export function Field({ label, value, type = 'text', hint, placeholder, select }: {
  label: string; value?: string; type?: string; hint?: string; placeholder?: string; select?: boolean;
}) {
  return (
    <label className="stack" style={{ gap: 0 }}>
      <span className="field-label">{label}</span>
      {select ? (
        <select className="input" defaultValue={value} style={{ appearance: 'none', backgroundImage: 'linear-gradient(45deg,transparent 50%,#0a0a0a 50%),linear-gradient(135deg,#0a0a0a 50%,transparent 50%)', backgroundPosition: 'calc(100% - 22px) 24px, calc(100% - 16px) 24px', backgroundSize: '6px 6px', backgroundRepeat: 'no-repeat' }}>
          <option>{value}</option>
        </select>
      ) : (
        <input className="input" type={type} defaultValue={value} placeholder={placeholder} />
      )}
      {hint && <span className="t-12 faint" style={{ marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

/** Small dots that show onboarding progress. */
export function ProgressDots({ step, total = 3, color = 'var(--u-black)' }: { step: number; total?: number; color?: string }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ width: i + 1 === step ? 18 : 6, height: 6, borderRadius: 3, background: color }} />
      ))}
    </div>
  );
}

/** Thin bars for multi-step flows (CGPA planner). */
export function StepBars({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ width: 40, height: 5, borderRadius: 3, background: i < step ? 'var(--u-black)' : '#dddbd5' }} />
      ))}
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--u-green)', track = '#e8e6e0', height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: track, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', background: color, borderRadius: height, transition: 'width var(--dur-4) var(--ease-out)' }} />
    </div>
  );
}

/** Coloured info banner, e.g. "Online today", "Cancelled". */
export function Banner({ tone = 'good', title, children, icon }: { tone?: 'good' | 'bad' | 'warn' | 'amber'; title: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const bg = { good: 'var(--u-good-tint)', bad: 'var(--u-bad-tint)', warn: 'var(--u-warn-tint)', amber: 'var(--u-amber)' }[tone];
  const ink = { good: 'var(--u-good-ink)', bad: 'var(--u-red)', warn: 'var(--u-warn-ink)', amber: 'var(--u-black)' }[tone];
  const head = tone === 'bad' ? 'var(--u-red)' : 'var(--u-black)';
  return (
    <div className="stack" style={{ background: bg, borderRadius: 20, padding: 16, gap: 6 }}>
      <div className="row t-16 w-7" style={{ gap: 6, color: head }}>{icon}{title}</div>
      {children && <div className="t-13" style={{ color: ink, lineHeight: 1.45 }}>{children}</div>}
    </div>
  );
}

export function Spacer({ h = 8 }: { h?: number }) {
  return <div style={{ height: h, flexShrink: 0 }} />;
}

