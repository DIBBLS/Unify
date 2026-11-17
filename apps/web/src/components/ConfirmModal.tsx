import type { ReactNode } from 'react';
import { AlertTriangle, LogOut, BellRing } from 'lucide-react';
import { BoxBoy } from './redesign/brand';

// Designed confirm sheet (bottom sheet on mobile) — the app-wide
// replacement for browser window.confirm popups.
export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  icon = 'auto',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'go';
  busy?: boolean;
  icon?: 'auto' | 'bell';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const showBell = icon === 'bell';
  return (
    <div
      className="modal-veil"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {showBell ? (
            <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--u-good-tint)', border: '1px solid var(--u-good-tint)', color: 'var(--u-good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BellRing size={24} />
            </span>
          ) : (
            <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--u-bad-tint)', border: '1px solid #fecaca', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={24} />
            </span>
          )}
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>{title}</div>
        <div className="modal-body" style={{ textAlign: 'center' }}>{body}</div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'modal-danger' : 'modal-go'}
            onClick={onConfirm}
            disabled={busy}
            style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
          >
            {tone === 'go' && (showBell ? <BellRing size={16} /> : <LogOut size={16} />)}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

