import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Search, User, PenTool, Bell } from 'lucide-react';
import { supabaseBrowser, touchActivity, isSessionExpired, expireSession } from '../lib/supabase';
import { pushSupported, enablePush } from '../lib/push';
import ConfirmModal from '../components/ConfirmModal';
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
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio', '/browse', '/classes'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

// Admin role: manage, never learn. No Learn tab — the admin reads
// everything through All content; learning paths are students-only.
// /browse + /classes light the Studio tab (the working area).
const ADMIN_TABS: Tab[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio', '/browse', '/classes'] },
  { to: '/profile', label: 'Profile', icon: User, match: ['/profile'] },
];

export default function Layout() {
  // Tri-state: null = session not yet resolved. The header auth slot and
  // nav render neutral placeholders until then, so a signed-in user never
  // flashes the logged-out "Sign in" chrome after login.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [initial, setInitial] = useState('');
  const [role, setRole] = useState<string | null>(null);
  // Role starts unknown: while authed-but-unknown the nav renders skeleton
  // placeholders so authors/admins never flash the student tabs first.
  const [roleLoaded, setRoleLoaded] = useState(false);
  // Skeleton count follows the last-known role on THIS device (authors and
  // admins get 3 pills, everyone else 4) so the loader matches the real nav.
  const [skelCount] = useState(() => {
    try {
      const r = localStorage.getItem('unify.role.v1');
      return r === 'lecturer' || r === 'collaborator' || r === 'admin' ? 3 : 4;
    } catch {
      return 4;
    }
  });
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Push permission prompt: once per device per 7 days, only while the
  // browser permission is still undecided. Profile toggle covers the rest.
  const [pushPrompt, setPushPrompt] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // Shown once when the browser reports "denied" — the fix lives in
  // browser settings, so plain retry would just fail again.
  const [pushDenied, setPushDenied] = useState(false);

  const dismissPushPrompt = () => {
    setPushPrompt(false);
    try {
      localStorage.setItem('unify.pushprompt.v1', String(Date.now()));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!authed) return;
    try {
      if (!pushSupported() || Notification.permission !== 'default') return;
      const last = Number(localStorage.getItem('unify.pushprompt.v1') || 0);
      if (last && Date.now() - last < 7 * 86400000) return;
    } catch {
      return;
    }
    // Let the app settle first — never on the first paint.
    const t = setTimeout(() => setPushPrompt(true), 3000);
    return () => clearTimeout(t);
  }, [authed]);

  const acceptPush = async () => {
    setPushBusy(true);
    try {
      const res = await enablePush();
      if (!res.ok) {
        try {
          if (Notification.permission === 'denied') setPushDenied(true);
        } catch {
          // ignore
        }
      }
    } finally {
      setPushBusy(false);
      dismissPushPrompt();
    }
  };

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
        const r = me.profile?.role || 'student';
        setRole(r);
        try {
          localStorage.setItem('unify.role.v1', r);
        } catch {
          // hint only — skeleton falls back to 4
        }
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
  const showSkeletonNav = authed === null || (authed && !roleLoaded);

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, alignItems: 'center' }}>
        <Link to="/dashboard" style={{ fontWeight: 800, textDecoration: 'none', color: 'var(--text)' }}>
          Unify<span style={{ color: '#10b981' }}> Learn</span>
        </Link>
        <span style={{ flex: 1 }} />
        {authed === null ? (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="skel" style={{ width: 32, height: 32, borderRadius: 9999 }} />
            <span className="skel" style={{ width: 32, height: 32, borderRadius: 9999 }} />
          </span>
        ) : authed ? (
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
      <nav className="bottomnav" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
        {showSkeletonNav
          ? Array.from({ length: skelCount }).map((_, i) => (
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
      {pushPrompt && (
        <ConfirmModal
          title="Get nudged for new notes?"
          body="Unify can buzz this device the moment your authors publish — weeks, announcements and role updates, even with the app closed. You can switch it off anytime in Profile."
          confirmLabel="Allow"
          cancelLabel="Not now"
          tone="go"
          icon="bell"
          busy={pushBusy}
          onConfirm={() => void acceptPush()}
          onCancel={dismissPushPrompt}
        />
      )}
      {pushDenied && (
        <ConfirmModal
          title="Browser is blocking push"
          body="Your browser said no, so tapping Allow can't work until you re-enable it: open the lock (or ⋮ menu) next to the address bar → Site settings → Notifications → Allow — then come back and tap Allow here. On iPhone, add Unify to the Home Screen first, then allow."
          confirmLabel="Got it"
          cancelLabel="Later"
          tone="go"
          icon="bell"
          onConfirm={() => setPushDenied(false)}
          onCancel={() => setPushDenied(false)}
        />
      )}
    </div>
  );
}
