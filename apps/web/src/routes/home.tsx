import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type Profile, type HomeUpdate } from '../lib/api';
import { canOpenLink } from '../lib/updateLinks';
import { profileGaps, gapsText } from '../lib/profileGaps';
import { DashboardSkeleton } from '../components/Skeletons';
import ErrorState from '../components/ErrorState';
import { BoxBoy, PERSONAS } from '../components/redesign/brand';
import { resolvePicture } from '../lib/picture';
import Typewriter from '../components/Typewriter';
import Flash from '../components/Flash';
import ConfirmModal from '../components/ConfirmModal';
import { HomeHero } from '../components/redesign/HomeHero';
import { UpdatesSlider, type UpdateSlide } from '../components/redesign/UpdatesSlider';
import { FACTS } from '../lib/naija';
import LiveWire from '../components/LiveWire';
import Loading from '../components/Loading';

type CourseStat = { course: string; topics: number };

type Platform = { users: number; weeks: number; topics: number; courses: number; xpTotal: number };
type Activity = {
  recentUsers: { first_name: string; email: string; role: string; created_at: string }[];
  recentNotes: { course: string; week: number; topic: number; version: number; title: string; created_at: string }[];
};

// Admin oversight: platform totals + latest signups + latest published
// notes in one dark card. Main admin (role) gets the manage link,
// normal admins (flag) get the view-only notes link.
// S20: back after a week or more away. Kind, no guilt: one step to get going.
// Shown once a day at most (dismiss hides it until tomorrow).
function WelcomeBack({ firstName, resume }: { firstName: string; resume: { course: string; week: number; topic: number } | null }) {
  const [away, setAway] = useState<number | null>(null);
  const key = 'unify.welcomeBack.' + new Date().toISOString().slice(0, 10);
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(key); } catch { return false; } });
  useEffect(() => {
    if (hidden) return;
    api.learnActivity(60).then((a) => {
      const days = a.days.filter((d) => d.xp > 0).map((d) => d.date).sort();
      if (!days.length) return; // brand new: the usual Home is the welcome
      const last = days[days.length - 1];
      const gap = Math.floor((Date.now() - new Date(`${last}T12:00:00`).getTime()) / 86400000);
      if (gap >= 7) setAway(gap);
    }).catch(() => {});
  }, [hidden]);
  if (hidden || away == null) return null;
  const close = () => { setHidden(true); try { localStorage.setItem(key, '1'); } catch { /* optional */ } };
  return (
    <div className="rise" style={{ margin: '12px 16px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
      <BoxBoy pose="wavePhone" width={56} calm />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Welcome back, {firstName}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>It's been {away} days. One topic today and you're moving again.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {resume ? (
            <Link to={`/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${resume.topic ? `?t=${resume.topic}` : ''}`} className="btn btn--amber btn--sm" onClick={close}>Pick up {resume.course} · Week {resume.week}</Link>
          ) : (
            <Link to="/revision" className="btn btn--amber btn--sm" onClick={close}>Five-minute revision</Link>
          )}
          <button className="btn btn--white btn--sm" onClick={close}>Not now</button>
        </div>
      </div>
    </div>
  );
}

function semesterWeekOf(start?: string | null, weeks?: number | null): { week: number; total: number } {
  const total = weeks || 12;
  if (!start) return { week: 0, total };
  const w = Math.floor((Date.now() - new Date(start).getTime()) / (7 * 86400000)) + 1;
  return { week: w >= 1 && w <= total ? w : 0, total };
}

// Home course card (design S19 CourseCard), in the app's own look: the lecturer's
// Box Boy avatar, code (+ PRIORITY for another level's course), title, lecturer,
// an In progress / Not started / Done pill, a progress bar of topics done, and
// where the semester is. The whole card opens the course.
function CourseCard({ index, course, title, staff, priority, semWeek }: {
  index: number; course: string; title: string; staff: { name: string; avatar: string; persona?: string }[]; priority: boolean; semWeek: { week: number; total: number };
}) {
  const [prog, setProg] = useState<{ done: number; topics: number } | null>(null);
  useEffect(() => {
    let gone = false;
    api.myCourseProgress(course).then((r) => {
      if (gone) return;
      setProg({ done: r.weeks.reduce((s, w) => s + w.done, 0), topics: r.weeks.reduce((s, w) => s + w.topics, 0) });
    }).catch(() => {});
    return () => { gone = true; };
  }, [course]);
  const pct = prog && prog.topics ? Math.min(1, prog.done / prog.topics) : 0;
  const state = !prog || prog.done === 0 ? 'Not started' : pct >= 1 ? 'Done' : 'In progress';
  const lecturer = staff.map((s) => s.name).join(' · ');
  return (
    <Link
      to={`/course/${encodeURIComponent(course)}`}
      className="rise"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms`, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'var(--text)' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {(staff.length ? staff : [{ name: '', avatar: '', persona: '' }]).map((s, si) => {
            const pic = resolvePicture({ avatar_url: s.avatar, box_boy_persona: s.persona });
            return (
              <img
                key={si}
                src={pic.kind !== 'none' ? pic.src : PERSONAS[2].img}
                alt=""
                title={s.name || undefined}
                width={44}
                height={44}
                loading="lazy"
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', marginLeft: si === 0 ? 0 : -14, background: 'var(--u-good-tint)' }}
              />
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{course}</span>
            {priority && <span className="pill pill--amber" style={{ fontSize: 10 }}>PRIORITY</span>}
          </div>
          {title && <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>}
          {lecturer && <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lecturer}</div>}
        </div>
        <span className={`pill ${state === 'Not started' ? 'pill--grey' : 'pill--good'}`} style={{ flexShrink: 0 }}>{state}</span>
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: 'var(--border)', overflow: 'hidden' }} aria-label={`${Math.round(pct * 100)}% of published topics done`}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: 'var(--u-green)' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
        {[semWeek.week ? `Week ${semWeek.week} of ${semWeek.total}` : '', prog && prog.topics ? `${prog.done} of ${prog.topics} topics` : 'No notes published yet'].filter(Boolean).join(' · ')}
      </div>
    </Link>
  );
}

// C01 for authors: the next week to write in each course (with the lecturer's
// materials for it, when they've shared some) and open student reports.
function AuthorNextUp({ courses }: { courses: string[] }) {
  const [rows, setRows] = useState<{ course: string; next: number; material: string }[]>([]);
  const [reports, setReports] = useState(0);
  useEffect(() => {
    let gone = false;
    (async () => {
      const out: { course: string; next: number; material: string }[] = [];
      for (const c of courses.slice(0, 4)) {
        try {
          const [w, m] = await Promise.all([api.courseWeeks(c), api.materials(c).catch(() => ({ materials: [] as { week: number; title: string }[] }))]);
          const have = new Set(w.weeks.map((x) => x.week));
          const next = Array.from({ length: 15 }, (_, i) => i + 1).find((n) => !have.has(n));
          if (next) out.push({ course: c, next, material: m.materials.find((x) => x.week === next)?.title || '' });
        } catch {
          // a course that fails just doesn't show
        }
      }
      if (!gone) setRows(out);
      api.contentReports().then((r) => { if (!gone) setReports(r.reports.filter((x) => x.status === 'open').length); }).catch(() => {});
    })();
    return () => { gone = true; };
  }, [courses.join('|')]);
  if (!rows.length && !reports) return null;
  return (
    <div style={{ margin: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Next up</h2>
      {rows.map((r) => (
        <Link key={r.course} to={`/studio?course=${encodeURIComponent(r.course)}&week=${r.next}`} style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{r.course} · Week {r.next}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{r.material ? `Lecturer's material ready: ${r.material}` : 'Waiting for the lecturer’s materials, or start from your own notes'}</span>
          </span>
          <ChevronRight size={16} color="var(--u-good)" />
        </Link>
      ))}
      {reports > 0 && (
        <Link to="/content-reports" style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Student reports</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{reports} to look at</span>
          </span>
          <ChevronRight size={16} color="var(--u-good)" />
        </Link>
      )}
    </div>
  );
}

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

