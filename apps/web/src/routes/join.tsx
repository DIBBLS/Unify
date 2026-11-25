import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setJoinIntent } from '../lib/joinIntent';
import Loading from '../components/Loading';

// Review 4: /join, /join/lecturer and /join/contributor. Each remembers who is
// joining and opens the one sign-in page on its Sign up tab.
export default function JoinRoute() {
  const { role } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const r = role === 'lecturer' || role === 'contributor' ? role : null;
    setJoinIntent(r);
    navigate(`/auth?tab=signup${r ? `&join=${r}` : ''}`, { replace: true });
  }, [role, navigate]);
  return <Loading text="Opening sign up…" />;
}
