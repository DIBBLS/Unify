import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronRight, Download, Flag } from 'lucide-react';
import { api, type CourseAttendance } from '../lib/api';
import { isWeekSaved, saveWeekOffline } from '../lib/offline';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import ReportSheet from './ReportSheet';

// Course page pieces (Review Round 2, design S23): the lecturer card, the
// course actions (save for offline, report), and week cards that open to show
// the week's classes, attendance for each class held, and the week's quiz.
type Progress = Awaited<ReturnType<typeof api.myCourseProgress>>['weeks'];
type Week = Progress[number];

export function LecturerCards({ lecturers }: { lecturers: { id: string; name: string }[] }) {
  const [profiles, setProfiles] = useState<Record<string, Awaited<ReturnType<typeof api.lecturerProfile>>>>({});
  useEffect(() => {
    let gone = false;
    void Promise.allSettled(lecturers.slice(0, 3).map((l) => api.lecturerProfile(l.id))).then((rs) => {
      if (gone) return;
      const m: Record<string, Awaited<ReturnType<typeof api.lecturerProfile>>> = {};
      rs.forEach((r, i) => { if (r.status === 'fulfilled') m[lecturers[i].id] = r.value; });
      setProfiles(m);
    });
    return () => { gone = true; };
  }, [lecturers]);
  if (!lecturers.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {lecturers.slice(0, 3).map((l) => {
        const p = profiles[l.id];
        const name = [p?.title, p?.name || l.name].filter(Boolean).join(' ');
        const initials = (p?.name || l.name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <Link key={l.id} to={`/lecturer/profile/${l.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, textDecoration: 'none', color: 'var(--text)' }}>
            {p?.avatar
              ? <img src={p.avatar} alt="" style={{ width: 48, height: 48, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
              : <span style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{initials}</span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{p?.department || 'Lecturer'}</span>
              {p?.bio && <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{p.bio}</span>}
            </span>
            <ChevronRight size={18} color="var(--text3)" />
          </Link>
        );
      })}
    </div>
  );
}

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

// One week: badge, title and how far you are; opens to the week's classes,
// attendance for the classes held, and the quiz.
export function WeekCard({ course, week, title, subtitle, progress, attendance, open, onToggle, preview, isNext }: {
  course: string; week: number; title: string; subtitle: string; progress?: Week; attendance?: { held: number; attended: number };
  open: boolean; onToggle: () => void; preview: boolean; isNext: boolean;
}) {
  const [done, setDone] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (!open || done || preview) return;
    api.progressGet(course, week)
      .then((r) => setDone(new Set(r.done.map((d) => (typeof d === 'number' ? d : d.topic)))))
      .catch(() => setDone(new Set()));
  }, [open, done, course, week, preview]);
  const topics = progress?.topics || 0;
  const doneN = progress?.done || 0;
  const all = topics > 0 && doneN >= topics;
  const state: 'done' | 'progress' | 'new' = all ? 'done' : doneN > 0 || isNext ? 'progress' : 'new';
  const badge = { done: ['var(--u-green)', 'var(--u-black)'], progress: ['var(--u-black)', 'var(--u-green)'], new: ['var(--surface2)', 'var(--text2)'] }[state];
  const base = `/learn/${encodeURIComponent(course)}/week/${week}`;
  // The notes page's ?t= is the tab position from 0 (class 1 = 0, quiz = number of classes).
  const q = (extra: string) => `${base}?${[extra, preview ? 'preview=1' : ''].filter(Boolean).join('&')}`;
  const meta = [
    topics ? (all ? `All ${topics} classes done` : `${doneN} of ${topics} classes done`) : 'No classes yet',
    progress?.quiz ? `Quiz ${progress.quiz.best}/${progress.quiz.total}` : '',
    attendance && attendance.held ? `came to ${attendance.attended} of ${attendance.held}` : '',
  ].filter(Boolean).join(' · ');
  const nextTopic = topics ? Array.from({ length: topics }, (_, i) => i + 1).find((n) => !done?.has(n)) : undefined;

  return (
    <div style={{ background: 'var(--surface)', border: `${open ? 1.5 : 1}px solid ${open ? 'var(--text)' : 'var(--border)'}`, borderRadius: 18, overflow: 'hidden' }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: 14, background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: badge[0], color: badge[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 17, flexShrink: 0 }}>{String(week).padStart(2, '0')}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>Week {week}</span>
          {title && <span style={{ display: 'block', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>}
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: all ? 'var(--u-good)' : 'var(--text2)', marginTop: 1 }}>{meta}</span>
        </span>
        <ChevronDown size={20} color="var(--text3)" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
          {subtitle && <div className="t-13 muted">{subtitle}</div>}
          {(progress?.topicTitles.length ? progress.topicTitles : Array.from({ length: topics }, (_, i) => `Class ${i + 1}`)).map((t, i) => {
            const n = i + 1;
            const isDone = !!done?.has(n);
            const isUp = !isDone && n === nextTopic;
            return (
              <Link key={n} to={q(`t=${n - 1}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 12px', borderRadius: 14, background: 'var(--surface2)', textDecoration: 'none', color: 'var(--text)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, background: isDone ? 'var(--u-green)' : isUp ? 'var(--u-black)' : 'var(--surface)', color: isDone ? 'var(--u-black)' : isUp ? 'var(--u-green)' : 'var(--text2)', border: isDone || isUp ? 'none' : '1px solid var(--border)' }}>
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
          {/* Attendance for the classes held this week (one dot each). */}
          {attendance && attendance.held > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: attendance.held }, (_, i) => (
                  <span key={i} title={i < attendance.attended ? 'Came' : 'Missed'} style={{ width: 12, height: 12, borderRadius: 9999, background: i < attendance.attended ? 'var(--u-green)' : 'var(--u-bad-tint)', border: `1px solid ${i < attendance.attended ? 'var(--u-good)' : 'var(--u-red)'}` }} />
                ))}
              </span>
              <span className="t-13 w-7" style={{ flex: 1 }}>Attendance: came to {attendance.attended} of {attendance.held} class{attendance.held === 1 ? '' : 'es'}</span>
            </div>
          )}
          {progress?.hasQuiz && (
            <Link to={q(`t=${topics}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, background: 'var(--u-black)', textDecoration: 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 9999, background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{progress.quiz ? `${progress.quiz.best}` : 'Q'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#fff' }}>Week {week} quiz</span>
                <span style={{ display: 'block', fontSize: 12, color: '#999' }}>{progress.quiz ? `Best ${progress.quiz.best}/${progress.quiz.total} · ${progress.quiz.attempts} attempt${progress.quiz.attempts === 1 ? '' : 's'}` : 'End-of-week questions'}</span>
              </span>
              <ArrowRight size={16} color="#fff" />
            </Link>
          )}
          <Link to={q('')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none' }}>Open Week {week}'s notes</Link>
        </div>
      )}
    </div>
  );
}

export function attendanceByWeek(a: CourseAttendance | null): Record<number, { held: number; attended: number }> {
  const out: Record<number, { held: number; attended: number }> = {};
  for (const w of a?.mine.weeks || []) out[w.week] = { held: w.held, attended: w.attended };
  return out;
}
