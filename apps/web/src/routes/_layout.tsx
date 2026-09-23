import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, User } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';

const TABS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { to: '/course', label: 'Learn', icon: BookOpen, match: ['/course', '/learn'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

export default function Layout() {
  const [authed, setAuthed] = useState(false);
  const [initial, setInitial] = useState('');
  const { pathname } = useLocation();

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setInitial((data.session?.user.email || '').charAt(0).toUpperCase());
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setInitial((session?.user.email || '').charAt(0).toUpperCase());
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div style={{ fontFamily: "'Nunito', system-ui" }}>
      <header style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 10, alignItems: 'center' }}>
        <Link to="/course" style={{ fontWeight: 800, textDecoration: 'none', color: '#111827' }}>
          Unify<span style={{ color: '#10b981' }}> Learn</span>
        </Link>
        <span style={{ flex: 1 }} />
        {authed ? (
          <Link
            to="/profile"
            aria-label="Profile"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: 'linear-gradient(135deg,#34d399,#059669)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            {initial || 'U'}
          </Link>
        ) : (
          <Link
            to="/auth"
            style={{
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              color: '#fff',
              background: '#10b981',
              padding: '8px 16px',
              borderRadius: 9999,
            }}
          >
            Sign in
          </Link>
        )}
      </header>
      <Outlet />
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #e5e5e5', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                textDecoration: 'none',
                color: active ? '#10b981' : '#777',
                fontSize: 11,
                fontWeight: active ? 800 : 500,
              }}
            >
              <Icon size={20} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
