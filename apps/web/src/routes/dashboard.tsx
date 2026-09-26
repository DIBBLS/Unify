import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type Profile } from '../lib/api';
import Loading from '../components/Loading';
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>{platform.users}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Users</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{platform.courses}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Courses</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{platform.weeks}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Weeks</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{platform.topics}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Topics</div>
        </div>
      </div>
      {activity && (activity.recentUsers.length > 0 || activity.recentNotes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>NEW USERS</div>
            {activity.recentUsers.slice(0, 3).map((u, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.first_name || 'Unnamed'} · {u.role}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>NEW NOTES</div>
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
  const [resume, setResume] = useState<{ course: string; week: number; topic: number } | null>(null);
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
  const [notes, setNotes] = useState<{ id: string; course: string; week: number; topic: number; version: number; title: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteError, setNoteError] = useState('');
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
        const me = await api.me();
        if (!me.onboarded || !me.profile) {
          navigate('/onboarding');
          return;
        }
        setProfile(me.profile);
        setEnrolled(me.courses || []);
        setResume(me.resume || null);
        setIsAdmin(!!me.isAdmin);
        const stats = await api.stats();
        setXp(stats.xp);
        setStreak(stats.streak);
        setCourses(stats.courses);
        setQuizzes({ taken: stats.quizzesTaken || 0, avg: stats.quizAvg || 0 });
        if (me.profile?.role === 'lecturer' || me.profile?.role === 'collaborator') {
          try {
            const authored = await api.authored();
            setNotes(authored.notes);
          } catch {
            // empty list stands
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

  if (loading) return <Loading text="Loading dashboard…" />;
  if (loadError)
    return <ErrorState title="Couldn't load your dashboard" message={loadError} />;

  const firstName = profile?.first_name || 'Builder';
  const cleanEnrolled = enrolled.map((c) => (c || '').trim()).filter(Boolean);
  const shown = cleanEnrolled.length
    ? cleanEnrolled.map((course) => ({ course }))
    : courses.map((c) => ({ course: c.course }));
  const isAuthor = profile?.role === 'lecturer' || profile?.role === 'collaborator';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '';

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
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
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
        {astats && (
          <div className="rise" style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.topics}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Notes</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.courses}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.students}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Students</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.completions}</div>
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
        {noteError && (
          <div style={{ margin: '12px 16px 0' }}>
            <Flash tone="error" message={noteError} onDismiss={() => setNoteError('')} />
          </div>
        )}
        <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <Mascot size={96} />
              <div style={{ marginTop: 8 }}>Nothing published yet. Open Studio to author your first week.</div>
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Link to={`/learn/${encodeURIComponent(n.course)}/week/${n.week}?preview=1`} style={{ flex: 1, textDecoration: 'none', color: 'var(--text)', display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, letterSpacing: 1 }}>{n.course} · WEEK {n.week} · TOPIC {n.topic} · v{n.version}</div>
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
            ))
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
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile?.grad_target ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Target</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{xp}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>XP</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{streak}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Streak</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{shown.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Courses</div>
        </div>
      </div>

      {quizzes.taken > 0 && (
        <div style={{ margin: '0 16px 12px', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
          {quizzes.taken} {quizzes.taken === 1 ? 'quiz' : 'quizzes'} taken · {quizzes.avg}% average
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
          <Link to={`/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${resume.topic ? `?t=${resume.topic}` : ''}`} style={{ padding: '10px 16px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
            Resume
          </Link>
        </div>
      ) : null}

      {isAdmin && platform && (
        <OversightCard platform={platform} activity={activity} mainAdmin={profile?.role === 'admin'} />
      )}

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/course" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
          View all <ChevronRight size={14} />
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 16 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses yet.</div>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
              Explore courses to enroll
            </Link>
          </div>
        ) : (
          shown.map((c, i) => (
            <Link key={c.course} to={`/course/${encodeURIComponent(c.course.trim())}`} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms`, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
              <span style={{ fontWeight: 700 }}>{c.course}</span>
              <ChevronRight size={16} color="#059669" />
            </Link>
          ))
        )}
      </div>

    </div>
  );
}
