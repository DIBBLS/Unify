import type { CSSProperties, ReactNode } from 'react';
import { Flame } from 'lucide-react';

/* ---------- Box Boy ---------- */
export const POSES = {
  cheer: '/boxboy/cheer.png',                 // fist up, notebook (celebrations)
  armsCrossed: '/boxboy/arms-crossed.png',    // confident
  peeking: '/boxboy/peeking.png',             // over an edge (loading, empty)
  wavePhone: '/boxboy/wave-phone.png',        // stop / hold on
  thumbsUpPhone: '/boxboy/thumbs-up-phone.png',
  thumbsUp: '/boxboy/thumbs-up.png',
  chairRelax: '/boxboy/chair-relax.png',      // no classes, rest
  chairSmall: '/boxboy/chair-small.png',
  readingStanding: '/boxboy/reading-standing.png',
  teaching: '/boxboy/teaching.png',
  targetSign: '/boxboy/target-sign.png',      // holds the CGPA target sign (sign is drawn in code)
  phoneOut: '/boxboy/phone-out.png',
  keyHandover: '/boxboy/key-handover.png',
  sittingPhone: '/boxboy/sitting-phone.png',
} as const;
export type Pose = keyof typeof POSES;

export function BoxBoy({ pose, width, style }: { pose: Pose; width: number; style?: CSSProperties }) {
  return <img src={POSES[pose]} alt="" width={width} style={{ width, height: 'auto', ...style }} draggable={false} />;
}

/** Fades the bottom of a Box Boy cut-out into the background. Never leave a hard crop line. */
export function FadedBoxBoy({ pose, width, bg = '#50ff90', fade = 120, style }: { pose: Pose; width: number; bg?: string; fade?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: 'relative', width, ...style }}>
      <BoxBoy pose={pose} width={width} />
      <div style={{ position: 'absolute', left: -40, right: -40, bottom: 0, height: fade, background: `linear-gradient(to bottom, ${hexA(bg, 0)} 0%, ${hexA(bg, 0.75)} 55%, ${bg} 85%)` }} />
    </div>
  );
}
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- Avatars: 5 round Box Boys, students pick one. No photos, no letters. ---------- */
export const PERSONAS = [
  { key: 'go-getter', name: 'Go-getter', title: 'The 5.0 Scholar', blurb: 'Has a target and a plan for every semester. Starts early and keeps score.', traits: ['Sets targets', 'Starts early', 'Keeps score'], img: '/boxboy/avatar-go-getter.png' },
  { key: 'comeback', name: 'Comeback', title: 'The Comeback Kid', blurb: 'Had a rough semester. Not this one. Steady, every single week.', traits: ['Bounces back', 'Steady pace', 'No excuses'], img: '/boxboy/avatar-comeback.png' },
  { key: 'curious', name: 'Curious', title: 'The Engineer', blurb: 'Needs to know how it actually works before it sticks. Worked examples first.', traits: ['Asks why', 'Builds things', 'Deep dives'], img: '/boxboy/avatar-curious.png' },
  { key: 'team-player', name: 'Team player', title: 'The Study Captain', blurb: 'Learns by explaining. The one the class calls the night before the test.', traits: ['Explains well', 'Studies in groups', 'Shares notes'], img: '/boxboy/avatar-team-player.png' },
  { key: 'on-the-move', name: 'On the move', title: 'The Hustler', blurb: 'School plus work, a business or leadership. Short sessions that fit the day.', traits: ['Busy days', 'Short sessions', 'Gets it done'], img: '/boxboy/avatar-on-the-move.png' },
] as const;
export type PersonaKey = (typeof PERSONAS)[number]['key'];

export function Avatar({ persona = 'go-getter', size = 40, ring, style }: { persona?: PersonaKey; size?: number; ring?: boolean; style?: CSSProperties }) {
  const p = PERSONAS.find((x) => x.key === persona) ?? PERSONAS[0];
  return (
    <img
      src={p.img}
      alt={p.name}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: ring ? '0 0 0 3px #fff, 0 0 0 6px #0a0a0a' : undefined, ...style }}
    />
  );
}

/* ---------- Wordmark / app icon ---------- */
export function Wordmark({ size = 16, color }: { size?: number; color?: string }) {
  return <span className="wordmark" style={{ fontSize: size, color }}>Unify Learn</span>;
}

export function AppIcon({ size = 120 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.24, background: '#0a0a0a', display: 'grid', placeItems: 'center' }}>
      <span className="display" style={{ fontSize: size * 0.47, color: '#50ff90' }}>U</span>
    </div>
  );
}

/* ---------- Speech bubble ---------- */
export function Bubble({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', background: '#fff', borderRadius: 18, padding: '10px 14px', fontWeight: 600, fontSize: 16, boxShadow: '0 2px 0 #0a0a0a', border: '2px solid #0a0a0a', ...style }}>
      {children}
    </div>
  );
}

/* ---------- Semester week tracker (Home hero) ----------
   12 bars. Weeks 1–7 calm, 8–10 amber "exams in N weeks", 11–12 red. */
export function SemesterWeek({ week, total = 12 }: { week: number; total?: number }) {
  const left = total - week + 1;
  const stage = week >= total - 1 ? 'final' : week >= 8 ? 'close' : 'calm';
  const nowColor = { calm: '#50ff90', close: '#fbbf24', final: '#dc2626' }[stage];
  const label =
    stage === 'calm' ? `Week ${week} of ${total}` :
    stage === 'close' ? `Week ${week} · exams in ${left} weeks` :
    week === total ? `Week ${week} · exams next week` : `Week ${week} · exams in ${left} weeks`;
  return (
    <div className="row" style={{ gap: 10, padding: '7px 12px', borderRadius: 14, background: 'var(--u-surface)', alignSelf: 'flex-start' }} aria-label={label}>
      <span className="t-12 w-7">{label}</span>
      <span className="row" style={{ gap: 3 }}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          return (
            <span key={n} style={{ width: 7, height: 12, borderRadius: 2, background: n < week ? '#0a0a0a' : n === week ? nowColor : 'var(--u-border)', outline: n === week ? '1.5px solid #0a0a0a' : undefined }} />
          );
        })}
      </span>
    </div>
  );
}

/* ---------- Countdown ring ---------- */
export function CountdownRing({ value, fraction, size = 200, stroke = 14, color = '#50ff90', track = '#2a2a2a', label, textColor = '#fff', fontSize }: {
  value: ReactNode; fraction: number; size?: number; stroke?: number; color?: string; track?: string; label?: ReactNode; textColor?: string; fontSize?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fraction)} />
      </svg>
      <div className="stack" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <span className="display" style={{ fontSize: fontSize ?? size * 0.26, color: textColor }}>{value}</span>
        {label && <span className="t-13" style={{ color: '#aaa' }}>{label}</span>}
      </div>
    </div>
  );
}

/* ---------- Streak pill ---------- */
export function StreakPill({ days, dark }: { days: number; dark?: boolean }) {
  return (
    <span className="row" style={{ gap: 6, padding: '7px 12px', borderRadius: 18, background: dark ? '#0a0a0a' : '#fbbf24', color: dark ? '#fbbf24' : '#0a0a0a', fontWeight: 700, fontSize: 14 }}>
      <Flame size={16} fill={dark ? '#fbbf24' : '#fff'} color={dark ? '#fbbf24' : '#0a0a0a'} /> {days}-day streak
    </span>
  );
}

