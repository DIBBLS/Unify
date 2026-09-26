import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, BookOpen, Megaphone, PartyPopper, CheckCheck } from 'lucide-react';
import BackButton from '../components/BackButton';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api, type NotificationItem } from '../lib/api';

function iconFor(type: string) {
  if (type === 'announce') return Megaphone;
  if (type === 'welcome') return PartyPopper;
  return BellRing;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function NotificationsRoute() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const load = async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) {
      navigate('/auth');
      return;
    }
    try {
      const res = await api.notifications(30);
      setNotes(res.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const openNote = async (n: NotificationItem) => {
    if (!n.read) {
      try {
        await api.notificationsMarkRead({ ids: [n.id] });
      } catch {
        // navigation still proceeds
      }
      setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    navigate(n.link || '/dashboard');
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await api.notificationsMarkRead({ all: true });
      setNotes((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark-all-read failed.');
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <Loading text="Loading notifications…" />;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/dashboard" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, flex: 1 }}>Notifications</h1>
        {notes.some((n) => !n.read) && (
          <button onClick={markAll} disabled={marking} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 14px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12, color: '#059669', opacity: marking ? 0.6 : 1 }}>
            <CheckCheck size={14} /> {marking ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <Mascot size={96} />
            <div style={{ marginTop: 8 }}>All caught up. New notes and updates land here.</div>
          </div>
        )}
        {notes.map((n) => {
          const Icon = iconFor(n.type);
          return (
            <button
              key={n.id}
              onClick={() => openNote(n)}
              style={{ padding: '14px 16px', background: n.read ? 'var(--surface)' : 'var(--green-bg)', border: `1px solid ${n.read ? 'var(--border)' : '#a7f3d0'}`, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', width: '100%', color: 'var(--text)' }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: n.read ? 'var(--surface2)' : '#10b981', color: n.read ? 'var(--text2)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {n.type === 'new_note' ? <BookOpen size={18} /> : <Icon size={18} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 800, display: 'block', fontSize: 14 }}>{n.title || 'Update'}</span>
                <span style={{ fontSize: 13, color: '#555', display: 'block', marginTop: 2 }}>{n.body}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>{timeAgo(n.created_at)}</span>
              </span>
              {!n.read && <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#10b981', flexShrink: 0, marginTop: 6 }} />}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Link to="/dashboard" style={{ fontSize: 13, color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
