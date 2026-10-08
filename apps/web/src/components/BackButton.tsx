import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { previousPath } from '../lib/navHistory';

// Back remembers the actual previous in-app screen (previousPath) and
// falls back to the explicit hub for deep links with no history.
export default function BackButton({ to, label = 'Back' }: { to: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(previousPath() || to)}
      style={{
        marginBottom: 16,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        background: 'none',
        border: 'none',
        color: 'var(--text2)',
        fontSize: 14,
        padding: 0,
      }}
    >
      <ChevronLeft size={18} /> {label}
    </button>
  );
}
