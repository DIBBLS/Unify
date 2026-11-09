import { useEffect, useState } from 'react';
import { SectionSkeleton } from '../../components/Skeletons';
import { Trash2, Plus } from 'lucide-react';
import { api, type HomeUpdate } from '../../lib/api';
import { POSES, type Pose } from '../../components/redesign/brand';
import { describeError } from '../../lib/errors';

// Admin: the live updates every signed-in user sees in the Home slider, like a
// notice board with a picture. Changes appear for everyone within about 30 s.
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginTop: 10 } as const;
const input = { padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' } as const;

const POSE_NAMES: Partial<Record<Pose, string>> = {
  cheer: 'Cheering', thumbsUp: 'Thumbs up', thumbsUpPhone: 'Phone + thumbs up', wavePhone: 'Waving', readingStanding: 'Reading', teaching: 'Teaching',
  targetSign: 'Target sign', phoneOut: 'Phone out', keyHandover: 'Key handover', armsCrossed: 'Confident', chairRelax: 'Relaxing', peeking: 'Peeking', sittingPhone: 'Sitting',
};

export default function HomeUpdatesPanel() {
  const [list, setList] = useState<HomeUpdate[] | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', link: '', cta: '', pose: 'cheer' as Pose, endsAt: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.adminUpdates().then((r) => setList(r.updates)).catch((e) => setMsg(describeError(e, 'load the updates')));
  }, []);

  const save = async (next: HomeUpdate[], done: string) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.adminSaveUpdates(next);
      setList(r.updates);
      setMsg(done);
    } catch (e) {
      setMsg(describeError(e, 'save the updates'));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMsg('An update needs a title and a message.');
      return;
    }
    const item: HomeUpdate = {
      id: Math.random().toString(36).slice(2, 10),
      title: draft.title.trim(),
      body: draft.body.trim(),
      pose: draft.pose,
      createdAt: new Date().toISOString(),
      ...(draft.link.trim() ? { link: draft.link.trim() } : {}),
      ...(draft.cta.trim() ? { cta: draft.cta.trim() } : {}),
      ...(draft.endsAt ? { endsAt: new Date(draft.endsAt + 'T23:59:59').toISOString() } : {}),
    };
    void save([item, ...(list || [])].slice(0, 12), 'Live now. Everyone sees it on Home.').then(() => setDraft({ title: '', body: '', link: '', cta: '', pose: draft.pose, endsAt: '' }));
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Home slider (live for everyone)</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 10px' }}>
        Shows first on every student's Home, with the Box Boy you pick. Use it for exam dates, new features, or a notice. Up to 12 at a time.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <input value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title (e.g. Exams start 20 Dec)" style={input} />
        <textarea value={draft.body} maxLength={240} rows={2} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Message" style={{ ...input, resize: 'vertical' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="Link: /courses or https://…" style={input} />
          <input value={draft.cta} maxLength={24} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} placeholder="Button label" style={input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select value={draft.pose} onChange={(e) => setDraft({ ...draft, pose: e.target.value as Pose })} style={input} aria-label="Box Boy">
            {(Object.keys(POSES) as Pose[]).map((k) => <option key={k} value={k}>{POSE_NAMES[k] || k}</option>)}
          </select>
          <label style={{ fontSize: 12, color: 'var(--text2)' }}>
            Ends on (optional)
            <input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} style={{ ...input, marginTop: 2 }} />
          </label>
        </div>
        <button className="btn btn--amber btn--sm" disabled={busy} onClick={add} style={{ justifySelf: 'start' }}><Plus size={14} /> Publish to Home</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 12, marginTop: 8, color: 'var(--text)' }}>{msg}</div>}

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {list === null && <SectionSkeleton rows={2} quote={false} />}
        {list && list.length === 0 && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Nothing live yet.</div>}
        {list?.map((u) => (
          <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
            <img src={POSES[u.pose]} alt="" width={36} height={36} style={{ objectFit: 'cover', objectPosition: 'top', borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.endsAt ? `Ends ${new Date(u.endsAt).toLocaleDateString()}` : 'No end date'}{u.link ? ` · ${u.link}` : ''}</div>
            </div>
            <button aria-label={`Remove ${u.title}`} disabled={busy} onClick={() => void save((list || []).filter((x) => x.id !== u.id), 'Removed. It is gone for everyone.')} style={{ padding: 8, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--u-red)' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
