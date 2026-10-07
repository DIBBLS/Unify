import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Clock, Eye, ArrowRight, Zap } from 'lucide-react';
import BackButton from '../components/BackButton';
import Wordmark from '../components/Wordmark';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import Mascot from '../components/Mascot';
import { TopicSlice } from '../components/TopicSlice';
import EoqQuiz from '../components/EoqQuiz';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';
import type { Topic, UnifyNote } from '../types/note';

type ShareData = {
  course: string;
  week: number;
  title: string;
  subtitle: string;
  note_json: unknown;
  share: { token: string; expires_at: string; views: number };
};

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m left`;
  if (h < 48) return `${h}h left`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} left`;
}

// Public share landing (/s/:token): a designed preview card plus the full
// week read-only. No account needed until expiry; completing/XP stays
// signed-in only — the expiry is what pulls readers back to join.
export default function ShareRoute() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(0);
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb?.auth
      .getSession()
      .then(({ data: s }) => setAuthed(!!s.session))
      .catch(() => {});
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.shareGet(token);
        setData(res);
      } catch (err) {
        setStatus((err as { status?: number })?.status || 0);
        setError(err instanceof Error ? err.message : 'Could not open this link.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <Loading text="Opening shared note…" />;
  if (!data) {
    if (status === 410) {
      return (
        <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px', textAlign: 'center' }}>
          <BackButton to="/auth" />
          <Mascot size={120} />
          <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24, marginTop: 12 }}>This link expired</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>
            Shared notes only live for a while — that is what makes them special. Join free and the whole library stays open.
          </p>
          <Link to="/auth" style={{ display: 'inline-block', padding: '12px 28px', background: '#10b981', color: '#fff', borderRadius: 9999, textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
            Join Unify free <ArrowRight size={16} style={{ verticalAlign: -3 }} />
          </Link>
        </div>
      );
    }
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
        <BackButton to="/auth" />
        <ErrorState title="Link not found" message={error || 'This share link is invalid or was revoked.'} />
      </div>
    );
  }

  const note = data.note_json as UnifyNote;
  const topics: Topic[] = note && Array.isArray(note.topics) ? note.topics : [];
  const quizCount = note?.eoq?.questions?.length || 0;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to={authed ? '/dashboard' : '/auth'} />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }}>
        <Wordmark size={18} />
      </div>
      {/* Preview card */}
      <div className="hero">
        <div className="hero-eyebrow">Shared note · {data.course}</div>
        <div className="hero-title">
          Week {data.week}: {data.title}
        </div>
        {data.subtitle ? <div className="hero-subtitle">{data.subtitle}</div> : null}
        <div className="hero-meta">
          <span className="meta-chip">
            <BookOpen size={11} style={{ verticalAlign: -1 }} /> {topics.length} topics
          </span>
          {quizCount > 0 && <span className="meta-chip">{quizCount} quiz questions</span>}
          <span className="meta-chip">
            <Zap size={11} style={{ verticalAlign: -1 }} /> +{topics.length * 10} XP inside
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 800, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9999, padding: '6px 14px' }}>
          <Clock size={13} /> Free for {countdown(data.share.expires_at)}
        </span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '6px 14px' }}>
          <Eye size={13} /> {data.share.views} {data.share.views === 1 ? 'view' : 'views'}
        </span>
      </div>

      {(() => {
        const lectures = [...new Set(topics.map((t) => t.lecture || 1))].sort((a, b) => a - b);
        const showHeads = lectures.length > 1;
        return lectures.map((lec) => (
          <div key={lec} style={{ marginBottom: showHeads ? 16 : 8 }}>
            {showHeads && (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                Lecture {lec}
              </div>
            )}
            {topics
              .filter((t) => (t.lecture || 1) === lec)
              .map((t) => (
                <div key={`${lec}-${t.number}`} style={{ marginBottom: 8 }}>
                  <TopicSlice topic={t} />
                </div>
              ))}
          </div>
        ));
      })()}
      {topics.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          No topics in this week yet.
        </div>
      )}
      {quizCount > 0 && (
        <EoqQuiz eoq={note.eoq} course={data.course} week={data.week} preview />
      )}

      {/* Join CTA */}
      <div style={{ marginTop: 20, background: '#111827', borderRadius: 16, padding: 20, textAlign: 'center', color: '#fff' }}>
        <Mascot size={84} />
        <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>
          {authed ? 'Want the full journey?' : 'Like studying like this?'}
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 14px' }}>
          {authed
            ? 'Open it in your app to earn XP, keep streaks and resume anywhere.'
            : 'Join free to keep every week, earn XP and never lose a link to expiry.'}
        </div>
        {authed ? (
          <button
            onClick={() => navigate(`/learn/${encodeURIComponent(data.course)}/week/${data.week}`)}
            style={{ padding: '12px 28px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', fontWeight: 800, fontSize: 14 }}
          >
            Open in my app
          </button>
        ) : (
          <Link to="/auth" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 9999, background: '#10b981', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, borderBottom: '4px solid #059669' }}>
            Join Unify free
          </Link>
        )}
      </div>
    </div>
  );
}
