import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Layout from './routes/_layout';
import CourseRoute from './routes/course';
import LearnWeek from './routes/learn/week';
import AuthRoute from './routes/auth';
import DashboardRoute from './routes/dashboard';
import OnboardingRoute from './routes/onboarding';
import ProfileRoute from './routes/profile';
import Mascot from './components/Mascot';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Chromeless: no top bar on sign in / onboarding */}
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/course" element={<CourseRoute />} />
          <Route path="/learn/:courseCode/week/:week" element={<LearnWeek />} />
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
