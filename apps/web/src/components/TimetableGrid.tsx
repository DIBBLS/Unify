import { MapPin, Video, X } from 'lucide-react';
import type { ClassSlot } from '../lib/api';
import { BoxBoy } from './redesign/brand';

// Timetable as a time grid (review Round 2 + design S37/S38): classes are
// blocks at their real times, today's current or next class is the call to
// action (dark card with Box Boy), and the week view lays every day side by
// side. Colour means status only: red cancelled, amber dashed not confirmed,
// black moved; the class happening now is dark with green.

export const toMin = (hhmm: string) => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmt = (hhmm: string) => {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

// Where a class actually sits today (a moved class sits at its new time).
export const timesOf = (s: ClassSlot) => {
  // Moved or running late: the class sits at its new start time.
  const moved = (s.change?.status === 'moved' || s.change?.status === 'late') && s.change.start;
  return { start: moved ? (s.change!.start as string) : s.start, end: moved ? (s.change!.end || s.end) : s.end, venue: s.change?.status === 'moved' && s.change.venue ? s.change.venue : s.venue };
};

export type SlotState = 'now' | 'next' | 'done' | 'later';

// The grid's hours: 8am to 6pm, stretched to fit any earlier or later class.
function hourRange(slots: ClassSlot[]): [number, number] {
  let lo = 8;
  let hi = 18;
  for (const s of slots) {
    const t = timesOf(s);
    lo = Math.min(lo, Math.floor(toMin(t.start) / 60));
    hi = Math.max(hi, Math.ceil(toMin(t.end) / 60));
  }
  return [Math.max(0, lo), Math.min(24, Math.max(hi, lo + 1))];
}

// Classes that overlap share the width: each gets a lane.
function lanes(slots: ClassSlot[]): Map<string, { lane: number; of: number }> {
  const sorted = [...slots].sort((a, b) => toMin(timesOf(a).start) - toMin(timesOf(b).start));
  const out = new Map<string, { lane: number; of: number }>();
  let group: ClassSlot[] = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const placed: { id: string; lane: number }[] = [];
    for (const s of group) {
      const st = toMin(timesOf(s).start);
      let lane = ends.findIndex((e) => e <= st);
      if (lane < 0) { lane = ends.length; ends.push(0); }
      ends[lane] = toMin(timesOf(s).end);
      placed.push({ id: s.id, lane });
    }
    for (const p of placed) out.set(p.id, { lane: p.lane, of: Math.max(1, ends.length) });
    group = [];
  };
  for (const s of sorted) {
    const st = toMin(timesOf(s).start);
    if (group.length && st >= groupEnd) flush();
    group.push(s);
    groupEnd = Math.max(groupEnd, toMin(timesOf(s).end));
  }
  if (group.length) flush();
  return out;
}

const ROW = 60; // px per hour

