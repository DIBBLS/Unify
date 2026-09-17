import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CoursePage from './pages/CoursePage';
import LearnPage from './pages/LearnPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/course" replace />} />
        <Route path="/course" element={<CoursePage />} />
        <Route path="/learn/:courseCode/week/:week" element={<LearnPage />} />
        <Route path="*" element={<div style={{ padding: 40 }}>Not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
