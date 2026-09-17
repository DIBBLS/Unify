import { Link } from 'react-router-dom';

export default function CoursePage() {
  // Lean: derive weeks from Firestore in real app; static 12 for MVP
  const course = 'MEE 352';
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Unify Learn</h1>
      <p style={{ color: '#6b7280', marginTop: 6 }}>12-week Duolingo-style path — lean rebuild</p>
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Link
            key={i}
            to={`/learn/${encodeURIComponent(course)}/week/${i + 1}`}
            style={{
              padding: '14px 16px',
              background: '#fff',
              border: '1.5px solid #e5e7eb',
              borderRadius: 16,
              textDecoration: 'none',
              color: '#111827',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Week {i + 1}</span>
            <span style={{ color: '#9ca3af' }}>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
