import { useEffect, useMemo, useState } from 'react';
import SendPdf from '../components/SendPdf';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Send, Trash2 } from 'lucide-react';
import CourseChat from '../components/CourseChat';
import { PracticeEditor } from '../components/PracticeQuestions';
import { useSchool } from '../lib/school';
import type { PostKind } from '../lib/api';
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
type Tab = 'weeks' | 'report' | 'attendance' | 'post' | 'messages';
const TABS: Tab[] = ['weeks', 'report', 'attendance', 'post', 'messages'];
type Status = Awaited<ReturnType<typeof api.lecturerWeekStatus>>;

// "Electronic & Computer Engineering|300 Level" -> "300L ECE".
function useClassLabel() {
  const school = useSchool();
  return (key: string) => {
    const [dept, level] = key.split('|');
    const code = school.departments.find((d) => d.name === dept)?.code || dept;
    return [level ? level.replace(' Level', 'L') : '', code].filter(Boolean).join(' ') || 'No class set';
  };
}

export default function LecturerCourseRoute() {
  const { code = '' } = useParams();
  const course = code.trim();
  const [params] = useSearchParams();
  const t = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(t && TABS.includes(t) ? t : 'weeks');
  const [status, setStatus] = useState<Status | null>(null);
  const [statusErr, setStatusErr] = useState('');
  const loadStatus = () => { setStatusErr(''); return api.lecturerWeekStatus(course).then(setStatus).catch((e) => setStatusErr(describeError(e, 'load the weeks'))); };
  useEffect(() => { void loadStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [course]);
  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const sub = [status?.levels[0]?.toUpperCase(), course, status?.contributors.length ? `with ${status.contributors.join(', ')} (contributor${status.contributors.length === 1 ? '' : 's'})` : ''].filter(Boolean).join(' · ');
  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <Label>Your course</Label>
      <Display size={28}>{status?.title || course}</Display>
      {sub && <div className="t-12 muted" style={{ marginTop: 4 }}>{sub}{status ? ` · ${status.students} student${status.students === 1 ? '' : 's'}` : ''}</div>}
      <div role="tablist" aria-label="Course sections" style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        {TABS.map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`chip chip--sm${tab === x ? ' chip--on' : ''}`} onClick={() => setTab(x)} style={{ textTransform: 'capitalize' }}>{x}</button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        {tab === 'weeks' && (statusErr && !status
          ? <Card style={{ gap: 8 }}><div className="t-13 muted">{statusErr}</div><button className="btn btn--white btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => void loadStatus()}>Try again</button></Card>
          : <Weeks course={course} status={status} reload={() => void loadStatus()} onPost={() => setTab('post')} />)}
        {tab === 'report' && <Report course={course} />}
        {tab === 'attendance' && <Attendance course={course} />}
        {tab === 'post' && <Post course={course} />}
        {tab === 'messages' && <CourseChat course={course} />}
      </div>
    </div>
  );
}

