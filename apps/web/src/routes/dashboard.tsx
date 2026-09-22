import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type Profile } from '../lib/api';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';

type CourseStat = { course: string; topics: number };

export default function DashboardRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
        const stats = await api.stats();
        setXp(stats.xp);
        setStreak(stats.streak);
        setCourses(stats.courses);
      } catch {
        setLoadError("Couldn't load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) return <Loading text="Loading dashboard…" />;
  if (loadError)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 40 }}>
        <Flash
          tone="error"
          message={loadError}
          ttl={0}
          action={
            <button onClick={() => window.location.reload()} style={{ padding: '8px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13 }}>
              Retry
            </button>
          }
        />
      </div>
    );

  const firstName = profile?.first_name || 'Builder';
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>{courses.length}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Courses</div>
        </div>
      </div>

      <div style={{ margin: '0 16px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, background: '#ecfdf5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen size={20} color="#059669" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Continue Learning</div>
          <div style={{ fontSize: 12, color: '#777' }}>Pick up where you left off</div>
        </div>
        <Link to="/course" style={{ padding: '10px 16px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
          Resume
        </Link>
      </div>

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/course" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'flex', gap: 4, alignItems: 'center' }}>
          View all <ChevronRight size={14} />
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>No courses yet. Go to Courses to enroll.</div>
          </div>
        ) : (
          courses.map((c) => (
            <Link key={c.course} to={`/learn/${encodeURIComponent(c.course)}/week/1`} style={{ padding: 14, background: '#fff', border: '2px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: '#3c3c3c' }}>
              <span style={{ fontWeight: 700 }}>{c.course}</span>
              <span style={{ fontSize: 12, color: '#777' }}>{c.topics} topics done</span>
            </Link>
          ))
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'space-around', background: '#fff', borderTop: '2px solid #e5e5e5', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: '#10b981', fontWeight: 700, fontSize: 12 }}>
          Dashboard
        </Link>
        <Link to="/course" style={{ textDecoration: 'none', color: '#777', fontSize: 12 }}>
          Learn
        </Link>
        <Link to="/profile" style={{ textDecoration: 'none', color: '#777', fontSize: 12 }}>
          Profile
        </Link>
      </nav>
    </div>
  );
}
