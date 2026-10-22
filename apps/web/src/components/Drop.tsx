import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Brand dropdown that opens as a FLOATING OVERLAY above the page —
// the panel never pushes content around or expands the frame it lives in.
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
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setUp(window.innerHeight - r.bottom < 240);
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 0, ...style }}>
      <button
        type="button"
        onClick={toggle}
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
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            [up ? 'bottom' : 'top']: 'calc(100% + 8px)',
            zIndex: 130,
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--surface)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
          } as React.CSSProperties}
        >
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, padding: 5 }}>
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
                    padding: '10px 14px',
                    lineHeight: 1.4,
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
