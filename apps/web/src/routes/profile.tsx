import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Pencil, Shield, X } from 'lucide-react';
import BackButton from '../components/BackButton';
import { supabaseBrowser, clearRememberSession } from '../lib/supabase';
import { api, type Profile, type University } from '../lib/api';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import ErrorState from '../components/ErrorState';
import Flash from '../components/Flash';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const DEPARTMENTS = [
  'Electronic & Computer Engineering',
  'Mechanical Engineering',
  'Industrial & Petroleum Engineering',
  'Chemical & Polymer Engineering',
  'Civil Engineering',
  'Aerospace Engineering',
];
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
const TARGETS = [
  { label: 'First Class', val: 4.5 },
  { label: '2nd Class Upper', val: 3.5 },
  { label: '2nd Class Lower', val: 2.4 },
  { label: 'Pass', val: 1.5 },
];

export default function ProfileRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  // Inline edit (no onboarding detour): role + semester stay locked.
  const [editing, setEditing] = useState(false);
  const [unis, setUnis] = useState<University[]>([]);
  const [dName, setDName] = useState('');
  const [dUni, setDUni] = useState('');
  const [dFaculty, setDFaculty] = useState('');
  const [dDept, setDDept] = useState('');
  const [dLevel, setDLevel] = useState('');
  const [dTarget, setDTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

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
        setIsAdmin(!!me.isAdmin);
        const p = me.profile;
        setDName(p.first_name || '');
        setDUni(p.university || '');
        setDFaculty(p.faculty || '');
        setDDept(p.department || '');
        setDLevel(p.level || '');
        setDTarget(p.grad_target != null ? String(p.grad_target) : '');
        try {
          setUnis(await api.universities());
        } catch {
          // university dropdown falls back to the saved name
        }
      } catch {
        setError("Couldn't load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleEmailChange = async () => {
    setEmailMsg('');
    const client = supabaseBrowser();
    if (!client) {
      setEmailMsg('Something went wrong. Please reload and try again.');
      return;
    }
    const next = newEmail.trim().toLowerCase();
    if (!next || !next.includes('@')) {
      setEmailMsg('Enter a valid email address.');
      return;
    }
    try {
      const { error: err } = await client.auth.updateUser({ email: next });
      if (err) {
        setEmailMsg(err.message);
        return;
      }
      setEmailMsg(`Confirmation sent to ${next}. Tap the link there to finish.`);
      setNewEmail('');
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : 'Email change failed.');
    }
  };

  const handleLogout = async () => {
    const sb = supabaseBrowser();
    // Local scope: clear this tab/client only, never nuke another tab's
    // newer session (single-session policy kicks via broadcast instead).
    if (sb) await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    clearRememberSession();
    navigate('/auth');
  };

  const startEdit = () => {
    setSaveMsg('');
    setSaveError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!dName.trim()) {
      setSaveError('Enter your first name.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveMsg('');
    try {
      const payload: Record<string, unknown> = {
        firstName: dName.trim(),
        university: dUni || null,
        faculty: dFaculty || null,
        department: dDept || null,
      };
      const match = unis.find((u) => u.name === dUni);
      if (match && UUID_RE.test(match.id)) payload.universityId = match.id;
      const author = profile?.role === 'lecturer' || profile?.role === 'collaborator';
      if (!author) {
        if (dLevel) payload.level = dLevel;
        if (dTarget) payload.gradTarget = Number(dTarget);
      }
      const res = await api.updateMe(payload);
      setProfile(res.profile);
      setEditing(false);
      setSaveMsg('Profile updated.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Loading profile…" />;
  if (error)
    return <ErrorState title="Couldn't load your profile" message={error} />;

  const initial = (profile?.first_name || email).charAt(0).toUpperCase() || 'U';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—';
  const canAuthor = profile?.role === 'lecturer' || profile?.role === 'collaborator';
  const rows: [string, string][] = [
    ['Role', roleLabel],
    ['University', profile?.university || '—'],
    ['Faculty', profile?.faculty || '—'],
    ['Department', profile?.department || '—'],
  ];
  if (!canAuthor) {
    rows.push(['Level', profile?.level || '—']);
    rows.push(['Graduation target', profile?.grad_target != null ? String(profile.grad_target) : '—']);
  }

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

      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Change email</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" style={{ flex: 1, minWidth: 0, padding: 10, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14 }} />
          <button onClick={handleEmailChange} style={{ padding: '10px 16px', borderRadius: 10, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13 }}>
            Send
          </button>
        </div>
        {emailMsg && <div style={{ fontSize: 12, color: '#059669', marginTop: 6 }}>{emailMsg}</div>}
      </div>
      {isAdmin && (
        <Link to="/admin" style={{ marginBottom: 8, padding: 14, background: '#111827', color: '#fff', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} /> Admin panel
        </Link>
      )}
      {saveMsg && <Flash tone="success" message={saveMsg} onDismiss={() => setSaveMsg('')} />}
      {saveError && <Flash tone="error" message={saveError} onDismiss={() => setSaveError('')} />}

      {editing && (
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Edit profile</div>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            First name
            <input value={dName} onChange={(e) => setDName(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            University
            <select value={dUni} onChange={(e) => setDUni(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }}>
              <option value="">Select…</option>
              {!unis.some((u) => u.name === dUni) && dUni && <option value={dUni}>{dUni}</option>}
              {unis.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Faculty
            <select value={dFaculty} onChange={(e) => setDFaculty(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }}>
              <option value="">Select…</option>
              {!['Faculty of Engineering'].includes(dFaculty) && dFaculty && <option value={dFaculty}>{dFaculty}</option>}
              <option value="Faculty of Engineering">Faculty of Engineering</option>
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Department
            <select value={dDept} onChange={(e) => setDDept(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }}>
              <option value="">Select…</option>
              {!DEPARTMENTS.includes(dDept) && dDept && <option value={dDept}>{dDept}</option>}
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          {!canAuthor && (
            <>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Level
                <select value={dLevel} onChange={(e) => setDLevel(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }}>
                  <option value="">Select…</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Graduation target
                <select value={dTarget} onChange={(e) => setDTarget(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 14, display: 'block' }}>
                  <option value="">Select…</option>
                  {TARGETS.map((t) => (
                    <option key={t.val} value={String(t.val)}>{t.label} — {t.val}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div style={{ fontSize: 11, color: '#777' }}>Role and semester are locked — only admin can change those.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 12, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 12, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} /> Cancel
            </button>
            <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: 12, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 12, fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {!editing && (
          <button onClick={startEdit} style={{ flex: 1, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Pencil size={16} /> Edit profile
          </button>
        )}
        <button onClick={handleLogout} style={{ flex: 1, padding: 14, background: '#fff', color: '#991b1b', border: '1px solid #fecaca', borderBottom: '4px solid #fecaca', borderRadius: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={16} /> Log out
        </button>
      </div>
      {canAuthor && (
        <Link to="/studio" style={{ marginTop: 8, padding: 14, background: '#fff', color: '#059669', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          Open Authoring Studio
        </Link>
      )}
    </div>
  );
}
