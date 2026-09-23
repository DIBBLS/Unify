import { useEffect, useState } from 'react';
import Flash from './Flash';

// Persistent while offline (no TTL): saved notes stay readable,
// new actions need a connection.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const go = () => setOnline(navigator.onLine);
    window.addEventListener('online', go);
    window.addEventListener('offline', go);
    return () => {
      window.removeEventListener('online', go);
      window.removeEventListener('offline', go);
    };
  }, []);

  if (online) return null;
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px 0' }}>
      <Flash
        tone="info"
        ttl={0}
        message="You're offline — saved notes stay readable. New actions need connection."
      />
    </div>
  );
}
