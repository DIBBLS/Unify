import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Trash2, PenTool, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type AdminUser } from '../lib/api';
import Loading from '../components/Loading';
import Flash from '../components/Flash';
import ConfirmModal from '../components/ConfirmModal';
import { Bars, Donut, Spark } from '../components/Charts';
import BackButton from '../components/BackButton';

type Stats = { users: number; byRole: Record<string, number>; weeks: number; topics: number; courses: number; xpTotal: number };
type Uni = { id: string; name: string; short_name?: string };
type Course = { code: string; title: string; levels: string[]; semesters: string[] };

const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];

// One collapsible module per admin area — the panel used to render
// everything at once (endless scroll). Exactly one open at a time.
function Module({
  id,
  title,
  badge,
  openId,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  badge?: number;
  openId: string;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const open = openId === id;
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => onToggle(open ? '' : id)}
        style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {badge != null && (
          <span style={{ fontSize: 11, fontWeight: 800, background: '#ecfdf5', color: '#059669', borderRadius: 9999, padding: '2px 10px' }}>
            {badge}
          </span>
        )}
        {open ? <ChevronDown size={18} color="#999" /> : <ChevronRight size={18} color="#999" />}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export default function AdminRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [unis, setUnis] = useState<Uni[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [uniName, setUniName] = useState('');
  const [uniShort, setUniShort] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseLevels, setCourseLevels] = useState<string[]>([]);
  const [courseSemester, setCourseSemester] = useState('First Semester');
  const [currentSemester, setCurrentSemester] = useState('First Semester');
  const [promoting, setPromoting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [models, setModels] = useState<{ model: string; failures: number; last_ok: string | null }[]>([]);
  const [provider, setProvider] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  // Main-admin protection: your own row (matched by auth id) hides the
  // role buttons + remove button, so the primary admin can never lock
  // itself out by flipping its own role.
  const [ownId, setOwnId] = useState('');
  const [openModule, setOpenModule] = useState('users');
  const [courseQ, setCourseQ] = useState('');
  // App errors (client log + Sentry backup). Sentry presence is a build-time
  // env flag, read here so the module says which window is live.
  const [errors, setErrors] = useState<{ kind: string; message: string; stack: string; url: string; app_version: string; created_at: string }[]>([]);
  const [sentryOn] = useState(() => Boolean((import.meta.env.VITE_SENTRY_DSN as string | undefined) || ''));
  const [trends, setTrends] = useState<{ signups: { day: string; count: number }[]; notes: { day: string; count: number }[]; xp: { day: string; count: number }[] } | null>(null);
  // Table-style user management: one scanable row per user (name, role
  // pill, level), tap to expand the full controls (role pills, level,
  // course assignment). Sub-level linking without losing the overview.
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  // Staff requests queue.
  const [requests, setRequests] = useState<{ id: string; user_id: string; role: string; level: string; courses: string[]; status: string; created_at: string; name: string; email: string }[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const r = await api.adminRoleRequests();
      setRequests(r.requests || []);
    } catch {
      // queue stands empty
    }
  };

  const decideRequest = async (id: string, approve: boolean) => {
    setDeciding(id);
    setError('');
    try {
      const res = await api.decideRoleRequest(id, approve);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setSuccess(
        approve
          ? `Approved.${res.granted?.length ? ` Teaching: ${res.granted.join(', ')}.` : ''}${res.capped?.length ? ` Held by 2-per-level cap: ${res.capped.join(', ')}.` : ''}`
          : 'Request declined. The applicant keeps student access.'
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setDeciding(null);
    }
  };
  // Per-author course assignment: the author's reachable set IS this
  // teaching list; gates enforce it server-side.
  const [courseMgr, setCourseMgr] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [assignInput, setAssignInput] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);

  const openCourseMgr = async (id: string) => {
    if (courseMgr === id) {
      setCourseMgr(null);
      return;
    }
    setCourseMgr(id);
    setAssigned([]);
    setAssignInput('');
    setError('');
    try {
      const res = await api.adminUserCourses(id);
      setAssigned(res.courses.filter((c) => c.kind === 'teaching').map((c) => c.course));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load courses.');
    }
  };

  const saveAssigned = async (id: string, next: string[]) => {
    setAssignBusy(true);
    setError('');
    try {
      const res = await api.adminSetUserCourses(id, next);
      setAssigned(res.courses);
      setSuccess(`Assigned ${res.courses.length} course${res.courses.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setAssignBusy(false);
    }
  };

  const loadAll = async (query = q, role = roleFilter) => {
    try {
      const [s, u, un, c, m, st, t, er] = await Promise.all([
        api.adminStats(),
        api.adminUsers(query, role),
        api.universities(),
        api.courses(),
        api.adminModels(),
        api.settings().catch(() => ({ currentSemester: 'First Semester' })),
        api.adminTrends().catch(() => null),
        api.adminErrors().catch(() => ({ errors: [] })),
      ]);
      setErrors(er.errors || []);
      setStats(s);
      setUsers(u.users);
      setUnis(un);
      setCourses(c);
      setModels(m.models);
      setProvider(m.provider);
      void loadRequests();
      setProvider(m.provider);
      setDefaultModel(m.default);
      if (t) setTrends(t);
      if (st.currentSemester) setCurrentSemester(st.currentSemester);
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
      setOwnId(sessionData.session.user.id);
      try {
        const me = await api.me();
        if (!me.isAdmin) {
          navigate('/dashboard');
          return;
        }
        await loadAll();
      } catch {
        setError("Couldn't load admin data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const refresh = () => loadAll();

  const addUni = async () => {
    if (!uniName.trim()) return;
    setError('');
    try {
      await api.adminCreateUni(uniName.trim(), uniShort.trim() || undefined);
      setUniName('');
      setUniShort('');
      setSuccess('University added.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed.');
    }
  };

  // One designed sheet for every destructive/broadcast action below.
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => void } | null>(null);

  const delUni = async (id: string, name: string) => {
    try {
      await api.adminDeleteUni(id);
      setSuccess('University deleted.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const toggleLevel = (l: string) =>
    setCourseLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const addCourse = async () => {
    if (!courseCode.trim() || !courseTitle.trim() || !courseLevels.length) {
      setError('Course needs a code, a title, and at least one level.');
      return;
    }
    setError('');
    try {
      await api.adminCreateCourse(courseCode.trim().toUpperCase(), courseTitle.trim(), courseLevels, courseSemester);
      setCourseCode('');
      setCourseTitle('');
      setCourseLevels([]);
      setSuccess('Course added.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed.');
    }
  };

  const delCourse = async (code: string) => {
    try {
      await api.adminDeleteCourse(code);
      setSuccess('Course deleted.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setError('');
    try {
      await api.adminInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setSuccess(`Invite sent to ${inviteEmail.trim()}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed.');
    }
  };

  const changeRole = async (id: string, role: string) => {
    setError('');
    try {
      await api.adminPatchUser(id, { role });
      setSuccess('Role updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  // Academic session: which semester students see (global toggle).
  const setSemester = async (semester: string) => {
    setError('');
    try {
      const res = await api.adminSetSemester(semester);
      setCurrentSemester(res.currentSemester);
      setSuccess(`Active semester: ${res.currentSemester}. Students now see only its courses.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  // One-click promotion: every student up one level (500 -> Graduated).
  const promoteAll = async () => {
    setPromoting(true);
    setError('');
    try {
      const res = await api.adminPromote();
      setSuccess(`Promoted ${res.promoted} student${res.promoted === 1 ? '' : 's'}, graduated ${res.graduated}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promotion failed.');
    } finally {
      setPromoting(false);
    }
  };

  const changeLevel = async (id: string, level: string) => {
    setError('');
    try {
      await api.adminPatchUser(id, { level });
      setSuccess('Level updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announcing, setAnnouncing] = useState(false);

  // Broadcast an announcement to every user's bell.
  const announce = async () => {
    if (!announceTitle.trim() || !announceBody.trim()) {
      setError('Announcement needs a title and a message.');
      return;
    }
    setAnnouncing(true);
    setError('');
    try {
      const res = await api.adminAnnounce(announceTitle.trim(), announceBody.trim());
      setAnnounceTitle('');
      setAnnounceBody('');
      setSuccess(`Announcement sent to ${res.reached} user${res.reached === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Announce failed.');
    } finally {
      setAnnouncing(false);
    }
  };

  const removeUser = async (id: string, name: string) => {
    setError('');
    try {
      await api.adminDeleteUser(id);
      setSuccess('User removed.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  if (loading) return <Loading text="Loading admin…" />;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 } as const;
  const input = { padding: 10, border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 } as const;
  const primaryBtn = { padding: '10px 18px', borderRadius: 12, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800 } as const;
  const shownCourses = courses.filter((c) => {
    const needle = courseQ.trim().toLowerCase();
    if (!needle) return true;
    return c.code.toLowerCase().includes(needle) || (c.title || '').toLowerCase().includes(needle);
  });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Shield size={22} color="#059669" /> Admin
      </h1>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}

      <Link to="/studio" style={{ marginTop: 12, padding: 14, background: '#111827', color: '#fff', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <PenTool size={16} /> Open Authoring Studio
      </Link>
      <Link to="/admin/content" style={{ marginTop: 8, padding: 14, background: 'var(--surface)', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <BookOpen size={16} /> View all content
      </Link>

      {stats && (
        <div style={{ margin: '16px 0 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.users}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Users</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.weeks}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Weeks</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.topics ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Topics</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.courses ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.xpTotal}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>XP</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.byRole.lecturer || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Authors</div>
          </div>
        </div>
      )}

      <Module id="analytics" title="Analytics" openId={openModule} onToggle={setOpenModule}>
        {!stats && !trends && (
          <div style={card}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Charts load with the panel data above.</div>
          </div>
        )}
        {stats && (
          <div style={{ ...card, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Users by role</div>
            <Donut
              segments={[
                { label: 'Students', value: stats.byRole.student || 0, color: '#16a34a' },
                { label: 'Lecturers', value: stats.byRole.lecturer || 0, color: '#3b82f6' },
                { label: 'Contributors', value: stats.byRole.contributor || 0, color: '#8b5cf6' },
                { label: 'Admins', value: stats.byRole.admin || 0, color: '#f59e0b' },
              ].filter((s) => s.value > 0)}
            />
          </div>
        )}
        {trends && (
          <>
            <div style={{ ...card, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Signups · last 14 days</div>
              <Bars data={trends.signups.map((d) => ({ label: d.day, value: d.count }))} />
            </div>
            <div style={{ ...card, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Notes published · last 14 days</div>
              <Bars data={trends.notes.map((d) => ({ label: d.day, value: d.count }))} />
            </div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>XP earned · last 14 days</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 800 }}>
                  {trends.xp.reduce((s, d) => s + d.count, 0).toLocaleString()} total
                </div>
              </div>
              <Spark data={trends.xp.map((d) => ({ label: d.day, value: d.count }))} />
            </div>
          </>
        )}
      </Module>

      <Module id="models" title="AI models" badge={models.length} openId={openModule} onToggle={setOpenModule}>
      <div style={card}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
          Provider: <strong>{provider || '—'}</strong> · Default: <strong>{defaultModel || '—'}</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {models.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>No models recorded yet — generation attempts populate this list.</div>
          )}
          {models.map((m) => {
            const healthy = m.failures < 3;
            return (
              <div key={m.model} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: healthy ? '#10b981' : '#ff4b4b', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.model}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{m.failures} fails</span>
                <button
                  onClick={async () => {
                    try {
                      await api.adminModelsReset(m.model);
                      await loadAll();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Reset failed.');
                    }
                  }}
                  style={{ padding: '6px 12px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12 }}
                >
                  Reset
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={async () => {
            try {
              const r = await api.adminModels(true);
              setModels(r.models);
              setProvider(r.provider);
              setDefaultModel(r.default);
              setSuccess('Model list refreshed from Google.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Refresh failed.');
            }
          }}
          style={{ ...primaryBtn, width: '100%', marginTop: 10 }}
        >
          Refresh from Google
        </button>
      </div>
      </Module>

      <Module id="unis" title="Universities" badge={unis.length} openId={openModule} onToggle={setOpenModule}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {unis.map((u) => (
          <div key={u.id} style={{ ...card, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{u.short_name || ''}</div>
            </div>
            <button onClick={() => setConfirm({ title: `Delete ${u.name}?`, body: 'Profiles keep the name as text.', label: 'Delete', run: () => void delUni(u.id, u.name) })} aria-label={`Delete ${u.name}`} style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', padding: 8, display: 'flex' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={uniName} onChange={(e) => setUniName(e.target.value)} placeholder="University name" style={{ ...input, flex: 2, minWidth: 140 }} />
          <input value={uniShort} onChange={(e) => setUniShort(e.target.value)} placeholder="Short" style={{ ...input, flex: 1, minWidth: 80 }} />
          <button onClick={addUni} style={primaryBtn}>Add</button>
        </div>
      </div>
      </Module>

      <Module id="courses" title="Courses per level" badge={courses.length} openId={openModule} onToggle={setOpenModule}>
      <div style={{ ...card, display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={courseQ} onChange={(e) => setCourseQ(e.target.value)} placeholder="Search code or title…" style={{ ...input, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shownCourses.map((c) => (
          <div key={c.code} style={{ ...card, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.code} — {c.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{(c.levels || []).join(', ') || 'No levels'}{(c.semesters || []).length ? ` · ${(c.semesters || []).join(', ')}` : ''}</div>
            </div>
            <button onClick={() => setConfirm({ title: `Delete ${c.code}?`, body: 'ALL its weeks go with it. Students lose that content.', label: 'Delete course', run: () => void delCourse(c.code) })} aria-label={`Delete ${c.code}`} style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', padding: 8, display: 'flex' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. ECE 201" style={{ ...input, flex: 1, minWidth: 100 }} />
            <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="Course title" style={{ ...input, flex: 2, minWidth: 140 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => toggleLevel(l)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: `1px solid ${courseLevels.includes(l) ? '#059669' : 'var(--border)'}`,
                  background: courseLevels.includes(l) ? '#10b981' : 'var(--surface)',
                  color: courseLevels.includes(l) ? '#fff' : 'var(--text2)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {l.replace(' Level', '')}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['First Semester', 'Second Semester'].map((s) => (
              <button
                key={s}
                onClick={() => setCourseSemester(s)}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: `1px solid ${courseSemester === s ? '#059669' : 'var(--border)'}`,
                  background: courseSemester === s ? '#10b981' : 'var(--surface)',
                  color: courseSemester === s ? '#fff' : 'var(--text2)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {s.replace(' Semester', '')}
              </button>
            ))}
          </div>
          <button onClick={addCourse} style={{ ...primaryBtn, width: '100%' }}>Add course</button>
        </div>
        {shownCourses.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 16 }}>No courses match that search.</div>}
      </div>
      </Module>

      <Module id="session" title="Academic session" openId={openModule} onToggle={setOpenModule}>
      <div style={card}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Active semester — students only see this semester's courses.</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['First Semester', 'Second Semester'].map((s) => (
            <button
              key={s}
              onClick={() => setSemester(s)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 9999,
                border: `1px solid ${currentSemester === s ? '#059669' : 'var(--border)'}`,
                background: currentSemester === s ? '#10b981' : 'var(--surface)',
                color: currentSemester === s ? '#fff' : 'var(--text2)',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {s.replace(' Semester', '')}
            </button>
          ))}
        </div>
        <button onClick={() => setConfirm({ title: 'Promote everyone?', body: 'ALL students move up one level. 500 Level graduates. Course enrollments reset for promoted students.', label: 'Promote all', run: () => void promoteAll() })} disabled={promoting} style={{ ...primaryBtn, width: '100%', opacity: promoting ? 0.6 : 1 }}>
          {promoting ? 'Promoting…' : 'Promote all students one level'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>500 Level graduates; enrollments reset for promoted students.</div>
      </div>
      </Module>

      <Module id="announce" title="Announce to users" openId={openModule} onToggle={setOpenModule}>
      <div style={card}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Lands on every user's bell instantly.</div>
        <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="Announcement title" style={{ ...input, width: '100%', marginBottom: 8 }} />
        <textarea value={announceBody} onChange={(e) => setAnnounceBody(e.target.value)} rows={3} placeholder="What should everyone know?" style={{ ...input, width: '100%', resize: 'vertical', marginBottom: 8 }} />
        <button onClick={() => setConfirm({ title: 'Send to everyone?', body: 'This announcement lands on every user\u2019s bell instantly.', label: 'Send', run: () => void announce() })} disabled={announcing} style={{ ...primaryBtn, width: '100%', opacity: announcing ? 0.6 : 1 }}>
          {announcing ? 'Sending…' : 'Send to all users'}
        </button>
      </div>
      </Module>

      <Module id="errors" title="App errors" badge={errors.length} openId={openModule} onToggle={setOpenModule}>
      <div style={card}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          Render crashes from user devices (Sentry backup — newest first, 30-day window).
          {sentryOn ? ' Sentry is also live.' : ' Sentry DSN not set: this log is the only window.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {errors.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 20 }}>No errors logged. Quiet is good.</div>}
          {errors.slice(0, 20).map((e, i) => (
            <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 9999, padding: '2px 8px' }}>{e.kind || 'client'}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, wordBreak: 'break-word' }}>{e.message || '(no message)'}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, wordBreak: 'break-all' }}>{e.app_version ? `v${e.app_version} · ` : ''}{e.url || ''}</div>
            </div>
          ))}
        </div>
      </div>
      </Module>

      <Module id="requests" title="Staff requests" badge={requests.length} openId={openModule} onToggle={setOpenModule}>
      <div style={card}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          Lecturer/contributor applications. Approve grants the role + teaching courses (contributor 2-per-level cap enforced); both sides notify by bell + email.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 20 }}>Queue clear — nothing waiting.</div>}
          {requests.map((r) => (
            <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{r.name} <span style={{ fontWeight: 500, color: 'var(--text2)' }}>wants {r.role}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.email}{r.level ? ` · ${r.level}` : ''}{r.courses?.length ? ` · ${r.courses.join(', ')}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => void decideRequest(r.id, true)}
                  disabled={deciding === r.id}
                  style={{ flex: 1, padding: 10, borderRadius: 12, background: '#10b981', color: '#fff', border: 'none', borderBottom: '3px solid #059669', fontWeight: 800, fontSize: 13, opacity: deciding === r.id ? 0.6 : 1 }}
                >
                  {deciding === r.id ? 'Working…' : 'Approve'}
                </button>
                <button
                  onClick={() => void decideRequest(r.id, false)}
                  disabled={deciding === r.id}
                  style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--surface)', color: '#991b1b', border: '1px solid #fecaca', borderBottom: '3px solid #fecaca', fontWeight: 800, fontSize: 13, opacity: deciding === r.id ? 0.6 : 1 }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </Module>

      <Module id="users" title="Users & roles" badge={users.length} openId={openModule} onToggle={setOpenModule}>
      <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite by email…" style={{ ...input, flex: 2, minWidth: 140 }} />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ ...input, flex: 1, minWidth: 110 }}>
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
          <option value="contributor">Contributor</option>
        </select>
        <button onClick={invite} style={primaryBtn}>Invite</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ ...input, flex: 1, minWidth: 140 }} />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); void loadAll(q, e.target.value); }} style={input}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="lecturer">Lecturers</option>
          <option value="contributor">Contributors</option>
          <option value="admin">Admins</option>
        </select>
        <button onClick={() => refresh()} style={primaryBtn}>Search</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 24px', gap: 8, alignItems: 'center', padding: '0 14px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text3)' }}>
          <span>USER</span>
          <span>ROLE</span>
          <span>LEVEL</span>
          <span />
        </div>
        {users.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 20 }}>No users found.</div>}
        {users.map((u) => {
          const open = expandedUser === u.id;
          const pill = u.role === 'admin' || u.is_admin
            ? { bg: '#111827', fg: '#fff' }
            : u.role === 'lecturer'
              ? { bg: '#dbeafe', fg: '#1d4ed8' }
              : u.role === 'contributor'
                ? { bg: '#ede9fe', fg: '#6d28d9' }
                : { bg: 'var(--surface2)', fg: 'var(--text2)' };
          return (
          <div key={u.id} style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 24px', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setExpandedUser(open ? null : u.id)}
                style={{ background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)', minWidth: 0, padding: 0 }}
                aria-label={open ? `Collapse ${u.first_name || 'user'}` : `Expand ${u.first_name || 'user'}`}
              >
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.first_name || 'Unnamed'}{u.id === ownId ? ' · You' : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email || ''}</div>
              </button>
              <span style={{ fontSize: 11, fontWeight: 800, background: pill.bg, color: pill.fg, borderRadius: 9999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                {(u.is_admin && u.role !== 'admin' ? `admin·${u.role}` : u.role) || 'student'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{(u.level || '').replace(' Level', '') || '—'}</span>
              <button
                onClick={() => setExpandedUser(open ? null : u.id)}
                aria-label={open ? 'Collapse' : 'Expand'}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', display: 'flex', padding: 2 }}
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {open && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{[u.university, u.department].filter(Boolean).join(' · ') || 'No profile details'}</div>
              {u.id !== ownId && (
                <button onClick={() => setConfirm({ title: `Remove ${u.first_name || 'this user'}?`, body: 'This cannot be undone.', label: 'Remove', run: () => void removeUser(u.id, u.first_name || '') })} aria-label="Remove user" style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', padding: 8, display: 'flex' }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {u.id === ownId ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#059669', fontWeight: 700, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px' }}>
                This is you — your role is locked so you can't lock yourself out.
              </div>
            ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {(['student', 'lecturer', 'contributor', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => changeRole(u.id, r)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 9999,
                    border: `1px solid ${u.role === r ? '#059669' : 'var(--border)'}`,
                    background: u.role === r ? '#10b981' : 'var(--surface)',
                    color: u.role === r ? '#fff' : 'var(--text2)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>Level:</span>
              <select
                value={u.level || ''}
                onChange={(e) => changeLevel(u.id, e.target.value)}
                style={{ ...input, flex: 1 }}
              >
                <option value="" disabled>{u.level || 'No level'}</option>
                {[...LEVELS, 'Graduated'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            {(u.role === 'lecturer' || u.role === 'contributor') && u.id !== ownId && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => openCourseMgr(u.id)}
                  style={{ width: '100%', padding: 8, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 800, fontSize: 12 }}
                >
                  {courseMgr === u.id ? 'Hide assigned courses' : 'Manage assigned courses'}
                </button>
                {courseMgr === u.id && (
                  <div style={{ marginTop: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {assigned.length === 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>None assigned — reaches nothing.</span>}
                      {assigned.map((c) => (
                        <span key={c} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 800, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: 9999, padding: '4px 6px 4px 12px' }}>
                          {c}
                          <button
                            onClick={() => saveAssigned(u.id, assigned.filter((x) => x !== c))}
                            disabled={assignBusy}
                            aria-label={`Unassign ${c}`}
                            style={{ background: 'none', border: 'none', color: '#991b1b', fontWeight: 800, display: 'flex', padding: 2 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={assignInput}
                        onChange={(e) => setAssignInput(e.target.value.toUpperCase())}
                        placeholder="e.g. MEE 352"
                        style={{ ...input, flex: 1, minWidth: 0 }}
                      />
                      <button
                        onClick={() => {
                          const code = assignInput.trim().toUpperCase();
                          if (!code || assigned.includes(code)) return;
                          setAssignInput('');
                          void saveAssigned(u.id, [...assigned, code]);
                        }}
                        disabled={assignBusy}
                        style={{ ...primaryBtn, opacity: assignBusy ? 0.6 : 1 }}
                      >
                        Assign
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>Codes must exist in the catalog — typos are rejected. Contributors cap at 2 per level.</div>
                  </div>
                )}
              </div>
            )}
            </div>
          )}
          </div>
          );
        }
      )}
      </div>
      </Module>
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          busy={promoting || announcing}
          onConfirm={() => {
            const run = confirm.run;
            setConfirm(null);
            run();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
