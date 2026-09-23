import { Link } from 'react-router-dom';
import { Lock, Check, ChevronRight } from 'lucide-react';
import BackButton from '../components/BackButton';

export default function CoursePage() {
  const course = 'MEE 352';
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>Unify Learn</h1>
      <p style={{ color: '#777', marginTop: 6, fontSize: 13 }}>12-week Duolingo path — Week 1 free, Plus for 2+</p>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const locked = i > 0;
          return (
            <Link
              key={i}
              to={`/learn/${encodeURIComponent(course)}/week/${i + 1}`}
              style={{
                padding: '14px 16px',
                background: locked ? '#f7f7f7' : '#fff',
                border: `2px solid ${locked ? '#e5e5e5' : '#10b981'}`,
                borderBottom: `4px solid ${locked ? '#e5e5e5' : '#059669'}`,
                borderRadius: 16,
                textDecoration: 'none',
                color: locked ? '#afafaf' : '#3c3c3c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: locked ? 0.85 : 1,
              }}
            >
              <span style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>Week {i + 1} {locked ? <Lock size={14} /> : <Check size={14} color="#059669" />}</span>
              <span style={{ color: locked ? '#afafaf' : '#059669' }}>
                <ChevronRight size={18} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
