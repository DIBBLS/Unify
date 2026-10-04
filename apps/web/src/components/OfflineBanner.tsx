import { useEffect, useState } from 'react';
import Flash from './Flash';
import { pendingCount } from '../lib/offline';

// Persistent while offline (no TTL): saved notes stay readable,
// new actions need a connection. Banked writes (progress, quiz results)
// show their count and flush on reconnect.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const go = () => {
      setOnline(navigator.onLine);
      setPending(pendingCount());
    };
    const onQ = () => setPending(pendingCount());
    go();
    window.addEventListener('online', go);
    window.addEventListener('offline', go);
    window.addEventListener('unify-queue', onQ as EventListener);
    return () => {
      window.removeEventListener('online', go);
      window.removeEventListener('offline', go);
      window.removeEventListener('unify-queue', onQ as EventListener);
    };
  }, []);

  if (online) return null;
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '12px 16px 0' }}>
      <Flash
        tone="info"
        ttl={0}
        message={
          pending > 0
            ? `You're offline — saved notes stay readable. ${pending} action${pending === 1 ? '' : 's'} banked, syncs on reconnect.`
            : "You're offline — saved notes stay readable. New actions need connection."
        }
      />
    </div>
  );
}
