import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { supabaseBrowser } from '../lib/supabase';

export default function Layout() {
  const [authed, setAuthed] = useState(false);
  const [initial, setInitial] = useState('');

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
              background: '#10b981',
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
    </div>
  );
}
