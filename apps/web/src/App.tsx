import { Suspense, useEffect, useState } from 'react';
import { applyRouteMeta } from './lib/seo';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Layout from './routes/_layout';
import CourseRoute from './routes/courses';
import CourseDetailRoute from './routes/course-detail';
import LearnWeek from './routes/learn/week';
import AuthRoute from './routes/auth';
import HomeRoute from './routes/home';
import MeRoute from './routes/me';
import { ROUTES, LEGACY_REDIRECTS } from './lib/routes';
import { useParams } from 'react-router-dom';

// Code-split the secondary/author routes: students' first load (auth →
// dashboard → notes) never downloads Studio tables, admin panels or the
// visual equation builder — each chunk fetches only when its route opens.
const ClassRoute = lazyRoute(() => import('./routes/class'));
const OnboardingRoute = lazyRoute(() => import('./routes/onboarding'));
const OnboardingPersonaRoute = lazyRoute(() => import('./routes/onboarding-persona'));
const CGPAPlannerRoute = lazyRoute(() => import('./routes/cgpa-planner'));
const AttendanceSetupRoute = lazyRoute(() => import('./routes/attendance-setup'));
const AttendancePassRoute = lazyRoute(() => import('./routes/attendance-pass'));
const MyAttendanceRoute = lazyRoute(() => import('./routes/my-attendance'));
const ScannerRoute = lazyRoute(() => import('./routes/scanner'));
const HocDashboardRoute = lazyRoute(() => import('./routes/hoc-dashboard'));
const ClassListRoute = lazyRoute(() => import('./routes/class-list'));
const GuideRoute = lazyRoute(() => import('./routes/guide'));
const KeywordsRoute = lazyRoute(() => import('./routes/learn/keywords'));
const CrosswordRoute = lazyRoute(() => import('./routes/learn/crossword'));
const GamesRoute = lazyRoute(() => import('./routes/games'));
const LiveWireRoute = lazyRoute(() => import('./routes/livewire'));
const ReportBugRoute = lazyRoute(() => import('./routes/report-bug'));
const ClassContributorsRoute = lazyRoute(() => import('./routes/class-contributors'));
const HocWelcomeRoute = lazyRoute(() => import('./routes/hoc-welcome'));
const HocRequestsRoute = lazyRoute(() => import('./routes/hoc-requests'));
const ReportsRoute = lazyRoute(() => import('./routes/reports'));
const AdminRolesRoute = lazyRoute(() => import('./routes/admin-roles'));
const StreakRoute = lazyRoute(() => import('./routes/streak'));
const RevisionRoute = lazyRoute(() => import('./routes/revision'));
const ContentReportsRoute = lazyRoute(() => import('./routes/content-reports'));
const LecturerCourseRoute = lazyRoute(() => import('./routes/lecturer-course'));
const LecturerProfileRoute = lazyRoute(() => import('./routes/lecturer-profile'));
const SettingsRoute = lazyRoute(() => import('./routes/settings'));
const LecturerWelcomeRoute = lazyRoute(() => import('./routes/lecturer-welcome'));
const ClassDetailRoute = lazyRoute(() => import('./routes/class-detail'));
const OnboardingFinishRoute = lazyRoute(() => import('./routes/onboarding-finish'));
const NotificationSettingsRoute = lazyRoute(() => import('./routes/settings').then((m) => ({ default: m.NotificationSettingsRoute })));
const OnlineClassRoute = lazyRoute(() => import('./routes/online-class'));
const LecturerHomeRoute = lazyRoute(() => import('./routes/lecturer-home'));
const BecomeHocRoute = lazyRoute(() => import('./routes/become-hoc'));
const WelcomeRoute = lazyRoute(() => import('./routes/welcome'));
const TimetableRoute = lazyRoute(() => import('./routes/timetable'));
const ScreensRoute = lazyRoute(() => import('./routes/screens'));
const NotificationsRoute = lazyRoute(() => import('./routes/notifications'));
const AdminRoute = lazyRoute(() => import('./routes/admin'));
const BrowseRoute = lazyRoute(() => import('./routes/browse'));
const ShareRoute = lazyRoute(() => import('./routes/share'));
const StudioRoute = lazyRoute(() => import('./routes/studio/index'));
const MyClassesRoute = lazyRoute(() => import('./routes/my-classes'));

