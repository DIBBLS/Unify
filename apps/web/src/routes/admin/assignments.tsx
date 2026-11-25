import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, type AdminUser } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import { askConfirm } from '../../lib/dialog';
import { SectionSkeleton } from '../../components/Skeletons';

// Admin › Course assignment (Review 4): every course and whether someone
// teaches it ("11 courses, 3 unassigned"), with an Assign action. Lecturers
// and contributors can be assigned; the server keeps the contributor cap.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
type Course = Awaited<ReturnType<typeof api.adminCourseAssignments>>['courses'][number];

export default function AdminAssignments() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [level, setLevel] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState('');
  const [pickQ, setPickQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.adminCourseAssignments().then((r) => setCourses(r.courses)).catch((e) => { errorToast(e, 'load courses'); setCourses([]); });
  useEffect(() => {
    void load();
    Promise.all([api.adminUsers('', 'lecturer'), api.adminUsers('', 'contributor')])
      .then(([l, c]) => setStaff([...l.users, ...c.users]))
      .catch(() => setStaff([]));
  }, []);

  const inLevel = (courses || []).filter((c) => !level || c.levels.includes(level));
  const unassigned = inLevel.filter((c) => c.assignees.length === 0).length;
  const s = q.trim().toLowerCase();
  const shown = inLevel.filter((c) => (!onlyOpen || c.assignees.length === 0) && (!s || c.code.toLowerCase().includes(s) || c.title.toLowerCase().includes(s)));

  const assign = async (code: string, u: AdminUser) => {
    setBusy(true);
    try {
      await api.adminAssignCourse(code, u.id);
      toastSuccess(`${u.first_name || 'They'} now teach${u.role === 'contributor' ? '' : 'es'} ${code}.`);
      setPicking('');
      setPickQ('');
      await load();
    } catch (e) {
      errorToast(e, 'assign that course');
    } finally {
      setBusy(false);
    }
  };
  const unassign = async (code: string, a: { id: string; name: string }) => {
    if (!(await askConfirm({ title: `Take ${code} from ${a.name}?`, body: 'Their notes stay published. They just stop being assigned.', confirmLabel: 'Unassign' }))) return;
    try {
      await api.adminUnassignCourse(code, a.id);
      await load();
    } catch (e) {
      errorToast(e, 'unassign that');
    }
  };

  const pq = pickQ.trim().toLowerCase();
  const candidates = staff.filter((u) => !pq || (u.first_name || '').toLowerCase().includes(pq) || (u.email || '').toLowerCase().includes(pq) || (u.department || '').toLowerCase().includes(pq)).slice(0, 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {courses && (
        <div style={{ ...card, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{inLevel.length}</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{inLevel.length === 1 ? 'course' : 'courses'}{level ? ` in ${level}` : ''},</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: unassigned ? 'var(--u-warn-ink, #b45309)' : 'var(--u-good)' }}>{unassigned}</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>unassigned</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['', ...LEVELS].map((l) => (
          <button key={l || 'all'} className={`chip chip--sm${level === l ? ' chip--on' : ''}`} onClick={() => setLevel(l)}>{l ? l.replace(' Level', 'L') : 'All levels'}</button>
        ))}
        <button className={`chip chip--sm${onlyOpen ? ' chip--on' : ''}`} onClick={() => setOnlyOpen((v) => !v)}>Unassigned only</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or title…" aria-label="Search courses" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />

      {!courses && <SectionSkeleton rows={4} quote={false} />}
      {courses && shown.length === 0 && <div style={{ ...card, fontSize: 13, color: 'var(--text2)' }}>{onlyOpen ? 'Every course here has someone assigned.' : 'No courses match.'}</div>}
      {shown.map((c) => (
        <div key={c.code} style={card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{c.code}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[c.title, c.levels.map((l) => l.replace(' Level', 'L')).join(', '), c.semesters.join(', ')].filter(Boolean).join(' · ')}</span>
            </span>
            <button className={`btn btn--sm ${c.assignees.length ? 'btn--white' : 'btn--amber'}`} onClick={() => { setPicking(picking === c.code ? '' : c.code); setPickQ(''); }}>
              {picking === c.code ? 'Close' : 'Assign'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {c.assignees.length === 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--u-warn-ink, #b45309)' }}>No one assigned</span>}
            {c.assignees.map((a) => (
              <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '3px 4px 3px 10px', background: a.role === 'lecturer' ? '#dbeafe' : '#ede9fe', color: a.role === 'lecturer' ? '#1d4ed8' : '#6d28d9' }}>
                {a.name} · {a.role}
                <button onClick={() => void unassign(c.code, a)} aria-label={`Unassign ${a.name}`} style={{ display: 'flex', background: 'none', border: 'none', padding: 2, color: 'inherit' }}><X size={12} /></button>
              </span>
            ))}
          </div>
          {picking === c.code && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <input autoFocus value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Find a lecturer or contributor…" aria-label="Find someone to assign" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
                {candidates.filter((u) => !c.assignees.some((a) => a.id === u.id)).map((u) => (
                  <button key={u.id} disabled={busy} onClick={() => void assign(c.code, u)} style={{ display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', padding: '8px 4px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{u.first_name || 'Unnamed'}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[u.role, u.level, u.department].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                ))}
                {candidates.length === 0 && <div style={{ fontSize: 12, color: 'var(--text2)', padding: 6 }}>No lecturer or contributor matches.</div>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
