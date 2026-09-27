import { useEffect, useState } from 'react';
import { Link2, Copy, Check, Trash2, X, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';

const TTLS = [
  { hours: 8, label: '8 hours' },
  { hours: 16, label: '16 hours' },
  { hours: 24, label: '24 hours' },
];

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.round(ms / 3600000);
  if (h < 48) return `expires in ${h}h`;
  return `expires in ${Math.round(h / 24)}d`;
}

// Share sheet: mint an expiring /s/:token link for this week, copy it,
// send it to WhatsApp, and manage your live links (views + revoke).
export function ShareModal({ course, week, title, topics, onClose }: { course: string; week: number; title: string; topics: string[]; onClose: () => void }) {
  const [ttl, setTtl] = useState(24);
  const [link, setLink] = useState<{ token: string; expires_at: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState<{ token: string; course: string; week: number; expires_at: string; views: number }[]>([]);

  const loadMine = () => {
    api.shareMine().then((r) => setMine(r.links)).catch(() => {});
  };

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Share links ride the OG function so WhatsApp/Telegram unfurl a rich
  // preview card; humans land on the same page with an app CTA.
  const urlFor = (token: string) => `${window.location.origin}/api/share/${token}`;

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await api.shareCreate(course, week, ttl);
      setLink({ token: res.token, expires_at: res.expires_at });
      loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create link.');
    } finally {
      setCreating(false);
    }
  };

  const copy = async (token: string) => {
    const url = urlFor(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // clipboard unavailable — user copies manually
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (token: string) => {
    try {
      await api.shareDelete(token);
      if (link?.token === token) setLink(null);
      loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed.');
    }
  };

  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share this week">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, fontSize: 16 }}>
            <Link2 size={18} color="#059669" /> Share {course} · Week {week}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text2)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ textAlign: 'left', marginTop: 6 }}>
          Anyone with the link reads free until it expires — no account needed. Expiry is what pulls them back to join.
        </div>
        {/* Mini preview: exactly the hero + topics going out */}
        <div style={{ marginTop: 10, background: '#0a0a0a', borderRadius: 12, padding: 16, color: '#f5f4f0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4ade80' }}>{course} · WEEK {week}</div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 17, marginTop: 4 }}>{title || `Week ${week}`}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,244,240,.65)', marginTop: 6 }}>
            {topics.length ? topics.slice(0, 3).map((t, i) => (
              <span key={i} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>T{i + 1} · {t}</span>
            )) : 'No topics yet'}
            {topics.length > 3 && <span style={{ display: 'block' }}>+{topics.length - 3} more topics</span>}
          </div>
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        {!link ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 8px' }}>LINK LIFETIME</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TTLS.map((t) => (
                <button
                  key={t.hours}
                  onClick={() => setTtl(t.hours)}
                  style={{ flex: 1, padding: '10px 6px', borderRadius: 12, border: `1px solid ${ttl === t.hours ? '#059669' : 'var(--border)'}`, background: ttl === t.hours ? '#10b981' : 'var(--surface)', color: ttl === t.hours ? '#fff' : 'var(--text2)', fontWeight: 800, fontSize: 12 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={create} disabled={creating} className="btn-primary" style={{ width: '100%', marginTop: 12, opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating…' : 'Create share link'}
            </button>
          </>
        ) : (
          <div style={{ marginTop: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all' }}>{urlFor(link.token)}</div>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, marginTop: 4 }}>{expiryLabel(link.expires_at)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => copy(link.token)} style={{ flex: 1, padding: 10, borderRadius: 12, background: '#10b981', color: '#fff', border: 'none', borderBottom: '3px solid #059669', fontWeight: 800, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Study ${course} Week ${week} with me on Unify Learn (free for a limited time): ${urlFor(link.token)}`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, padding: 10, borderRadius: 12, background: '#25D366', color: '#fff', border: 'none', borderBottom: '3px solid #128C7E', fontWeight: 800, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          </div>
        )}
        {mine.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>YOUR LIVE LINKS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mine.slice(0, 5).map((l) => {
                const dead = new Date(l.expires_at).getTime() <= Date.now();
                return (
                  <div key={l.token} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', opacity: dead ? 0.55 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{l.course} · W{l.week}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{l.views} views · {expiryLabel(l.expires_at)}</div>
                    </div>
                    {!dead && (
                      <button onClick={() => copy(l.token)} aria-label="Copy link" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: '#059669', padding: 7, display: 'flex' }}>
                        <Copy size={14} />
                      </button>
                    )}
                    <button onClick={() => revoke(l.token)} aria-label="Revoke link" style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', padding: 7, display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
