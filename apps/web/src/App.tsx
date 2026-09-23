import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Layout from './routes/_layout';
import CourseRoute from './routes/course';
import LearnWeek from './routes/learn/week';
import AuthRoute from './routes/auth';
import DashboardRoute from './routes/dashboard';
import OnboardingRoute from './routes/onboarding';
import ProfileRoute from './routes/profile';
import StudioRoute from './routes/studio/index';
import StudioReviewRoute from './routes/studio/review';
import Mascot from './components/Mascot';
import Loading from './components/Loading';
import { supabaseBrowser } from './lib/supabase';
import { api } from './lib/api';

function NotFound() {
  const link: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: 9999,
    background: '#10b981',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 800,
    borderBottom: '4px solid #059669',
  };
  return (
    <div style={{ padding: 40, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <Mascot size={120} animate="wave" />
      </div>
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24 }}>Page not found</h1>
      <p style={{ color: '#777', fontSize: 14, margin: '8px 0 20px' }}>This link doesn't exist. Try one of these:</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/course" style={link}>Learn</Link>
        <Link to="/auth" style={link}>Sign in</Link>
        <Link to="/dashboard" style={link}>Dashboard</Link>
      </div>
    </div>
  );
}

// Gate: no session -> /auth. Every app route sits behind this; the pages
// themselves additionally check the profile (onboarded -> app, else onboarding).
function RequireAuth({ children }: { children: JSX.Element }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      navigate('/auth');
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/auth');
      else setOk(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/auth');
      else setOk(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ok) return <Loading text="Checking sign-in…" />;
  return children;
}

const STUDENT_ONLY = ['student'];
const AUTHOR_ONLY = ['lecturer', 'collaborator'];

// Gate: authors (lecturer/collaborator) have no learn paths — bounce to dashboard.
function RequireRole({ allow, children }: { allow: string[]; children: JSX.Element }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const key = allow.join('|');

  useEffect(() => {
    api
      .me()
      .then((me) => {
        const role = me.profile?.role || 'student';
        if (!me.onboarded) navigate('/onboarding');
        else if (!allow.includes(role)) navigate('/dashboard');
        else setOk(true);
      })
      .catch(() => navigate('/auth'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, key]);

  if (!ok) return <Loading text="Checking access…" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Chromeless: no top bar on sign in / onboarding */}
        <Route path="/auth" element={<AuthRoute />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingRoute />
            </RequireAuth>
          }
        />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route
            path="/course"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <CourseRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/learn/:courseCode/week/:week"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <LearnWeek />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfileRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/studio"
            element={
              <RequireAuth>
                <RequireRole allow={AUTHOR_ONLY}>
                  <StudioRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/studio/review"
            element={
              <RequireAuth>
                <RequireRole allow={AUTHOR_ONLY}>
                  <StudioReviewRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
