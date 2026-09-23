import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Explicit back destination (deep links have no history to go back to).
export default function BackButton({ to, label = 'Back' }: { to: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        marginBottom: 16,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        background: 'none',
        border: 'none',
        color: '#777',
        fontSize: 14,
        padding: 0,
      }}
    >
      <ChevronLeft size={18} /> {label}
    </button>
  );
}
