import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, Home, CalendarDays, MessageSquare, User, PenTool } from 'lucide-react';
import { useBack, useGo } from './nav';

/* ---------- Screen shell ---------- */
export function Screen({ children, bg = 'var(--u-page)', tabs, actions, style }: {
  children: ReactNode; bg?: string; tabs?: boolean; actions?: boolean; style?: CSSProperties;
}) {
  return (
    <div className={`screen${tabs ? ' screen--tabs' : ''}${actions ? ' screen--actions' : ''}`} style={{ background: bg, ...style }}>
      {children}
    </div>
  );
}

/** Back button + title. Every screen below a tab uses this. */
export function TopBar({ title, right, dark, onBack }: { title?: ReactNode; right?: ReactNode; dark?: boolean; onBack?: () => void }) {
  const back = useBack();
  return (
    <div className="row" style={{ height: 56, padding: '0 16px', gap: 12, position: 'relative', zIndex: 2 }}>
      <button
        aria-label="Back"
        onClick={onBack ?? back}
        style={{ width: 40, height: 40, borderRadius: 20, display: 'grid', placeItems: 'center', background: dark ? 'rgba(255,255,255,.1)' : '#fff', border: dark ? 0 : '1px solid var(--u-border)' }}
      >
        <ChevronLeft size={20} color={dark ? '#fff' : '#0a0a0a'} />
      </button>
      <div className="grow t-17 w-6" style={{ color: dark ? '#fff' : undefined }}>{title}</div>
      {right}
    </div>
  );
}

/* ---------- Tab bar ---------- */
type TabKey = 'home' | 'timetable' | 'class' | 'me' | 'studio';
const TABS: Record<'student' | 'lecturer' | 'contributor', { key: TabKey; label: string; icon: typeof Home; to: string }[]> = {
  student: [
    { key: 'home', label: 'Home', icon: Home, to: 'S19' },
    { key: 'timetable', label: 'Timetable', icon: CalendarDays, to: 'S37' },
    { key: 'class', label: 'Class', icon: MessageSquare, to: 'S42' },
    { key: 'me', label: 'Me', icon: User, to: 'S45' },
  ],
  lecturer: [
    { key: 'home', label: 'Home', icon: Home, to: 'L07' },
    { key: 'timetable', label: 'Timetable', icon: CalendarDays, to: 'L09' },
    { key: 'class', label: 'Class', icon: MessageSquare, to: 'L15' },
    { key: 'me', label: 'Me', icon: User, to: 'L17' },
  ],
  contributor: [
    { key: 'home', label: 'Home', icon: Home, to: 'C01' },
    { key: 'studio', label: 'Studio', icon: PenTool, to: 'C02' },
    { key: 'me', label: 'Me', icon: User, to: 'S45' },
  ],
};

export function TabBar({ active, role = 'student', classBadge = 0 }: { active: TabKey; role?: keyof typeof TABS; classBadge?: number }) {
  const go = useGo();
  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 'var(--shell)', height: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))',
        background: '#fff', borderTop: '1px solid var(--u-border)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '11px 12px 0', zIndex: 30,
      }}
    >
      {TABS[role].map((t) => {
        const on = t.key === active;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => go(t.to)}
            className="stack"
            style={{ alignItems: 'center', gap: 3, minWidth: 64, padding: '6px 14px', borderRadius: 18, background: on ? 'var(--u-green)' : 'transparent', position: 'relative' }}
          >
            <Icon size={22} color={on ? '#0a0a0a' : '#999'} strokeWidth={on ? 2.2 : 1.8} />
            <span className="t-12" style={{ fontWeight: on ? 700 : 500, color: on ? '#0a0a0a' : '#999' }}>{t.label}</span>
            {t.key === 'class' && classBadge > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 10, width: 22, height: 22, borderRadius: 11, background: 'var(--u-red)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid #fff' }}>
                {classBadge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- Bottom actions (sticky buttons) ---------- */
export function BottomActions({ children, tone = 'page', hint }: { children: ReactNode; tone?: 'page' | 'dark' | 'green' | 'clear'; hint?: ReactNode }) {
  return (
    <div className={`bottom-actions${tone === 'page' ? '' : ` bottom-actions--${tone}`}`}>
      {hint && <div className="t-13 center" style={{ color: tone === 'dark' ? '#aaa' : 'var(--u-text-2)' }}>{hint}</div>}
      {children}
    </div>
  );
}

/* ---------- Bottom sheet over a dimmed screen ---------- */
export function Sheet({ children, height }: { children: ReactNode; height?: number }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
      <div
        className="stack"
        style={{
          position: 'fixed', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '100%', maxWidth: 'var(--shell)',
          minHeight: height, background: '#fff', borderRadius: '32px 32px 0 0', padding: '12px 16px calc(24px + env(safe-area-inset-bottom))', gap: 14, zIndex: 41,
        }}
      >
        <span style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, background: '#dddbd5', marginBottom: 6 }} />
        {children}
      </div>
    </>
  );
}

/** Green band header used on onboarding form steps. */
export function GreenBand({ children, height = 254 }: { children: ReactNode; height?: number }) {
  return (
    <div className="stack" style={{ background: 'var(--u-green)', minHeight: height, padding: '16px 16px 28px', gap: 18, justifyContent: 'space-between' }}>
      {children}
    </div>
  );
}
