import { useEffect, useState } from 'react';
import { api, type AdminUser } from '../../lib/api';
import { useSchool } from '../../lib/school';
import { errorToast } from '../../lib/errors';
import Drop from '../../components/Drop';
import { SectionSkeleton } from '../../components/Skeletons';
import { ClassContributorsPicker } from './guide';
import { PendingSignUps, SignUpLink } from './staff';

// Admin › Course Contributors (Review 4): its own page in the sidebar. Every
// student contributor, filtered by level (100–500) and department, with the
// courses each one writes. "Contributors by class" opens one class's view.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
type Row = AdminUser & { courses?: string[] };

export default function AdminContributors() {
  const school = useSchool();
  const [level, setLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let gone = false;
    setRows(null);
    api.adminContributors({ level, department })
      .then((r) => { if (!gone) setRows(r.users); })
      .catch((e) => { if (!gone) { errorToast(e, 'load contributors'); setRows([]); } });
    return () => { gone = true; };
  }, [level, department, reload]);

  const s = q.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !s || (r.first_name || '').toLowerCase().includes(s) || (r.email || '').toLowerCase().includes(s) || (r.courses || []).some((c) => c.toLowerCase().includes(s)));
  const without = shown.filter((r) => !(r.courses || []).length).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SignUpLink role="contributor" />
      <PendingSignUps role="contributor" onChange={() => setReload((n) => n + 1)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Drop value={level} onChange={setLevel} label="Level" style={{ minWidth: 130 }} options={[{ value: '', label: 'All levels' }, ...LEVELS.map((l) => ({ value: l, label: l }))]} />
        <Drop value={department} onChange={setDepartment} label="Department" style={{ flex: 1, minWidth: 180 }} options={[{ value: '', label: 'All departments' }, ...school.departments.map((d) => ({ value: d.name, label: d.name }))]} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or course…" aria-label="Search contributors" style={{ flex: 1, minWidth: 160, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
      </div>

      {!rows && <SectionSkeleton rows={3} quote={false} />}
      {rows && (
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {shown.length} {shown.length === 1 ? 'contributor' : 'contributors'}
          {without > 0 && <> · <b style={{ color: 'var(--u-warn-ink, #b45309)' }}>{without} with no course yet</b></>}
        </div>
      )}
      {rows && shown.length === 0 && <div style={{ ...card, fontSize: 13, color: 'var(--text2)' }}>No contributors match these filters.</div>}
      {shown.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0 }}>{r.first_name || 'Unnamed'}</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{(r.level || '').replace(' Level', 'L') || '—'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{[r.email, r.department].filter(Boolean).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {(r.courses || []).length
              ? (r.courses || []).map((c) => <span key={c} style={{ fontSize: 11, fontWeight: 800, background: '#ede9fe', color: '#6d28d9', borderRadius: 9999, padding: '3px 10px' }}>{c}</span>)
              : <span style={{ fontSize: 12, color: 'var(--text3)' }}>No course assigned. Assign one from Users &amp; roles.</span>}
          </div>
        </div>
      ))}

      <ClassContributorsPicker />
    </div>
  );
}
