import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { goBack, leaveTo } from '../lib/navHistory';

// Back steps back to the actual previous in-app screen (navHistory) and
// falls back to the explicit hub for deep links with no history.
// fixed: always go to `to` (games → Practice), not wherever you came from.
export default function BackButton({ to, label = 'Back', fixed }: { to: string; label?: string; fixed?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (fixed ? leaveTo(navigate, to) : goBack(navigate, to))}
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

