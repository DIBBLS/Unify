import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { api, type AdminUser } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import { SectionSkeleton } from '../../components/Skeletons';

// Review 4: separate sign-up links and approval before access.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
type Req = Awaited<ReturnType<typeof api.adminRoleRequests>>['requests'][number];

/** The sign-up link for one role, with a copy button. */
export function SignUpLink({ role }: { role: 'lecturer' | 'contributor' }) {
  const url = `${window.location.origin}/join/${role}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      errorToast(new Error(`Copy the link by hand: ${url}`), 'copy the link');
    }
  };
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 14 }}>{role === 'lecturer' ? 'Lecturer sign-up link' : 'Contributor sign-up link'}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 8px', lineHeight: 1.5 }}>
        {role === 'lecturer'
          ? 'Send this to lecturers. They sign up, then wait for your approval before anything opens.'
          : 'Send this to students who will write notes. They keep student access and appear below for your approval.'}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
        <button className="btn btn--amber btn--sm" onClick={() => void copy()} aria-label="Copy the link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Pending sign-ups for one role, with Approve / Decline. */
export function PendingSignUps({ role, onChange }: { role: 'lecturer' | 'contributor'; onChange?: () => void }) {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    api.adminRoleRequests()
      .then((r) => setRows(r.requests.filter((q) => q.role === role && q.status === 'pending')))
      .catch((e) => { errorToast(e, 'load sign-ups'); setRows([]); });
  }, [role]);
  const decide = async (r: Req, approve: boolean) => {
    setBusy(r.id);
    try {
      await api.decideRoleRequest(r.id, approve);
      toastSuccess(approve ? `${r.name || 'They'} can now sign in as a ${role}.` : 'Declined. They keep student access.');
      setRows((x) => (x ? x.filter((q) => q.id !== r.id) : x));
      onChange?.();
    } catch (e) {
      errorToast(e, approve ? 'approve that' : 'decline that');
    } finally {
      setBusy('');
    }
  };
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 6px', fontWeight: 800, fontSize: 14 }}>
        Waiting for approval{rows && rows.length ? ` · ${rows.length}` : ''}
      </div>
      {!rows && <div style={{ padding: 14 }}><SectionSkeleton rows={2} quote={false} /></div>}
      {rows && rows.length === 0 && <div style={{ padding: '4px 14px 14px', fontSize: 13, color: 'var(--text2)' }}>No one is waiting.</div>}
      {rows?.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 160 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{r.name || 'Unnamed'}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[r.email, r.level, `signed up ${new Date(r.created_at).toLocaleDateString()}`].filter(Boolean).join(' · ')}</span>
          </span>
          <button className="btn btn--amber btn--sm" disabled={busy === r.id} onClick={() => void decide(r, true)}>Approve</button>
          <button className="btn btn--white btn--sm" disabled={busy === r.id} onClick={() => void decide(r, false)}>Decline</button>
        </div>
      ))}
    </div>
  );
}

// Admin › Lecturers & staff: the lecturer link, who is waiting, and everyone
// approved (lecturers, then admins).
export default function AdminStaff() {
  const [lecturers, setLecturers] = useState<AdminUser[] | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    api.adminUsers('', 'lecturer').then((r) => setLecturers(r.users)).catch((e) => { errorToast(e, 'load lecturers'); setLecturers([]); });
    api.adminUsers('', 'admin').then((r) => setAdmins(r.users)).catch(() => setAdmins([]));
  }, [reload]);
  const s = q.trim().toLowerCase();
  const match = (u: AdminUser) => !s || (u.first_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s) || (u.department || '').toLowerCase().includes(s);
  const shownLecturers = (lecturers || []).filter(match);
  const shownAdmins = admins.filter(match);
  const row = (u: AdminUser) => (
    <div key={u.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{u.first_name || 'Unnamed'}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{[u.email, u.department].filter(Boolean).join(' · ')}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SignUpLink role="lecturer" />
      <PendingSignUps role="lecturer" onChange={() => setReload((n) => n + 1)} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or department…" aria-label="Search staff" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 6px', fontWeight: 800, fontSize: 14 }}>Approved lecturers{lecturers ? ` · ${shownLecturers.length}` : ''}</div>
        {!lecturers && <div style={{ padding: 14 }}><SectionSkeleton rows={3} quote={false} /></div>}
        {lecturers && shownLecturers.length === 0 && <div style={{ padding: '4px 14px 14px', fontSize: 13, color: 'var(--text2)' }}>No lecturers yet.</div>}
        {shownLecturers.map(row)}
      </div>
      {shownAdmins.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 6px', fontWeight: 800, fontSize: 14 }}>Admins · {shownAdmins.length}</div>
          {shownAdmins.map(row)}
        </div>
      )}
    </div>
  );
}
