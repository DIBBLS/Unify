import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard } from '../components/redesign/ui';

// Lecturer's course page (L10–L12, L15, L16) in the app's usual look:
//  Weeks: each published week, open to read or review it (L13 from the reader);
//  Report: counts only, never names (L11);
//  Attendance: each student's attendance, at-risk filters, CSV (L16);
//  Post: an announcement, tip or reminder to everyone taking the course (L15).
type Tab = 'weeks' | 'report' | 'attendance' | 'post';

export default function LecturerCourseRoute() {
  const { code = '' } = useParams();
  const course = code.trim();
  const [params] = useSearchParams();
  const t = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(t && ['weeks', 'report', 'attendance', 'post'].includes(t) ? t : 'weeks');
  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  return (
    <div style={shell}>
      <BackButton to={ROUTES.lecturer} />
      <Label>Your course</Label>
      <Display size={30}>{course}</Display>
      <div role="tablist" aria-label="Course sections" style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        {(['weeks', 'report', 'attendance', 'post'] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`chip chip--sm${tab === x ? ' chip--on' : ''}`} onClick={() => setTab(x)} style={{ textTransform: 'capitalize' }}>{x}</button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        {tab === 'weeks' && <Weeks course={course} />}
        {tab === 'report' && <Report course={course} />}
        {tab === 'attendance' && <Attendance course={course} />}
        {tab === 'post' && <Post course={course} />}
      </div>
    </div>
  );
}

function Weeks({ course }: { course: string }) {
  const [weeks, setWeeks] = useState<{ week: number; title: string; subtitle: string }[] | null>(null);
  useEffect(() => { api.courseWeeks(course).then((r) => setWeeks(r.weeks || [])).catch(() => setWeeks([])); }, [course]);
  if (!weeks) return <SectionSkeleton rows={3} />;
  if (!weeks.length) return <Card><div className="t-15 w-6">No weeks published yet</div><div className="t-13 muted">Contributors write the weeks in Studio; they show here once published.</div></Card>;
  return (
    <>
      <div className="t-13 muted" style={{ marginBottom: 8 }}>Open a week to read it. Use "Review this week" at the top of the week to flag errors for the authors.</div>
      <ListCard>
        {weeks.map((w) => (
          <Link key={w.week} to={`/learn/${encodeURIComponent(course)}/week/${w.week}?preview=1`} className="row" style={{ gap: 12, padding: '13px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
            <div className="grow stack" style={{ gap: 2 }}>
              <div className="t-15 w-6">Week {w.week}{w.title ? ` · ${w.title}` : ''}</div>
              {w.subtitle && <div className="t-13 muted">{w.subtitle}</div>}
            </div>
          </Link>
        ))}
      </ListCard>
    </>
  );
}

function Report({ course }: { course: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.courseReport>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.courseReport(course).then(setData).catch((e) => setErr(describeError(e, 'load the report'))); }, [course]);
  if (err) return <Card><div className="t-13 muted">{err}</div></Card>;
  if (!data) return <SectionSkeleton rows={3} />;
  return (
    <>
      <div className="t-13 muted" style={{ marginBottom: 8 }}>{data.students} student{data.students === 1 ? '' : 's'} taking {course}. Counts only, never names.</div>
      {data.weeks.length === 0 ? (
        <Card><div className="t-13 muted">Nothing to report until weeks are published.</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.weeks.map((w) => (
            <Card key={w.week} pad={14} style={{ gap: 6 }}>
              <div className="t-15 w-7">Week {w.week}{w.title ? ` · ${w.title}` : ''}</div>
              <div style={{ height: 6, borderRadius: 9999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: `${w.studiedPct}%`, height: '100%', background: 'var(--u-green)' }} />
              </div>
              <div className="t-13">{w.studiedPct}% studied it ({w.studied} of {data.students})</div>
              <div className="t-13 muted">
                {w.quizAvg == null ? 'No quiz attempts yet' : `Quiz: ${w.quizAvg}% average · ${w.quizTakers} took it${w.attemptsPerStudent ? ` · ${w.attemptsPerStudent} attempts each` : ''}`}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Attendance({ course }: { course: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.attendanceStudents>> | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | '75' | '50'>('all');
  useEffect(() => { api.attendanceStudents(course).then(setData).catch((e) => setErr(describeError(e, 'load attendance'))); }, [course]);
  const rows = useMemo(() => (data?.students || []).filter((s) => filter === 'all' || (s.pct != null && s.pct < Number(filter))), [data, filter]);
  if (err) return <Card><div className="t-13 muted">{err}</div></Card>;
  if (!data) return <SectionSkeleton rows={3} />;

  const csv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"` : v);
    const lines = ['Name,Matric,Attended,Held,Percent', ...data.students.map((s) => [s.name, s.matric, String(s.attended), String(data.held), s.pct == null ? '' : String(s.pct)].map(esc).join(','))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.replace(/\s+/g, '')}-attendance.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <>
      <div className="t-13 muted" style={{ marginBottom: 8 }}>{data.held} class{data.held === 1 ? '' : 'es'} held. Lowest attendance first.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {([['all', 'All'], ['75', 'Under 75%'], ['50', 'Under 50%']] as const).map(([k, l]) => (
          <button key={k} className={`chip chip--sm${filter === k ? ' chip--on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <button className="btn btn--white btn--sm" style={{ marginLeft: 'auto' }} onClick={csv} disabled={!data.students.length}>Download CSV</button>
      </div>
      {data.held === 0 ? (
        <Card><div className="t-13 muted">No attendance taken yet. Take attendance from Classroom or the course page.</div></Card>
      ) : rows.length === 0 ? (
        <Card><div className="t-13 muted">No one in this group.</div></Card>
      ) : (
        <ListCard>
          {rows.map((s, i) => (
            <div key={`${s.matric}-${i}`} className="row" style={{ gap: 10, padding: '12px 16px' }}>
              <div className="grow stack" style={{ gap: 2 }}>
                <div className="t-15 w-6">{s.name}</div>
                <div className="t-13 muted">{[s.matric, s.onUnify ? '' : 'Not on Unify yet'].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="t-13 w-7" style={{ color: s.pct != null && s.pct < 50 ? 'var(--u-red, #dc2626)' : s.pct != null && s.pct < 75 ? 'var(--u-warn-ink, #92400e)' : 'var(--u-good)' }}>
                {s.attended}/{data.held}{s.pct != null ? ` · ${s.pct}%` : ''}
              </span>
            </div>
          ))}
        </ListCard>
      )}
    </>
  );
}

function Post({ course }: { course: string }) {
  const [type, setType] = useState<'announcement' | 'tip' | 'reminder'>('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof api.coursePosts>>['posts']>([]);
  const load = () => api.coursePosts(course).then((r) => setPosts(r.posts)).catch(() => {});
  useEffect(() => { void load(); }, [course]);
  const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 };
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.coursePost({ course, type, title: title.trim() || undefined, content: content.trim() });
      toastSuccess(`Posted to ${r.reached} student${r.reached === 1 ? '' : 's'} taking ${course}.`);
      setTitle(''); setContent('');
      await load();
    } catch (e) {
      errorToast(e, 'post that');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card style={{ gap: 10 }}>
        <div className="t-13">Posting to everyone taking <b>{course}</b>. It shows on their course page and in their notifications.</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['announcement', 'tip', 'reminder'] as const).map((x) => (
            <button key={x} className={`chip chip--sm${type === x ? ' chip--on' : ''}`} onClick={() => setType(x)} style={{ textTransform: 'capitalize' }}>{x}</button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} style={field} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} placeholder="e.g. Test on Friday in LT2. Bring calculators." style={{ ...field, resize: 'vertical' }} />
        <button className="btn btn--amber btn--block" disabled={busy || !content.trim()} onClick={() => void send()}>{busy ? 'Posting…' : 'Post to students'}</button>
      </Card>
      {posts.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <Label>Posted</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {posts.map((p) => (
              <Card key={p.id} pad={14} style={{ gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="t-12 muted" style={{ textTransform: 'capitalize' }}>{p.type} · {new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  {p.mine && (
                    <button aria-label="Delete post" onClick={() => void api.coursePostDelete(p.id).then(load).catch((e) => errorToast(e, 'delete that post'))} style={{ color: 'var(--text3)', display: 'flex', padding: 2 }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {p.title && <div className="t-15 w-7">{p.title}</div>}
                <div className="t-14" style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
              </Card>
            ))}
          </div>
        </section>
      )}
      {posts.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}><BoxBoy pose="teaching" width={90} calm /></div>
      )}
    </>
  );
}
