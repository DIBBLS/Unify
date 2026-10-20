import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Pencil, Shield, X, Sun, Moon, MessageCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import Drop from '../components/Drop';
import { useTheme } from '../hooks/useTheme';
import { useDesign } from '../hooks/useDesign';
import { APP_VERSION } from '../lib/version';
import Wordmark from '../components/Wordmark';
import { pushSupported, pushState, enablePush, disablePush, type PushState } from '../lib/push';
import { supabaseBrowser, clearRememberSession } from '../lib/supabase';
import { api, clearMeCache, type Profile, type University } from '../lib/api';
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

// Support channel (WhatsApp): renders only when the backend has a support
// number configured. Prefilled text carries the app version so support
// knows what the student runs. Own hooks, own component — no ordering risk.
function SupportRow() {
  const [number, setNumber] = useState('');
  useEffect(() => {
    api.support().then((s) => {
      if (s.supported && s.supportNumber) setNumber(s.supportNumber);
    }).catch(() => {});
  }, []);
  if (!number) return null;
  const text = encodeURIComponent(`Hello Unify support! I need help with the app (v${APP_VERSION}).`);
  return (
    <a
      href={`https://wa.me/${number}?text=${text}`}
      target="_blank"
      rel="noreferrer"
      style={{ marginTop: 8, padding: 14, background: '#25D366', color: '#fff', borderBottom: '4px solid #128C7E', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <MessageCircle size={16} /> Get help on WhatsApp
    </a>
  );
}
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
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  // Inline edit (no onboarding detour): role + semester stay locked.
  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Profile picture: file → on-device 256px JPEG (any input size) → avatars
  // bucket. Reads fall back to /me's Gravatar-by-email when no upload exists.
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  // Email verification CTA: unverified inboxes confirm right from here.
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [verifBusy, setVerifBusy] = useState(false);
  const [verifMsg, setVerifMsg] = useState('');
  // /me's avatar (Gravatar/SSO photo) when the profile row has no upload.
  const [meAvatar, setMeAvatar] = useState('');

  const uploadAvatar = async (file: File | null) => {
    if (!file || uploadingAvatar) return;
    setAvatarMsg('');
    // Some pickers hand back an empty MIME for perfectly good photos —
    // never reject on that; the decode below is the real test.
    if (file.type && !file.type.startsWith('image/')) {
      setAvatarMsg("That's not an image — pick a JPG, PNG or WEBP photo.");
      return;
    }
    setUploadingAvatar(true);
    try {
      // Standardize: downscale to a 256px JPEG (~20-40KB) on-device, so
      // profile pictures stay tiny no matter what the camera produced.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          try {
            const S = 256;
            const scale = Math.min(1, S / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const cv = document.createElement('canvas');
            cv.width = w;
            cv.height = h;
            const ctx = cv.getContext('2d');
            if (!ctx) throw new Error('no canvas');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(cv.toDataURL('image/jpeg', 0.82));
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('unreadable image'));
        };
        img.src = url;
      });
      const res = await api.uploadAvatar(dataUrl);
      setProfile((prev) => (prev ? { ...prev, avatar_url: res.avatarUrl } : prev));
      // Header chip refreshes live (URL itself cache-busts server-side).
      window.dispatchEvent(new CustomEvent('unify:avatar', { detail: res.avatarUrl }));
      setAvatarMsg('Picture updated.');
    } catch (e) {
      // Surface the server's exact rejection when there is one — generic
      // copy only for local decode/network failures.
      const msg = e instanceof Error ? e.message : '';
      setAvatarMsg(
        msg && !/network|failed|fetch|offline|configured/i.test(msg)
          ? msg
          : "Couldn't read that photo — save it as JPG or PNG (some formats like HEIC need converting) and retry."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };
  const { theme, toggle } = useTheme();
  const { design, setDesign } = useDesign();
  const [pushSt, setPushSt] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    if (!pushSupported()) {
      setPushSt('unsupported');
      return;
    }
    void pushState().then(setPushSt).catch(() => {});
  }, []);

  const flipPush = async () => {
    setPushBusy(true);
    setPushMsg('');
    try {
      if (pushSt === 'on') {
        await disablePush();
        setPushSt('off');
        setPushMsg('Push off on this device.');
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushSt('on');
          setPushMsg('Push on — new notes and announcements will buzz you.');
        } else {
          if (Notification.permission === 'denied') setPushSt('denied');
          setPushMsg(res.reason || 'Could not enable push.');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };
  const [unis, setUnis] = useState<University[]>([]);
  const [dName, setDName] = useState('');
  const [dUni, setDUni] = useState('');
  const [dFaculty, setDFaculty] = useState('');
  const [dDept, setDDept] = useState('');
  const [dLevel, setDLevel] = useState('');
  const [dTarget, setDTarget] = useState('');
  const [dNotify, setDNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setSaveError = (m: string) => { setSaveErrorState(m); if (m) toastError(m); };

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
      const su = sessionData.session.user as { email_confirmed_at?: string; confirmed_at?: string };
      setEmailConfirmed(Boolean(su.email_confirmed_at || su.confirmed_at));
      try {
        const me = await api.me();
        if (!me.onboarded || !me.profile) {
          navigate('/onboarding');
          return;
        }
        setProfile(me.profile);
        setMeAvatar(me.avatar || '');
        setIsAdmin(!!me.isAdmin);
        const p = me.profile;
        setDName(p.first_name || '');
        setDUni(p.university || '');
        setDFaculty(p.faculty || '');
        setDDept(p.department || '');
        setDLevel(p.level || '');
        setDTarget(p.grad_target != null ? String(p.grad_target) : '');
        setDNotify(p.notify_new_notes !== false);
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
      // The new address is unconfirmed until that link is tapped.
      setEmailConfirmed(false);
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : 'Email change failed.');
    }
  };

  const resendVerify = async () => {
    const client = supabaseBrowser();
    if (!client || !email) return;
    setVerifBusy(true);
    setVerifMsg('');
    try {
      const { error } = await client.auth.resend({ type: 'signup', email });
      setVerifMsg(error ? error.message : 'Verification email sent — check your inbox and spam.');
    } catch {
      setVerifMsg("Couldn't send right now — try again in a minute.");
    } finally {
      setVerifBusy(false);
    }
  };

  const handleLogout = async () => {
    setConfirmLogout(true);
  };

  const doLogout = async () => {
    setConfirmLogout(false);
    const sb = supabaseBrowser();
    // Local scope: clear this tab/client only, never nuke another tab's
    // newer session (single-session policy kicks via broadcast instead).
    if (sb) await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    clearRememberSession();
    clearMeCache();
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
      const author = profile?.role === 'lecturer' || profile?.role === 'contributor';
      if (!author) {
        if (dLevel) payload.level = dLevel;
        if (dTarget) payload.gradTarget = Number(dTarget);
      } else if (dLevel) {
        // Authors pick the level they contribute to (scopes Browse).
        payload.level = dLevel;
      }
      payload.notifyNewNotes = dNotify;
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
  const canAuthor = profile?.role === 'lecturer' || profile?.role === 'contributor';
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
  // Staff never see or touch their contributing level here — it is assigned
  // by admins (users table) and shown on the dashboard contributions card.

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        {(profile?.avatar_url || meAvatar) ? (
          <img src={profile?.avatar_url || meAvatar} alt="Profile picture" style={{ width: 64, height: 64, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, flexShrink: 0 }}>
            {initial}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 22 }}>{profile?.first_name || 'Builder'}</h1>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{email}</div>
          {email && !emailConfirmed && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 9999, padding: '3px 10px' }}>Email not verified</span>
              <button onClick={() => void resendVerify()} disabled={verifBusy} style={{ fontSize: 12, fontWeight: 800, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {verifBusy ? 'Sending…' : 'Resend verification email'}
              </button>
            </div>
          )}
          {verifMsg && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{verifMsg}</div>}
          <label style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 800, color: '#059669', cursor: 'pointer' }}>
            {uploadingAvatar ? 'Uploading…' : profile?.avatar_url ? 'Change picture' : 'Add a picture'}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingAvatar}
              onChange={(e) => void uploadAvatar(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
          </label>
          {avatarMsg && <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{avatarMsg}</div>}
        </div>
        <Mascot size={64} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Change email</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" style={{ flex: 1, minWidth: 0, padding: 10, border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 }} />
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

      {editing && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Edit profile</div>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            First name
            <input value={dName} onChange={(e) => setDName(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, display: 'block' }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            University
            <Drop
              value={dUni}
              onChange={setDUni}
              label="Select…"
              style={{ width: '100%', marginTop: 4 }}
              options={[
                ...(dUni && !unis.some((u) => u.name === dUni) ? [{ value: dUni, label: dUni }] : []),
                ...unis.map((u) => ({ value: u.name, label: u.name })),
              ]}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Faculty
            <Drop
              value={dFaculty}
              onChange={setDFaculty}
              label="Select…"
              style={{ width: '100%', marginTop: 4 }}
              options={[
                ...(dFaculty && !['Faculty of Engineering'].includes(dFaculty) ? [{ value: dFaculty, label: dFaculty }] : []),
                { value: 'Faculty of Engineering', label: 'Faculty of Engineering' },
              ]}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Department
            <Drop
              value={dDept}
              onChange={setDDept}
              label="Select…"
              style={{ width: '100%', marginTop: 4 }}
              options={[
                ...(dDept && !DEPARTMENTS.includes(dDept) ? [{ value: dDept, label: dDept }] : []),
                ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
              ]}
            />
          </label>
          {!canAuthor && (
            <>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Level
                <Drop
                  value={dLevel}
                  onChange={setDLevel}
                  label="Select…"
                  style={{ width: '100%', marginTop: 4 }}
                  options={LEVELS.map((l) => ({ value: l, label: l }))}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Graduation target
                <Drop
                  value={dTarget}
                  onChange={setDTarget}
                  label="Select…"
                  style={{ width: '100%', marginTop: 4 }}
                  options={TARGETS.map((t) => ({ value: String(t.val), label: `${t.label} — ${t.val}` }))}
                />
              </label>
            </>
          )}
          {canAuthor && (
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Your contributing level and courses are assigned by an admin — they show on your dashboard.</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Role and semester are locked — only admin can change those.</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={dNotify} onChange={(e) => setDNotify(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
            Email me when new notes drop in my courses
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 12, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 12, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} /> Cancel
            </button>
            <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: 12, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 12, fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Appearance</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>Design &amp; theme apply across the whole app.</div>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9999, padding: 4, marginBottom: 10 }}>
          {(['classic', 'story'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDesign(d)}
              style={{ flex: 1, padding: 10, borderRadius: 9999, border: 'none', background: design === d ? '#16a34a' : 'transparent', color: design === d ? '#fff' : 'var(--text2)', fontWeight: 800, fontSize: 13 }}
            >
              {d === 'classic' ? 'Classic' : 'Story'}
            </button>
          ))}
        </div>
        <button onClick={() => toggle()} style={{ width: '100%', padding: 12, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 800, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {pushSt !== 'unsupported' && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={flipPush}
              disabled={pushBusy || pushSt === 'denied'}
              style={{ width: '100%', padding: 12, background: pushSt === 'on' ? '#ecfdf5' : 'var(--surface2)', color: pushSt === 'on' ? '#059669' : 'var(--text)', border: `1px solid ${pushSt === 'on' ? '#a7f3d0' : 'var(--border)'}`, borderRadius: 12, fontWeight: 800, fontSize: 13, opacity: pushBusy || pushSt === 'denied' ? 0.6 : 1 }}
            >
              {pushBusy ? 'Working…' : pushSt === 'on' ? 'Push notifications: ON' : 'Push notifications: OFF'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              {pushSt === 'denied'
                ? 'Blocked in browser settings — allow notifications for this site, then retry.'
                : 'Lock-screen nudges for new notes and announcements, even with the app closed.'}
            </div>
            {pushMsg && <div style={{ fontSize: 12, color: '#059669', marginTop: 6 }}>{pushMsg}</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {!editing && (
          <button onClick={startEdit} style={{ flex: 1, padding: 14, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Pencil size={16} /> Edit profile
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={handleLogout} style={{ flex: 1, padding: 14, background: 'var(--surface)', color: '#991b1b', border: '1px solid #fecaca', borderBottom: '4px solid #fecaca', borderRadius: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={16} /> Log out
        </button>
      </div>
      {canAuthor && (
        <Link to="/studio" style={{ marginTop: 8, padding: 14, background: 'var(--surface)', color: '#059669', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          Open Authoring Studio
        </Link>
      )}
      <SupportRow />
      {confirmLogout && (
        <ConfirmModal
          title="Log out?"
          body="Are you sure you want to sign out of Unify Learn on this device?"
          confirmLabel="Log out"
          tone="go"
          onConfirm={() => void doLogout()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
        <Wordmark size={13} /> <span>v{APP_VERSION}</span>
      </div>
    </div>
  );
}
