import { DetailSkeleton } from '../components/Skeletons';
import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, FileText } from 'lucide-react';
import BackButton from '../components/BackButton';
import { ROUTES } from '../lib/routes';
import { BoxBoy } from '../components/redesign/brand';
import Flash from '../components/Flash';
import { api, type Material } from '../lib/api';
import { log } from '../lib/log';
import { describeError } from '../lib/errors';
import Loading from '../components/Loading';
import CourseAttendance from '../components/CourseAttendance';
import { PracticeRunner } from '../components/PracticeQuestions';
import { CourseActions, LecturersCard, MatricPrompt, MarksLegend, WeekCard, attendanceByWeek, weekClasses, type ClassMark } from '../components/CoursePageParts';
import { CrosswordIcon, KeywordsIcon } from '../components/GameIcons';
import type { CourseAttendance as AttendanceData, CourseLecturers } from '../lib/api';

// Week of the semester from the profile's semester start (0 = not set / outside it).
export function semesterWeek(start?: string | null, weeks?: number | null): { week: number; total: number } {
  const total = weeks || 12;
  if (!start) return { week: 0, total };
  const w = Math.floor((Date.now() - new Date(start).getTime()) / (7 * 86400000)) + 1;
  return { week: w >= 1 && w <= total ? w : 0, total };
}

type WeekRow ={ week: number; title: string; subtitle: string; authors?: { name: string; avatar: string }[] };

