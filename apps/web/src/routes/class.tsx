import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Lock, Search } from 'lucide-react';
import BackButton from '../components/BackButton';
import { SearchListSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import Loading from '../components/Loading';

type CatalogCourse = { code: string; title: string; weeks: number; levels: string[]; semesters: string[]; matchedAlias: string | null };

// Manage courses: open by level (100L-500L, with a count each), then the
// semester, then that semester's courses to add or remove. Any level can be
// opened (carryovers, courses never registered, other levels); search spans
// everything. Enrolled courses live under My Courses.
export default function ClassRoute() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [myLevel, setMyLevel] = useState('');
  const [activeSemester, setActiveSemester] = useState('First Semester');
  // The running semester's teaching weeks are over: the next one opens.
  const [semEnded, setSemEnded] = useState(false);
  const [enrolledSet, setEnrolledSet] = useState<Set<string>>(new Set());
  // The courses the student had when the page opened go first in every list.
  // Taken once, so a row doesn't jump away while they add or remove it.
  const [firstMine, setFirstMine] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  // BUG-006 search: code, title or alias ("ME 352" finds "MEE 352"),
  // spanning both semesters with badges so nothing hides.
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CatalogCourse[] | null>(null);
  // Drill-down: level, then semester, then courses. null = that step is open.
  // Review 3 (C9): levels open in place (your level first), each with a
  // First / Second semester switch and its courses to add or remove.
  const [openLevel, setOpenLevel] = useState<string | null>(null);
  const [semOf, setSemOf] = useState<Record<string, string>>({});

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        setError('Please sign in again.');
        setLoading(false);
        return;
      }
      try {
        const [me, settings] = await Promise.all([
          api.me(),
          api.settings().catch(() => ({ currentSemester: 'First Semester', semesterEnded: false })),
        ]);
        if (me.profile?.level) setMyLevel(me.profile.level);
        setEnrolledSet(new Set((me.courses || []).map((c) => c.toUpperCase())));
        setFirstMine(new Set((me.courses || []).map((c) => c.toUpperCase())));
        if (settings.currentSemester) setActiveSemester(settings.currentSemester);
        setSemEnded(!!(settings as { semesterEnded?: boolean }).semesterEnded);
        const list = (await api.courses()).filter((c) => c.code && c.code.trim());
        // Week counts ride on the catalog response — no per-course fan-out
        // (one Explore visit used to fire ~160 week requests).
        setCourses(
          list.map((c) => ({ code: c.code, title: c.title, weeks: c.weeks || 0, levels: c.levels || [], semesters: c.semesters || [], matchedAlias: null }))
        );
      } catch (err) {
        setError(describeError(err, 'load courses'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced catalog search (min 2 chars) across every level: carryovers and
  // courses from other levels must be findable.
  // Declared above the loading early-return: a hook after a return
  // changes the hook count between renders and crashes the page (#310).
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await api.courseSearch(needle, '');
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, myLevel]);

  if (loading) return <SearchListSkeleton withAction={false} />;

  // Levels as the catalog spells them ("400 Level"); "400L" profiles match too.
  const norm = (l: string) => (l || '').replace(/^(\d{3})\s*L(evel)?$/i, '$1 Level').trim();
  const levelOf = (c: CatalogCourse) => c.levels.map(norm);
  const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
  const extra = [...new Set(courses.flatMap(levelOf))].filter((l) => l && !LEVELS.includes(l)).sort();
  const levels = [...LEVELS, ...extra];
  const mine = norm(myLevel);
  const SEMS = ['First Semester', 'Second Semester'];
  const inLevel = (l: string) => courses.filter((c) => levelOf(c).includes(l));
  const inSem = (l: string, sem: string) => inLevel(l).filter((c) => c.semesters.includes(sem));
  // Added courses first, then the rest, each group in its usual order.
  const addedFirst = (list: CatalogCourse[]) => [...list].sort((a, b) => Number(firstMine.has(b.code.toUpperCase())) - Number(firstMine.has(a.code.toUpperCase())));
  const shown = addedFirst(results !== null ? results : []);
  const opened = openLevel ?? (mine && inLevel(mine).length ? mine : null);
  const short = (l: string) => l.replace(/ Level$/, 'L');
  const addedIn = (list: CatalogCourse[]) => list.filter((c) => enrolledSet.has(c.code.toUpperCase())).length;
  // Locks (same rule as the server, lib/courseLock): lower levels open for
  // carryovers; higher levels wait for promotion; in your own level the next
  // semester opens when the running one's weeks are over.
  const mineIdx = LEVELS.indexOf(mine);
  const slotLock = (level: string, sem: string): string | null => {
    const lvl = LEVELS.indexOf(norm(level));
    if (mineIdx < 0 || lvl < 0 || lvl < mineIdx) return null;
    if (lvl > mineIdx) return `Opens when you move to ${LEVELS[lvl]}`;
    const order = ['First Semester', 'Second Semester'];
    const s2 = order.indexOf(sem);
    const cur = order.indexOf(activeSemester);
    if (s2 < 0 || cur < 0 || s2 <= cur || semEnded) return null;
    return `Opens when ${sem} starts`;
  };
  const lockOf = (c: CatalogCourse): string | null => {
    const lv = c.levels.length ? c.levels : [''];
    const sm = c.semesters.length ? c.semesters : [''];
    let why: string | null = null;
    for (const l of lv) for (const x of sm) {
      const r = slotLock(l, x);
      if (!r) return null;
      why = why || r;
    }
    return why;
  };
  const levelLock = (l: string) => slotLock(l, activeSemester);


  const toggleEnroll = async (code: string) => {
    const isIn = enrolledSet.has(code.toUpperCase());
    setBusy(code);
    setError('');
    try {
      const res = await api.enroll(code, !isIn);
      setEnrolledSet(new Set((res.enrolled || []).map((c) => c.toUpperCase())));
    } catch (err) {
      setError(describeError(err, 'add that course'));
    } finally {
      setBusy(null);
    }
  };

  const courseRow = (c: CatalogCourse, i: number, isSearch: boolean) => {
          const isIn = enrolledSet.has(c.code.toUpperCase());
          // Locked courses can be looked at, not added (one already added can still be removed).
          const locked = !isIn ? lockOf(c) : null;
          return (
            <div
              key={c.code}
              className="rise cv-row"
              style={{
                animationDelay: `${Math.min(i, 6) * 40}ms`,
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              {/* Enroll-only: no link into the course. Enrolled courses open
                  from My Courses (/course). */}
              <div
                style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text)', minWidth: 0 }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--u-good-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} color="var(--u-good)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{c.code}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
                  {isSearch && (
                    <span style={{ fontSize: 11, color: 'var(--u-good)', fontWeight: 700, display: 'block' }}>
                      {[...(c.levels || []).map((l) => norm(l).replace(/ Level$/, 'L')), ...(c.semesters || []).map((x) => x.replace(' Semester', ''))].join(' · ')}{c.matchedAlias ? ` · also “${c.matchedAlias}”` : ''}
                    </span>
                  )}
                  {locked && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, display: 'block' }}>{locked}</span>}
                </span>
              </div>
              {locked ? (
                <span aria-label={`Locked: ${locked}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '8px 12px', borderRadius: 9999, border: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                  <Lock size={12} /> Locked
                </span>
              ) : (
              <button
                onClick={() => toggleEnroll(c.code)}
                disabled={busy === c.code}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: `1px solid ${isIn ? 'var(--u-good)' : 'var(--border)'}`,
                  background: isIn ? 'var(--u-amber)' : 'var(--surface)',
                  color: isIn ? 'var(--u-black)' : 'var(--u-good)',
                  fontWeight: 800,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  opacity: busy === c.code ? 0.6 : 1,
                }}
              >
                {busy === c.code ? '…' : isIn ? 'Added ✓' : 'Add'}
              </button>
              )}
            </div>
          );
  };

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/courses" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>Manage courses</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        {enrolledSet.size} course{enrolledSet.size === 1 ? '' : 's'} added. Open a level to add a course you take (carryovers and other levels too) or remove one you don't.
      </p>
      <div style={{ position: 'relative', marginTop: 12 }}>
        <Search size={16} color="#999" style={{ position: 'absolute', left: 12, top: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Or search any course: code, title or alias…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>
      {results === null && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {levels.map((l) => {
            const list = inLevel(l);
            const added = addedIn(list);
            const isOpen = opened === l;
            const lockedLevel = levelLock(l) && LEVELS.indexOf(l) > mineIdx ? levelLock(l) : null;
            const sem = semOf[l] || (inSem(l, activeSemester).length ? activeSemester : SEMS.find((x) => inSem(l, x).length) || activeSemester);
            const semList = addedFirst(inSem(l, sem));
            const semsHere = SEMS.filter((x) => inSem(l, x).length);
            return (
              <div key={l} style={{ background: 'var(--surface)', border: `1px solid ${l === mine ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden', opacity: list.length ? 1 : 0.5 }}>
                <button onClick={() => setOpenLevel(isOpen ? '' : l)} disabled={!list.length} aria-expanded={isOpen}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: isOpen ? 'var(--u-black)' : 'var(--surface2)', color: isOpen ? 'var(--u-green)' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{l.replace(/ Level$/, '')}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800 }}>{l}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>
                      {[l === mine ? 'Your level' : '', `${list.length} course${list.length === 1 ? '' : 's'}`, added ? `${added} added` : '', lockedLevel || ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {lockedLevel ? <Lock size={16} color="var(--text3)" aria-label="Locked" /> : <ChevronDown size={18} color="var(--text3)" style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {semsHere.length > 1 && (
                      <div role="tablist" aria-label={`${l} semester`} style={{ display: 'flex', gap: 6 }}>
                        {semsHere.map((x) => (
                          <button key={x} role="tab" aria-selected={sem === x} className={`chip chip--sm${sem === x ? ' chip--on' : ''}`} onClick={() => setSemOf((m) => ({ ...m, [l]: x }))}>
                            {x.replace(' Semester', ' semester')}{slotLock(l, x) ? ' · locked' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    {semsHere.length === 1 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{sem}</div>}
                    {semList.map((c, i) => courseRow(c, i, false))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {searching && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Searching…</div>}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results !== null && shown.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <BoxBoy pose="peeking" width={62} />
            <div style={{ marginTop: 8 }}>{results !== null ? 'No courses match that search.' : 'No courses in this semester yet. Check back soon.'}</div>
          </div>
        )}
        {shown.map((c, i) => courseRow(c, i, true))}
      </div>
    </div>
  );
}

