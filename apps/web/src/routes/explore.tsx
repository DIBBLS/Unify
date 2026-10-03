import { useEffect, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';

type CatalogCourse = { code: string; title: string; weeks: number; levels: string[]; semesters: string[]; matchedAlias: string | null };

// Explore + enroll: browse your level's courses for the active semester
// and join them. Enrolled courses live under My Courses (/course).
export default function ExplorePage() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [myLevel, setMyLevel] = useState('');
  const [activeSemester, setActiveSemester] = useState('First Semester');
  const [enrolledSet, setEnrolledSet] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // BUG-006 search: code, title or alias ("ME 352" finds "MEE 352"),
  // spanning both semesters with badges so nothing hides.
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CatalogCourse[] | null>(null);

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
        setError(err instanceof Error ? err.message : 'Could not load courses.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced catalog search (min 2 chars, level-scoped when known).
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
        const res = await api.courseSearch(needle, myLevel || '');
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, myLevel]);

  if (loading) return <Loading text="Loading courses…" />;

  // Strict scoping: your level + the admin's active semester, nothing else.
  // Search mode spans both semesters (badged) so no course can hide.
  const shown = results !== null ? results : courses.filter(
    (c) => (!myLevel || c.levels.includes(myLevel)) && c.semesters.includes(activeSemester)
  );

  const toggleEnroll = async (code: string) => {
    const isIn = enrolledSet.has(code.toUpperCase());
    setBusy(code);
    setError('');
    try {
      const res = await api.enroll(code, !isIn);
      setEnrolledSet(new Set((res.enrolled || []).map((c) => c.toUpperCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/course" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>Explore courses</h1>
      <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13 }}>
        Find courses and enroll{myLevel ? ` · ${myLevel}` : ''}
      </p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
        {myLevel || 'Your level'} · {activeSemester}
      </div>
      <div style={{ position: 'relative', marginTop: 10 }}>
        <Search size={16} color="#999" style={{ position: 'absolute', left: 12, top: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code, title or alias…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>
      {searching && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Searching…</div>}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>{results !== null ? 'No courses match that search.' : 'No courses for this level yet. Check back soon.'}</div>
          </div>
        )}
        {shown.map((c, i) => {
          const isIn = enrolledSet.has(c.code.toUpperCase());
          const isSearch = results !== null;
          return (
            <div
              key={c.code}
              className="rise"
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
                <span style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} color="#059669" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{c.code}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.title} · {c.weeks} {c.weeks === 1 ? 'week' : 'weeks'}</span>
                  {isSearch && (
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, display: 'block' }}>
                      {(c.semesters || []).map((s) => s.replace(' Semester', '')).join(' · ')}{c.matchedAlias ? ` · also “${c.matchedAlias}”` : ''}
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
                  border: `1px solid ${isIn ? '#059669' : 'var(--border)'}`,
                  background: isIn ? '#10b981' : 'var(--surface)',
                  color: isIn ? '#fff' : '#059669',
                  fontWeight: 800,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  opacity: busy === c.code ? 0.6 : 1,
                }}
              >
                {busy === c.code ? '…' : isIn ? 'Enrolled ✓' : 'Enroll'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