// L10: each week's state, and L13: check it, mark it reviewed or ask for changes.
function Weeks({ course, status, reload, onPost }: { course: string; status: Status | null; reload: () => void; onPost: () => void }) {
  const [sendWeek, setSendWeek] = useState<number | null>(null);
  const [changesFor, setChangesFor] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!status) return <SectionSkeleton rows={3} />;
  const review = async (week: number, st: 'reviewed' | 'changes') => {
    setBusy(true);
    try {
      await api.lecturerWeekReview({ course, week, status: st, note: st === 'changes' ? note.trim() : undefined });
      toastSuccess(st === 'reviewed' ? `Week ${week} marked reviewed. The contributor has been told.` : `Sent to the contributor. It's in Messages too.`);
      setChangesFor(null); setNote('');
      reload();
    } catch (e) { errorToast(e, 'save your review'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {status.weeks.map((w) => {
        const st = w.published ? (w.review?.status === 'reviewed' ? 'done' : 'check') : w.materials ? 'coming' : 'send';
        const meta = st === 'done'
          ? ['Notes reviewed', w.classesHeld ? `${w.classesHeld} class${w.classesHeld === 1 ? '' : 'es'}` : '', w.camePct != null ? `${w.camePct}% came` : ''].filter(Boolean).join(' · ')
          : st === 'check' ? (w.review?.status === 'changes' ? `You asked for changes: "${w.review.note}"` : 'Notes ready for you to check')
          : st === 'coming' ? `Materials received (${w.materials}) · notes on the way`
          : 'Waiting for your materials';
        const badge = { done: ['var(--u-green)', 'var(--u-black)'], check: ['var(--u-black)', 'var(--u-green)'], coming: ['var(--surface2)', 'var(--text3)'], send: ['var(--surface2)', 'var(--text3)'] }[st];
        return (
          <Card key={w.week} pad={14} style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: badge[0], color: badge[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>{String(w.week).padStart(2, '0')}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-15 w-7" style={{ display: 'block' }}>Week {w.week}{w.title ? ` · ${w.title}` : ''}</span>
                <span className="t-12" style={{ display: 'block', color: st === 'check' && w.review?.status === 'changes' ? 'var(--u-warn-ink)' : 'var(--text2)' }}>{meta}</span>
              </span>
              {st === 'check' && <Link to={`/learn/${encodeURIComponent(course)}/week/${w.week}?preview=1`} className="btn btn--amber btn--sm">Check</Link>}
              {st === 'send' && <button className="btn btn--outline btn--sm" onClick={() => setSendWeek(w.week)}>Send</button>}
              {st === 'done' && <Link to={`/learn/${encodeURIComponent(course)}/week/${w.week}?preview=1`} className="t-13 w-7" style={{ color: 'var(--u-good)', textDecoration: 'none' }}>Open</Link>}
            </div>
            {st === 'check' && (
              changesFor === w.week ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="What needs changing? e.g. Add a 3×3 example; most exam questions are 3×3." style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--amber btn--sm" disabled={busy || !note.trim()} onClick={() => void review(w.week, 'changes')}>Send to the contributor</button>
                    <button className="btn btn--white btn--sm" onClick={() => setChangesFor(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn--green btn--sm" disabled={busy} onClick={() => void review(w.week, 'reviewed')}><Check size={15} /> Mark as reviewed</button>
                  <button className="btn btn--white btn--sm" onClick={() => { setChangesFor(w.week); setNote(''); }}>Needs changes</button>
                </div>
              )
            )}
          </Card>
        );
      })}
      <Card tone="dark" pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1 }}>
          <span className="t-15 w-7" style={{ display: 'block', color: '#fff' }}>Tell this class something</span>
          <span className="t-12" style={{ color: '#aaa' }}>Every class taking it, or pick one</span>
        </span>
        <button className="btn btn--green btn--sm" onClick={onPost}><Send size={14} /> Post</button>
      </Card>
      {sendWeek != null && <SendPdf course={course} week={sendWeek} onClose={() => { setSendWeek(null); reload(); }} />}
    </div>
  );
}

function Report({ course }: { course: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.courseReport>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.courseReport(course).then(setData).catch((e) => setErr(describeError(e, 'load the report'))); }, [course]);
  const [pickWeek, setPickWeek] = useState<number | null>(null);
  const classLabel = useClassLabel();
  const [missed, setMissed] = useState<Awaited<ReturnType<typeof api.lecturerMissed>> | null>(null);
  const [adding, setAdding] = useState(false);
  const shownWeek = pickWeek ?? ((data && ([...data.weeks].reverse().find((w) => w.studied > 0) || data.weeks[data.weeks.length - 1])?.week) || null);
  useEffect(() => { setMissed(null); if (shownWeek) api.lecturerMissed(course, shownWeek).then(setMissed).catch(() => setMissed(null)); }, [course, shownWeek]);
  if (err) return <Card><div className="t-13 muted">{err}</div></Card>;
  if (!data) return <SectionSkeleton rows={3} />;
  const latest = [...data.weeks].reverse().find((w) => w.studied > 0) || data.weeks[data.weeks.length - 1];
  const pick = data.weeks.find((w) => w.week === pickWeek) || latest;
  return (
    <>
      {pick && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {data.weeks.map((w) => <button key={w.week} className={`chip chip--sm${pick.week === w.week ? ' chip--on' : ''}`} onClick={() => setPickWeek(w.week)}>Week {w.week}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[[String(data.students), 'students taking it on Unify'], [String(pick.studied), `studied Week ${pick.week}`], [pick.quizAvg == null ? '–' : `${pick.quizAvg}%`, 'quiz average'], [String(pick.quizTakers), 'took the quiz']].map(([n, l]) => (
              <Card key={l} pad={14} style={{ gap: 2 }}><span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 28 }}>{n}</span><span className="t-12 muted">{l}</span></Card>
            ))}
          </div>
          {(data.classes || []).length > 0 && (
            <Card pad={16} style={{ gap: 10, marginBottom: 12 }}>
              <span className="t-14 w-7">Studied Week {pick.week}, by class</span>
              {(data.classes || []).map((c) => {
                const n = pick.byClass?.[c.key] || 0;
                const pct = c.students ? Math.round((n / c.students) * 100) : 0;
                return (
                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }} className="t-13"><span className="w-6">{classLabel(c.key)} · {c.students}</span><span className="w-7">{pct}%</span></div>
                    <div style={{ height: 6, borderRadius: 9999, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--u-black)' }} /></div>
                  </div>
                );
              })}
            </Card>
          )}
          {/* L11: the questions most students got wrong this week. */}
          <Label>Most missed in Week {pick.week}</Label>
          {missed && missed.questions.length > 0 ? (
            <ListCard style={{ marginTop: 6, marginBottom: 12 }}>
              {missed.questions.map((q) => (
                <div key={q.index} className="row" style={{ gap: 10, padding: '12px 16px' }}>
                  <div className="grow t-14"><b>Q{q.index + 1}</b> · {q.question}</div>
                  <span className={`pill ${q.wrongPct >= 50 ? 'pill--bad' : 'pill--warn'}`} style={{ whiteSpace: 'nowrap' }}>{q.wrongPct}% wrong</span>
                </div>
              ))}
            </ListCard>
          ) : (
            <div className="t-13 muted" style={{ margin: '6px 0 12px' }}>{missed && missed.attempts ? 'No question stands out yet.' : "Shows once students take this week's quiz (attempts from today on)."}</div>
          )}
          <Label>Every week</Label>
        </>
      )}
      {/* Practice questions can be added before any week is published too. */}
      <div style={{ margin: '4px 0 14px' }}>
        {adding ? <PracticeEditor course={course} onClose={() => setAdding(false)} /> : (
          <button className="btn btn--outline btn--block" onClick={() => setAdding(true)}>+ Add practice questions</button>
        )}
      </div>
      <div className="t-13 muted" style={{ marginBottom: 8, marginTop: 6 }}>{data.students} student{data.students === 1 ? '' : 's'} taking {course}. Counts only, never names.</div>
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
  const [sort, setSort] = useState<'low' | 'under75' | 'az'>('low');
  useEffect(() => { api.attendanceStudents(course).then(setData).catch((e) => setErr(describeError(e, 'load attendance'))); }, [course]);
  const rows = useMemo(() => {
    const all = [...(data?.students || [])];
    if (sort === 'az') return all.sort((a, b) => a.name.localeCompare(b.name));
    const low = all.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
    return sort === 'under75' ? low.filter((s) => s.pct != null && s.pct < 75) : low;
  }, [data, sort]);
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
      {data.held > 0 && (() => {
        const withPct = data.students.filter((s) => s.pct != null);
        const avg = withPct.length ? Math.round(withPct.reduce((n, s) => n + (s.pct || 0), 0) / withPct.length) : 0;
        return (
          <Card tone="dark" pad={18} style={{ gap: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 44, color: 'var(--u-green)' }}>{avg}%</span>
              <span className="t-13" style={{ color: '#aaa' }}>average attendance · {data.held} class{data.held === 1 ? '' : 'es'} held so far</span>
            </div>
          </Card>
        );
      })()}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {([['low', 'Lowest first'], ['under75', `Below 75% · ${data.students.filter((s) => s.pct != null && s.pct < 75).length}`], ['az', 'A–Z']] as const).map(([k, l]) => (
          <button key={k} className={`chip chip--sm${sort === k ? ' chip--on' : ''}`} onClick={() => setSort(k)}>{l}</button>
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
  const [sending, setSending] = useState(false);
  const [type, setType] = useState<PostKind>('notice');
  const [audience, setAudience] = useState('');
  const [classes, setClasses] = useState<{ key: string; students: number }[]>([]);
  const [total, setTotal] = useState(0);
  const classLabel = useClassLabel();
  useEffect(() => { api.courseReport(course).then((r) => { setClasses(r.classes || []); setTotal(r.students); }).catch(() => {}); }, [course]);
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
      const r = await api.coursePost({ course, type, title: title.trim() || undefined, content: content.trim(), audience: audience || undefined });
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
        <Label>Which students?</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[{ key: '', label: `Every class taking ${course}`, n: total }, ...(classes.length > 1 ? classes.map((c) => ({ key: c.key, label: `${classLabel(c.key)} students`, n: c.students })) : [])].map((o) => (
            <button key={o.key || 'all'} onClick={() => setAudience(o.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${audience === o.key ? 'var(--text)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', textAlign: 'left' }}>
              <span style={{ width: 18, height: 18, borderRadius: 9999, border: audience === o.key ? '6px solid var(--text)' : '1.5px solid var(--border)', flexShrink: 0 }} />
              <span style={{ flex: 1 }} className="t-14 w-6">{o.label}</span>
              <span className="t-12 muted">{o.n} students</span>
            </button>
          ))}
        </div>
        <Label>What is it?</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['notice', 'test', 'assignment', 'exam', 'reminder'] as const).map((x) => (
            <button key={x} className={`chip chip--sm${type === x ? ' chip--on' : ''}`} onClick={() => setType(x)} style={{ textTransform: 'capitalize' }}>{x}</button>
          ))}
        </div>
        <div className="t-12 muted">Announcement only, like a locked WhatsApp group: students read it on their course page and get a bell. Students who join later still see it.</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} style={field} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} placeholder="e.g. Test on Friday in LT2. Bring calculators." style={{ ...field, resize: 'vertical' }} />
        <button className="btn btn--amber btn--block" disabled={busy || !content.trim()} onClick={() => void send()}>{busy ? 'Posting…' : 'Post to students'}</button>
        <button className="btn btn--white btn--block" onClick={() => setSending(true)}>Send a PDF instead</button>
      </Card>
      {sending && <SendPdf course={course} onClose={() => { setSending(false); void load(); }} />}
      {posts.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <Label>Posted</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {posts.map((p) => (
              <Card key={p.id} pad={14} style={{ gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="t-12 muted" style={{ textTransform: 'capitalize' }}>{p.type} · {p.audience ? `${classLabel(p.audience)} only` : 'every class'} · {new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
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
