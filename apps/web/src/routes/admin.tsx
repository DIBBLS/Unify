import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type AdminUser } from '../lib/api';
import Loading from '../components/Loading';
import Flash from '../components/Flash';
import BackButton from '../components/BackButton';

type Stats = { users: number; byRole: Record<string, number>; weeks: number; xpTotal: number };

export default function AdminRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = async (query = q, role = roleFilter) => {
    try {
      const [s, u] = await Promise.all([api.adminStats(), api.adminUsers(query, role)]);
      setStats(s);
      setUsers(u.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed.');
    }
  };

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
      try {
        const me = await api.me();
        if (!me.isAdmin) {
          navigate('/dashboard');
          return;
        }
        await load();
      } catch {
        setError("Couldn't load admin data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const changeRole = async (id: string, role: string) => {
    setError('');
    try {
      await api.adminPatchUser(id, { role });
      setSuccess('Role updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const removeUser = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name || 'this user'} from Unify Learn? This cannot be undone.`)) return;
    setError('');
    try {
      await api.adminDeleteUser(id);
      setSuccess('User removed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  if (loading) return <Loading text="Loading admin…" />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Shield size={22} color="#059669" /> Admin
      </h1>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}

      {stats && (
        <div style={{ margin: '16px 0', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.users}</div>
            <div style={{ fontSize: 11, color: '#777' }}>Users</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.weeks}</div>
            <div style={{ fontSize: 11, color: '#777' }}>Weeks</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.xpTotal}</div>
            <div style={{ fontSize: 11, color: '#777' }}>XP</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.byRole.lecturer || 0}</div>
            <div style={{ fontSize: 11, color: '#777' }}>Authors</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ flex: 1, minWidth: 140, padding: 10, border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 14 }} />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); void load(q, e.target.value); }} style={{ padding: 10, border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 14 }}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="lecturer">Lecturers</option>
          <option value="collaborator">Collaborators</option>
        </select>
        <button onClick={() => load()} style={{ padding: '10px 18px', borderRadius: 12, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800 }}>Search</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.length === 0 && <div style={{ color: '#777', fontSize: 13, textAlign: 'center', padding: 20 }}>No users found.</div>}
        {users.map((u) => (
          <div key={u.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.first_name || 'Unnamed'}{u.is_admin ? ' · Admin' : ''}</div>
                <div style={{ fontSize: 12, color: '#777' }}>{[u.university, u.department].filter(Boolean).join(' · ') || 'No profile details'}</div>
              </div>
              <button onClick={() => removeUser(u.id, u.first_name || '')} aria-label="Remove user" style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', padding: 8, display: 'flex' }}>
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {(['student', 'lecturer', 'collaborator'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => changeRole(u.id, r)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 9999,
                    border: `1px solid ${u.role === r ? '#059669' : '#e5e5e5'}`,
                    background: u.role === r ? '#10b981' : '#fff',
                    color: u.role === r ? '#fff' : '#777',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
