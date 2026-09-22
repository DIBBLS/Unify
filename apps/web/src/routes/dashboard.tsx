import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

function gradeToPoint(g: string) {
  const m: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
  return m[g.toUpperCase()] ?? 0;
}

export default function DashboardRoute() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate('/auth');
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      const data = snap.data() || {};
      setProfile(data);
      setCourses(data.courses || []);
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard…</div>;

  const graded = courses.filter((c) => c.grade && c.grade !== '-' && c.grade !== '');
  const totalUnits = courses.reduce((s, c) => s + (c.units || 3), 0);
  let cgpa = 0;
  if (graded.length) {
    let w = 0,
      u = 0;
    graded.forEach((c) => {
      w += gradeToPoint(c.grade) * (c.units || 3);
      u += c.units || 3;
    });
    cgpa = u ? w / u : 0;
  }

  const pct = 68;
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 12px', background: '#fff' }}>
        <div style={{ fontSize: 11, color: '#afafaf', letterSpacing: 1 }}>Your Dashboard</div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28, marginTop: 4 }}>
          Good to have you, <em style={{ background: '#58cc02', color: '#fff', padding: '0 6px', borderRadius: 6, fontStyle: 'normal' }}>{profile?.firstName || user?.displayName?.split(' ')[0] || 'Builder'}</em>
        </h1>
        <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>{profile?.department || ''}</div>
      </div>

      <div style={{ margin: '12px 16px', background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile?.gradePlanner?.target || '—'}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Target</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{cgpa.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: '#777' }}>CGPA</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totalUnits}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Units</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{courses.length}</div>
          <div style={{ fontSize: 11, color: '#777' }}>Courses</div>
        </div>
      </div>

      <div style={{ margin: '0 16px 12px', height: 8, background: '#e5e5e5', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#58cc02', borderRadius: 9999 }} />
      </div>
      <div style={{ margin: '0 16px 16px', fontSize: 12, color: '#777', textAlign: 'right' }}>{pct}% complete</div>

      <div style={{ margin: '0 16px', background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, background: '#dbf8c5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📚</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Continue Learning</div>
          <div style={{ fontSize: 12, color: '#777' }}>Pick up where you left off</div>
        </div>
        <Link to="/course" style={{ padding: '10px 16px', background: '#58cc02', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #58a700' }}>
          Resume
        </Link>
      </div>

      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Your Courses</h2>
        <Link to="/course" style={{ fontSize: 13, color: '#58a700', fontWeight: 700, textDecoration: 'none' }}>
          View all →
        </Link>
      </div>
      <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16 }}>No courses yet. Go to Courses to enroll.</div>
        ) : (
          courses.slice(0, 5).map((c) => (
            <Link key={c.course} to={`/learn/${encodeURIComponent(c.course)}/week/1`} style={{ padding: 14, background: '#fff', border: '2px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: '#3c3c3c' }}>
              <span style={{ fontWeight: 700 }}>{c.course}</span>
              <span style={{ fontSize: 12, color: '#777' }}>{c.units || 3} units</span>
            </Link>
          ))
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'space-around', background: '#fff', borderTop: '2px solid #e5e5e5', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: '#58cc02', fontWeight: 700, fontSize: 12 }}>
          Dashboard
        </Link>
        <Link to="/course" style={{ textDecoration: 'none', color: '#777', fontSize: 12 }}>
          Learn
        </Link>
        <Link to="/auth" style={{ textDecoration: 'none', color: '#777', fontSize: 12 }}>
          Profile
        </Link>
      </nav>
    </div>
  );
}
