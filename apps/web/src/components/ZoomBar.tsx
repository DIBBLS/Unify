import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { useFocusMode, setFocusMode } from '../lib/focus';

// Floating reader controls, bottom-right.
//  - Focus (reader only, every device): hides the top bar + bottom tabs.
//  - Zoom (desktop only): scales ONLY the content column — the top bar and
//    bottom nav keep their normal size. Steps of 10, clamped 70–150,
//    persisted per device.
const ZOOM_KEY = 'unify.zoom.v1';
const CONTENT_ID = 'unify-content';
const MIN = 70;
const MAX = 150;
const STEP = 10;

export default function ZoomBar() {
  const { pathname } = useLocation();
  const reader = /^\/learn\/[^/]+\/week\/\d+/.test(pathname);
  const focus = useFocusMode();
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 640 : false));
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [z, setZ] = useState(() => {
    try {
      const v = Number(localStorage.getItem(ZOOM_KEY));
      return Number.isFinite(v) && v >= MIN && v <= MAX ? v : 100;
    } catch {
      return 100;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, String(z));
    } catch {
      // private mode — zoom just won't persist
    }
    // Content column only: header + bottom nav stay their normal size.
    const el = document.getElementById(CONTENT_ID);
    if (!el) return;
    el.style.zoom = z === 100 ? '' : String(z / 100);
  }, [z, pathname]);

  // Mobile: no zoom — the reader's Focus toggle is the only control.
  if (mobile && !reader) return null;

  const btn: React.CSSProperties = {
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'var(--green-deep)',
    cursor: 'pointer',
    borderRadius: 8,
    padding: 0,
  };
  return (
    <div
      role="group"
      aria-label="Reader controls"
      style={{
        position: 'fixed',
        right: 16,
        bottom: focus ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 'calc(76px + env(safe-area-inset-bottom, 0px))',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 9999,
        padding: '3px 6px',
        boxShadow: 'var(--shadow)',
        fontSize: 12,
        fontWeight: 800,
        color: 'var(--text2)',
      }}
    >
      {reader && (
        <button
          type="button"
          onClick={() => setFocusMode(!focus)}
          aria-pressed={focus}
          title={focus ? 'Exit focus mode' : 'Focus mode — hide the bars while reading'}
          style={{
            width: 'auto',
            height: 26,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 8px',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 800,
            background: focus ? '#ecfdf5' : 'transparent',
            color: focus ? '#059669' : 'var(--text2)',
          }}
        >
          {focus ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {focus ? 'Exit' : 'Focus'}
        </button>
      )}
      {reader && !mobile && <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px' }} />}
      {!mobile && (
        <>
          <button
            type="button"
            style={{ ...btn, opacity: z <= MIN ? 0.35 : 1 }}
            onClick={() => setZ((v) => Math.max(MIN, v - STEP))}
            disabled={z <= MIN}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZ(100)}
            title="Reset zoom to 100%"
            aria-label="Zoom level, click to reset to 100 percent"
            style={{ ...btn, width: 'auto', minWidth: 40, fontSize: 12, fontWeight: 800, color: 'var(--text)' }}
          >
            {z}%
          </button>
          <button
            type="button"
            style={{ ...btn, opacity: z >= MAX ? 0.35 : 1 }}
            onClick={() => setZ((v) => Math.min(MAX, v + STEP))}
            disabled={z >= MAX}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={14} />
          </button>
        </>
      )}
    </div>
  );
}
