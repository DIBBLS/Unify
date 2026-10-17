import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

// Word-style view zoom, bottom-right. Balanced (100%) by default; the
// choice persists per device. CSS zoom on <html> scales the whole app
// (including fixed nav and modals) without breaking layout like transform
// scale would. Steps of 10, clamped 70–150.
const ZOOM_KEY = 'unify.zoom.v1';
const MIN = 70;
const MAX = 150;
const STEP = 10;

export default function ZoomBar() {
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
    // '' at 100% so the document stays at its natural zoom (no compounding).
    document.documentElement.style.zoom = z === 100 ? '' : String(z / 100);
  }, [z]);

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
      aria-label="Zoom level"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
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
    </div>
  );
}