export function DayGrid({ slots, stateOf, nowMin, isHoc, onOpen, onRemove, onJoin }: {
  slots: ClassSlot[];
  stateOf: (s: ClassSlot) => SlotState;
  nowMin: number | null;
  isHoc: boolean;
  onOpen: (s: ClassSlot) => void;
  onRemove: (s: ClassSlot) => void;
  onJoin: (s: ClassSlot) => void;
}) {
  const [lo, hi] = hourRange(slots);
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const lane = lanes(slots);
  const height = (hi - lo) * ROW;
  const showNow = nowMin != null && nowMin >= lo * 60 && nowMin <= hi * 60;
  return (
    <div role="list" aria-label="Classes by time" style={{ position: 'relative', marginTop: 12, padding: '10px 10px 10px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
      <div style={{ position: 'relative', height: height + 2 }}>
        {hours.map((h) => (
          <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: (h - lo) * ROW, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ width: 50, flex: 'none', textAlign: 'right', paddingRight: 8, fontSize: 11, fontWeight: 700, color: 'var(--text3)', lineHeight: '12px', transform: 'translateY(-6px)' }}>{hourLabel(h)}</span>
            <span style={{ flex: 1, borderTop: '1px dashed var(--border)' }} />
          </div>
        ))}
        <div style={{ position: 'absolute', left: 54, right: 0, top: 0, bottom: 0 }}>
          {slots.map((s) => {
            const t = timesOf(s);
            const st = stateOf(s);
            const ch = s.change?.status;
            const top = ((toMin(t.start) - lo * 60) / 60) * ROW;
            const h = Math.max(34, ((toMin(t.end) - toMin(t.start)) / 60) * ROW - 4);
            const l = lane.get(s.id) || { lane: 0, of: 1 };
            const now = st === 'now' && ch !== 'cancelled';
            const next = st === 'next' && ch !== 'cancelled';
            const tone: React.CSSProperties =
              ch === 'cancelled' ? { background: 'var(--u-bad-tint)', border: '1px solid var(--u-red)', color: 'var(--u-red)' }
              : now ? { background: 'var(--u-black)', border: '1px solid var(--u-black)', color: '#f5f4f0', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
              : ch === 'moved' ? { background: 'var(--text)', border: '1px solid var(--text)', color: 'var(--bg)' }
              : ch === 'unconfirmed' ? { background: 'var(--surface)', border: '1.5px dashed var(--u-amber)', color: 'var(--text)' }
              : next ? { background: 'var(--u-warn-tint)', border: '2px solid var(--u-amber)', color: 'var(--text)' }
              : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' };
            const compact = h < 54;
            return (
              <div
                key={s.id}
                role="listitem"
                onClick={() => onOpen(s)}
                style={{
                  position: 'absolute', top: top + 2, height: h,
                  left: `calc(${(l.lane / l.of) * 100}% + 2px)`, width: `calc(${100 / l.of}% - 4px)`,
                  borderRadius: 12, padding: compact ? '5px 8px' : '8px 10px', cursor: 'pointer', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', gap: 2, opacity: st === 'done' && !now ? 0.55 : 1,
                  ...tone,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {now && <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: 'var(--u-black)', background: 'var(--u-green)', borderRadius: 6, padding: '2px 5px' }}>NOW</span>}
                  {next && <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: 'var(--u-black)', background: 'var(--u-amber)', borderRadius: 6, padding: '2px 5px' }}>NEXT</span>}
                  <span style={{ fontWeight: 800, fontSize: 14, textDecoration: ch === 'cancelled' ? 'line-through' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.course}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center', flex: 'none' }} onClick={(e) => e.stopPropagation()}>
                    {s.meetLink && ch !== 'cancelled' && (
                      <button onClick={() => onJoin(s)} className="btn btn--amber btn--sm" style={{ height: 26, padding: '0 10px', fontSize: 11, gap: 4 }}><Video size={12} /> Join</button>
                    )}
                    {isHoc && (
                      <button aria-label={`Remove ${s.course} at ${s.start}`} onClick={() => onRemove(s)} style={{ display: 'flex', padding: 2, background: 'none', border: 'none', color: 'inherit', opacity: 0.6 }}><X size={14} /></button>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>{fmt(t.start)}–{fmt(t.end)}</span>
                  {!compact && t.venue && <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><MapPin size={11} /> {t.venue}</span>}
                  {ch === 'cancelled' && <span style={{ fontWeight: 800 }}>Cancelled</span>}
                  {ch === 'unconfirmed' && <span style={{ fontWeight: 800, color: 'var(--u-warn-ink)' }}>Not confirmed</span>}
                  {ch === 'moved' && <span style={{ fontWeight: 800 }}>Moved</span>}
                  {ch === 'late' && <span style={{ fontWeight: 800, color: now ? 'var(--u-amber)' : 'var(--u-warn-ink)' }}>Running late</span>}
                  {ch === 'confirmed' && <span style={{ fontWeight: 800, color: now ? 'var(--u-green)' : 'var(--u-good)' }}>✓ Confirmed</span>}
                </div>
                {!compact && s.lecturer && <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.lecturer}</div>}
              </div>
            );
          })}
        </div>
        {showNow && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 46, right: 0, top: ((nowMin! - lo * 60) / 60) * ROW - 4, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--u-red)' }} />
            <span style={{ flex: 1, height: 2, background: 'var(--u-red)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// Today's call to action: the class on now, or the next one, with Box Boy.
export function TodayCard({ slot, state, nowMin, onOpen, onJoin }: { slot: ClassSlot; state: SlotState; nowMin: number; onOpen: () => void; onJoin: () => void }) {
  const t = timesOf(slot);
  const mins = toMin(t.start) - nowMin;
  const when = state === 'now'
    ? `Happening now · till ${fmt(t.end)}`
    : mins < 60 ? `Up next · in ${Math.max(1, mins)} min` : `Up next · ${fmt(t.start)}`;
  return (
    <div className="card card--dark" style={{ marginTop: 14, padding: '16px 16px 18px', display: 'flex', gap: 12, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', color: state === 'now' ? 'var(--u-green)' : 'var(--u-amber)' }}>{when}</span>
        <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 26, color: '#f5f4f0', lineHeight: 1.1 }}>{slot.course}</span>
        <span style={{ fontSize: 13, color: '#bbb' }}>
          {fmt(t.start)}–{fmt(t.end)}{t.venue ? ` · ${t.venue}` : ''}{slot.lecturer ? ` · ${slot.lecturer}` : ''}
        </span>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {slot.meetLink && <button className="btn btn--amber btn--sm" onClick={onJoin}><Video size={14} /> Join class</button>}
          <button className={slot.meetLink ? 'btn btn--ghost-dark btn--sm' : 'btn btn--amber btn--sm'} onClick={onOpen}>Open class</button>
        </div>
      </div>
      <BoxBoy pose={state === 'now' ? 'teaching' : 'readingStanding'} width={84} style={{ flexShrink: 0 }} />
    </div>
  );
}

// The week at a glance: a column per day, classes as blocks; tap one to open that day.
export function WeekGrid({ slots, days, today, nowMin, labels, onPickDay }: {
  slots: ClassSlot[];
  days: number[];
  today: number;
  nowMin: number;
  labels: string[];
  onPickDay: (d: number) => void;
}) {
  const [lo, hi] = hourRange(slots);
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const row = 46;
  const height = (hi - lo) * row;
  return (
    <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '10px 8px 10px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(${days.length}, 1fr)`, gap: 3 }}>
        <span />
        {days.map((d) => (
          <button key={d} onClick={() => onPickDay(d)} style={{ padding: '5px 0', borderRadius: 10, border: 'none', background: d === today ? 'var(--u-black)' : 'transparent', color: d === today ? '#f5f4f0' : 'var(--text2)', fontSize: 12, fontWeight: 800 }}>
            {labels[d]}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(${days.length}, 1fr)`, gap: 3, marginTop: 6 }}>
        <div style={{ position: 'relative', height }}>
          {hours.map((h) => (
            <span key={h} style={{ position: 'absolute', top: (h - lo) * row - 6, right: 4, fontSize: 9, fontWeight: 700, color: 'var(--text3)' }}>{hourLabel(h)}</span>
          ))}
        </div>
        {days.map((d) => {
          const mine = slots.filter((s) => s.day === d);
          const lane = lanes(mine);
          return (
            <div key={d} style={{ position: 'relative', height, borderLeft: '1px solid var(--border)', background: d === today ? 'var(--u-good-tint)' : undefined, borderRadius: 4 }}>
              {mine.map((s) => {
                const t = timesOf(s);
                const l = lane.get(s.id) || { lane: 0, of: 1 };
                const ch = s.change?.status;
                const live = d === today && nowMin >= toMin(t.start) && nowMin < toMin(t.end) && ch !== 'cancelled';
                return (
                  <button
                    key={s.id}
                    onClick={() => onPickDay(d)}
                    title={`${s.course} ${t.start}–${t.end}${t.venue ? ` · ${t.venue}` : ''}`}
                    style={{
                      position: 'absolute', top: ((toMin(t.start) - lo * 60) / 60) * row + 1, height: Math.max(20, ((toMin(t.end) - toMin(t.start)) / 60) * row - 2),
                      left: `calc(${(l.lane / l.of) * 100}% + 1px)`, width: `calc(${100 / l.of}% - 2px)`,
                      borderRadius: 8, padding: '3px 4px', textAlign: 'left', overflow: 'hidden', fontSize: 10, fontWeight: 800, lineHeight: 1.2,
                      background: ch === 'cancelled' ? 'var(--u-bad-tint)' : live ? 'var(--u-black)' : ch === 'moved' ? 'var(--text)' : 'var(--surface2)',
                      color: ch === 'cancelled' ? 'var(--u-red)' : live ? 'var(--u-green)' : ch === 'moved' ? 'var(--bg)' : 'var(--text)',
                      border: ch === 'unconfirmed' ? '1.5px dashed var(--u-amber)' : ch === 'cancelled' ? '1px solid var(--u-red)' : '1px solid var(--border)',
                      textDecoration: ch === 'cancelled' ? 'line-through' : undefined,
                    }}
                  >
                    {s.course}
                  </button>
                );
              })}
              {d === today && nowMin >= lo * 60 && nowMin <= hi * 60 && (
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - lo * 60) / 60) * row, height: 2, background: 'var(--u-red)', pointerEvents: 'none' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