// Old paths (still written by the backend into notification/push links)
// forward to the redesign routes, keeping params, query and hash.
function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const path = to.replace(/:(\w+)/g, (_, k) => encodeURIComponent(params[k] ?? ''));
  return <Navigate to={`${path}${search}${hash}`} replace />;
}

// /api/share/:token is served by the edge OG function for bots; if a
// human lands here inside the SPA, forward to the real share landing.
function ShareRedirect() {
  const { token = '' } = useParams();
  return <Navigate to={`/s/${encodeURIComponent(token)}`} replace />;
}
import { BoxBoy } from './components/redesign/brand';
import Toasts from './components/Toasts';
import ZoomBar from './components/ZoomBar';
import InstallBar from './components/InstallBar';
import Loading from './components/Loading';
import ErrorState from './components/ErrorState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabaseBrowser, ensureSession, setCachedSession, getCachedSession } from './lib/supabase';
import { api } from './lib/api';
import { lazyRoute, preloadWhenIdle } from './lib/lazyRoute';
// Set once the next screens' code has been queued for idle download.
let preloaded = false;

function NotFound() {
  const link: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: 9999,
    background: 'var(--u-amber)',
    color: 'var(--u-black)',
    textDecoration: 'none',
    fontWeight: 800,
    borderBottom: '4px solid #c69a1a',
  };
  return (
    <div style={{ padding: 40, textAlign: 'center', maxWidth: 'var(--shell, 480px)', margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <BoxBoy pose="wavePhone" width={120} />
      </div>
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24 }}>Page not found</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>This link doesn't go anywhere. It may be old or mistyped. Try one of these:</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/courses" style={link}>My courses</Link>
        <Link to="/auth" style={link}>Sign in</Link>
        <Link to="/home" style={link}>Home</Link>
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
const AUTHOR_ONLY = ['lecturer', 'contributor'];

// Gate: authors (lecturer/contributor) have no learn paths — bounce to dashboard.
// Only a real 401 (dead session) bounces to /auth. Network/API failures show
// a retry screen instead of kicking the user to sign-in and back (that loop
// is what made sessions feel like they "refresh anyhow").
function RequireRole({ allow, children, strict = false }: { allow: string[]; children: JSX.Element; strict?: boolean }) {
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
          (role === 'lecturer' || role === 'contributor' || me.isAdmin);
        if (!me.onboarded) navigate('/onboarding');
        else if (!allow.includes(role) && (strict || !me.isAdmin) && !preview) navigate('/home');
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
      <ErrorState
        title="Can't reach the server"
        message="You're still signed in — check your connection and retry."
      />
    );
  if (!ok) return <Loading text="Checking access…" />;
  return children;
}

