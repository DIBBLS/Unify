import LoadingQuote from '../components/LoadingQuote';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api, type HocPost } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import ErrorState from '../components/ErrorState';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// Class board: posts from your Head of Class for your department + level.
// The HOC (and admins) can post and delete their own; everyone else reads.
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

      {isHoc && (
        <Link to={ROUTES.scanner} className="btn btn--amber btn--block" style={{ marginTop: 16 }}>Take attendance (show QR)</Link>
      )}
      {(isHoc || isAdmin) && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Label>Post to your class</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TYPES.map((t) => (
              <button key={t.key} className={`chip chip--sm${t.key === type ? ' chip--on' : ''}`} onClick={() => setType(t.key)}>{t.label}</button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} style={field} />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What does your class need to know?" maxLength={1000} rows={4} style={{ ...field, resize: 'vertical' }} />
          <button className="btn btn--amber btn--block" disabled={busy || !content.trim()} onClick={() => void post()}>{busy ? 'Posting…' : 'Post'}</button>
        </Card>
      )}

      <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts === null ? (
          <><div className="skel" style={{ height: 110, borderRadius: 24 }} /><LoadingQuote style={{ margin: '24px auto 0' }} /></>
        ) : posts.length === 0 ? (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="chairRelax" width={110} />
            <div className="t-15 w-6">Nothing posted yet</div>
            <div className="t-13 muted">
              {meta ? 'Posts from your Head of Class appear here.' : 'Set your department and level in Me to see your class board.'}
            </div>
            {!isHoc && meta && <Link to={ROUTES.hocRequest} className="btn btn--white btn--sm">Become your class HOC</Link>}
          </Card>
        ) : (
          posts.map((p) => (
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
