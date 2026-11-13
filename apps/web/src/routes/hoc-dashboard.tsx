import { SectionSkeleton } from '../components/Skeletons';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api, type HocPost } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import ClassMembers from '../components/ClassMembers';
import ErrorState from '../components/ErrorState';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// Class board: posts from your Head of Class for your department + level.
// The HOC (and admins) can post and delete their own; everyone else reads.
// Everyone in the class also sees who else is in it (Class members).
const TYPES: { key: HocPost['type']; label: string }[] = [
  { key: 'announcement', label: 'Announcement' },
  { key: 'tip', label: 'Tip' },
  { key: 'question', label: 'Question' },
];
const TONE = { announcement: 'amber', tip: 'good', question: 'grey' } as const;

const field: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 15,
};

export default function HocDashboardRoute() {
  const [posts, setPosts] = useState<HocPost[] | null>(null);
  const [isHoc, setIsHoc] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meta, setMeta] = useState('');
  const [audience, setAudience] = useState<{ students: number; fromList: boolean } | null>(null);
  const formRef = useRef<HTMLTextAreaElement>(null);
  const [filter, setFilter] = useState<'all' | HocPost['type']>('all');
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<HocPost['type']>('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setFailed(false);
    try {
      const [r, me] = await Promise.all([api.hocPosts(), api.me()]);
      setPosts(r.posts);
      setIsHoc(r.isHoc);
      setIsAdmin(!!me.isAdmin);
      setMeta([r.department, r.level].filter(Boolean).join(' · '));
      setAudience(r.audience || null);
    } catch (e) {
      errorToast(e, 'load the class board');
      setFailed(true);
    }
  };
  useEffect(() => { void load(); }, []);

  const post = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await api.hocPost({ type, title: title.trim() || undefined, content: content.trim() });
      setTitle(''); setContent('');
      toastSuccess('Posted to your class.');
      await load();
    } catch (e) { errorToast(e, 'post that'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await api.hocDelete(id); setPosts((p) => (p || []).filter((x) => x.id !== id)); }
    catch (e) { errorToast(e, 'delete that post'); }
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (failed) return <div style={shell}><ErrorState message="We couldn't load the class board." onRetry={() => void load()} /></div>;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BoxBoy pose="teaching" width={64} />
        <div>
          <Label>{meta || 'Your class'}</Label>
          <Display size={28}>Class board</Display>
        </div>
      </div>

      {/* My pass lives with attendance (course page, My record), not here. */}
      {(isHoc || isAdmin) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to={ROUTES.classList} className="btn btn--white" style={{ flex: 1 }}>Class list</Link>
        </div>
      )}
      {isHoc && audience && !audience.fromList && (
        <Link to={ROUTES.hocWelcome} className="card" style={{ marginTop: 12, display: 'block', textDecoration: 'none', color: 'var(--text)', padding: 14 }}>
          <div className="t-15 w-7">Finish setting up your class</div>
          <div className="t-13 muted">Upload your class list first: classmates can't confirm their place until it's in.</div>
        </Link>
      )}
      {(isHoc || isAdmin) && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Label>Post to your class</Label>
          {meta && (
            <div className="t-13" style={{ marginTop: -4 }}>
              Posting to <b>{meta}</b>{audience ? ` · ${audience.students} student${audience.students === 1 ? '' : 's'}` : ''}
              {audience && !audience.fromList && <span className="muted"> on Unify (upload your class list for the full count)</span>}
              <span className="muted">. Only your class gets it.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TYPES.map((t) => (
              <button key={t.key} className={`chip chip--sm${t.key === type ? ' chip--on' : ''}`} onClick={() => setType(t.key)}>{t.label}</button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} style={field} />
          <textarea ref={formRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What does your class need to know?" maxLength={1000} rows={4} style={{ ...field, resize: 'vertical' }} />
          <button className="btn btn--amber btn--block" disabled={busy || !content.trim()} onClick={() => void post()}>{busy ? 'Posting…' : 'Post'}</button>
        </Card>
      )}

      {meta && <ClassMembers />}

      <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* S42: filter the feed (announcement-only design: All / Announcements / Tips / Questions). */}
        {posts && posts.length > 0 && (
          <div role="tablist" aria-label="Filter posts" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['all', 'All'], ['announcement', 'Announcements'], ['tip', 'Tips'], ['question', 'Questions']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={`chip chip--sm${filter === k ? ' chip--on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        )}
        {posts && posts.length > 0 && filter !== 'all' && !posts.some((p) => p.type === filter) && (
          <Card><div className="t-13 muted">No {filter === 'tip' ? 'tips' : filter === 'question' ? 'questions' : 'announcements'} yet.</div></Card>
        )}
        {posts === null ? (
          <SectionSkeleton rows={2} />
        ) : posts.length === 0 ? (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="chairRelax" width={110} />
            <div className="t-15 w-6">{isHoc ? 'Post your first announcement to your class' : 'Nothing posted yet'}</div>
            <div className="t-13 muted">
              {isHoc ? 'Class times, test dates, where to find the notes: your class sees it straight away.' : meta ? 'Posts from your class rep appear here.' : 'Set your department and level in Me to see your class board.'}
            </div>
            {isHoc && <button className="btn btn--amber btn--sm" onClick={() => { formRef.current?.focus(); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>New post</button>}
          </Card>
        ) : (
          posts.filter((p) => filter === 'all' || p.type === filter).map((p) => (
            <Card key={p.id} style={{ gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill tone={TONE[p.type]}>{p.type}</Pill>
                  <span className="t-13 muted">{p.author} · {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                </div>
                {(p.mine || isAdmin) && (
                  <button aria-label="Delete post" onClick={() => void remove(p.id)} style={{ color: 'var(--text3)', display: 'flex', padding: 4 }}><Trash2 size={16} /></button>
                )}
              </div>
              {p.title && <div className="t-15 w-6">{p.title}</div>}
              <div className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
            </Card>
          ))
        )}
      </section>

    </div>
  );
}
