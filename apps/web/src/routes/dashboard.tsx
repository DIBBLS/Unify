import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type Profile } from '../lib/api';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';

type CourseStat = { course: string; topics: number };

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
  const [notes, setNotes] = useState<{ id: string; course: string; week: number; topic: number; version: number; title: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteError, setNoteError] = useState('');

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
          if (me.isAdmin) {
            try {
              const s = await api.adminStats();
              setPlatform({ users: s.users, weeks: s.weeks, topics: s.topics, courses: s.courses, xpTotal: s.xpTotal });
            } catch {
              // platform stats stand empty
            }
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
    if (!window.confirm('Delete this note version? Older versions stay live.')) return;
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
        <div style={{ padding: '20px 16px 12px', background: '#fff' }}>
          <div style={{ fontSize: 11, color: '#afafaf', letterSpacing: 1 }}>Your Dashboard</div>
          <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28, marginTop: 4 }}>
            Good to have you, <em style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '0 6px', borderRadius: 6, fontStyle: 'normal' }}>{firstName}</em>
          </h1>
          <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>{profile?.department || roleLabel}</div>
        </div>
        {astats && (
          <div style={{ margin: '12px 16px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.topics}</div>
              <div style={{ fontSize: 11, color: '#777' }}>Topics</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.students}</div>
              <div style={{ fontSize: 11, color: '#777' }}>Students</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.completions}</div>
              <div style={{ fontSize: 11, color: '#777' }}>Done</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{astats.quizzesTaken}</div>
              <div style={{ fontSize: 11, color: '#777' }}>Quizzes</div>
            </div>
          </div>
        )}
        {isAdmin && platform && (
          <div style={{ margin: '0 16px', background: '#111827', borderRadius: 12, padding: 16, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Platform</div>
              <Link to="/admin" style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, textDecoration: 'none' }}>Open Admin panel</Link>
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
          </div>
        )}
        <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Published notes</h2>
          <span style={{ fontSize: 13, color: '#777' }}>{notes.length}</span>
        </div>
        {noteError && (
          <div style={{ margin: '12px 16px 0' }}>
            <Flash tone="error" message={noteError} onDismiss={() => setNoteError('')} />
          </div>
        )}
        <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
              <Mascot size={96} />
              <div style={{ marginTop: 8 }}>Nothing published yet. Open Studio to author your first week.</div>
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} style={{ padding: 14, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Link to={`/learn/${encodeURIComponent(n.course)}/week/${n.week}?preview=1`} style={{ flex: 1, textDecoration: 'none', color: '#3c3c3c', display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, letterSpacing: 1 }}>{n.course} · WEEK {n.week} · TOPIC {n.topic} · v{n.version}</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{n.title || `Topic ${n.topic}`}</div>
                </Link>
                <button
                  onClick={() => deleteNote(n.id)}
                  disabled={deleting === n.id}
                  aria-label={`Delete ${n.course} week ${n.week} topic ${n.topic} version ${n.version}`}
                  style={{ padding: 10, borderRadius: 10, background: '#fff', border: '1px solid #e5e5e5', color: '#991b1b', opacity: deleting === n.id ? 0.5 : 1 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 12px', background: '#fff' }}>
        <div style={{ fontSize: 11, color: '#afafaf', letterSpacing: 1 }}>Your Dashboard</div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28, marginTop: 4 }}>
          Good to have you, <em style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '0 6px', borderRadius: 6, fontStyle: 'normal' }}>{firstName}</em>
        </h1>
        <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>{profile?.department || ''}</div>
      </div>

      <div style={{ margin: '12px 16px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile?.grad_target ?? '—'}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Target</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{xp}</div>
          <div style={{ fontSize: 11, color: '#777' }}>XP</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{streak}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Streak</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{shown.length}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Courses</div>
        </div>
      </div>

      {quizzes.taken > 0 && (
        <div style={{ margin: '0 16px 12px', fontSize: 12, color: '#777', textAlign: 'center' }}>
          {quizzes.taken} {quizzes.taken === 1 ? 'quiz' : 'quizzes'} taken · {quizzes.avg}% average
        </div>
      )}

      {resume && resume.course ? (
        <div style={{ margin: '0 16px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, background: '#ecfdf5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} color="#059669" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Continue Learning</div>
            <div style={{ fontSize: 12, color: '#777' }}>{resume.course} · Week {resume.week} · pick up where you stopped</div>
          </div>
          <Link to={`/learn/${encodeURIComponent(resume.course.trim())}/week/${resume.week}${resume.topic ? `?t=${resume.topic}` : ''}`} style={{ padding: '10px 16px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
            Resume
          </Link>
        </div>
      ) : null}

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/course" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
          View all <ChevronRight size={14} />
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses yet.</div>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
              Explore courses to enroll
            </Link>
          </div>
        ) : (
          shown.map((c) => (
            <Link key={c.course} to={`/course/${encodeURIComponent(c.course.trim())}`} style={{ padding: 14, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: '#3c3c3c' }}>
              <span style={{ fontWeight: 700 }}>{c.course}</span>
              <ChevronRight size={16} color="#059669" />
            </Link>
          ))
        )}
      </div>

    </div>
  );
}
