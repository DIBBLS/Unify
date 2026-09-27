import { AlertTriangle, LogOut, BellRing } from 'lucide-react';
import Mascot from './Mascot';

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
  body: string;
  confirmLabel?: string;
  tone?: 'danger' | 'go';
  busy?: boolean;
  icon?: 'auto' | 'bell' | 'mascot';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const showMascot = icon === 'mascot' || (icon === 'auto' && tone === 'go');
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
            <span style={{ width: 52, height: 52, borderRadius: 9999, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BellRing size={24} />
            </span>
          ) : showMascot ? (
            <Mascot size={72} />
          ) : (
            <span style={{ width: 52, height: 52, borderRadius: 9999, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
