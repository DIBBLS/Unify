import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './routes/_layout';
import CourseRoute from './routes/course';
import LearnWeek from './routes/learn/week';
import AuthRoute from './routes/auth';
import DashboardRoute from './routes/dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/course" replace />} />
          <Route path="/course" element={<CourseRoute />} />
          <Route path="/learn/:courseCode/week/:week" element={<LearnWeek />} />
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="*" element={<div style={{ padding: 40 }}>Not found — route not yet migrated from legacy *.html</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