export default function CourseDetailRoute() {
  // Param name must match the route (/course/:courseCode in App.tsx) —
  // reading a wrong key yields '' for every course (that was the
  // "No course selected" bug: the link was right, the read was wrong).
  const { courseCode: code = '' } = useParams();
  const [searchParams] = useSearchParams();
  // React Router already URL-decodes params — never decode again here
  // (a stray % once crashed this screen). Trimmed for lookups, but the
  // empty-guard tests the RAW param: a whitespace code is "present but
  // unenrolled" (blocked screen with enroll button), not "nothing selected".
  const courseCode = (code || '').trim();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [blocked, setBlocked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  // Preview landings (admin/author browsing) go back to their hub, never
  // to the student My Courses module.
  // Students with no in-app trail (reopened, refreshed, from a notification) go Home.
  const [backTo, setBackTo] = useState('/home');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [slots, setSlots] = useState<{ day: number; start: string; end: string; venue: string; lecturer: string }[]>([]);
  const preview = searchParams.get('preview') === '1';
  const [sem, setSem] = useState<{ week: number; total: number }>({ week: 0, total: 12 });
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<'weeks' | 'outline' | 'practice'>(initialTab === 'outline' || initialTab === 'practice' ? initialTab : 'weeks');
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof api.myCourseProgress>>['weeks'] | null>(null);
  // Review 3 (C1/C10): lecturers with their weeks, and the course intro.
  const [lect, setLect] = useState<CourseLecturers | null>(null);
  const [semStart, setSemStart] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Design S23: the course's full title and semester, attendance per week, and
  // which week card is open (the current week, or the first not finished).
  const [courseInfo, setCourseInfo] = useState<{ title: string; semesters: string[] } | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Weeks + profile load in parallel: a flaky profile check (cold
        // start) must never hide the weeks. The enrolled-only gate applies
        // only when the check succeeds (authors in ?preview=1 pass through).
        const [me, res] = await Promise.all([
          api.me().catch(() => null),
          api.courseWeeks(courseCode),
        ]);
        if (me) {
          const role = me.profile?.role || 'student';
          setSem(semesterWeek(me.profile?.semester_start, me.profile?.semester_weeks));
          setSemStart(me.profile?.semester_start || null);
          setBackTo(
            preview
              ? me.isAdmin
                ? '/admin/content'
                : role === 'lecturer' || role === 'contributor'
                  ? '/browse'
                  : '/courses'
              : '/home'
          );
          if (preview) {
            setWeeks(res.weeks || []);
            return;
          }
          const enrolled = (me.courses || []).map((c) => c.toUpperCase().trim()).includes(courseCode.toUpperCase());
          if ((role === 'student' || !role) && !enrolled && !me.isAdmin) {
            setBlocked(true);
            setLoading(false);
            return;
          }
        }
        setWeeks(res.weeks || []);
        // Class times ride alongside (read-only here; lecturers manage
        // them under My Classes). Failure never blocks the weeks.
        api.timetable(courseCode).then((tt) => setSlots(tt.slots || [])).catch(() => {});
        api.materials(courseCode).then((r) => setMaterials(r.materials || [])).catch(() => {});
        api.myCourseProgress(courseCode).then((r) => setProgress(r.weeks)).catch(() => {});
        api.courseLecturers(courseCode).then(setLect).catch(() => {});
        api.courses().then((list) => {
          const c = list.find((x) => x.code.toUpperCase().trim() === courseCode.toUpperCase());
          if (c) setCourseInfo({ title: c.title, semesters: c.semesters || [] });
        }).catch(() => {});
        if (!preview) api.attendanceCourse(courseCode).then(setAttendance).catch(() => {});
      } catch (err) {
        // S73: a course code that doesn't exist (old link, typo) gets its own state.
        if ((err as { status?: number }).status === 404) setNotFound(true);
        else setError(describeError(err, 'load weeks'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode]);

  const enrollHere = async () => {
    setEnrolling(true);
    setError('');
    try {
      await api.enroll(courseCode, true);
      setBlocked(false);
      const res = await api.courseWeeks(courseCode);
      setWeeks(res.weeks || []);
    } catch (err) {
      setError(describeError(err, 'add that course'));
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!code) {
    // Unreachable via router links (course code is always present), but if
    // it ever happens, send the student to their courses instead of a
    // dead-end message. Logged so a recurrence leaves a trace.
    log.warn('route', `course detail with empty code (url=${window.location.href})`);
    return <Navigate to="/courses" replace />;
  }
  if (notFound)
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px', textAlign: 'center' }}>
        <BackButton to={backTo} />
        <div style={{ display: 'flex', justifyContent: 'center' }}><BoxBoy pose="peeking" width={90} /></div>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20, marginTop: 12 }}>We can't find {courseCode}</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>The link may be old, or the course isn't on Unify yet.</p>
        <Link to="/courses/find" className="btn btn--amber">Manage courses</Link>
      </div>
    );
  if (blocked)
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px', textAlign: 'center' }}>
        <BackButton to={backTo} />
        <div style={{ display: 'flex', justifyContent: 'center' }}><BoxBoy pose="readingStanding" width={72} /></div>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20, marginTop: 12 }}>{courseCode} isn't on your list yet</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>Add it to open its weeks, topics and quizzes. It takes a second.</p>
      {slots.length > 0 && (
        <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--u-good)' }}>CLASS TIMES · REPEATS WEEKLY</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((s) => (
              <div key={`${s.day}-${s.start}`} style={{ fontSize: 13, fontWeight: 700 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.day] || `Day ${s.day}`} · {s.start}–{s.end}
                {(s.venue || s.lecturer) && (
                  <span style={{ fontWeight: 500, color: 'var(--text2)' }}>
                    {' '}· {[s.venue, s.lecturer].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        <button onClick={enrollHere} disabled={enrolling} style={{ padding: '12px 28px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', fontWeight: 800, fontSize: 14, opacity: enrolling ? 0.6 : 1 }}>
          {enrolling ? 'Adding…' : `Add ${courseCode}`}
        </button>
        <div style={{ marginTop: 12 }}>
          <Link to="/courses/find" style={{ fontSize: 13, color: 'var(--u-good)', fontWeight: 700, textDecoration: 'none' }}>
            or explore other courses
          </Link>
        </div>
      </div>
    );

  // Review 3 (C1): title, a short introduction, the lecturers, the matric
  // prompt, then every week of the semester with attendance on each.
  const byWeek = attendanceByWeek(attendance);
  const perWeek = slots.length;
  const lastPublished = weeks.reduce((m, w) => Math.max(m, w.week), 0);
  const totalWeeks = Math.max(sem.total, lastPublished);
  const firstOpen = (sem.week > 0 ? sem.week : null)
    ?? weeks.find((w) => { const p = progress?.find((x) => x.week === w.week); return !p || p.done < p.topics; })?.week
    ?? null;
  const shown = openWeek ?? firstOpen;
  const lecturerFor = (w: number) => lect?.lecturers.find((l) => l.weekFrom != null && l.weekTo != null && w >= l.weekFrom && w <= l.weekTo)?.name
    || (lect?.lecturers.length === 1 ? lect.lecturers[0].name : '');
  const surnameOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(-1)[0] || n;
  const shortName = (n: string) => { const t = n.match(/^(Prof|Dr|Engr|Mr|Mrs|Ms)\.?\s/i)?.[1]; return t ? `${t}. ${surnameOf(n)}` : n; };
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to={backTo} label={courseCode} />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{courseInfo?.title || courseCode}</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        {[courseInfo?.title ? courseCode : '', (courseInfo?.semesters || []).map((x) => x.replace(' Semester', ' semester')).join(' & '), `${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'} published`].filter(Boolean).join(' · ')}
      </p>
      {lect?.intro && <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, color: 'var(--text)' }}>{lect.intro}</p>}
      {lect && <LecturersCard course={courseCode} lecturers={lect.lecturers} week={sem.week} canEdit={lect.canEdit && !preview} />}
      {!preview && <MatricPrompt course={courseCode} />}
      <CourseActions course={courseCode} weeks={progress || []} preview={preview} />
      {sem.week > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text2)', whiteSpace: 'nowrap' }}>WEEK {sem.week} OF {sem.total}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${(sem.week / sem.total) * 100}%`, height: '100%', background: 'var(--u-green)' }} />
          </div>
          {attendance && attendance.mine.held > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: 9999, background: 'var(--u-good-tint)', color: 'var(--u-good)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>Attendance {attendance.mine.attended} of {attendance.mine.held}</span>
          )}
        </div>
      )}
      {!preview && <LecturerPosts course={courseCode} />}
      {/* S23–S25: Weeks · Outline · Practice */}
      <div role="tablist" aria-label="Course sections" style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {(['weeks', 'outline', 'practice'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip chip--sm${tab === t ? ' chip--on' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>
      {tab === 'outline' && <Outline weeks={weeks} progress={progress} />}
      {tab === 'practice' && <Practice course={courseCode} progress={progress} preview={preview} />}
      {tab === 'weeks' && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weeks.length === 0 && !error && sem.week === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <BoxBoy pose="readingStanding" width={62} />
              <div style={{ marginTop: 8 }}>No weeks published yet.</div>
            </div>
          )}
          {(weeks.length > 0 || sem.week > 0) && Array.from({ length: totalWeeks }, (_, i) => i + 1).map((n) => {
            const w = weeks.find((x) => x.week === n);
            const p = progress?.find((x) => x.week === n);
            const a = byWeek[n];
            const held = a?.classes || [];
            const count = Math.max(perWeek, a?.held || 0);
            const marks: ClassMark[] = Array.from({ length: count }, (_, i) => (i < held.length ? (held[i].came ? 'came' : 'missed') : 'open'));
            const current = n === sem.week;
            const classes = current && !preview ? weekClasses({ week: n, semesterStart: semStart, slots, held, titles: p?.topicTitles || [] }) : null;
            const who = lecturerFor(n);
            const sub = current
              ? ['This week', who && shortName(who), count ? `${count} class${count === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' · ')
              : w
                ? [who && shortName(who), p?.quiz ? `Quiz ${p.quiz.best}/${p.quiz.total}` : p && p.topics ? `${p.done} of ${p.topics} read` : ''].filter(Boolean).join(' · ') || 'Notes ready'
                : [who && shortName(who), sem.week > 0 && n < sem.week ? 'notes coming' : ''].filter(Boolean).join(' · ') || 'Notes land when the week is taught';
            return (
              <WeekCard
                key={n}
                course={courseCode}
                week={n}
                title={w?.title || ''}
                sub={sub}
                published={!!w}
                current={current}
                past={sem.week > 0 && n < sem.week}
                progress={p}
                marks={marks}
                classes={classes}
                open={shown === n}
                onToggle={() => setOpenWeek(shown === n ? -1 : n)}
                preview={preview}
              />
            );
          })}
          {!preview && (perWeek > 0 || (attendance?.mine.held || 0) > 0) && <MarksLegend />}
          {materials.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: 1 }}>FROM YOUR LECTURER</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {materials.map((m) => (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', color: 'var(--text)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <FileText size={18} color="var(--u-good)" />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{m.title}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Week {m.week} · {m.type === 'past-paper' ? 'past paper' : m.type}</span>
                    </span>
                    <ExternalLink size={16} color="var(--u-good)" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {!preview && <CourseAttendance course={courseCode} totalWeeks={sem.total} currentWeek={sem.week} hideMine />}
        </div>
      )}
    </div>
  );
}


type Progress = Awaited<ReturnType<typeof api.myCourseProgress>>['weeks'];
const box: React.CSSProperties = { padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };

// S24: the course outline, week by week (topic names from the published notes).
function Outline({ weeks, progress }: { weeks: WeekRow[]; progress: Progress | null }) {
  if (!weeks.length) return <div style={{ ...box, marginTop: 16, color: 'var(--text2)', textAlign: 'center' }}>The outline appears as weeks are published.</div>;
  return (
    <div style={{ ...box, marginTop: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Course outline</div>
      {weeks.map((w) => {
        const p = progress?.find((x) => x.week === w.week);
        return (
          <div key={w.week} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ width: 58, flexShrink: 0, fontSize: 12, fontWeight: 800, color: p && p.topics && p.done >= p.topics ? 'var(--u-good)' : 'var(--text2)' }}>Week {w.week}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{w.title || `Week ${w.week}`}</span>
              {p && p.topicTitles.length > 0 && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{p.topicTitles.join(' · ')}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// S25: practice: each week's quiz with your best score; past questions come later.
function Practice({ course, progress, preview }: { course: string; progress: Progress | null; preview: boolean }) {
  const quizzes = (progress || []).filter((w) => w.hasQuiz);
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...box, display: 'flex', gap: 12, alignItems: 'center', opacity: 0.75 }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700 }}>Past questions</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Coming once the Faculty approves them.</span>
        </span>
      </div>
      {!preview && <PracticeRunner course={course} />}
      {quizzes.length === 0 && <div style={{ ...box, color: 'var(--text2)', textAlign: 'center' }}>Weekly quizzes show here as weeks are published.</div>}
      {(progress || []).length > 0 && (
        <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><KeywordsIcon size={16} /> Keywords</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Spell each week's key terms from a wheel of letters, with clues from the notes.</span>
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(progress || []).map((w) => (
              <Link key={w.week} to={ROUTES.keywords(course, w.week)} className="chip chip--sm" style={{ textDecoration: 'none' }}>Week {w.week}</Link>
            ))}
          </div>
        </div>
      )}
      {(progress || []).length > 0 && (
        <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><CrosswordIcon size={16} /> Crossword</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>The week's key terms crossing each other, with clues from the notes.</span>
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(progress || []).map((w) => (
              <Link key={w.week} to={ROUTES.crossword(course, w.week)} className="chip chip--sm" style={{ textDecoration: 'none' }}>Week {w.week}</Link>
            ))}
          </div>
        </div>
      )}
      {(progress || []).length > 0 && <CourseBoard course={course} />}
      {quizzes.map((w) => (
        <Link
          key={w.week}
          to={`/learn/${encodeURIComponent(course)}/week/${w.week}?t=${w.topics}${preview ? '&preview=1' : ''}`}
          style={{ ...box, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>Week {w.week} quiz</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{w.title || 'End-of-week questions'}{w.quiz ? ` · ${w.quiz.attempts} attempt${w.quiz.attempts === 1 ? '' : 's'}` : ''}</span>
          </span>
          {w.quiz ? (
            <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 9999, background: 'var(--u-good-tint)', color: 'var(--u-good)' }}>{w.quiz.best}/{w.quiz.total}</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--u-good)' }}>Start</span>
          )}
        </Link>
      ))}
    </div>
  );
}

// Games across the whole course: key terms mastered, and the course leaderboard.
function CourseBoard({ course }: { course: string }) {
  const [mine, setMine] = useState<number | null>(null);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof api.gameBoard>> | null>(null);
  useEffect(() => {
    api.gameMine(course).then((r) => setMine(r.termsMastered)).catch(() => {});
    api.gameBoard({ course }).then(setBoard).catch(() => {});
  }, [course]);
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontWeight: 700 }}>Course leaderboard</span>
      {board && !board.top.length && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Nobody has played {course}'s games yet. Finish a week's notes and play Keywords or Crossword to get on the board.</span>}
      {mine != null && <span style={{ fontSize: 12, color: 'var(--text2)' }}>You've mastered {mine} key term{mine === 1 ? '' : 's'} in {course} so far{board?.me ? `, and you're number ${board.me.rank} of ${board.players}` : ''}.</span>}
      {(board?.top || []).slice(0, 5).map((p) => (
        <div key={p.rank} style={{ display: 'flex', gap: 8, fontSize: 13, fontWeight: p.me ? 800 : 500 }}>
          <span style={{ width: 18, color: 'var(--text2)' }}>{p.rank}</span>
          <span style={{ flex: 1 }}>{p.me ? 'You' : p.name}</span>
          <span style={{ color: 'var(--text2)' }}>{p.terms} terms</span>
          <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 800 }}>{p.score}</span>
        </div>
      ))}
      <Link to={`${ROUTES.games}?course=${encodeURIComponent(course)}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none', marginTop: 2 }}>Weekly leaderboards and games</Link>
    </div>
  );
}

// L15 seen by students: the latest posts from this course's lecturer.
function LecturerPosts({ course }: { course: string }) {
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof api.coursePosts>>['posts']>([]);
  useEffect(() => {
    api.coursePosts(course).then((r) => setPosts(r.posts.slice(0, 3))).catch(() => {});
  }, [course]);
  if (!posts.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: 1 }}>FROM YOUR LECTURER</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.map((p) => (
          <div key={p.id} style={box}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>{p.type} · {p.author} · {new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
            {p.title && <div style={{ fontWeight: 700, marginTop: 4 }}>{p.title}</div>}
            <div style={{ fontSize: 14, marginTop: 2, whiteSpace: 'pre-wrap' }}>{p.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

