import { Loader2 } from 'lucide-react';

export default function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#777' }}>
      <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: '#58cc02' }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{text}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
