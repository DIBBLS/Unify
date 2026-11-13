import { useEffect, useRef, useState } from 'react';
import { BoxBoy } from './redesign/brand';

// The one consistent full-page error state: connection failures, dead API,
// anything that leaves a route with nothing to show.
// Offline-aware: while offline it says so (saved notes stay readable via
// the OfflineBanner + cached content) and retries automatically the moment
// the browser reports coming back online.
export default function ErrorState({
  title = "Something didn't load",
  message,
  onRetry,
  retryLabel = 'Retry',
  action,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
}) {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const wasOffline = useRef(typeof navigator !== 'undefined' && !navigator.onLine);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  useEffect(() => {
    const go = () => {
      const on = navigator.onLine;
      setOnline(on);
      if (on && wasOffline.current) {
        wasOffline.current = false;
        if (retryRef.current) retryRef.current();
        else window.location.reload();
      }
    };
    const markOff = () => setOnline(false);
    window.addEventListener('online', go);
    window.addEventListener('offline', markOff);
    return () => {
      window.removeEventListener('online', go);
      window.removeEventListener('offline', markOff);
    };
  }, []);
  const retry = () => {
    if (onRetry) onRetry();
    else window.location.reload();
  };
  const showOffline = !online;
  return (
    <div style={{ padding: 40, maxWidth: 'var(--shell, 480px)', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <BoxBoy pose="wavePhone" width={88} />
      </div>
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20 }}>
        {showOffline ? "You're offline" : title}
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>
        {showOffline
          ? 'Check your connection — your saved notes stay readable.'
          : message}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={retry} style={{ padding: '12px 28px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', fontWeight: 800, fontSize: 14 }}>
          {retryLabel}
        </button>
        {action}
      </div>
      {/* Not a connection problem? Let them tell us, with this screen and the error filled in. */}
      {!showOffline && (
        <a
          href={`/report-bug?from=${encodeURIComponent(window.location.pathname)}&what=${encodeURIComponent(`${title}: ${message}`)}`}
          style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 700, color: 'var(--u-good)' }}
        >
          Keeps happening? Report this problem
        </a>
      )}
    </div>
  );
}