export default function HomeRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [enrolled, setEnrolled] = useState<string[]>([]);
  const [signInPhoto, setSignInPhoto] = useState('');
  const gaps = profileGaps(profile, signInPhoto);
  const [liveUpdates, setLiveUpdates] = useState<HomeUpdate[]>([]);
  useEffect(() => {
    api.updates().then((r) => setLiveUpdates(r.updates || [])).catch(() => {});
  }, []);
  // S44: the school's guide sits in the carousel; it leads when the admin has
  // updated it since this student last opened it.
  const [guide, setGuide] = useState<{ title: string; steps: number; updated: string; fresh: boolean } | null>(null);
  useEffect(() => {
    api.guide().then((r) => {
      if (!r.guide) return;
      let seen = '';
      try { seen = localStorage.getItem('unify:guide-seen') || ''; } catch { /* fine */ }
      setGuide({ title: r.guide.title, steps: r.guide.steps.length, updated: r.guide.updated_at, fresh: seen !== r.guide.updated_at });
    }).catch(() => {});
  }, []);
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
  const [catalog, setCatalog] = useState<Record<string, { title: string; weeks: number; lecturers: string[]; levels?: string[]; staff: { name: string; avatar: string; persona?: string }[] }>>({});
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
          api.courses().catch(() => [] as { code: string; title: string; weeks: number; lecturers: string[]; levels?: string[]; staff: { name: string; avatar: string; persona?: string }[] }[]),
        ]);
        if (!me.onboarded || !me.profile) {
          navigate('/onboarding');
          return;
        }
        setProfile(me.profile);
        setSignInPhoto(me.avatar || '');
        setEnrolled(me.courses || []);
        setResume(me.resume || null);
        setIsAdmin(!!me.isAdmin);
        // Streak heartbeat: showing up counts (server records one/day).
        void api.pingDaily();
        // Waiting-room lookup: students who applied for staff see status.
        // Not awaited here: joins the panel batch below so it never delays the rest.
        const roleReq =
          (me.profile?.role || 'student') === 'student'
            ? api
                .myRoleRequest()
                .then((mine) => {
                  if (mine.request && mine.request.status === 'pending') setPendingReq(mine.request);
                })
                .catch(() => {
                  // no waiting room without a readable request
                })
            : Promise.resolve();
        // BUG-012: one catalog fetch feeds every course card (title,
        // weeks, lecturers) — never one request per card.
        try {
          const map: Record<string, { title: string; weeks: number; lecturers: string[]; levels?: string[]; staff: { name: string; avatar: string; persona?: string }[] }> = {};
          for (const c of catRes) map[c.code.toUpperCase().trim()] = { title: c.title, weeks: c.weeks || 0, lecturers: c.lecturers || [], levels: c.levels || [], staff: c.staff || [] };
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
          setCourses(stats.courses || []);
          setQuizzes({ taken: stats.quizzesTaken || 0, avg: stats.quizAvg || 0 });
        }
        // Author + admin panels are independent: fire them all together
        // (each failure leaves only its own panel empty).
        const panels: Promise<unknown>[] = [roleReq];
        if (me.profile?.role === 'lecturer' || me.profile?.role === 'contributor') {
          panels.push(
            api.authored().then((a) => setNotes(a.notes)).catch(() => {}),
            api.teaching().then((t) => setTeaching(t.courses || [])).catch(() => {}),
            api.contributions().then((c) => setMyContribs(c.courses || [])).catch(() => {}),
            api.authorStats().then(setAstats).catch(() => {}),
          );
        }
        // Oversight loads for every effective admin, both dashboard views.
        if (me.isAdmin) {
          panels.push(
            api
              .adminStats()
              .then((s) => setPlatform({ users: s.users, weeks: s.weeks, topics: s.topics, courses: s.courses, xpTotal: s.xpTotal }))
              .catch(() => {}),
            api.adminActivity().then(setActivity).catch(() => {}),
          );
        }
        await Promise.all(panels);
      } catch {
        setLoadError("Couldn't load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) return <DashboardSkeleton author={skelAuthor} />;
  if (loadError)
    return <ErrorState title="Couldn't load Home" message={loadError} />;
  // Admins have one front page: the admin Overview.
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;

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
        <HomeHero profile={profile!} firstName={firstName} />
        {gaps.length > 0 && (
          <div style={{ margin: '12px 16px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 13 }}><strong>Finish your profile</strong> <span style={{ color: 'var(--text2)' }}>— still missing {gapsText(gaps)}.</span></div>
            <Link to="/me" style={{ padding: '8px 16px', background: 'var(--u-amber)', color: 'var(--u-black)', borderBottom: '3px solid #c69a1a', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
              {gaps.length === 1 && gaps[0] === 'a picture' ? 'Add photo' : 'Finish up'}
            </Link>
          </div>
        )}
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
          <Link to="/browse" style={{ fontSize: 13, color: 'var(--u-good)', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
            Browse {profile?.level ? `${profile.level} ` : ''}notes <ChevronRight size={14} />
          </Link>
        </div>
        {profile?.role === 'lecturer' || teaching.length > 0 ? (
          <Link to="/my-classes" style={{ margin: '12px 16px 0', padding: 14, background: 'var(--u-green)', color: 'var(--u-black)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none' }}>
            <BookOpen size={20} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 800, display: 'block' }}>My Classes</span>
              <span style={{ fontSize: 12, opacity: 0.9 }}>Timetable + roster for the courses you teach</span>
            </span>
            <ChevronRight size={16} />
          </Link>
        ) : null}
        {(profile?.role === 'contributor' || profile?.role === 'lecturer') && myContribs.some((c) => c.assigned) && (
          <AuthorNextUp courses={myContribs.filter((c) => c.assigned).map((c) => c.course)} />
        )}
        {(profile?.role === 'contributor' || profile?.role === 'lecturer') && (
          <div style={{ margin: '16px 16px 0' }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>My contributions</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {myContribs.filter((c) => c.assigned).length} course{myContribs.filter((c) => c.assigned).length === 1 ? '' : 's'} assigned{profile?.role === 'contributor' ? ' · 2-course cap per level' : ''} · totals cover every author on shared courses.
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myContribs.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, fontSize: 13 }}>
                  No courses assigned yet — ask an admin to assign your courses.
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
              <BoxBoy pose="chairRelax" width={77} />
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
                  <div style={{ fontSize: 11, color: 'var(--u-good)', fontWeight: 800, letterSpacing: 1 }}>{n.course} · WEEK {n.week} · L{n.lecture || 1}·T{n.topic} · v{n.version}{older > 0 ? ` · ${older} older` : ''}</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{n.title || `Topic ${n.topic}`}</div>
                </Link>
                <button
                  onClick={() => setConfirmDelete(n.id)}
                  disabled={deleting === n.id}
                  aria-label={`Delete ${n.course} week ${n.week} topic ${n.topic} version ${n.version}`}
                  style={{ padding: 10, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--u-red)', opacity: deleting === n.id ? 0.5 : 1 }}
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
  // Admin updates: the button shows only for viewers who can open its page
  // (role-gated pages would bounce everyone else straight back to Home).
  const updateSlides: UpdateSlide[] = liveUpdates.map((u) => {
    const linkOk = canOpenLink(u.link, profile?.role, isAdmin);
    return { id: 'live-' + u.id, pose: u.pose, tag: 'From Unify', title: u.title, body: u.body, to: linkOk && u.link && u.link.startsWith('/') ? u.link : undefined, href: u.link && u.link.startsWith('https://') ? u.link : undefined, cta: u.cta || 'Open' };
  });
  // Continue-where-you-stopped leads the slideshow, opening the exact topic.
  if (resume && resume.course) {
    const q = new URLSearchParams();
    if (resume.topic) q.set('t', String(resume.topic));
    if (resume.lecture && resume.lecture > 1) q.set('c', String(resume.lecture));
    const qs = q.toString();
    updateSlides.unshift({ id: 'resume', pose: 'readingStanding', tag: 'Pick up', title: `${resume.course} · Week ${resume.week}`, body: 'You stopped here. A few minutes keeps the streak alive.', to: `/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${qs ? `?${qs}` : ''}`, cta: 'Resume' });
  }
  if (shown.length === 0) updateSlides.push({ id: 'enroll', pose: 'peeking', tag: 'Start here', title: 'Add your courses', body: 'Find your department’s courses and the notes appear on Home.', to: '/courses/find', cta: 'Find courses' });
  if (guide) {
    const slide: UpdateSlide = { id: 'guide', pose: 'targetSign', tag: guide.fresh ? 'Updated by your school' : 'Guide', title: guide.title, body: `${guide.steps} steps, in order, with where to go for each one.`, to: '/guide', cta: 'Open the guide' };
    if (guide.fresh) updateSlides.splice(resume ? 1 : 0, 0, slide);
    else updateSlides.push(slide);
  }
  // Practice: the course games, with their leaderboards.
  if (shown.length > 0 && (profile?.role || 'student') === 'student') {
    updateSlides.push({ id: 'practice', pose: 'cheer', tag: 'Practice', title: 'Course games', body: 'Keywords and Crossword from your own notes, against the clock, with leaderboards for your course.', to: '/games', cta: 'Play now' });
  }
  updateSlides.push({ id: 'attend', pose: 'phoneOut', tag: 'In class', title: 'Your attendance pass', body: 'In class, open My pass and let your class rep or lecturer scan it.', to: '/attendance/pass', cta: 'My pass' });
  updateSlides.push({ id: 'class', pose: 'thumbsUpPhone', tag: 'Your class', title: 'Notices from your class rep', body: 'Board posts and shared materials from your course live in Class.', to: '/class', cta: 'Open Class' });
  {
    const f = FACTS[new Date().getDate() % FACTS.length];
    updateSlides.push({ id: 'fact', pose: 'chairRelax', tag: f.tag, title: 'Did you know?', body: f.text });
  }
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <HomeHero profile={profile!} firstName={firstName} showCgpa={profile?.role === 'student'} />

      {profile?.role === 'student' && <WelcomeBack firstName={firstName} resume={resume} />}

      <div className="rise" style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
        <div>
          {profile?.cgpa_target != null ? (
            <div className="stat-num" style={{ fontSize: 18 }}>{Number(profile.cgpa_target).toFixed(2)}</div>
          ) : profile?.role === 'student' ? (
            <Link to="/cgpa-planner" className="stat-num" style={{ fontSize: 15, color: 'var(--u-text)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Set</Link>
          ) : (
            <div className="stat-num" style={{ fontSize: 18 }}>—</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>CGPA target</div>
        </div>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{xp}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>XP</div>
        </div>
        <Link to="/streak" style={{ color: 'inherit', textDecoration: 'none' }} aria-label={`Streak: ${streak} days. Open your streak`}>
          <div className="stat-num" style={{ fontSize: 18 }}>{streak}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Streak</div>
        </Link>
        <div>
          <div className="stat-num" style={{ fontSize: 18 }}>{shown.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
        </div>
      </div>

      {/* Live wire: urgent messages with a countdown, between the stats and the carousel. */}
      <LiveWire />

      <UpdatesSlider slides={updateSlides} />

      {quizzes.taken > 0 && (
        <div style={{ margin: '0 16px 12px', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
          {quizzes.taken} {quizzes.taken === 1 ? 'quiz' : 'quizzes'} taken · {quizzes.avg}% average
        </div>
      )}
      {profile?.role === 'student' && courses.some((c) => c.topics > 0) && (
        <Link to="/revision" style={{ margin: '0 16px 12px', display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, color: 'var(--text)', textDecoration: 'none' }}>
          <img src={PERSONAS[2].img} alt="" width={40} height={40} loading="lazy" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Revise what you've learned</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>10 quick recall cards from topics you've finished</span>
          </span>
          <ChevronRight size={18} color="var(--u-good)" />
        </Link>
      )}

      {gaps.length > 0 && (
        <div style={{ margin: '0 16px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface2)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--text3)', flexShrink: 0 }}>
            {(profile?.first_name || 'U').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Finish your profile</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Still missing {gapsText(gaps)}.</div>
          </div>
          <Link to="/me" style={{ padding: '8px 16px', background: 'var(--u-amber)', color: 'var(--u-black)', borderBottom: '3px solid #c69a1a', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
            {gaps.length === 1 && gaps[0] === 'a picture' ? 'Add photo' : 'Finish up'}
          </Link>
        </div>
      )}

      {pendingReq && (
        <div style={{ margin: '0 16px 12px', background: 'var(--u-warn-tint)', border: '1px solid #fde68a', borderRadius: 12, padding: 16 }}>
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

      {isAdmin && platform && (
        <OversightCard platform={platform} activity={activity} mainAdmin={profile?.role === 'admin'} />
      )}

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/courses/find" style={{ fontSize: 13, color: 'var(--u-good)', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
          Manage courses <ChevronRight size={14} />
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 16 }}>
            <BoxBoy pose="peeking" width={77} />
            <div style={{ marginTop: 8 }}>No courses yet. Add the ones you're taking this semester.</div>
            <Link to="/courses/find" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: 'var(--u-amber)', color: 'var(--u-black)', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #c69a1a' }}>
              Explore courses to enroll
            </Link>
          </div>
        ) : (
          shown.map((c, i) => {
            const key = c.course.toUpperCase().trim();
            const meta = catalog[key];
            const levels = meta?.levels || [];
            return (
              <CourseCard
                key={c.course}
                index={i}
                course={c.course.trim()}
                title={meta?.title || ''}
                staff={(meta?.staff || []).slice(0, 3)}
                // PRIORITY: a course from another level (carryover or elective).
                priority={!!profile?.level && levels.length > 0 && !levels.includes(profile.level)}
                semWeek={semesterWeekOf(profile?.semester_start, profile?.semester_weeks)}
              />
            );
          })
        )}
      </div>
      {confirmUnenroll && (
        <ConfirmModal
          title={`Remove ${confirmUnenroll}?`}
          body="It leaves Home. You can add it back any time from Courses, and your XP and progress stay."
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

