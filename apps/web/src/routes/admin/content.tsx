import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, Layers, Search, ShieldAlert } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { supabaseBrowser } from '../../lib/supabase';
import { api, type AdminContentCourse } from '../../lib/api';

// Admin-only: every course → weeks → topics/versions in one tree, with
// direct reader links. Admins are gate-exempt, so no enrollment needed.
export default function AdminContentRoute() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<AdminContentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        navigate('/auth');
        return;
      }
      try {
        const res = await api.adminContent();
        setCourses(res.courses);
      } catch (err) {
        if ((err as { status?: number })?.status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : 'Could not load content.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return courses;
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(needle) ||
        (c.title || '').toLowerCase().includes(needle)
    );
  }, [courses, q]);

  if (loading) return <Loading text="Loading all content…" />;
  if (forbidden)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
        <BackButton to="/dashboard" />
        <ErrorState
          title="Admin only"
          message="This page is for platform admins."
        />
      </div>
    );

  const totalWeeks = courses.reduce((n, c) => n + c.weekCount, 0);
  const totalTopics = courses.reduce((n, c) => n + c.topicCount, 0);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Layers size={22} color="#059669" /> All content
      </h1>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
        {courses.length} courses · {totalWeeks} weeks · {totalTopics} topics with notes
      </div>
      {error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 13, color: '#991b1b' }}>
          {error}
        </div>
      )}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <Search size={16} color="#999" style={{ position: 'absolute', left: 12, top: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code or title…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((c) => {
          const isOpen = open === c.code;
          return (
            <div key={c.code} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : c.code)}
                style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text)' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{c.code}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.title || 'Untitled course'}{c.level ? ` · ${c.level}` : ''}{c.semester ? ` · ${c.semester.replace(' Semester', '')}` : ''}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {c.weekCount}w · {c.topicCount}t
                </span>
                {isOpen ? <ChevronDown size={16} color="#999" /> : <ChevronRight size={16} color="#999" />}
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '4px 14px 12px' }}>
                  <Link
                    to={`/course/${encodeURIComponent(c.code)}?preview=1`}
                    style={{ display: 'inline-block', fontSize: 12, color: '#059669', fontWeight: 800, textDecoration: 'none', margin: '6px 0' }}
                  >
                    Open course page →
                  </Link>
                  {c.weeks.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0' }}>No weeks yet.</div>
                  )}
                  {c.weeks.map((w) => (
                    <div key={w.week} style={{ marginTop: 8 }}>
                      <Link
                        to={`/learn/${encodeURIComponent(c.code)}/week/${w.week}?preview=1`}
                        style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textDecoration: 'none' }}
                      >
                        Week {w.week} · {w.title || 'Untitled'}
                      </Link>
                      {w.topics.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Shell only — no topics published.</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {w.topics.map((t) => (
                            <Link
                              key={t.topic}
                              to={`/learn/${encodeURIComponent(c.code)}/week/${w.week}?preview=1&t=${t.topic}`}
                              style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9999, padding: '4px 10px', textDecoration: 'none' }}
                              title={t.title || `Topic ${t.topic}`}
                            >
                              <BookOpen size={12} /> T{t.topic} · v{t.versions}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            {q ? 'No courses match that search.' : 'No courses yet.'}
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 12, color: '#92400e', display: 'flex', gap: 8 }}>
        <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Reading as admin never writes progress or XP and never moves your Resume bookmark.</span>
      </div>
    </div>
  );
}
