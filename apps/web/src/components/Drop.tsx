import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Brand dropdown that opens INLINE (expands in its own section, pushing
// content down) instead of the OS fullscreen picker. Same button look as
// the .brand-select rule so mixed screens stay uniform.
export default function Drop({
  value,
  options,
  onChange,
  label,
  style,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  label: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div style={{ minWidth: 0, ...style }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        style={{
          width: '100%',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {current ? current.label : label}
        </span>
        <ChevronDown size={14} color="#059669" style={{ transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: 6 }}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: active ? '#ecfdf5' : 'transparent',
                    color: active ? '#059669' : 'var(--text)',
                    fontSize: 13,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            {options.length === 0 && (
              <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text3)' }}>No options.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
