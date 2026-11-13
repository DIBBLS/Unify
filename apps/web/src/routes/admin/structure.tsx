import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import { forgetSchool, type SchoolFaculty } from '../../lib/school';
import Drop from '../../components/Drop';
import { SectionSkeleton } from '../../components/Skeletons';

// Admin › Faculties & departments: the one list every picker uses (onboarding,
// Me, lecturer setup, roles). A rename carries to everyone already in it
// (profiles, class lists, class boards, roles, live wires); retiring hides a
// department from pickers without moving anyone.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 };
const input: React.CSSProperties = { padding: 10, border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 };
const STATUS = [
  { value: 'open', label: 'Open' },
  { value: 'soon', label: 'Coming soon' },
  { value: 'later', label: 'Not open yet' },
] as const;

export default function AdminStructure() {
  const [data, setData] = useState<{ faculties: SchoolFaculty[]; people: Record<string, number> } | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // id being renamed
  const [draft, setDraft] = useState('');
  const [newFaculty, setNewFaculty] = useState('');
  const [newDept, setNewDept] = useState<Record<string, { name: string; code: string }>>({});

  const load = () => api.adminStructure().then(setData).catch((e) => errorToast(e, 'load faculties and departments'));
  useEffect(() => { void load(); }, []);
  const done = async (msg: string) => { forgetSchool(); toastSuccess(msg); setEditing(null); await load(); };
  const run = async (fn: () => Promise<unknown>, msg: string, what: string) => {
    try { await fn(); await done(msg); } catch (e) { errorToast(e, what); }
  };

  if (!data) return <SectionSkeleton rows={3} quote={false} />;
  const people = (dept: string) => data.people[dept] || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...card, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
        The faculties and departments everyone picks from. Renaming one updates everyone already in it (profiles, class lists, class boards, roles), so no class gets split. Retiring a department hides it from new sign-ups; people in it keep it.
      </div>

      {data.faculties.map((f) => (
        <div key={f.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {editing === f.id ? (
              <>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ ...input, flex: 1 }} />
                <button className="btn btn--amber btn--sm" onClick={() => {
                  const n = f.departments.reduce((s, d) => s + people(d.name), 0);
                  if (draft.trim() && draft.trim() !== f.name && window.confirm(`Rename "${f.name}" to "${draft.trim()}"? It changes for ${n} ${n === 1 ? 'person' : 'people'} already in it.`)) void run(() => api.adminFacultyEdit(f.id, { name: draft.trim() }), 'Faculty renamed.', 'rename that faculty');
                }}>Save</button>
                <button className="btn btn--white btn--sm" onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>{f.name}</span>
                <button className="btn btn--white btn--sm" onClick={() => { setEditing(f.id); setDraft(f.name); }}>Rename</button>
              </>
            )}
            <Drop value={f.status} onChange={(v) => void run(() => api.adminFacultyEdit(f.id, { status: v as SchoolFaculty['status'] }), 'Saved.', 'change that faculty')} label="Status" options={STATUS.map((x) => ({ value: x.value, label: x.label }))} style={{ minWidth: 150 }} />
          </div>

          {f.departments.length === 0 && <div className="t-13 muted">No departments yet.</div>}
          {f.departments.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)', opacity: d.active ? 1 : 0.6 }}>
              {editing === d.id ? (
                <>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ ...input, flex: 1 }} />
                  <button className="btn btn--amber btn--sm" onClick={() => {
                    const n = people(d.name);
                    if (draft.trim() && draft.trim() !== d.name && window.confirm(`Rename "${d.name}" to "${draft.trim()}"? It changes for ${n} ${n === 1 ? 'person' : 'people'}, and their class lists and class boards.`)) void run(() => api.adminDeptEdit(d.id, { name: draft.trim() }), 'Department renamed.', 'rename that department');
                  }}>Save</button>
                  <button className="btn btn--white btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{d.name}{d.code ? <span className="muted" style={{ fontWeight: 600 }}> · {d.code}</span> : null}{!d.active ? ' · retired' : ''}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{people(d.name)} {people(d.name) === 1 ? 'person' : 'people'}</span>
                  </span>
                  <button className="btn btn--white btn--sm" onClick={() => { setEditing(d.id); setDraft(d.name); }}>Rename</button>
                  {data.faculties.length > 1 && (
                    <Drop value={f.id} onChange={(v) => { if (v !== f.id) void run(() => api.adminDeptEdit(d.id, { facultyId: v }), 'Department moved.', 'move that department'); }} label="Faculty" options={data.faculties.map((x) => ({ value: x.id, label: x.name }))} style={{ minWidth: 150 }} />
                  )}
                  <button className="btn btn--white btn--sm" onClick={() => void run(() => api.adminDeptEdit(d.id, { active: !d.active }), d.active ? 'Department retired.' : 'Department restored.', 'change that department')}>{d.active ? 'Retire' : 'Restore'}</button>
                </>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input placeholder="New department name" value={newDept[f.id]?.name || ''} onChange={(e) => setNewDept((s) => ({ ...s, [f.id]: { name: e.target.value, code: s[f.id]?.code || '' } }))} style={{ ...input, flex: 2 }} />
            <input placeholder="Code, e.g. ECE" value={newDept[f.id]?.code || ''} onChange={(e) => setNewDept((s) => ({ ...s, [f.id]: { name: s[f.id]?.name || '', code: e.target.value } }))} style={{ ...input, flex: 1, maxWidth: 120 }} />
            <button className="btn btn--white btn--sm" disabled={(newDept[f.id]?.name || '').trim().length < 3} onClick={() => {
              const n = newDept[f.id];
              void run(() => api.adminDeptAdd({ facultyId: f.id, name: n.name.trim(), code: n.code.trim() }), 'Department added.', 'add that department').then(() => setNewDept((s) => ({ ...s, [f.id]: { name: '', code: '' } })));
            }}>Add department</button>
          </div>
        </div>
      ))}

      <div style={{ ...card, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input placeholder="New faculty, e.g. Faculty of Science" value={newFaculty} onChange={(e) => setNewFaculty(e.target.value)} style={{ ...input, flex: 1 }} />
        <button className="btn btn--amber btn--sm" disabled={newFaculty.trim().length < 3} onClick={() => void run(() => api.adminFacultyAdd({ name: newFaculty.trim(), status: 'later' }), 'Faculty added (not open yet: set it to Open when ready).', 'add that faculty').then(() => setNewFaculty(''))}>Add faculty</button>
      </div>
    </div>
  );
}
