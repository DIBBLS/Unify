import { useEffect, useRef } from 'react';

// Single error/success/info style for the whole app.
// ttl (ms) auto-dismisses; ttl={0} stays until unmounted. `action` renders
// below the message (e.g. a Retry button on persistent errors).
const TONES = {
  error: { background: 'var(--u-bad-tint)', border: '1px solid var(--u-red)', color: 'var(--u-red)' },
  success: { background: 'var(--u-good-tint)', border: '1px solid var(--u-good)', color: 'var(--u-good)' },
  info: { background: '#fff7ed', border: '1px solid #fed7aa', color: 'var(--u-warn-ink)' },
} as const;

export default function Flash({
  tone,
  message,
  ttl = 6000,
  onDismiss,
  action,
}: {
  tone: keyof typeof TONES;
  message: string;
  ttl?: number;
  onDismiss?: () => void;
  action?: React.ReactNode;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!ttl) return;
    const t = setTimeout(() => dismissRef.current?.(), ttl);
    return () => clearTimeout(t);
  }, [ttl, message]);

  const s = TONES[tone];
  return (
    <div
      role="alert"
      className="flash"
      style={{
        background: s.background,
        border: s.border,
        borderRadius: 12,
        padding: 10,
        color: s.color,
        fontSize: 13,
        marginBottom: 12,
      }}
    >
      {message}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

