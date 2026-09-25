import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, LibraryBig, Info } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import { supabaseBrowser } from '../lib/supabase';
import { api, type AdminContentCourse } from '../lib/api';

// Authors: the content tree scoped to the level they contribute to
// (profile.level, picked at onboarding). Read-only previews throughout.
export default function BrowseRoute() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<AdminContentCourse[]>([]);
  const [level, setLevel] = useState('');
  const [role, setRole] = useState('');
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
        const me = await api.me().catch(() => null);
        setLevel(me?.profile?.level || '');
        setRole(me?.profile?.role || '');
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

  const isAuthor = role === 'lecturer' || role === 'collaborator';
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (isAuthor && level && c.level !== level) return false;
      if (!needle) return true;
      return c.code.toLowerCase().includes(needle) || (c.title || '').toLowerCase().includes(needle);
    });
  }, [courses, q, isAuthor, level]);

  if (loading) return <Loading text="Loading notes…" />;
  if (forbidden)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
        <BackButton to="/dashboard" />
        <ErrorState title="Authors only" message="This browser is for lecturers and collaborators." />
      </div>
    );

  const totalWeeks = scoped.reduce((n, c) => n + c.weekCount, 0);
  const totalTopics = scoped.reduce((n, c) => n + c.topicCount, 0);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <LibraryBig size={22} color="#059669" /> Browse notes
      </h1>
      <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
        {isAuthor && level ? `${level} · ` : ''}{scoped.length} courses · {totalWeeks} weeks · {totalTopics} topics with notes
      </div>
      {isAuthor && !level && (
        <div style={{ marginTop: 12, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 12, color: '#92400e', display: 'flex', gap: 8 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>No contributing level set — showing everything. Set it in Profile so this narrows to your level.</span>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 13, color: '#991b1b' }}>
          {error}
        </div>
      )}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code or title…"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 14 }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scoped.map((c) => {
          const isOpen = open === c.code;
          return (
            <div key={c.code} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : c.code)}
                style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', textAlign: 'left', color: '#3c3c3c' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{c.code}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <div style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>No weeks yet.</div>
                  )}
                  {c.weeks.map((w) => (
                    <div key={w.week} style={{ marginTop: 8 }}>
                      <Link
                        to={`/learn/${encodeURIComponent(c.code)}/week/${w.week}?preview=1`}
                        style={{ fontSize: 13, fontWeight: 800, color: '#3c3c3c', textDecoration: 'none' }}
                      >
                        Week {w.week} · {w.title || 'Untitled'}
                      </Link>
                      {w.topics.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#999' }}>Shell only — no topics published.</div>
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
        {scoped.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#777', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            {q ? 'No courses match that search.' : 'No notes at your level yet.'}
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, padding: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, fontSize: 12, color: '#065f46' }}>
        Previews are read-only — nothing is recorded. To edit, open the week and tap Edit in Studio.
      </div>
    </div>
  );
}
