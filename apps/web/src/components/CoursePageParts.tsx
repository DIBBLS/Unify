import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Download, Flag, Link2, Pencil, QrCode, X } from 'lucide-react';
import { ROUTES } from '../lib/routes';
import { api, type CourseAttendance, type CourseLecturer } from '../lib/api';
import { isWeekSaved, saveWeekOffline } from '../lib/offline';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import ReportSheet from './ReportSheet';

// Course page pieces (Review Round 2, design S23): the lecturer card, the
// course actions (save for offline, report), and week cards that open to show
// the week's classes, attendance for each class held, and the week's quiz.
type Progress = Awaited<ReturnType<typeof api.myCourseProgress>>['weeks'];
type Week = Progress[number];

export function CourseActions({ course, weeks, preview }: { course: string; weeks: Week[]; preview: boolean }) {
  const [saving, setSaving] = useState('');
  const [reportWeek, setReportWeek] = useState<Week | null>(null);
  const [picking, setPicking] = useState(false);
  const allSaved = weeks.length > 0 && weeks.every((w) => isWeekSaved(course, w.week));
  const saveAll = async () => {
    try {
      for (let i = 0; i < weeks.length; i++) {
        setSaving(`Saving ${i + 1} of ${weeks.length}…`);
        if (!isWeekSaved(course, weeks[i].week)) await saveWeekOffline(course, weeks[i].week);
      }
      toastSuccess(`${course} is saved for offline: every published week.`);
    } catch (e) {
      errorToast(e, 'save the course for offline');
    } finally {
      setSaving('');
    }
  };
  if (preview) return null;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button disabled={!!saving || !weeks.length} onClick={() => void saveAll()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '9px 14px', borderRadius: 9999, border: 'none', background: allSaved ? 'var(--u-good-tint)' : 'var(--u-black)', color: allSaved ? 'var(--u-good)' : '#fff', fontWeight: 800, fontSize: 12 }}>
          {allSaved ? <Check size={14} /> : <Download size={14} />} {saving || (allSaved ? 'Saved for offline' : 'Save for offline')}
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={() => setPicking((v) => !v)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: 'none', border: 'none', color: 'var(--text2)', fontWeight: 700, fontSize: 12 }}>
          <Flag size={14} /> Report a problem
        </button>
      </div>
      {picking && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="t-13 w-7">Which week has the problem?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {weeks.map((w) => <button key={w.week} className="chip chip--sm" onClick={() => { setReportWeek(w); setPicking(false); }}>Week {w.week}</button>)}
          </div>
        </div>
      )}
      {reportWeek && <ReportSheet course={course} week={reportWeek.week} topics={reportWeek.topicTitles} current={reportWeek.topicTitles[0] || ''} review={false} onClose={() => setReportWeek(null)} />}
    </>
  );
}

// Review 3 (C1): every week of the semester as a compact row, with a tick,
// a cross or an empty circle for each class. A published week opens to its
// classes and quiz. This week's classes carry dates; today's class gets Read
// notes and a small Pass button (the pass opens from the week, C2).
export type ClassMark = 'came' | 'missed' | 'open';
export type WeekClass = { n: number; title: string; date: Date; start: string; venue: string; mark: ClassMark | 'today' | 'later'; at?: string };

export function Marks({ marks, size = 20 }: { marks: ClassMark[]; size?: number }) {
  if (!marks.length) return null;
  return (
    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }} aria-label={`${marks.filter((m) => m === 'came').length} of ${marks.length} classes attended`}>
      {marks.map((m, i) => (
        <span key={i} title={m === 'came' ? 'Came' : m === 'missed' ? 'Missed' : 'Not held yet'} style={{
          width: size, height: size, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: m === 'came' ? 'var(--u-green)' : m === 'missed' ? 'var(--surface2)' : 'transparent',
          border: m === 'open' ? '1.5px dashed var(--border)' : m === 'missed' ? '1px solid var(--border)' : 'none',
          color: m === 'came' ? 'var(--u-black)' : 'var(--text3)',
        }}>
          {m === 'came' ? <Check size={size * 0.6} strokeWidth={3.5} /> : m === 'missed' ? <X size={size * 0.55} strokeWidth={3.5} /> : null}
        </span>
      ))}
    </span>
  );
}

export function MarksLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: 'var(--text2)' }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Marks marks={['came']} size={16} /> Came</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Marks marks={['missed']} size={16} /> Missed</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Marks marks={['open']} size={16} /> Not held yet</span>
    </div>
  );
}

