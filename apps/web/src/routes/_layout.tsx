import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ClipboardCheck, Search, User, PenTool, Bell } from 'lucide-react';
import { supabaseBrowser, touchActivity, isSessionExpired, expireSession } from '../lib/supabase';
import { pushSupported, enablePush } from '../lib/push';
import ConfirmModal from '../components/ConfirmModal';
import Wordmark from '../components/Wordmark';
import { api, type Profile } from '../lib/api';
import { PICTURE_EVENT, resolvePicture } from '../lib/picture';
import { recordNav } from '../lib/navHistory';
import { useFocusMode } from '../lib/focus';
import OfflineBanner from '../components/OfflineBanner';

type Tab = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: string[];
  external?: boolean;
};

const STUDENT_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home'] },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, match: ['/timetable', '/courses', '/learn'] },
  { to: '/class', label: 'Class', icon: Search, match: ['/class'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

const AUTHOR_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio', '/browse', '/my-classes'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

const LECTURER_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home'] },
  { to: '/lecturer', label: 'Classroom', icon: ClipboardCheck, match: ['/lecturer', '/attendance', '/my-classes'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio', '/browse'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

// Admin role: manage, never learn. No Learn tab — the admin reads
// everything through All content; learning paths are students-only.
// /browse + /classes light the Studio tab (the working area).
const ADMIN_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio', '/browse', '/my-classes'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

export default function Layout() {
  // Tri-state: null = session not yet resolved. The header auth slot and
  // nav render neutral placeholders until then, so a signed-in user never
  // flashes the logged-out "Sign in" chrome after login.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [initial, setInitial] = useState('');
  const [avatar, setAvatar] = useState('');
  const [role, setRole] = useState<string | null>(null);
  // Role starts unknown: while authed-but-unknown the nav renders skeleton
  // placeholders so authors/admins never flash the student tabs first.
  const [roleLoaded, setRoleLoaded] = useState(false);
  // Skeleton count follows the last-known role on THIS device (authors and
  // admins get 3 pills, everyone else 4) so the loader matches the real nav.
  const [skelCount] = useState(() => {
    try {
      const r = localStorage.getItem('unify.role.v1');
      return r === 'lecturer' || r === 'contributor' || r === 'admin' ? 3 : 4;
    } catch {
      return 4;
    }
  });
  const [unread, setUnread] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const { pathname } = useLocation();
  // Focus (reading) mode: the note reader owns the whole screen — both
  // chrome bars stay out of the way (mobile included). The flag persists
  // per device, but the bars are only hidden ON note readers: the rest of
  // the app always renders normally, so focus never leaks elsewhere.
  const focus = useFocusMode();
  const focusOnReader = focus && /^\/learn\/[^/]+\/week\/\d+/.test(pathname);
  // Immersive screens own the whole viewport: no header, no bottom bar on
  // phones, no sidebar on desktop. Today that is the note reader in focus mode
  // and any chat screen.
  const immersive = focusOnReader || /^\/chat(\/|$)/.test(pathname);
  const navigate = useNavigate();
  // Return memory for every Back button (pathname only — tab switches
  // don't pollute the trail).
  useEffect(() => {
    recordNav(pathname);
  }, [pathname]);
  // Push permission prompt: once per device per 7 days, only while the
  // browser permission is still undecided. Profile toggle covers the rest.
  const [pushPrompt, setPushPrompt] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // Desktop nav auto-collapse: 10s without pointer/keyboard activity hides
  // the bar to a sliver; hovering the sliver brings it back. Touch devices
  // and phones never collapse (no hover to resurface with).
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(hover: hover) and (min-width: 768px)');
    } catch {
      return;
    }
    if (!mq) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      setNavHidden(false);
      timer = window.setTimeout(() => setNavHidden(true), 10000);
    };
    const onActivity = () => {
      if (mq && mq.matches) arm();
      else {
        window.clearTimeout(timer);
        setNavHidden(false);
      }
    };
    const onMode = () => onActivity();
    arm();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', onMode);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onMode);
    };
  }, []);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
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

  // Live picture refresh: an upload or a new Box Boy broadcasts so the header
  // chip updates without a reload (the URL itself cache-busts server-side).
  const [picProfile, setPicProfile] = useState<Pick<Profile, 'avatar_url' | 'box_boy_persona'> | null>(null);
  useEffect(() => {
    const onAvatar = (e: Event) => {
      const url = (e as CustomEvent<string>).detail || '';
      setAvatar(url);
      setPicProfile((p) => ({ ...(p || {}), avatar_url: url }));
    };
    const refresh = () => {
      api.me().then((m) => {
        setAvatar(m.avatar || '');
        setPicProfile({ avatar_url: m.profile?.avatar_url, box_boy_persona: m.profile?.box_boy_persona });
      }).catch(() => {});
    };
    window.addEventListener('unify:avatar', onAvatar);
    window.addEventListener(PICTURE_EVENT, refresh);
    return () => {
      window.removeEventListener('unify:avatar', onAvatar);
      window.removeEventListener(PICTURE_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setRole(null);
      setAvatar('');
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
        setAvatar(me.avatar || '');
        setPicProfile({ avatar_url: me.profile?.avatar_url, box_boy_persona: me.profile?.box_boy_persona });
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

  // Bell badge: push-driven (SW postMessage on every push) with a slow
  // 5-minute fallback poll + refresh on navigation and tab refocus. The old
  // 30s poll per open tab is gone — at pilot scale it was pure waste.
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
    const t = setInterval(load, 300000);
    const onPush = (e: MessageEvent) => {
      if (e && e.data && (e.data as { type?: string }).type === 'unify-notif') load();
    };
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', onPush as EventListener);
      }
    } catch {
      // message events unsupported — poll + focus carry the badge
    }
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', onPush as EventListener);
        }
      } catch {
        // ignore
      }
    };
  }, [authed, pathname]);

  const isAuthor = role === 'lecturer' || role === 'contributor';
  const tabs: Tab[] = role === 'lecturer' ? LECTURER_TABS : isAuthor ? AUTHOR_TABS : role === 'admin' ? ADMIN_TABS : STUDENT_TABS;
  const pic = resolvePicture(picProfile, avatar);
  const showSkeletonNav = authed === null || (authed && !roleLoaded);

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {!immersive && !(isDesktop && authed) && (
      <header style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, alignItems: 'center' }}>
        <Link to="/home" style={{ textDecoration: 'none' }} aria-label="Unify Learn home">
          <Wordmark size={20} />
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
              style={{ position: 'relative', width: 32, height: 32, borderRadius: 9999, background: 'var(--u-good-tint)', color: 'var(--u-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9999, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <Link
              to="/me"
              aria-label="Profile"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: pic.src ? 'transparent' : 'var(--u-green)',
              color: 'var(--u-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
              overflow: 'hidden',
            }}
          >
            {pic.src ? <img src={pic.src} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} /> : (initial || 'U')}
          </Link>
          </>
        ) : (
          <Link
            to="/auth"
            style={{
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              color: 'var(--u-black)',
              background: 'var(--u-amber)',
              borderBottom: '3px solid #c69a1a',
              padding: '8px 16px',
              borderRadius: 9999,
            }}
          >
            Sign in
          </Link>
        )}
      </header>
      )}
      <OfflineBanner />
      {/* Content column: desktop zoom targets this element only — the
          sticky header and bottom nav keep their normal size. */}
      <div style={{ display: isDesktop ? 'flex' : 'block', alignItems: 'flex-start', minHeight: isDesktop ? 'calc(100vh - 56px)' : 'auto' }}>
        {isDesktop && authed && !immersive && (
          <aside className="side-pills" aria-label="Main">
            {/* Collapsed icon rail; opens on hover or keyboard focus, closes when left. */}
            <div className="side-rail">
              <Link to="/home" className="side-logo" aria-label="Unify Learn home">
                <span className="side-mark">U</span>
                <span className="side-label side-brand"><Wordmark size={18} /></span>
              </Link>
              {showSkeletonNav
                ? Array.from({ length: skelCount }).map((_, i) => (
                    <div key={i} className="side-pill"><div className="skel" style={{ width: 24, height: 24, borderRadius: 6 }} /></div>
                  ))
                : tabs.map((t) => {
                    const active = t.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
                    const Icon = t.icon;
                    return (
                      <Link key={t.to} to={t.to} className={`side-pill${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} aria-label={t.label}>
                        <span className="side-ico"><Icon size={22} /></span>
                        <span className="side-label">{t.label}</span>
                      </Link>
                    );
                  })}
              <span className="side-spacer" />
              <Link to="/notifications" className="side-pill" aria-label="Notifications">
                <span className="side-ico">
                  <Bell size={20} />
                  {unread > 0 && <span className="side-badge">{unread > 9 ? '9+' : unread}</span>}
                </span>
                <span className="side-label">Notifications</span>
              </Link>
              <Link to="/me" className="side-pill side-me" aria-label="Me">
                <span className="side-ico side-avatar">{pic.src ? <img src={pic.src} alt="" /> : (initial || 'U')}</span>
                <span className="side-label">Me</span>
              </Link>
            </div>
          </aside>
        )}
        <main id="unify-content" style={{ flex: 1, minWidth: 0 }}>
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      {!immersive && !isDesktop && (
      <nav className="bottomnav" onMouseEnter={() => setNavHidden(false)} style={{ position: 'fixed', bottom: 0, left: '50%', transform: `translateX(-50%)${navHidden ? ' translateY(calc(100% - 14px))' : ''}`, transition: 'transform .3s ease', width: '100%', maxWidth: 'var(--shell, 480px)', display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}>
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
          // Brand-kit active state: the lit tab sits in a green-tint pill.
          const style = {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: active ? 'var(--text)' : 'var(--text2)',
            background: active ? 'var(--green-bg)' : 'transparent',
            borderRadius: 9999,
            padding: '4px 0',
            margin: '0 4px',
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
      )}
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

