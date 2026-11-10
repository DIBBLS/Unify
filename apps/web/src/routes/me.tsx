import PushHelp, { GuideSteps } from '../components/PushHelp';
import type { GuideKind } from '../lib/pushHelp';
import { ProfileSkeleton } from '../components/Skeletons';
import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Pencil, X, Sun, Moon, MessageCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import Drop from '../components/Drop';
import { useTheme } from '../hooks/useTheme';
import { APP_VERSION } from '../lib/version';
import Wordmark from '../components/Wordmark';
import { pushSupported, pushState, enablePush, disablePush, type PushState } from '../lib/push';
import { supabaseBrowser, clearRememberSession } from '../lib/supabase';
import { api, clearMeCache, type Profile, type University } from '../lib/api';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import Flash from '../components/Flash';
import { BoxBoy } from '../components/redesign/brand';

import { describeError, errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { askInstall, isStandalone } from '../lib/install';
import { announcePicture, resolvePicture } from '../lib/picture';
import { preparePhoto } from '../lib/image';
import { Avatar, PERSONAS, type PersonaKey } from '../components/redesign/brand';
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

export default function MeRoute() {
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

  const [personaBusy, setPersonaBusy] = useState(false);
  const picture = resolvePicture(profile, meAvatar);
  const pickPersona = async (key: PersonaKey) => {
    setPersonaBusy(true);
    try {
      // Choosing a Box Boy replaces an uploaded photo (the photo would win otherwise).
      await api.setPersona(key, true);
      setProfile((prev) => (prev ? { ...prev, box_boy_persona: key, avatar_url: '' } : prev));
      announcePicture();
      toastSuccess(`${PERSONAS.find((p) => p.key === key)?.name || 'Box Boy'} is your picture now.`);
    } catch (e) {
      errorToast(e, 'change your picture');
    } finally {
      setPersonaBusy(false);
    }
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file || uploadingAvatar) return;
    setAvatarMsg('');
    // No format gate: pickers mislabel photos (empty MIME, HEIC as
    // octet-stream). preparePhoto converts whatever it can open (HEIC
    // included) to a small JPEG — the decode is the only real test.
    setUploadingAvatar(true);
    try {
      // Square 320px JPEG under ~60 KB, upright, no black behind transparency.
      const { dataUrl } = await preparePhoto(file, { size: 320, maxBytes: 60 * 1024 });
      const res = await api.uploadAvatar(dataUrl);
      setProfile((prev) => (prev ? { ...prev, avatar_url: res.avatarUrl } : prev));
      // Header chip refreshes live (URL itself cache-busts server-side).
      window.dispatchEvent(new CustomEvent('unify:avatar', { detail: res.avatarUrl }));
      setAvatarMsg('Picture updated.');
    } catch (e) {
      // Surface the server's exact rejection when there is one — generic
      // copy only for local decode/network failures.
      const msg = describeError(e, 'update your picture');
      setAvatarMsg(
        /^Couldn/.test(msg) || /reach the server|offline/i.test(msg)
          ? "Couldn't open that file as a picture. Try another photo."
          : msg
      );
    } finally {
      setUploadingAvatar(false);
    }
  };
  const { theme, toggle } = useTheme();
  const [pushSt, setPushSt] = useState<PushState>('off');
  const [pushGuideKind, setPushGuideKind] = useState<GuideKind | null>(null);
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
          if (res.kind === 'blocked') setPushSt('denied');
          setPushMsg(res.reason || 'Could not enable push.');
          setPushGuideKind(res.kind ?? 'failed');
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
        setEmailMsg(describeError(err, 'change your email'));
        return;
      }
      setEmailMsg(`Confirmation sent to ${next}. Tap the link there to finish.`);
      setNewEmail('');
      // The new address is unconfirmed until that link is tapped.
      setEmailConfirmed(false);
    } catch (err) {
      setEmailMsg(describeError(err, 'change your email'));
    }
  };

  const resendVerify = async () => {
    const client = supabaseBrowser();
    if (!client || !email) return;
    setVerifBusy(true);
    setVerifMsg('');
    try {
      const { error } = await client.auth.resend({ type: 'signup', email });
      setVerifMsg(error ? describeError(error, 'send the verification email') : 'Verification email sent — check your inbox and spam.');
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
      if (!author && profile?.role === 'student') {
        if (dLevel) payload.level = dLevel;
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
      setSaveError(describeError(err, 'save your profile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ProfileSkeleton />;
  if (error)
    return <ErrorState title="Couldn't load your profile" message={error} />;

  const initial = (profile?.first_name || email).charAt(0).toUpperCase() || 'U';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—';
  const canAuthor = profile?.role === 'lecturer' || profile?.role === 'contributor';
  // Level and graduation target are student concepts: staff and admins never see them.
  const isStudent = (profile?.role || 'student') === 'student';
  const rows: [string, string][] = [
    ['Role', roleLabel],
    ['University', profile?.university || '—'],
    ['Faculty', profile?.faculty || '—'],
    ['Department', profile?.department || '—'],
  ];
  if (isStudent) {
    rows.push(['Level', profile?.level || '—']);
    const ct = (profile as unknown as { cgpa_target?: number | null } | null)?.cgpa_target;
    rows.push(['CGPA target', ct != null ? Number(ct).toFixed(2) : 'Not set']);
  }
  // Staff never see or touch their contributing level here — it is assigned
  // by admins (users table) and shown on the dashboard contributions card.

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton to="/home" />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        {picture.src ? (
          <img src={picture.src} alt="Profile picture" style={{ width: 64, height: 64, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, flexShrink: 0 }}>
            {initial}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 22 }}>{profile?.first_name || 'Builder'}</h1>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{email}</div>
          {email && !emailConfirmed && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--u-warn-ink)', background: 'var(--u-warn-tint)', border: '1px solid #fde68a', borderRadius: 9999, padding: '3px 10px' }}>Email not verified</span>
              <button onClick={() => void resendVerify()} disabled={verifBusy} style={{ fontSize: 12, fontWeight: 800, color: 'var(--u-good)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {verifBusy ? 'Sending…' : 'Resend verification email'}
              </button>
            </div>
          )}
          {verifMsg && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{verifMsg}</div>}
          <label style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 800, color: 'var(--u-good)', cursor: 'pointer' }}>
            {uploadingAvatar ? 'Uploading…' : profile?.avatar_url ? 'Change picture' : 'Add a picture'}
            <input
              type="file"
              accept="image/*,.heic,.heif"
              disabled={uploadingAvatar}
              onChange={(e) => void uploadAvatar(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
          </label>
          {avatarMsg && <div style={{ fontSize: 12, color: 'var(--u-good)', marginTop: 4 }}>{avatarMsg}</div>}
        </div>
        <BoxBoy pose="armsCrossed" width={64} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Or pick a Box Boy as your picture</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 10px' }}>
          {profile?.avatar_url ? 'Picking one replaces your uploaded photo.' : 'Tap one to use it everywhere.'}
        </div>
        <div role="radiogroup" aria-label="Box Boy persona" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PERSONAS.map((p) => {
            const on = profile?.box_boy_persona === p.key && !profile?.avatar_url;
            return (
              <button
                key={p.key}
                role="radio"
                aria-checked={on}
                aria-label={p.name}
                disabled={personaBusy}
                onClick={() => void pickPersona(p.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 4, borderRadius: 16, border: `2px solid ${on ? 'var(--u-green)' : 'transparent'}`, background: on ? 'var(--u-good-tint)' : 'transparent', opacity: personaBusy ? 0.6 : 1 }}
              >
                <Avatar persona={p.key} size={52} />
                <span style={{ fontSize: 11, fontWeight: on ? 800 : 600 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
        {isStudent && (
          <Link to="/cgpa-planner?step=target" className="btn btn--white btn--sm" style={{ margin: '0 16px 12px', display: 'flex', justifyContent: 'center' }}>
            {(profile as unknown as { cgpa_target?: number | null } | null)?.cgpa_target != null ? 'Edit CGPA target' : 'Set CGPA target'}
          </Link>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Change email</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" style={{ flex: 1, minWidth: 0, padding: 10, border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 }} />
          <button onClick={handleEmailChange} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '3px solid #c69a1a', fontWeight: 800, fontSize: 13 }}>
            Send
          </button>
        </div>
        {emailMsg && <div style={{ fontSize: 12, color: 'var(--u-good)', marginTop: 6 }}>{emailMsg}</div>}
      </div>
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
          {isStudent && (
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
            </>
          )}
          {canAuthor && (
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Your contributing level and courses are assigned by an admin — they show on your dashboard.</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Role and semester are locked — only admin can change those.</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={dNotify} onChange={(e) => setDNotify(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--u-amber)' }} />
            Email me when new notes drop in my courses
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 12, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 12, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} /> Cancel
            </button>
            <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: 12, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 12, fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Appearance</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>Theme applies across the whole app.</div>
        <button onClick={() => toggle()} style={{ width: '100%', padding: 12, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 800, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {pushSt !== 'unsupported' && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={flipPush}
              disabled={pushBusy || pushSt === 'denied'}
              style={{ width: '100%', padding: 12, background: pushSt === 'on' ? 'var(--u-good-tint)' : 'var(--surface2)', color: pushSt === 'on' ? 'var(--u-good)' : 'var(--text)', border: `1px solid ${pushSt === 'on' ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 12, fontWeight: 800, fontSize: 13, opacity: pushBusy ? 0.6 : 1 }}
            >
              {pushBusy ? 'Working…' : pushSt === 'on' ? 'Push notifications: ON' : 'Push notifications: OFF'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              {pushSt === 'denied'
                ? 'Blocked in your browser settings. Here is how to allow it:'
                : 'Lock-screen nudges for new notes and announcements, even with the app closed.'}
            </div>
            {pushSt === 'denied' && <div style={{ fontSize: 12, marginTop: 6 }}><GuideSteps kind="blocked" /></div>}
            {pushMsg && pushSt !== 'denied' && <div style={{ fontSize: 12, color: 'var(--u-good)', marginTop: 6 }}>{pushMsg}</div>}
            {pushGuideKind && pushSt !== 'denied' && <PushHelp kind={pushGuideKind} onClose={() => setPushGuideKind(null)} />}
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
        <button onClick={handleLogout} style={{ flex: 1, padding: 14, background: 'var(--surface)', color: 'var(--u-red)', border: '1px solid #fecaca', borderBottom: '4px solid #fecaca', borderRadius: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={16} /> Log out
        </button>
      </div>
      {canAuthor && (
        <Link to="/studio" style={{ marginTop: 8, padding: 14, background: 'var(--surface)', color: 'var(--u-good)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
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
      {!isStandalone() && (
        <button className="btn btn--amber btn--block" onClick={askInstall} style={{ marginTop: 16 }}>
          Install Unify on this device
        </button>
      )}
      {(isAdmin || import.meta.env.DEV) && (
        <Link to="/screens" className="btn btn--white btn--sm" style={{ marginTop: 16, display: 'flex', width: 'fit-content', marginInline: 'auto' }}>
          All screens
        </Link>
      )}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
        <Wordmark size={13} /> <span>v{APP_VERSION}</span>
      </div>
    </div>
  );
}

