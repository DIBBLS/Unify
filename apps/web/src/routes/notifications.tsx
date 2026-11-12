import { ListSkeleton } from '../components/Skeletons';
import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, BookOpen, Megaphone, PartyPopper, ShieldCheck, CheckCheck, Video, Trash2 } from 'lucide-react';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import { BoxBoy } from '../components/redesign/brand';
import { supabaseBrowser } from '../lib/supabase';
import { api, NOTIFS_CHANGED, type NotificationItem } from '../lib/api';
import { describeError } from '../lib/errors';

function iconFor(type: string) {
  if (type === 'announce') return Megaphone;
  if (type === 'welcome') return PartyPopper;
  if (type === 'role') return ShieldCheck;
  if (type === 'online_class') return Video;
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
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  // The bell lives in the layout: tell it the count changed.
  const announceChange = () => window.dispatchEvent(new Event(NOTIFS_CHANGED));

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
      setError(describeError(err, 'load notifications'));
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
    navigate(n.link || '/home');
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await api.notificationsMarkRead({ all: true });
      setNotes((prev) => prev.map((x) => ({ ...x, read: true })));
      announceChange();
    } catch (err) {
      setError(describeError(err, 'mark everything as read'));
    } finally {
      setMarking(false);
    }
  };

  const removeNote = async (id: string) => {
    setDeleting(id);
    try {
      await api.notificationDelete(id);
      setNotes((prev) => prev.filter((x) => x.id !== id));
      announceChange();
    } catch (err) {
      setError(describeError(err, 'delete that notification'));
    } finally {
      setDeleting(null);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await api.notificationsClear();
      setNotes((prev) => prev.filter((x) => x.pinned));
      announceChange();
    } catch (err) {
      setError(describeError(err, 'clear your notifications'));
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  if (loading) return <ListSkeleton rows={5} titleWidth="50%" />;

  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to="/home" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, flex: 1 }}>Notifications</h1>
        {notes.length > 0 && (
          <button onClick={() => setConfirmClear(true)} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 14px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12, color: 'var(--text2)' }}>
            <Trash2 size={14} /> Clear all
          </button>
        )}
        {notes.some((n) => !n.read) && (
          <button onClick={markAll} disabled={marking} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 14px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12, color: 'var(--u-good)', opacity: marking ? 0.6 : 1 }}>
            <CheckCheck size={14} /> {marking ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <BoxBoy pose="phoneOut" width={96} />
            <div style={{ marginTop: 8 }}>You're all caught up. New notes, class changes and messages from your class rep will land here.</div>
          </div>
        )}
        {notes.map((n) => {
          const Icon = iconFor(n.type);
          return (
            <div
              key={n.id}
              style={{ background: n.read ? 'var(--surface)' : 'var(--green-bg)', border: `1px solid ${n.read ? 'var(--border)' : 'var(--u-good)'}`, borderRadius: 12, display: 'flex', alignItems: 'flex-start' }}
            >
            <button
              onClick={() => openNote(n)}
              style={{ padding: '14px 4px 14px 16px', background: 'none', border: 'none', display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', flex: 1, minWidth: 0, color: 'var(--text)' }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: n.read ? 'var(--surface2)' : 'var(--u-amber)', color: n.read ? 'var(--text2)' : 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {n.type === 'new_note' ? <BookOpen size={18} /> : <Icon size={18} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {(n.type === 'announce' || n.pinned) && (
                  <span style={{ display: 'inline-flex', gap: 6, marginBottom: 4 }}>
                    {n.type === 'announce' && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '2px 8px', borderRadius: 9999, background: 'var(--u-black)', color: 'var(--u-green)' }}>FROM UNIFY</span>}
                    {n.pinned && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '2px 8px', borderRadius: 9999, border: '1px solid var(--border)', color: 'var(--text2)' }}>PINNED</span>}
                  </span>
                )}
                <span style={{ fontWeight: 800, display: 'block', fontSize: 14 }}>{n.title || 'Update'}</span>
                <span style={{ fontSize: 13, color: '#555', display: 'block', marginTop: 2 }}>{n.body}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>{timeAgo(n.created_at)}</span>
              </span>
              {!n.read && <span style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--u-amber)', flexShrink: 0, marginTop: 6 }} />}
            </button>
            <button
              onClick={() => void removeNote(n.id)}
              disabled={deleting === n.id}
              aria-label={`Delete notification: ${n.title || 'Update'}`}
              style={{ padding: 14, background: 'none', border: 'none', color: 'var(--text3)', flexShrink: 0, display: 'flex', opacity: deleting === n.id ? 0.5 : 1 }}
            >
              <Trash2 size={16} />
            </button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Link to="/home" style={{ fontSize: 13, color: 'var(--u-good)', fontWeight: 700, textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
      {confirmClear && (
        <ConfirmModal
          title="Clear all notifications?"
          body={notes.some((n) => n.pinned) ? "This removes every notification except pinned messages from Unify. It can't be undone." : "This removes every notification from your list. It can't be undone."}
          confirmLabel="Clear all"
          busy={clearing}
          onConfirm={() => void clearAll()}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