export function WeekCard({ course, week, title, sub, published, current, past, progress, marks, classes, open, onToggle, preview }: {
  course: string; week: number; title: string; sub: string; published: boolean; current: boolean; past: boolean; progress?: Week;
  marks: ClassMark[]; classes: WeekClass[] | null; open: boolean; onToggle: () => void; preview: boolean;
}) {
  const [done, setDone] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (!open || done || preview || !published) return;
    api.progressGet(course, week)
      .then((r) => setDone(new Set(r.done.map((d) => (typeof d === 'number' ? d : d.topic)))))
      .catch(() => setDone(new Set()));
  }, [open, done, course, week, preview, published]);
  const topics = progress?.topics || 0;
  const doneN = progress?.done || 0;
  const all = topics > 0 && doneN >= topics;
  const canOpen = published || !!classes?.length;
  const badge = current
    ? ['var(--u-black)', 'var(--u-green)']
    : all || (published && past)
      ? ['var(--u-green)', 'var(--u-black)']
      : published
        ? ['var(--u-good-tint)', 'var(--u-good)']
        : ['var(--surface2)', 'var(--text3)'];
  const base = `/learn/${encodeURIComponent(course)}/week/${week}`;
  // The notes page's ?t= is the tab position from 0 (class 1 = 0, quiz = number of classes).
  const q = (extra: string) => `${base}?${[extra, preview ? 'preview=1' : ''].filter(Boolean).join('&')}`;
  const nextTopic = topics ? Array.from({ length: topics }, (_, i) => i + 1).find((n) => !done?.has(n)) : undefined;
  const dim = !published && !current;

  return (
    <div style={{ background: dim ? 'transparent' : 'var(--surface)', border: `${open ? 1.5 : 1}px solid ${open ? 'var(--text)' : dim ? 'var(--surface2)' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={canOpen ? onToggle : undefined} aria-expanded={canOpen ? open : undefined} disabled={!canOpen} style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: '9px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)', cursor: canOpen ? 'pointer' : 'default', opacity: 1 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: badge[0], color: badge[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{String(week).padStart(2, '0')}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: dim ? 'var(--text2)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || `Week ${week}`}</span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: published && !current ? 'var(--u-good)' : 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        </span>
        <Marks marks={marks} />
      </button>
      {open && canOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
          {classes?.length
            ? classes.map((c) => <ClassRow key={c.n} c={c} course={course} week={week} notes={published ? q(`t=${Math.min(c.n, Math.max(topics, 1)) - 1}`) : ''} />)
            : (progress?.topicTitles.length ? progress.topicTitles : Array.from({ length: topics }, (_, i) => `Class ${i + 1}`)).map((t, i) => {
                const n = i + 1;
                const isDone = !!done?.has(n);
                const isUp = !isDone && n === nextTopic;
                return (
                  <Link key={n} to={q(`t=${n - 1}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: 'var(--surface2)', textDecoration: 'none', color: 'var(--text)' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, background: isDone ? 'var(--u-green)' : isUp ? 'var(--u-black)' : 'var(--surface)', color: isDone ? 'var(--u-black)' : isUp ? 'var(--u-green)' : 'var(--text2)', border: isDone || isUp ? 'none' : '1px solid var(--border)' }}>
                      {isDone ? <Check size={15} strokeWidth={3} /> : n}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{t}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>Class {n}{isDone ? ' · Read' : isUp ? ' · Up next' : ''}</span>
                    </span>
                    {isUp ? <span style={{ width: 28, height: 28, borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={15} /></span> : <ChevronRight size={16} color="var(--text3)" />}
                  </Link>
                );
              })}
          {progress?.hasQuiz && (
            <Link to={q(`t=${topics}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, background: 'var(--u-black)', textDecoration: 'none' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9999, background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{progress.quiz ? `${progress.quiz.best}` : 'Q'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#fff' }}>Week {week} quiz</span>
                <span style={{ display: 'block', fontSize: 12, color: '#999' }}>{progress.quiz ? `Best ${progress.quiz.best}/${progress.quiz.total} · ${progress.quiz.attempts} attempt${progress.quiz.attempts === 1 ? '' : 's'}` : 'End-of-week questions'}</span>
              </span>
              <ArrowRight size={16} color="#fff" />
            </Link>
          )}
          {published && !classes?.length && <Link to={q('')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none' }}>Open Week {week}'s notes</Link>}
        </div>
      )}
    </div>
  );
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d: Date) => `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

function ClassRow({ c, course, week, notes }: { c: WeekClass; course: string; week: number; notes: string }) {
  const sub = [`Class ${c.n}`, dayLabel(c.date), c.mark === 'came' && c.at ? `marked ${new Date(c.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : c.venue].filter(Boolean).join(' · ');
  if (c.mark === 'today') {
    const pass = `${ROUTES.attendancePass}?${new URLSearchParams({ course, week: String(week), class: String(c.n), title: c.title }).toString()}`;
    return (
      <div style={{ padding: 12, borderRadius: 14, border: '1.5px solid var(--u-amber)', background: 'var(--u-warn-tint)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 28, height: 28, borderRadius: 9999, background: 'var(--u-black)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{c.n}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{c.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{sub}</span>
          </span>
          <span style={{ padding: '3px 9px', borderRadius: 9999, background: 'var(--u-black)', color: '#fff', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>Today {c.start}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {notes
            ? <Link to={notes} className="btn btn--amber" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Read notes <ArrowRight size={16} /></Link>
            : <span className="btn btn--white" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', opacity: 0.7 }}>Notes land soon</span>}
          <Link to={pass} className="btn btn--white" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px' }}><QrCode size={16} /> Pass</Link>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Show your pass at the door when the scan opens.</div>
      </div>
    );
  }
  const status = c.mark === 'came' ? { text: 'Attended', bg: 'var(--u-good-tint)', fg: 'var(--u-good)' }
    : c.mark === 'missed' ? { text: 'Missed', bg: 'var(--surface)', fg: 'var(--text2)' }
    : c.mark === 'later' ? { text: DAY_SHORT[c.date.getDay()], bg: 'var(--surface)', fg: 'var(--text2)' }
    : { text: 'Not held', bg: 'var(--surface)', fg: 'var(--text3)' };
  const body = (
    <>
      {c.mark === 'came' || c.mark === 'missed'
        ? <Marks marks={[c.mark]} size={28} />
        : <span style={{ width: 28, height: 28, borderRadius: 9999, border: '1.5px dashed var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{c.n}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: c.mark === 'later' || c.mark === 'open' ? 'var(--text2)' : 'var(--text)' }}>{c.title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>{sub}</span>
      </span>
      <span style={{ padding: '3px 9px', borderRadius: 9999, background: status.bg, color: status.fg, border: '1px solid var(--border)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{status.text}</span>
    </>
  );
  const style: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: 'var(--surface2)', textDecoration: 'none', color: 'var(--text)' };
  return notes ? <Link to={notes} style={style}>{body}</Link> : <div style={style}>{body}</div>;
}

// This week's classes from the timetable, dated, with attendance on each.
export function weekClasses(opts: {
  week: number; semesterStart: string | null; slots: { day: number; start: string; venue: string }[];
  held: { at: string; came: boolean }[]; titles: string[];
}): WeekClass[] | null {
  const { week, semesterStart, slots, held, titles } = opts;
  if (!semesterStart || !slots.length) return null;
  const start = new Date(semesterStart);
  if (Number.isNaN(start.getTime())) return null;
  const weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (week - 1) * 7);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dated = slots
    .map((s) => ({ ...s, date: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + ((s.day - weekStart.getDay() + 7) % 7)) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.start.localeCompare(b.start));
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return dated.map((s, i) => {
    const h = held.find((x) => sameDay(new Date(x.at), s.date));
    const isToday = sameDay(s.date, today);
    const mark: WeekClass['mark'] = h?.came ? 'came' : isToday ? 'today' : h ? 'missed' : s.date >= endOfToday ? 'later' : 'open';
    return { n: i + 1, title: titles[i] || `Class ${i + 1}`, date: s.date, start: hhmm(s.start), venue: s.venue, mark, at: h?.at };
  });
}

// Review 3 (C1, C10): who teaches the course and in which weeks. Small
// overlapping circles, then one row per lecturer with their week range; the
// one teaching this week is highlighted. A lecturer not on Unify Learn yet
// shows by name only. The class rep gets a link to set them.
const initialsOf = (n: string) => n.replace(/^((prof|dr|engr|mr|mrs|ms)\.?\s+)+/i, '').split(/[\s.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function Avatar({ l, size, ring }: { l: CourseLecturer; size: number; ring?: boolean }) {
  const pic = l.lecturer?.avatar;
  const common: React.CSSProperties = { width: size, height: size, borderRadius: 9999, flexShrink: 0, border: ring ? '2px solid var(--surface)' : undefined, boxSizing: 'border-box' };
  if (pic) return <img src={pic} alt="" style={{ ...common, objectFit: 'cover' }} />;
  return (
    <span style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.34, background: l.lecturer ? 'var(--u-green)' : 'var(--surface2)', color: l.lecturer ? 'var(--u-black)' : 'var(--text2)' }}>
      {initialsOf(l.name)}
    </span>
  );
}

export function LecturersCard({ course, lecturers, week, canEdit }: { course: string; lecturers: CourseLecturer[]; week: number; canEdit: boolean }) {
  if (!lecturers.length) {
    if (!canEdit) return null;
    return (
      <Link to={`${ROUTES.course(course)}/lecturers`} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, padding: 14, borderRadius: 16, border: '1px dashed var(--border)', color: 'var(--text)', textDecoration: 'none' }}>
        <Pencil size={16} /> <span className="t-13 w-7" style={{ flex: 1 }}>Add this course's lecturers</span> <ChevronRight size={16} color="var(--text3)" />
      </Link>
    );
  }
  const ranged = lecturers.some((l) => l.weekFrom != null);
  const nowIdx = week > 0 ? lecturers.findIndex((l) => l.weekFrom != null && l.weekTo != null && week >= l.weekFrom && week <= l.weekTo) : -1;
  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {lecturers.length > 1 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ display: 'flex' }}>
            {lecturers.map((l, i) => <span key={i} style={{ marginLeft: i ? -10 : 0 }}><Avatar l={l} size={36} ring /></span>)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{lecturers.length} lecturers</span>
            {ranged && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>Taught in turns across the weeks</span>}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lecturers.map((l, i) => {
          const now = i === nowIdx;
          const sub = [
            now ? 'Teaching now' : '',
            l.lecturer ? l.lecturer.department || 'Lecturer' : 'Not on Unify Learn yet',
          ].filter(Boolean).join(' · ');
          const range = l.weekFrom != null && l.weekTo != null ? (l.weekFrom === l.weekTo ? `Wk ${l.weekFrom}` : `Wk ${l.weekFrom}–${l.weekTo}`) : '';
          const inner = (
            <>
              <Avatar l={l} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{l.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{sub}</span>
              </span>
              {range && <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', background: now ? 'var(--u-green)' : 'var(--surface)', color: 'var(--u-black)', border: now ? 'none' : '1px solid var(--border)' }}>{range}</span>}
            </>
          );
          const style: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: now ? 'var(--u-good-tint)' : 'var(--surface2)', textDecoration: 'none', color: 'var(--text)' };
          return l.lecturer
            ? <Link key={i} to={`/lecturer/profile/${l.lecturer.id}`} style={style}>{inner}</Link>
            : <div key={i} style={style}>{inner}</div>;
        })}
      </div>
      {canEdit && (
        <Link to={`${ROUTES.course(course)}/lecturers`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none' }}>
          <Pencil size={14} /> Set lecturers and their weeks
        </Link>
      )}
    </div>
  );
}

// Review 3 (C1): until the student links their matric number, a small prompt
// on the course page so their attendance counts.
export function MatricPrompt({ course }: { course: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let gone = false;
    Promise.all([api.classListMe().catch(() => null), api.attendanceProfile().catch(() => null)]).then(([cl, p]) => {
      if (gone) return;
      const linked = cl?.list ? !!cl.entry || !!cl.request : !!p?.matric;
      setShow(!linked && (!!cl || !!p));
    });
    return () => { gone = true; };
  }, []);
  if (!show) return null;
  const next = encodeURIComponent(ROUTES.course(course));
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 16, border: '1.5px solid var(--u-amber)', background: 'var(--u-warn-tint)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Link2 size={18} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Link your matric number</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--u-warn-ink)' }}>So every class you attend counts.</span>
      </span>
      <Link to={`${ROUTES.attendanceSetup}?next=${next}`} style={{ padding: '8px 14px', borderRadius: 9999, background: 'var(--u-black)', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>Link now</Link>
    </div>
  );
}

export function attendanceByWeek(a: CourseAttendance | null): Record<number, { held: number; attended: number; classes: { at: string; came: boolean }[] }> {
  const out: Record<number, { held: number; attended: number; classes: { at: string; came: boolean }[] }> = {};
  for (const w of a?.mine.weeks || []) out[w.week] = { held: w.held, attended: w.attended, classes: w.classes || [] };
  return out;
}
