import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Mascot from './Mascot';

const QUOTES = [
  'Small steps every day build engineers.',
  'Built for the ones who build.',
  'Your future self is watching. Keep going.',
  'One topic at a time. Own your journey.',
  'Consistency beats intensity.',
  'Great engineers are made, one week at a time.',
];

export default function Loading({ text = 'Loading…' }: { text?: string }) {
  const [qi, setQi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQi((i) => (i + 1) % QUOTES.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text2)', textAlign: 'center' }}>
      <div style={{ animation: 'mascot-fly 5s ease-in-out infinite' }}>
        <Mascot size={110} animate="float" />
      </div>
      <div key={qi} className="flash" style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 15, color: 'var(--text)', fontStyle: 'italic', maxWidth: 300 }}>
        &ldquo;{QUOTES[qi]}&rdquo;
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: '#10b981' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{text}</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes mascot-fly{0%,100%{transform:translate(0,0)}25%{transform:translate(10px,-10px)}50%{transform:translate(0,-16px)}75%{transform:translate(-10px,-8px)}}`}</style>
    </div>
  );
}
