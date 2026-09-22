import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui" }}>
      <header style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <Link to="/course" style={{ fontWeight: 800, textDecoration: 'none', color: '#111827' }}>
          Unify<span style={{ color: '#22C55E' }}>.</span>
        </Link>
        <span style={{ flex: 1 }} />
        <Link to="/auth" style={{ fontSize: 12 }}>
          Auth
        </Link>
      </header>
      <Outlet />
    </div>
  );
}
