import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Pencil } from 'lucide-react';
import BackButton from '../components/BackButton';
import { supabaseBrowser } from '../lib/supabase';
import { api, getApiUrl, type Profile } from '../lib/api';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';

export default function ProfileRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        navigate('/auth');
        return;
      }
      setEmail(sessionData.session.user.email || '');
      try {
        const me = await api.me();
        if (!me.onboarded || !me.profile) {
          navigate('/onboarding');
          return;
        }
        setProfile(me.profile);
      } catch {
        setError("Couldn't load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut().catch(() => {});
    navigate('/auth');
  };

  if (loading) return <Loading text="Loading profile…" />;
  if (error)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 40 }}>
        <Flash
          tone="error"
          message={error}
          ttl={0}
          action={
            <button onClick={() => window.location.reload()} style={{ padding: '8px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13 }}>
              Retry
            </button>
          }
        />
      </div>
    );

  const initial = (profile?.first_name || email).charAt(0).toUpperCase() || 'U';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—';
  const canAuthor = profile?.role === 'lecturer' || profile?.role === 'collaborator';
  const rows: [string, string][] = [
    ['Role', roleLabel],
    ['University', profile?.university || '—'],
    ['Faculty', profile?.faculty || '—'],
    ['Department', profile?.department || '—'],
    ['Level', profile?.level || '—'],
    ['Graduation target', profile?.grad_target != null ? String(profile.grad_target) : '—'],
  ];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>
          {initial}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22 }}>{profile?.first_name || 'Builder'}</h1>
          <div style={{ fontSize: 13, color: '#777' }}>{email}</div>
        </div>
        <Mascot size={64} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>
            <span style={{ fontSize: 13, color: '#777' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Link to="/onboarding?edit=1" style={{ flex: 1, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Pencil size={16} /> Edit profile
        </Link>
        <button onClick={handleLogout} style={{ flex: 1, padding: 14, background: '#fff', color: '#991b1b', border: '1px solid #fecaca', borderBottom: '4px solid #fecaca', borderRadius: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={16} /> Log out
        </button>
      </div>
      {getApiUrl() && canAuthor && (
        <a href={getApiUrl() as string} target="_blank" rel="noreferrer" style={{ marginTop: 8, padding: 14, background: '#fff', color: '#059669', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          Open Authoring Studio
        </a>
      )}
    </div>
  );
}
