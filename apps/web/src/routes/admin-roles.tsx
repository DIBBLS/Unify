import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { Card, Display, Label } from '../components/redesign/ui';

// Admin: give scoped roles to existing accounts. Level admins approve class reps
// for one department + level; heads of department and deans see attendance
// counts for their department / faculty.
type Grant = Awaited<ReturnType<typeof api.roleGrants>>['grants'][number];
const ROLE_NAME = { level_admin: 'Level admin', hod: 'Head of department', dean: 'Dean' } as const;
const DEPARTMENTS = ['Electronic & Computer Engineering', 'Mechanical Engineering', 'Industrial & Petroleum Engineering', 'Chemical & Polymer Engineering', 'Civil Engineering', 'Aerospace Engineering'];
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
const field: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };

export default function AdminRolesRoute() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Grant['role']>('level_admin');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [level, setLevel] = useState(LEVELS[1]);
  const [faculty, setFaculty] = useState('Faculty of Engineering');
  const [busy, setBusy] = useState(false);

  const load = () => api.roleGrants().then((r) => { setGrants(r.grants); setErr(''); }).catch((e) => setErr(describeError(e, 'load roles')));
  useEffect(() => { void load(); }, []);

  const give = async () => {
    setBusy(true);
    try {
      const r = await api.roleGrant({ email: email.trim(), role, department: role !== 'dean' ? department : undefined, level: role === 'level_admin' ? level : undefined, faculty: role === 'dean' ? faculty : undefined });
      toastSuccess(`${r.name || email} is now ${ROLE_NAME[role].toLowerCase()}.`);
      setEmail('');
      await load();
    } catch (e) {
      errorToast(e, 'give that role');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 640px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.admin} />
      <Label>Admin</Label>
      <Display size={28}>Level admins, HODs and deans</Display>
      <Card style={{ marginTop: 16, gap: 10 }}>
        <label className="t-13 w-6">Their account email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@email.com" style={field} /></label>
        <label className="t-13 w-6">Role
          <select value={role} onChange={(e) => setRole(e.target.value as Grant['role'])} style={field}>
            <option value="level_admin">Level admin: approves class reps</option>
            <option value="hod">Head of department: attendance counts</option>
            <option value="dean">Dean: attendance counts for the faculty</option>
          </select>
        </label>
        {role !== 'dean' && (
          <label className="t-13 w-6">Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={field}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
          </label>
        )}
        {role === 'level_admin' && (
          <label className="t-13 w-6">Level
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={field}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
        )}
        {role === 'dean' && <label className="t-13 w-6">Faculty<input value={faculty} onChange={(e) => setFaculty(e.target.value)} style={field} /></label>}
        <button className="btn btn--amber btn--block" disabled={busy || !/@/.test(email)} onClick={() => void give()}>{busy ? 'Saving…' : 'Give role'}</button>
      </Card>
      {err && <div className="t-13" style={{ color: 'var(--u-red)', marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
        {(grants || []).map((g) => (
          <Card key={g.id} pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-15 w-6">{g.name || g.email}</div>
              <div className="t-13 muted">{ROLE_NAME[g.role]} · {g.role === 'dean' ? g.faculty : g.role === 'hod' ? g.department : `${g.department} ${g.level}`}</div>
            </div>
            <button
              aria-label={`Remove ${ROLE_NAME[g.role]} from ${g.name || g.email}`}
              onClick={() => { if (window.confirm(`Remove ${ROLE_NAME[g.role].toLowerCase()} from ${g.name || g.email}?`)) void api.roleRevoke(g.id).then(load).catch((e) => errorToast(e, 'remove that role')); }}
              style={{ display: 'flex', padding: 6, color: 'var(--text3)' }}
            >
              <X size={16} />
            </button>
          </Card>
        ))}
        {grants && grants.length === 0 && <div className="t-13 muted">Nobody has these roles yet.</div>}
      </div>
    </div>
  );
}
