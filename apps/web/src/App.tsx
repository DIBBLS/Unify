import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from './routes/_layout';
import CourseRoute from './routes/course';
import ExploreRoute from './routes/explore';
import CourseDetailRoute from './routes/courseDetail';
import LearnWeek from './routes/learn/week';
import AuthRoute from './routes/auth';
import DashboardRoute from './routes/dashboard';
import OnboardingRoute from './routes/onboarding';
import ProfileRoute from './routes/profile';
import AdminRoute from './routes/admin';
import StudioRoute from './routes/studio/index';
import Mascot from './components/Mascot';
import Loading from './components/Loading';
import { supabaseBrowser, ensureSession, setCachedSession, getCachedSession } from './lib/supabase';
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
  // Start open when a previous gate already confirmed the session, so
  // navigating between pages never flashes "Checking sign-in…".
  const [ok, setOk] = useState(() => {
    const c = getCachedSession();
    return c.loaded && !!c.session;
  });

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      navigate('/auth');
      return;
    }
    ensureSession().then((session) => {
      if (!session) navigate('/auth');
      else setOk(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setCachedSession(session);
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
// Only a real 401 (dead session) bounces to /auth. Network/API failures show
// a retry screen instead of kicking the user to sign-in and back (that loop
// is what made sessions feel like they "refresh anyhow").
function RequireRole({ allow, children }: { allow: string[]; children: JSX.Element }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ok, setOk] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = allow.join('|');

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        const role = me.profile?.role || 'student';
        // Authors may open a single week read-only via ?preview=1 (dashboard links).
        const preview =
          searchParams.get('preview') === '1' &&
          (role === 'lecturer' || role === 'collaborator' || me.isAdmin);
        if (!me.onboarded) navigate('/onboarding');
        else if (!allow.includes(role) && !me.isAdmin && !preview) navigate('/dashboard');
        else setOk(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number })?.status === 401) navigate('/auth');
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, key]);

  if (failed)
    return (
      <div style={{ padding: 40, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <Mascot size={110} />
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20, marginTop: 12 }}>Can't reach the server</h1>
        <p style={{ color: '#777', fontSize: 14, margin: '8px 0 20px' }}>You're still signed in — check your connection and retry.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', fontWeight: 800, fontSize: 14 }}>
          Retry
        </button>
      </div>
    );
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
            path="/explore"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <ExploreRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/course/:courseCode"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <CourseDetailRoute />
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
            path="/admin"
            element={
              <RequireAuth>
                <AdminRoute />
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

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
