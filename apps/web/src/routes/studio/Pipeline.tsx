import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// The contributor's pipeline: for each course they write for, which weeks have
// materials waiting, which one they are writing right now, and which are live.
// Tap a week to load it into the composer. (There is no separate "submitted"
// stage: publishing goes straight to students, so the board has three.)
type Stage = 'materials' | 'writing' | 'live';
type CourseRow = { course: string; weeks: { week: number; stage: Stage; title?: string }[] };

const STAGE_LABEL: Record<Stage, string> = { materials: 'Materials in', writing: 'Writing', live: 'Live' };
const STAGE_STYLE: Record<Stage, { bg: string; fg: string; bd: string }> = {
  materials: { bg: 'var(--u-warn-tint)', fg: 'var(--u-warn-ink)', bd: '#fde68a' },
  writing: { bg: 'var(--u-amber)', fg: 'var(--u-black)', bd: '#c69a1a' },
  live: { bg: 'var(--u-good-tint)', fg: 'var(--u-good)', bd: 'var(--u-good)' },
};

function readDraft(): { course: string; week: number } | null {
  try {
    const d = JSON.parse(localStorage.getItem('unify.studio.draft.v1') || 'null');
    if (d && d.course && Number(d.week) > 0 && (d.raw || d.note || d.title)) return { course: String(d.course).toUpperCase().replace(/\s/g, ''), week: Number(d.week) };
  } catch {
    // no draft
  }
  return null;
}

export default function Pipeline({ onPick }: { onPick: (course: string, week: number) => void }) {
  const [rows, setRows] = useState<CourseRow[] | null>(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const { courses } = await api.teaching();
        const draft = readDraft();
        const out: CourseRow[] = [];
        for (const course of courses.slice(0, 8)) {
          const [mats, weeks] = await Promise.allSettled([api.materials(course), api.courseWeeks(course)]);
          const live = new Map<number, string>();
          if (weeks.status === 'fulfilled') for (const w of weeks.value.weeks) live.set(w.week, w.title);
          const matWeeks = new Set<number>();
          if (mats.status === 'fulfilled') for (const m of mats.value.materials || []) matWeeks.add(m.week);
          const all = new Set<number>([...live.keys(), ...matWeeks]);
          if (draft && draft.course === course.toUpperCase().replace(/\s/g, '')) all.add(draft.week);
          const list = [...all].sort((a, b) => a - b).map((week) => {
            const writing = !!draft && draft.week === week && draft.course === course.toUpperCase().replace(/\s/g, '') && !live.has(week);
            const stage: Stage = live.has(week) ? 'live' : writing ? 'writing' : 'materials';
            return { week, stage, title: live.get(week) };
          });
          out.push({ course, weeks: list });
        }
        if (!gone) setRows(out);
      } catch {
        if (!gone) setRows([]);
      }
    })();
    return () => { gone = true; };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <section aria-label="Your pipeline" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Your pipeline</div>
      {rows.map((r) => {
        const count = (s: Stage) => r.weeks.filter((w) => w.stage === s).length;
        return (
          <div key={r.course} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{r.course}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {count('materials')} waiting · {count('writing')} writing · {count('live')} live
              </span>
            </div>
            {r.weeks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>No materials yet. They show up here when your lecturer or class rep shares them.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.weeks.map((w) => {
                  const st = STAGE_STYLE[w.stage];
                  return (
                    <button
                      key={w.week}
                      type="button"
                      onClick={() => onPick(r.course, w.week)}
                      title={`${STAGE_LABEL[w.stage]}${w.title ? ': ' + w.title : ''}`}
                      style={{ minHeight: 44, padding: '6px 12px', borderRadius: 12, border: `1px solid ${st.bd}`, background: st.bg, color: st.fg, fontWeight: 800, fontSize: 12, textAlign: 'left', lineHeight: 1.25 }}
                    >
                      Week {w.week}
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 11, opacity: 0.85 }}>{STAGE_LABEL[w.stage]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
