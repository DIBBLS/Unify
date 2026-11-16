import { Link } from 'react-router-dom';
import * as SidebarPrimitive from '@animate-ui/react/primitives/sidebar';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gamepad2,
  LayoutDashboard,
  MessageCircle,
  PenTool,
  ScanLine,
  User,
  Users,
} from '@/components/icons';
import Wordmark from './Wordmark';
import { GROUPS as ADMIN_GROUPS } from '../lib/adminNav';

export type Tab = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: string[];
  external?: boolean;
};

// Review: the menu is Home · Timetable · Class · Games · Me; courses open
// from the course cards on Home. My pass / my record light the Class tab.
export const STUDENT_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home', '/courses', '/learn', '/course', '/streak', '/revision'] },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, match: ['/timetable'] },
  { to: '/class', label: 'Class', icon: Users, match: ['/class', '/hoc', '/attendance/my', '/attendance/pass', '/class-list'] },
  { to: '/games', label: 'Games', icon: Gamepad2, match: ['/games'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

export const AUTHOR_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home', '/browse', '/my-classes', '/course', '/learn'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio'] },
  { to: '/messages', label: 'Messages', icon: MessageCircle, match: ['/messages'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

// Lecturers: Home · Timetable · Classroom · Scanner · Messages · Me (decided
// 13 Nov + sidebar review). Home is the design L07 view, Classroom the former
// Classroom page plus Send a PDF. No Studio: lecturers don't publish notes.
// Scanner (take attendance) and Messages get their own entries so Classroom
// only lights for the classroom pages themselves.
export const LECTURER_TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, match: ['/home', '/course', '/learn'] },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, match: ['/timetable', '/my-classes'] },
  { to: '/lecturer', label: 'Classroom', icon: ClipboardCheck, match: ['/lecturer', '/attendance/setup', '/browse', '/content-reports', '/studio'] },
  { to: '/attendance/scanner', label: 'Scanner', icon: ScanLine, match: ['/attendance/scanner'] },
  { to: '/messages', label: 'Messages', icon: MessageCircle, match: ['/messages'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

// Admin role: manage, never learn. No Learn tab — the admin reads
// everything through All content; learning paths are students-only.
// /browse + /classes light the Studio tab (the working area).
export const ADMIN_TABS: Tab[] = [
  { to: '/admin', label: 'Home', icon: LayoutDashboard, match: ['/admin', '/home', '/browse', '/my-classes', '/course', '/learn'] },
  { to: '/studio', label: 'Studio', icon: PenTool, match: ['/studio'] },
  { to: '/me', label: 'Me', icon: User, match: ['/me'] },
];

export function tabActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

function PillLink({ to, label, icon: Icon, isActive, iconSize = 22, badge }: {
  to: string; label: string; icon: Tab['icon']; isActive: boolean; iconSize?: number; badge?: string;
}) {
  return (
    <Link
      to={to}
      data-sidebar="menu-button"
      className={'side-pill' + (isActive ? ' is-active' : '')}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      <span className="side-ico">
        <Icon size={iconSize} />
        {badge && <span className="side-badge">{badge}</span>}
      </span>
      <span className="side-label">{label}</span>
    </Link>
  );
}

function RoleLinks({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <>
      {tabs.filter((t) => t.to !== '/me').map((t) => (
        <PillLink key={t.to} to={t.to} label={t.label} icon={t.icon} isActive={tabActive(pathname, t.match)} />
      ))}
    </>
  );
}

function AdminGroups({ pathname }: { pathname: string }) {
  return (
    <>
      {ADMIN_GROUPS.map((g) => (
        <div key={g.label || 'top'} className="side-group">
          {g.label && <div className="side-grouplabel" data-sidebar="group-label">{g.label}</div>}
          {g.items.map((it) => {
            const to = it.id === 'overview' ? '/admin' : '/admin/' + it.id;
            const isActive = it.id === 'overview' ? (pathname === '/admin' || pathname === '/home') : pathname === to;
            const Icon = it.icon;
            return (
              <Link key={it.id} to={to} data-sidebar="menu-button" className={'side-pill' + (isActive ? ' is-active' : '')} aria-current={isActive ? 'page' : undefined} aria-label={it.title}>
                <span className="side-ico"><Icon size={20} /></span>
                <span className="side-label">{it.id === 'overview' ? 'Home' : it.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="side-group">
        <div className="side-grouplabel" data-sidebar="group-label">Create</div>
        <PillLink to="/studio" label="Studio" icon={PenTool} isActive={pathname.startsWith('/studio')} iconSize={20} />
      </div>
    </>
  );
}

function RailInner({ role, pathname, unread, picSrc, initial, showSkeleton, skelCount }: {
  role: string | null; pathname: string; unread: number; picSrc: string; initial: string;
  showSkeleton: boolean; skelCount: number;
}) {
  const { open, toggleSidebar } = SidebarPrimitive.useSidebar();
  const isAuthor = role === 'lecturer' || role === 'contributor';
  const list: Tab[] = role === 'lecturer' ? LECTURER_TABS : isAuthor ? AUTHOR_TABS : role === 'admin' ? ADMIN_TABS : STUDENT_TABS;
  return (
    <aside className={'side-pills' + (open ? ' is-pinned' : '')} aria-label="Main">
      <SidebarPrimitive.Highlight className="side-rail">
        {/* Collapsed icon rail; hover or keyboard focus peeks, the pin (or
            Cmd/Ctrl+B) keeps it open and remembers for 7 days. */}
        <Link to="/home" className="side-logo" aria-label="Unify Learn home">
          <span className="side-mark">U</span>
          <span className="side-label side-brand"><Wordmark size={18} /></span>
        </Link>
        <button
          type="button"
          className="side-trigger"
          onClick={toggleSidebar}
          aria-expanded={open}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          title="Toggle sidebar (Ctrl+B)"
        >
          <span className="side-ico">
            <SidebarPrimitive.TriggerIcon
              open={<ChevronLeft size={18} />}
              closed={<ChevronRight size={18} />}
            />
          </span>
          <span className="side-label">{open ? 'Collapse' : 'Expand'}</span>
        </button>
        {showSkeleton
          ? Array.from({ length: skelCount }).map((_, i) => (
              <div key={i} className="side-pill"><div className="skel" style={{ width: 24, height: 24, borderRadius: 6 }} /></div>
            ))
          : role === 'admin'
          ? <AdminGroups pathname={pathname} />
          : <RoleLinks tabs={list} pathname={pathname} />}
        <span className="side-spacer" />
        <PillLink
          to="/notifications"
          label="Notifications"
          icon={Bell}
          isActive={false}
          iconSize={20}
          badge={unread > 0 ? (unread > 9 ? '9+' : String(unread)) : undefined}
        />
        <Link
          to="/me"
          data-sidebar="menu-button"
          className={'side-pill side-me' + (pathname === '/me' || pathname.startsWith('/me/') ? ' is-active' : '')}
          aria-current={pathname === '/me' ? 'page' : undefined}
          aria-label="Me"
        >
          <span className="side-ico side-avatar">{picSrc ? <img src={picSrc} alt="" /> : (initial || 'U')}</span>
          <span className="side-label">Me</span>
        </Link>
      </SidebarPrimitive.Highlight>
    </aside>
  );
}

// Desktop sidebar on the Animate UI primitive: open state, cookie and
// Cmd/Ctrl+B come from the Provider, the hover/active glide from Highlight,
// the trigger icon from TriggerIcon. It overlays the page (no Gap), exactly
// like the rail it replaces. Mobile keeps the bottom tab bar in _layout.
export function AppSidebar(props: {
  role: string | null; pathname: string; unread: number; picSrc: string; initial: string;
  showSkeleton: boolean; skelCount: number;
}) {
  return (
    <SidebarPrimitive.Provider defaultOpen={false}>
      <RailInner {...props} />
    </SidebarPrimitive.Provider>
  );
}
