import { AlertTriangle, LogOut } from 'lucide-react';
import Mascot from './Mascot';

// Designed confirm sheet (bottom sheet on mobile) — the app-wide
// replacement for browser window.confirm popups.
export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: 'danger' | 'go';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
          {tone === 'danger' ? (
            <span style={{ width: 52, height: 52, borderRadius: 9999, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={24} />
            </span>
          ) : (
            <Mascot size={72} />
          )}
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>{title}</div>
        <div className="modal-body" style={{ textAlign: 'center' }}>{body}</div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={tone === 'danger' ? 'modal-danger' : 'modal-go'}
            onClick={onConfirm}
            disabled={busy}
            style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
          >
            {tone === 'go' && <LogOut size={16} />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
