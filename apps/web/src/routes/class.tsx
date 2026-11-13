import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
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
  const [enrolledSet, setEnrolledSet] = useState<Set<string>>(new Set());
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
  const [pickLevel, setPickLevel] = useState<string | null>(null);
  const [pickSem, setPickSem] = useState<string | null>(null);

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
          api.settings().catch(() => ({ currentSemester: 'First Semester' })),
        ]);
        if (me.profile?.level) setMyLevel(me.profile.level);
        setEnrolledSet(new Set((me.courses || []).map((c) => c.toUpperCase())));
        if (settings.currentSemester) setActiveSemester(settings.currentSemester);
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

  if (loading) return <SearchListSkeleton />;

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
  const shown = results !== null ? results : pickLevel && pickSem ? inSem(pickLevel, pickSem) : [];
  const short = (l: string) => l.replace(/ Level$/, 'L');
  const addedIn = (list: CatalogCourse[]) => list.filter((c) => enrolledSet.has(c.code.toUpperCase())).length;

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

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/courses" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>Manage courses</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        {enrolledSet.size} course{enrolledSet.size === 1 ? '' : 's'} added. Pick a level, then a semester, then add what you take, including carryovers and courses from other levels.
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
        <nav aria-label="Where you are" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 14, fontSize: 13 }}>
          <button onClick={() => { setPickLevel(null); setPickSem(null); }} style={{ background: 'none', border: 'none', padding: 0, color: pickLevel ? 'var(--u-good)' : 'var(--text)', fontWeight: 800 }}>Levels</button>
          {pickLevel && <><ChevronRight size={14} color="var(--text3)" /><button onClick={() => setPickSem(null)} style={{ background: 'none', border: 'none', padding: 0, color: pickSem ? 'var(--u-good)' : 'var(--text)', fontWeight: 800 }}>{pickLevel}</button></>}
          {pickLevel && pickSem && <><ChevronRight size={14} color="var(--text3)" /><span style={{ fontWeight: 800 }}>{pickSem}</span></>}
        </nav>
      )}
      {results === null && !pickLevel && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {levels.map((l, i) => {
            const list = inLevel(l);
            const added = addedIn(list);
            return (
              <button key={l} className="rise" onClick={() => setPickLevel(l)} disabled={!list.length}
                style={{ animationDelay: `${i * 40}ms`, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${l === mine ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 12, textAlign: 'left', color: 'var(--text)', opacity: list.length ? 1 : 0.5 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: l === mine ? 'var(--u-good-tint)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{short(l)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>{l}{l === mine ? ' · your level' : ''}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{list.length} course{list.length === 1 ? '' : 's'}{added ? ` · ${added} added` : ''}</span>
                </span>
                <ChevronRight size={18} color="var(--text3)" />
              </button>
            );
          })}
        </div>
      )}
      {results === null && pickLevel && !pickSem && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SEMS.map((sem) => {
            const list = inSem(pickLevel, sem);
            const added = addedIn(list);
            return (
              <button key={sem} className="rise" onClick={() => setPickSem(sem)} disabled={!list.length}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${sem === activeSemester ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 12, textAlign: 'left', color: 'var(--text)', opacity: list.length ? 1 : 0.5 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>{sem}{sem === activeSemester ? ' · this semester' : ''}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{list.length} course{list.length === 1 ? '' : 's'}{added ? ` · ${added} added` : ''}</span>
                </span>
                <ChevronRight size={18} color="var(--text3)" />
              </button>
            );
          })}
        </div>
      )}
      {searching && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Searching…</div>}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(results !== null || (pickLevel && pickSem)) && shown.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <BoxBoy pose="peeking" width={62} />
            <div style={{ marginTop: 8 }}>{results !== null ? 'No courses match that search.' : 'No courses in this semester yet. Check back soon.'}</div>
          </div>
        )}
        {shown.map((c, i) => {
          const isIn = enrolledSet.has(c.code.toUpperCase());
          const isSearch = results !== null;
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
                </span>
              </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

