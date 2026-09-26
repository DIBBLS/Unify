import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Search, User, PenTool, Bell } from 'lucide-react';
import { supabaseBrowser, touchActivity, isSessionExpired, expireSession } from '../lib/supabase';
import { api } from '../lib/api';
import OfflineBanner from '../components/OfflineBanner';

type Tab = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: string[];
  external?: boolean;
};

const STUDENT_TABS: Tab[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { to: '/course', label: 'Learn', icon: BookOpen, match: ['/course', '/learn'] },
  { to: '/explore', label: 'Explore', icon: Search, match: ['/explore'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

const AUTHOR_TABS: Tab[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

// Admin role gets the union it needs: learn paths, studio, profile.
// (Admin panel + all-content browser live on the dashboard cards.)
const ADMIN_TABS: Tab[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { to: '/course', label: 'Learn', icon: BookOpen, match: ['/course', '/learn'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

export default function Layout() {
  const [authed, setAuthed] = useState(false);
  const [initial, setInitial] = useState('');
  const [role, setRole] = useState<string | null>(null);
  // Role starts unknown: while authed-but-unknown the nav renders skeleton
  // placeholders so authors/admins never flash the student tabs first.
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!authed) {
      setRole(null);
      setRoleLoaded(false);
      setUnread(0);
      return;
    }
    setRoleLoaded(false);
    api
      .me()
      .then((me) => {
        setRole(me.profile?.role || 'student');
        setRoleLoaded(true);
      })
      .catch(() => {
        // Profile check flaked: fall back to student tabs rather than
        // hanging on skeletons (fail-open, same as content gates).
        setRoleLoaded(true);
      });
  }, [authed]);

  // Activity tracking + 30-min idle expiry. touchActivity persists the last
  // active moment (survives app close); the interval/focus check signs out
  // idle tabs and bounces to /auth with the expired flag.
  useEffect(() => {
    if (!authed) return;
    touchActivity();
    const onActivity = () => touchActivity();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    const enforce = async () => {
      if (!isSessionExpired()) return;
      await expireSession();
      setAuthed(false);
      navigate('/auth?expired=1');
    };
    const t = setInterval(() => void enforce(), 30000);
    const onFocus = () => void enforce();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('focus', onFocus);
    };
  }, [authed, navigate]);

  // Bell badge: unread count refreshes on navigation, on tab refocus, and
  // every 30s while the app is open (lightweight count query).
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const load = () => {
      api
        .notifications(1)
        .then((res) => {
          if (!cancelled) setUnread(res.unread || 0);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, [authed, pathname]);

  const isAuthor = role === 'lecturer' || role === 'collaborator';
  const tabs: Tab[] = isAuthor ? AUTHOR_TABS : role === 'admin' ? ADMIN_TABS : STUDENT_TABS;
  const showSkeletonNav = authed && !roleLoaded;

  return (
    <div style={{ fontFamily: "'Nunito', system-ui" }}>
      <header style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, alignItems: 'center' }}>
        <Link to="/dashboard" style={{ fontWeight: 800, textDecoration: 'none', color: 'var(--text)' }}>
          Unify<span style={{ color: '#10b981' }}> Learn</span>
        </Link>
        <span style={{ flex: 1 }} />
        {authed ? (
          <>
            <Link
              to="/notifications"
              aria-label="Notifications"
              style={{ position: 'relative', width: 32, height: 32, borderRadius: 9999, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9999, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
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
          </>
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
      <OfflineBanner />
      <Outlet />
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
        {showSkeletonNav
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div className="skel" style={{ width: 22, height: 22, borderRadius: 6 }} />
                <div className="skel" style={{ width: 44, height: 10, borderRadius: 5 }} />
              </div>
            ))
          : tabs.map((t) => {
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
          const Icon = t.icon;
          const style = {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: active ? '#10b981' : 'var(--text2)',
            fontSize: 11,
            fontWeight: active ? 800 : 500,
          } as const;
          return t.external ? (
            <a key={t.to} href={t.to} target="_blank" rel="noreferrer" style={style}>
              <Icon size={20} />
              {t.label}
            </a>
          ) : (
            <Link key={t.to} to={t.to} style={style}>
              <Icon size={20} />
              {t.label}
            </Link>
          );
          })}
      </nav>
    </div>
  );
}
