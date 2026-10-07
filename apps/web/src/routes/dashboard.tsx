import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type Profile } from '../lib/api';
import { DashboardSkeleton } from '../components/Skeletons';
import ErrorState from '../components/ErrorState';
import Mascot from '../components/Mascot';
import Typewriter from '../components/Typewriter';
import Flash from '../components/Flash';
import ConfirmModal from '../components/ConfirmModal';
import { greeting, dailyLine, dailyKey, daypart } from '../lib/greet';

type CourseStat = { course: string; topics: number };

type Platform = { users: number; weeks: number; topics: number; courses: number; xpTotal: number };
type Activity = {
  recentUsers: { first_name: string; email: string; role: string; created_at: string }[];
  recentNotes: { course: string; week: number; topic: number; version: number; title: string; created_at: string }[];
};

// Admin oversight: platform totals + latest signups + latest published
// notes in one dark card. Main admin (role) gets the manage link,
// normal admins (flag) get the view-only notes link.
function OversightCard({ platform, activity, mainAdmin }: { platform: Platform; activity: Activity | null; mainAdmin: boolean }) {
  return (
    <div style={{ margin: '12px 16px 0', background: '#111827', borderRadius: 12, padding: 16, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Platform</div>
        {mainAdmin ? (
          <Link to="/admin" style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, textDecoration: 'none' }}>Open Admin panel</Link>
        ) : (
          <Link to="/admin/content" style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, textDecoration: 'none' }}>View notes</Link>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center', marginTop: 10 }}>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{platform.users}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Users</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{platform.courses}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Courses</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{platform.weeks}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Weeks</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{platform.topics}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Topics</div>
        </div>
      </div>
      {activity && (activity.recentUsers.length > 0 || activity.recentNotes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>LATEST SIGNUPS</div>
            {activity.recentUsers.slice(0, 3).map((u, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.first_name || 'Unnamed'} · {u.role}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>LATEST PUBLISHED NOTES</div>
            {activity.recentNotes.slice(0, 3).map((n, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.course} W{n.week}T{n.topic}v{n.version}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [enrolled, setEnrolled] = useState<string[]>([]);
  const [resume, setResume] = useState<{ course: string; week: number; topic: number; lecture?: number } | null>(null);
  const [quizzes, setQuizzes] = useState({ taken: 0, avg: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [astats, setAstats] = useState<{ courses: number; topics: number; versions: number; students: number; completions: number; quizzesTaken: number; quizAvg: number } | null>(null);
  const [platform, setPlatform] = useState<{ users: number; weeks: number; topics: number; courses: number; xpTotal: number } | null>(null);
  const [activity, setActivity] = useState<{
    recentUsers: { first_name: string; email: string; role: string; created_at: string }[];
    recentNotes: { course: string; week: number; topic: number; version: number; title: string; created_at: string }[];
  } | null>(null);
  const [notes, setNotes] = useState<{ id: string; course: string; week: number; topic: number; lecture: number; version: number; title: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteError, setNoteErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setNoteError = (m: string) => { setNoteErrorState(m); if (m) toastError(m); };
  // BUG-012: catalog meta for course cards (title, weeks, lecturers) +
  // elective removal target. Hooks stay above every early return (#310).
  const [catalog, setCatalog] = useState<Record<string, { title: string; weeks: number; lecturers: string[]; staff: { name: string; avatar: string }[] }>>({});
  // Skeleton variant follows the last-known role on THIS device (same
  // hint as the nav) so the loader matches the real dashboard — students
  // and contributors each see their own shape, even on first paint.
  const [skelAuthor] = useState(() => {
    try {
      const r = localStorage.getItem('unify.role.v1');
      return r === 'lecturer' || r === 'contributor' || r === 'admin';
    } catch {
      return false;
    }
  });
  // Teaching courses: lecturers always get My Classes; contributors with
  // assigned teaching courses do too (backend gates the page either way).
  const [teaching, setTeaching] = useState<string[]>([]);
  const [myContribs, setMyContribs] = useState<{ course: string; level: string; semester: string; assigned: boolean; topics: number; versions: number; totalTopics: number }[]>([]);
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);
  // Waiting room: a student with a pending staff request sees application
  // status + a way out — never a silent demotion to "just a student".
  const [pendingReq, setPendingReq] = useState<{ id: string; role: string; level: string; courses: string[]; status: string; created_at: string } | null>(null);
  const [cancellingReq, setCancellingReq] = useState(false);

  const cancelRequest = async () => {
    setCancellingReq(true);
    try {
      await api.cancelRoleRequest();
      setPendingReq(null);
    } catch {
      // card stays; retry from here
    } finally {
      setCancellingReq(false);
    }
  };
  // Delete-confirm target. Declared with the other hooks: a useState placed
  // after an early return changes the hook count between renders (#310).
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
        // me + stats + catalog launch together: three sequential round
        // trips used to gate the whole dashboard on cold start.
        const [me, statsRes, catRes] = await Promise.all([
          api.me(),
          api.stats().catch(() => null),
          api.courses().catch(() => [] as { code: string; title: string; weeks: number; lecturers: string[]; staff: { name: string; avatar: string }[] }[]),
        ]);
        if (!me.onboarded || !me.profile) {
          navigate('/onboarding');
          return;
        }
        setProfile(me.profile);
        setEnrolled(me.courses || []);
        setResume(me.resume || null);
        setIsAdmin(!!me.isAdmin);
        // Streak heartbeat: showing up counts (server records one/day).
        void api.pingDaily();
        // Waiting-room lookup: students who applied for staff see status.
        if ((me.profile?.role || 'student') === 'student') {
          try {
            const mine = await api.myRoleRequest();
            if (mine.request && mine.request.status === 'pending') setPendingReq(mine.request);
          } catch {
            // no waiting room without a readable request
          }
        }
        // BUG-012: one catalog fetch feeds every course card (title,
        // weeks, lecturers) — never one request per card.
        try {
          const map: Record<string, { title: string; weeks: number; lecturers: string[]; staff: { name: string; avatar: string }[] }> = {};
          for (const c of catRes) map[c.code.toUpperCase().trim()] = { title: c.title, weeks: c.weeks || 0, lecturers: c.lecturers || [], staff: c.staff || [] };
          setCatalog(map);
        } catch {
          // cards fall back to codes
        }
        // BUG-013: warm the enrolled course week-lists in the background
        // so course pages open instantly (kills the slow-blank feel).
        try {
          const warm = () => {
            for (const c of me.courses || []) {
              if (c && c.trim()) api.courseWeeks(c.trim()).catch(() => {});
            }
          };
          const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
          if (ric) ric(warm);
          else window.setTimeout(warm, 1500);
        } catch {
          // warmup is best-effort
        }
        const stats = statsRes;
        if (stats) {
          setXp(stats.xp);
          setStreak(stats.streak);
          setCourses(stats.courses);
          setQuizzes({ taken: stats.quizzesTaken || 0, avg: stats.quizAvg || 0 });
        }
        if (me.profile?.role === 'lecturer' || me.profile?.role === 'contributor') {
          try {
            const authored = await api.authored();
            setNotes(authored.notes);
          } catch {
            // empty list stands
          }
          try {
            setTeaching((await api.teaching()).courses || []);
          } catch {
            // My Classes card falls back to role-only
          }
          try {
            setMyContribs((await api.contributions()).courses || []);
          } catch {
            // contributions stand empty
          }
          try {
            setAstats(await api.authorStats());
          } catch {
            // stats stand empty
          }
        }
        // Oversight loads for every effective admin, both dashboard views.
        if (me.isAdmin) {
          try {
            const s = await api.adminStats();
            setPlatform({ users: s.users, weeks: s.weeks, topics: s.topics, courses: s.courses, xpTotal: s.xpTotal });
          } catch {
            // platform stats stand empty
          }
          try {
            setActivity(await api.adminActivity());
          } catch {
            // activity stands empty
          }
        }
      } catch {
        setLoadError("Couldn't load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) return <DashboardSkeleton author={skelAuthor} />;
  if (loadError)
    return <ErrorState title="Couldn't load your dashboard" message={loadError} />;

  const firstName = profile?.first_name || 'Builder';
  const cleanEnrolled = enrolled.map((c) => (c || '').trim()).filter(Boolean);
  const shown = cleanEnrolled.length
    ? cleanEnrolled.map((course) => ({ course }))
    : courses.map((c) => ({ course: c.course }));
  const isAuthor = profile?.role === 'lecturer' || profile?.role === 'contributor';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '';

  // BUG-012: electives leave with one tap (compulsory courses are
  // re-added by repairEnrollments on next Explore visit if removed).
  const unenroll = async (course: string) => {
    setUnenrolling(true);
    try {
      await api.enroll(course, false);
      setEnrolled((prev) => prev.filter((c) => c.toUpperCase().trim() !== course.toUpperCase().trim()));
    } catch {
      // card stays; retry from the course page
    } finally {
      setUnenrolling(false);
    }
  };
  // Delete one published topic version (own notes; admins can remove any).
  const deleteNote = async (id: string) => {
    setDeleting(id);
    setNoteError('');
    try {
      await api.noteDelete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setNoteError("Couldn't delete that note. Check your connection and retry.");
    } finally {
      setDeleting(null);
    }
  };
  if (isAuthor)
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
        <div style={{ padding: '20px 16px 12px', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>Your Dashboard</div>
            <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginTop: 4 }}>
              {greeting()}, <em style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '0 6px', borderRadius: 6, fontStyle: 'normal' }}>{firstName}</em>
            </h1>
            <div style={{ fontSize: 13, color: '#059669', marginTop: 4, minHeight: 18 }}>
              <Typewriter key={dailyKey()} text={dailyLine()} speed={28} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{profile?.department || roleLabel}</div>
          </div>
          <Mascot size={64} animate={daypart() === 'morning' ? 'sip' : 'wave'} />
        </div>
        {astats && !isAdmin && (
          <div className="rise" style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
            <div>
              <div className="stat-num" style={{ fontSize: 18 }}>{astats.topics}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Notes</div>
            </div>
            <div>
              <div className="stat-num" style={{ fontSize: 18 }}>{astats.courses}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
            </div>
            <div>
              <div className="stat-num" style={{ fontSize: 18 }}>{astats.students}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Students</div>
            </div>
            <div>
              <div className="stat-num" style={{ fontSize: 18 }}>{astats.completions}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Done</div>
            </div>
          </div>
        )}
        {isAdmin && platform && (
          <OversightCard platform={platform} activity={activity} mainAdmin={profile?.role === 'admin'} />
        )}
        <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Published notes</h2>
          <Link to="/browse" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
            Browse {profile?.level ? `${profile.level} ` : ''}notes <ChevronRight size={14} />
          </Link>
        </div>
        {profile?.role === 'lecturer' || teaching.length > 0 ? (
          <Link to="/classes" style={{ margin: '12px 16px 0', padding: 14, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none' }}>
            <BookOpen size={20} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 800, display: 'block' }}>My Classes</span>
              <span style={{ fontSize: 12, opacity: 0.9 }}>Timetable + roster for the courses you teach</span>
            </span>
            <ChevronRight size={16} />
          </Link>
        ) : null}
        {profile?.role === 'contributor' && (
          <div style={{ margin: '16px 16px 0' }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>My contributions</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {myContribs.filter((c) => c.assigned).length} course{myContribs.filter((c) => c.assigned).length === 1 ? '' : 's'} assigned · 2-course cap per level · totals cover every author on shared courses.
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myContribs.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, fontSize: 13 }}>
                  No courses assigned yet — ask an admin to assign your two courses.
                </div>
              )}
              {myContribs.map((c) => (
                <div key={c.course} style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{c.course}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{[c.level, (c.semester || '').replace(' Semester', '')].filter(Boolean).join(' · ') || 'Unscoped'}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text2)' }}>
                    <div><strong style={{ color: 'var(--text)', fontSize: 14 }}>{c.totalTopics}</strong> notes in course</div>
                    <div>{c.topics} yours · {c.versions} versions</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <Mascot size={96} />
              <div style={{ marginTop: 8 }}>Nothing published yet. Open Studio to author your first week.</div>
            </div>
          ) : (
            (() => {
              // BUG-008: one row per topic showing ONLY the latest version;
              // older versions stay reachable in the reader, not in the list.
              // Lecture-scoped: L1·T1 and L2·T1 are different rows.
              const seen = new Map<string, { n: (typeof notes)[number]; older: number }>();
              for (const n of notes) {
                const k = `${n.course}::${n.week}::${n.lecture || 1}::${n.topic}`;
                const g = seen.get(k);
                if (!g) seen.set(k, { n, older: 0 });
                else g.older += 1;
              }
              return [...seen.values()].map(({ n, older }) => (
              <div key={n.id} style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Link to={`/learn/${encodeURIComponent(n.course)}/week/${n.week}?preview=1`} style={{ flex: 1, textDecoration: 'none', color: 'var(--text)', display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, letterSpacing: 1 }}>{n.course} · WEEK {n.week} · L{n.lecture || 1}·T{n.topic} · v{n.version}{older > 0 ? ` · ${older} older` : ''}</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{n.title || `Topic ${n.topic}`}</div>
                </Link>
                <button
                  onClick={() => setConfirmDelete(n.id)}
                  disabled={deleting === n.id}
                  aria-label={`Delete ${n.course} week ${n.week} topic ${n.topic} version ${n.version}`}
                  style={{ padding: 10, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: '#991b1b', opacity: deleting === n.id ? 0.5 : 1 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              ));
            })()
          )}
        </div>
        {confirmDelete && (
          <ConfirmModal
            title="Delete this version?"
            body="The version is removed but older versions stay live for students."
            confirmLabel="Delete"
            busy={deleting !== null}
            onConfirm={() => {
              const id = confirmDelete;
              setConfirmDelete(null);
              void deleteNote(id);
            }}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </div>
    );
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 12px', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>Your Dashboard</div>
          <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginTop: 4 }}>
            {greeting()}, <em style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '0 6px', borderRadius: 6, fontStyle: 'normal' }}>{firstName}</em>
          </h1>
          <div style={{ fontSize: 13, color: '#059669', marginTop: 4, minHeight: 18 }}>
            <Typewriter key={dailyKey()} text={dailyLine()} speed={28} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{profile?.department || ''}</div>
        </div>
        <Mascot size={64} animate={daypart() === 'morning' ? 'sip' : 'wave'} />
      </div>

      <div className="rise" style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{profile?.grad_target ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Target</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{xp}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>XP</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{streak}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Streak</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{shown.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
        </div>
      </div>

      {quizzes.taken > 0 && (
        <div style={{ margin: '0 16px 12px', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
          {quizzes.taken} {quizzes.taken === 1 ? 'quiz' : 'quizzes'} taken · {quizzes.avg}% average
        </div>
      )}

      {pendingReq && (
        <div style={{ margin: '0 16px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ''} — your {pendingReq.role} application is with the admin
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.6 }}>
            Applied{pendingReq.level ? ` for ${pendingReq.level}` : ''}{pendingReq.courses?.length ? ` · ${pendingReq.courses.join(', ')}` : ''} ·
            sent {new Date(pendingReq.created_at).toLocaleDateString()}. Nothing is taken from you while you wait —
            full student access stays, and approval lands on your bell and email.
          </div>
          <button
            onClick={() => void cancelRequest()}
            disabled={cancellingReq}
            style={{ marginTop: 10, padding: '8px 16px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 700, fontSize: 12, opacity: cancellingReq ? 0.6 : 1 }}
          >
            {cancellingReq ? 'Withdrawing…' : 'Withdraw application'}
          </button>
        </div>
      )}

      {resume && resume.course ? (
        <div style={{ margin: '0 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, background: '#ecfdf5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} color="#059669" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Continue Learning</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{resume.course} · Week {resume.week} · pick up where you stopped</div>
          </div>
          <Link to={`/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${(() => { const q = new URLSearchParams(); if (resume.topic) q.set('t', String(resume.topic)); if (resume.lecture && resume.lecture > 1) q.set('c', String(resume.lecture)); const s = q.toString(); return s ? `?${s}` : ''; })()}`} style={{ padding: '10px 16px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
            Resume
          </Link>
        </div>
      ) : null}

      {isAdmin && platform && (
        <OversightCard platform={platform} activity={activity} mainAdmin={profile?.role === 'admin'} />
      )}

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/explore" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
          Add courses <ChevronRight size={14} />
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {shown.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 16 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses yet.</div>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
              Explore courses to enroll
            </Link>
          </div>
        ) : (
          shown.map((c, i) => {
            const key = c.course.toUpperCase().trim();
            const meta = catalog[key];
            const stat = courses.find((s) => s.course.toUpperCase().trim() === key);
            const staff = (meta?.staff || []).slice(0, 3);
            const staffNames = staff.map((s) => s.name).join(' · ');
            return (
              <div key={c.course} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms`, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  {staff.length ? (
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      {staff.map((s, si) => (
                        s.avatar ? (
                          <img key={si} src={s.avatar} alt={s.name} title={s.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', marginLeft: si === 0 ? 0 : -10 }} />
                        ) : (
                          <div key={si} title={s.name} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', marginLeft: si === 0 ? 0 : -10 }}>
                            {s.name.trim().charAt(0).toUpperCase()}
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {c.course.trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link to={`/course/${encodeURIComponent(c.course.trim())}`} style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.course}
                    </Link>
                    {staffNames ? (
                      <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{staffNames}</div>
                    ) : null}
                  </div>
                </div>
                <Link to={`/course/${encodeURIComponent(c.course.trim())}`} style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta?.title || 'Tap to open'}
                </Link>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text2)' }}>
                  <BookOpen size={12} color="#059669" />
                  <span>{meta?.weeks || 0} weeks{stat && stat.topics > 0 ? ` · ${stat.topics} done` : ''}</span>
                  <button
                    onClick={() => setConfirmUnenroll(c.course)}
                    aria-label={`Remove ${c.course} from your courses`}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {confirmUnenroll && (
        <ConfirmModal
          title={`Remove ${confirmUnenroll}?`}
          body="It leaves your dashboard. Re-enroll anytime from Explore — your XP and progress stay."
          confirmLabel="Remove"
          busy={unenrolling}
          onConfirm={() => {
            const code = confirmUnenroll;
            setConfirmUnenroll(null);
            void unenroll(code);
          }}
          onCancel={() => setConfirmUnenroll(null)}
        />
      )}

    </div>
  );
}