// Page title, description, canonical and robots tag for every route (SEO).
function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => { applyRouteMeta(pathname); }, [pathname]);
  // Once signed in and idle, fetch the code for the screens opened next.
  useEffect(() => {
    if (preloaded || !/^\/(home|courses|course|learn|me|class|timetable)/.test(pathname)) return;
    preloaded = true;
    preloadWhenIdle([
      () => import('./routes/timetable'),
      () => import('./routes/hoc-dashboard'),
      () => import('./routes/notifications'),
      () => import('./routes/revision'),
      () => import('./routes/games'),
      () => import('./routes/learn/keywords'),
      () => import('./routes/learn/crossword'),
    ]);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        {/* Global error toasts live here — above the routes — so failures
        surface on EVERY screen including chromeless ones (/auth,
        /onboarding, /s/:token) that never mount the layout. */}
        <Toasts />
        <RouteMeta />
        <ZoomBar />
        <InstallBar />
        {/* Lazy routes (Studio, admin, browse…) suspend on first open —
            this fallback covers every chunk fetch. */}
        <Suspense fallback={<Loading text="Loading…" />}>
        <Routes>
        {/* Chromeless: no top bar on sign in / onboarding */}
        <Route path="/auth" element={<AuthRoute />} />
        <Route path={ROUTES.welcome} element={<WelcomeRoute />} />
        {/* Public share landing: no session needed until expiry */}
        <Route path="/s/:token" element={<ShareRoute />} />
        {/* Fallback: if the edge OG function ever misses (misconfigured
        project root), humans opening /api/share links still land in-app
        instead of a 404. Bots get the function; humans get this. */}
        <Route path="/api/share/:token" element={<ShareRedirect />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/persona"
          element={
            <RequireAuth>
              <OnboardingPersonaRoute />
            </RequireAuth>
          }
        />
        <Route path="/onboarding/finish" element={<RequireAuth><OnboardingFinishRoute /></RequireAuth>} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route
            path={ROUTES.courses}
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <CourseRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="/class" element={<RequireAuth><HocDashboardRoute /></RequireAuth>} />
          <Route
            path="/courses/find"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <ClassRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/courses/:courseCode"
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
            path={ROUTES.home}
            element={
              <RequireAuth>
                <HomeRoute />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.me}
            element={
              <RequireAuth>
                <MeRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/cgpa-planner"
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY} strict>
                  <CGPAPlannerRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/:section?"
            element={
              <RequireAuth>
                <AdminRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/browse"
            element={
              <RequireAuth>
                <RequireRole allow={AUTHOR_ONLY}>
                  <BrowseRoute />
                </RequireRole>
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
            path={ROUTES.myClasses}
            element={
              <RequireAuth>
                <RequireRole allow={AUTHOR_ONLY}>
                  <MyClassesRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="/attendance/setup" element={<RequireAuth><AttendanceSetupRoute /></RequireAuth>} />
          <Route path="/attendance/pass" element={<RequireAuth><AttendancePassRoute /></RequireAuth>} />
          <Route path="/attendance/my" element={<RequireAuth><MyAttendanceRoute /></RequireAuth>} />
          <Route path="/attendance/scanner" element={<RequireAuth><ScannerRoute /></RequireAuth>} />
          <Route path="/hoc" element={<RequireAuth><HocDashboardRoute /></RequireAuth>} />
          <Route path="/class-list" element={<RequireAuth><ClassListRoute /></RequireAuth>} />
          <Route path="/guide" element={<RequireAuth><GuideRoute /></RequireAuth>} />
          <Route path="/learn/:courseCode/week/:week/keywords" element={<RequireAuth><KeywordsRoute /></RequireAuth>} />
          <Route path="/learn/:courseCode/week/:week/crossword" element={<RequireAuth><CrosswordRoute /></RequireAuth>} />
          <Route path={ROUTES.games} element={<RequireAuth><GamesRoute /></RequireAuth>} />
          <Route path={ROUTES.liveWire} element={<RequireAuth><LiveWireRoute /></RequireAuth>} />
          <Route path={ROUTES.reportBug} element={<RequireAuth><ReportBugRoute /></RequireAuth>} />
          <Route path="/class/contributors" element={<RequireAuth><ClassContributorsRoute /></RequireAuth>} />
          <Route path="/hoc/welcome" element={<RequireAuth><HocWelcomeRoute /></RequireAuth>} />
          <Route path="/hoc/requests" element={<RequireAuth><HocRequestsRoute /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><ReportsRoute /></RequireAuth>} />
          <Route path="/admin-roles" element={<RequireAuth><AdminRolesRoute /></RequireAuth>} />
          <Route path="/streak" element={<RequireAuth><StreakRoute /></RequireAuth>} />
          <Route path="/revision" element={<RequireAuth><RevisionRoute /></RequireAuth>} />
          <Route path="/content-reports" element={<RequireAuth><ContentReportsRoute /></RequireAuth>} />
          <Route path="/lecturer/course/:code" element={<RequireAuth><LecturerCourseRoute /></RequireAuth>} />
          <Route path="/lecturer/profile/:id" element={<RequireAuth><LecturerProfileRoute /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsRoute /></RequireAuth>} />
          <Route path="/lecturer/welcome" element={<RequireAuth><LecturerWelcomeRoute /></RequireAuth>} />
          <Route path="/timetable/class/:course/:id" element={<RequireAuth><ClassDetailRoute /></RequireAuth>} />
          <Route path="/settings/notifications" element={<RequireAuth><NotificationSettingsRoute /></RequireAuth>} />
          <Route path="/online-class" element={<RequireAuth><OnlineClassRoute /></RequireAuth>} />
          <Route path="/lecturer" element={<RequireAuth><LecturerHomeRoute /></RequireAuth>} />
          <Route path={ROUTES.screens} element={<RequireAuth><ScreensRoute /></RequireAuth>} />
          <Route
            path={ROUTES.timetable}
            element={
              <RequireAuth>
                <RequireRole allow={STUDENT_ONLY}>
                  <TimetableRoute />
                </RequireRole>
              </RequireAuth>
            }
          />
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
          ))}
          <Route path="/hoc/request" element={<RequireAuth><BecomeHocRoute /></RequireAuth>} />

          <Route path="*" element={<NotFound />} />
        </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

