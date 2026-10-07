import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { subscribeToasts } from '../lib/toast';

// Fixed bottom-center error stack, above the nav. One host in the layout;
// routes push via toastError(). Auto-dismisses in 6s, tap X to kill now.
export default function Toasts() {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (!items.length) return null;
  return (
    <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(76px + env(safe-area-inset-bottom))', width: 'min(440px, calc(100vw - 32px))', zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((t) => (
        <div key={t.id} role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#111827', color: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,.35)', animation: 'rise-in .2s ease' }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#f87171', flexShrink: 0, marginTop: 5 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{t.message}</span>
          <button
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Dismiss error"
            style={{ background: 'none', border: 'none', color: '#9ca3af', display: 'flex', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
