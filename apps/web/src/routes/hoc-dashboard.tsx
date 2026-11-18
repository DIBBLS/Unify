import { SectionSkeleton } from '../components/Skeletons';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import { api, type HocPost } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { askConfirm } from '../lib/dialog';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import ClassMembers from '../components/ClassMembers';
import LecturerChecks from '../components/LecturerChecks';
import LiveWire from '../components/LiveWire';
import ErrorState from '../components/ErrorState';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// Class board (Review 3, C3/C4) for a department + level.
// - Everyone: the live wire on top, then announcements, polls and answered
//   questions, filtered All / Announcements / Questions / Polls.
// - Students: vote in polls, add "same question", and ask the class rep a
//   question from the bar at the bottom (the class rep sees their name;
//   classmates see it once it's answered).
// - Class rep: post an Announcement, a Poll or a Live wire (emergencies
//   only), and answer the questions waiting (or turn one into a poll).
type Filter = 'all' | 'announcement' | 'question' | 'poll';
type Compose = 'announcement' | 'poll' | 'livewire';
const FILTERS: [Filter, string][] = [['all', 'All'], ['announcement', 'Announcements'], ['question', 'Questions'], ['poll', 'Polls']];
const CLOSES: [number, string][] = [[0, 'No end'], [6, '6 hours'], [24, '1 day'], [72, '3 days']];
const field: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit',
};
const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `Today, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function HocDashboardRoute() {
  const [posts, setPosts] = useState<HocPost[] | null>(null);
  const [isHoc, setIsHoc] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meta, setMeta] = useState('');
  const [audience, setAudience] = useState<{ students: number; fromList: boolean } | null>(null);
  const formRef = useRef<HTMLTextAreaElement>(null);
  const [params] = useSearchParams();
  const location = useLocation();
  const initialFilter = params.get('filter');
  const [filter, setFilter] = useState<Filter>(FILTERS.some(([k]) => k === initialFilter) ? (initialFilter as Filter) : 'all');
  // Review 3 (C8): class size and how many have joined (class rep only).
  const [size, setSize] = useState<{ listed: number; joined: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Compose>('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [closes, setCloses] = useState(24);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState('');

  const load = async () => {
    setFailed(false);
    try {
      const [r, me] = await Promise.all([api.hocPosts(), api.me()]);
      setPosts(r.posts);
      setIsHoc(r.isHoc);
      setIsAdmin(!!me.isAdmin);
      setMeta([r.level, r.department].filter(Boolean).join(' '));
      setAudience(r.audience || null);
      if (r.isHoc) api.classList().then((d) => {
        const live = d.entries.filter((e) => !e.removed);
        setSize(d.list ? { listed: live.length, joined: live.filter((e) => e.claimed).length } : null);
      }).catch(() => {});
    } catch (e) {
      errorToast(e, 'load the class board');
      setFailed(true);
    }
  };
  useEffect(() => { void load(); }, []);
  // Home's tools row: "Post" opens here with #post and goes straight to the box.
  useEffect(() => {
    if (location.hash !== '#post' || posts === null) return;
    formRef.current?.focus();
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.hash, posts]);

  const canPost = isHoc || isAdmin;
  const post = async () => {
    if (!content.trim()) return;
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (mode === 'poll' && opts.length < 2) { errorToast(new Error('A poll needs at least 2 options.'), 'post that poll'); return; }
    setBusy(true);
    try {
      await api.hocPost(mode === 'poll'
        ? { type: 'poll', content: content.trim(), options: opts, closesAt: closes ? new Date(Date.now() + closes * 3600000).toISOString() : undefined }
        : { type: 'announcement', title: title.trim() || undefined, content: content.trim() });
      setTitle(''); setContent(''); setOptions(['', '']);
      toastSuccess(mode === 'poll' ? 'Poll posted. Your class can vote now.' : 'Posted to your class.');
      await load();
    } catch (e) { errorToast(e, 'post that'); }
    finally { setBusy(false); }
  };
  const remove = async (p: HocPost) => {
    if (!(await askConfirm({ title: p.type === 'question' ? 'Delete this question?' : 'Delete this post?', body: 'It goes for everyone in the class.', confirmLabel: 'Delete' }))) return;
    try { await api.hocDelete(p.id); setPosts((ps) => (ps || []).filter((x) => x.id !== p.id)); }
    catch (e) { errorToast(e, 'delete that post'); }
  };
  const sendQuestion = async () => {
    if (ask.trim().length < 5) return;
    setBusy(true);
    try {
      await api.hocAsk(ask.trim());
      setAsk('');
      toastSuccess('Sent to your class rep. Classmates see it once it’s answered.');
      await load();
    } catch (e) { errorToast(e, 'send your question'); }
    finally { setBusy(false); }
  };
  const turnIntoPoll = (q: HocPost) => {
    setMode('poll');
    setContent(q.content);
    setOptions(['', '']);
    window.setTimeout(() => { formRef.current?.focus(); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 140px' } as const;
  if (failed) return <div style={shell}><ErrorState message="We couldn't load the class board." onRetry={() => void load()} /></div>;

  const waiting = (posts || []).filter((p) => p.type === 'question' && p.question && !p.question.answer);
  const feed = (posts || []).filter((p) => !(p.type === 'question' && p.question && !p.question.answer && canPost)).filter((p) =>
    filter === 'all' || p.type === filter || (filter === 'announcement' && p.type === 'tip'));

  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Display size={30}>Class</Display>
          <div className="t-13 muted" style={{ marginTop: 2 }}>{meta || 'Your class'}</div>
        </div>
        <BoxBoy pose="teaching" width={64} />
      </div>

      {/* C3: the live wire sits at the top of the board. */}
      <LiveWire allowSend={false} countdown={false} style={{ margin: '14px 0 0' }} />

      {/* My pass lives with attendance (course page, My record), not here. */}
      {isHoc && size && (
        <Card style={{ marginTop: 16, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="t-15 w-7" style={{ flex: 1 }}>Your class</span>
            <span className="t-13 muted">{size.joined} of {size.listed} joined</span>
          </div>
          <div style={{ height: 8, borderRadius: 9999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${size.listed ? Math.round((size.joined / size.listed) * 100) : 0}%`, height: '100%', background: 'var(--u-green)' }} />
          </div>
          <div className="t-13 muted">{size.listed} student{size.listed === 1 ? '' : 's'} on your class list · {size.listed - size.joined} still to join Unify Learn{isHoc ? ` · ${waiting.length} question${waiting.length === 1 ? '' : 's'} waiting` : ''}</div>
        </Card>
      )}
      {canPost && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link to={ROUTES.classList} className="btn btn--white" style={{ flex: 1 }}>Class list</Link>
          {isHoc && <Link to={ROUTES.hocRules} className="btn btn--white" style={{ flex: 1 }}>Class rules</Link>}
        </div>
      )}
      {isHoc && audience && !audience.fromList && (
        <Link to={ROUTES.hocWelcome} className="card" style={{ marginTop: 12, display: 'block', textDecoration: 'none', color: 'var(--text)', padding: 14 }}>
          <div className="t-15 w-7">Finish setting up your class</div>
          <div className="t-13 muted">Upload your class list first: classmates can't confirm their place until it's in.</div>
        </Link>
      )}

      {/* C4: the class rep posts an Announcement, a Poll or a Live wire. */}
      {canPost && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Label>New post</Label>
          {meta && (
            <div className="t-13" style={{ marginTop: -4 }}>
              Posting to <b>{meta}</b>{audience ? ` · ${audience.students} student${audience.students === 1 ? '' : 's'}` : ''}
              {audience && !audience.fromList && <span className="muted"> on Unify Learn (upload your class list for the full count)</span>}
            </div>
          )}
          <div role="tablist" aria-label="What to post" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([['announcement', 'Announcement'], ['poll', 'Poll'], ['livewire', 'Live wire']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mode === k} className={`chip chip--sm${mode === k ? ' chip--on' : ''}`} onClick={() => setMode(k)}>{l}</button>
            ))}
          </div>
          {mode === 'livewire' ? (
            // Emergency-only warning and the send form (components/LiveWire).
            <LiveWire allowSend countdown={false} style={{ margin: 0 }} />
          ) : (
            <>
              {mode === 'announcement' && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} style={field} />}
              <textarea ref={formRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder={mode === 'poll' ? 'Ask your class… e.g. Should we ask to move Friday’s class to 2 PM?' : 'What does your class need to know?'} maxLength={1000} rows={mode === 'poll' ? 2 : 4} style={{ ...field, resize: 'vertical' }} />
              {mode === 'poll' && (
                <>
                  {options.map((o, i) => (
                    <input key={i} value={o} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value.slice(0, 80) : x)))} placeholder={`Option ${i + 1}`} style={field} />
                  ))}
                  {options.length < 4 && <button className="btn btn--white btn--sm" onClick={() => setOptions((os) => [...os, ''])}>Add an option</button>}
                  <div className="t-13 w-7">Voting closes</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CLOSES.map(([h, l]) => <button key={h} className={`chip chip--sm${closes === h ? ' chip--on' : ''}`} onClick={() => setCloses(h)}>{l}</button>)}
                  </div>
                </>
              )}
              <button className="btn btn--amber btn--block" disabled={busy || !content.trim()} onClick={() => void post()}>{busy ? 'Posting…' : mode === 'poll' ? 'Post poll' : 'Post'}</button>
            </>
          )}
        </Card>
      )}

      {/* C4/C8: questions waiting for the class rep. */}
      {canPost && waiting.length > 0 && (
        <section style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="t-12 w-7 muted" style={{ letterSpacing: 1 }}>QUESTIONS WAITING · {waiting.length}</div>
          {waiting.map((q) => <WaitingQuestion key={q.id} q={q} onDone={() => void load()} onPoll={() => turnIntoPoll(q)} onDelete={() => void remove(q)} />)}
        </section>
      )}

      {/* Class rep: confirm lecturers who added one of the class's courses (S62). */}
      {isHoc && <LecturerChecks />}
      {meta && <ClassMembers />}

      <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts && posts.length > 0 && (
          <div role="tablist" aria-label="Filter posts" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={`chip chip--sm${filter === k ? ' chip--on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        )}
        {posts === null ? (
          <SectionSkeleton rows={2} />
        ) : feed.length === 0 ? (
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <BoxBoy pose="chairRelax" width={110} />
            <div className="t-15 w-6">{filter !== 'all' ? `No ${FILTERS.find(([k]) => k === filter)?.[1].toLowerCase()} yet` : canPost ? 'Post your first announcement to your class' : 'Nothing posted yet'}</div>
            <div className="t-13 muted">
              {canPost ? 'Class times, test dates, where to find the notes: your class sees it straight away.' : meta ? 'Posts from your class rep and answered questions appear here.' : 'Set your department and level in Me to see your class board.'}
            </div>
          </Card>
        ) : (
          feed.map((p) => <PostCard key={p.id} p={p} canDelete={p.mine || canPost} onDelete={() => void remove(p)} onChange={() => void load()} />)
        )}
      </section>

      {/* C3: students ask their class rep from a bar at the bottom. */}
      {!canPost && meta && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'var(--tabbar-h, 64px)', zIndex: 20, padding: '10px 16px 8px', background: 'linear-gradient(to bottom, transparent, var(--u-page, var(--bg)) 30%)' }}>
          <div style={{ maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 9999, border: '1.5px solid var(--u-black)', background: 'var(--surface)' }}>
              <input value={ask} onChange={(e) => setAsk(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === 'Enter') void sendQuestion(); }} placeholder="Ask your class rep a question…" aria-label="Ask your class rep a question" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15 }} />
              <button onClick={() => void sendQuestion()} disabled={busy || ask.trim().length < 5} aria-label="Send question" style={{ width: 40, height: 40, borderRadius: 9999, border: 'none', background: 'var(--u-amber)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ask.trim().length < 5 ? 0.5 : 1 }}><ArrowRight size={20} /></button>
            </div>
            <div className="t-12 muted" style={{ marginTop: 4, textAlign: 'center' }}>Your class rep sees your name. Classmates see the question once it's answered.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostHead({ p, canDelete, onDelete }: { p: HocPost; canDelete: boolean; onDelete: () => void }) {
  const tag = p.type === 'poll' ? <Pill tone="dark">Poll</Pill> : p.type === 'question' ? <Pill tone="amber">Question</Pill> : p.type === 'tip' ? <Pill tone="good">Tip</Pill> : <Pill tone="good">Announcement</Pill>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {tag}
      <span className="t-13 w-7" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author}{p.byRep ? ' · class rep' : ''}</span>
      <span className="t-12 muted">{p.type === 'poll' && p.poll?.closesAt ? (p.poll.closed ? 'Closed' : `Closes ${when(p.poll.closesAt)}`) : when(p.createdAt)}</span>
      {canDelete && <button aria-label="Delete" onClick={onDelete} style={{ color: 'var(--text3)', display: 'flex', padding: 4 }}><Trash2 size={15} /></button>}
    </div>
  );
}

function PostCard({ p, canDelete, onDelete, onChange }: { p: HocPost; canDelete: boolean; onDelete: () => void; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, what: string) => {
    setBusy(true);
    try { await fn(); onChange(); } catch (e) { errorToast(e, what); } finally { setBusy(false); }
  };
  if (p.type === 'poll' && p.poll) {
    const poll = p.poll;
    const voted = poll.myVote != null;
    return (
      <Card style={{ gap: 8 }}>
        <PostHead p={p} canDelete={canDelete} onDelete={onDelete} />
        <div className="t-15 w-7" style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
        {poll.options.map((o, i) => {
          const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
          const mine = poll.myVote === i;
          const show = voted || poll.closed;
          return (
            <button key={i} disabled={busy || poll.closed} onClick={() => void act(() => api.hocVote(p.id, i), 'vote')} aria-pressed={mine}
              style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, textAlign: 'left', color: 'var(--text)', background: 'var(--surface2)', border: `1.5px solid ${mine ? 'var(--u-black)' : 'var(--border)'}` }}>
              {show && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mine ? 'var(--u-good-tint)' : 'var(--border)', opacity: mine ? 1 : 0.5 }} />}
              <span style={{ position: 'relative', flex: 1, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{mine && <Check size={15} />}{o}</span>
              {show && <span style={{ position: 'relative', fontWeight: 800, fontSize: 14 }}>{pct}%</span>}
            </button>
          );
        })}
        <div className="t-12 muted">{poll.total} voted{voted ? ' · you voted (tap another option to change)' : poll.closed ? '' : ' · tap an option to vote'}</div>
      </Card>
    );
  }
  if (p.type === 'question' && p.question) {
    const q = p.question;
    return (
      <Card style={{ gap: 8 }}>
        <PostHead p={p} canDelete={canDelete} onDelete={onDelete} />
        <div className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
        {q.answer ? (
          <div style={{ padding: 12, borderRadius: 12, background: 'var(--u-good-tint)' }}>
            <div className="t-12 w-7" style={{ color: 'var(--u-good)' }}>{q.answeredBy || 'Class rep'} · class rep answered</div>
            <div className="t-15" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{q.answer}</div>
          </div>
        ) : (
          <div className="t-13 muted">Waiting for your class rep. Only you and your class rep see it for now.</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-12 muted" style={{ flex: 1 }}>{q.same ? `${q.same} classmate${q.same === 1 ? '' : 's'} had the same question` : ''}</span>
          {/* Classmates (not the asker) can add "same question" to an answered one. */}
          {!p.mine && q.answer && (
            <button className={`chip chip--sm${q.iSame ? ' chip--on' : ''}`} disabled={busy} onClick={() => void act(() => api.hocSame(p.id), 'save that')}>{q.iSame ? 'Same question ✓' : 'Same question'}</button>
          )}
        </div>
      </Card>
    );
  }
  return (
    <Card style={{ gap: 6 }}>
      <PostHead p={p} canDelete={canDelete} onDelete={onDelete} />
      {p.title && <div className="t-15 w-7">{p.title}</div>}
      <div className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
      {p.byRep && <div className="t-12 muted">From your class rep</div>}
    </Card>
  );
}

// Class rep: one waiting question, answered inline or turned into a poll.
function WaitingQuestion({ q, onDone, onPoll, onDelete }: { q: HocPost; onDone: () => void; onPoll: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await api.boardAnswer(q.id, text.trim()); toastSuccess('Answered. Your class can see it now.'); onDone(); }
    catch (e) { errorToast(e, 'send that answer'); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="t-13 w-7" style={{ flex: 1 }}>{q.author}</span>
        <span className="t-12 muted">{when(q.createdAt)}{q.question?.same ? ` · ${q.question.same} asked the same` : ''}</span>
        <button aria-label="Delete question" onClick={onDelete} style={{ color: 'var(--text3)', display: 'flex', padding: 4 }}><Trash2 size={15} /></button>
      </div>
      <div className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{q.content}</div>
      {open ? (
        <>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} placeholder="Your answer. The whole class sees it." style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--amber btn--sm" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send answer'}</button>
            <button className="btn btn--white btn--sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--amber btn--sm" onClick={() => setOpen(true)}>Answer</button>
          <button className="btn btn--white btn--sm" onClick={onPoll}>Turn into a poll</button>
        </div>
      )}
    </Card>
  );
}
