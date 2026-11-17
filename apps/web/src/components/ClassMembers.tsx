import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar, type PersonaKey } from './redesign/brand';
import { Card, Label, Pill } from './redesign/ui';

// Who's in your class on Unify (same department and level): the class rep
// first, then everyone by name. Names and avatars only.
type Member = Awaited<ReturnType<typeof api.classMembers>>['members'][number];
const FIRST = 8;

export default function ClassMembers() {
  const [members, setMembers] = useState<Member[] | null | undefined>(undefined);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => {
    api.classMembers().then((r) => setMembers(r.members)).catch(() => setMembers(null));
  }, []);
  if (members === null || (members && members.length === 0)) return null;

  const term = q.trim().toLowerCase();
  const shown = (members || []).filter((m) => !term || m.name.toLowerCase().includes(term));
  const list = all || term ? shown : shown.slice(0, FIRST);
  return (
    <Card style={{ marginTop: 16, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={16} />
        <Label>Class members</Label>
        {members && <span className="t-13 muted" style={{ marginLeft: 'auto' }}>{members.length} on Unify</span>}
      </div>
      {members === undefined && <div className="t-13 muted">Loading your classmates…</div>}
      {members && members.length > FIRST && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Search size={15} color="var(--text2)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a classmate" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15 }} />
        </label>
      )}
      {list.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {m.avatar
            ? <img src={m.avatar} alt="" width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <Avatar persona={(m.persona || 'go-getter') as PersonaKey} size={32} />}
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: m.me ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}{m.me ? ' (you)' : ''}</span>
          {m.isHoc && <Pill tone="amber">Class rep</Pill>}
        </div>
      ))}
      {term && shown.length === 0 && <div className="t-13 muted">No one by that name yet.</div>}
      {!term && members && members.length > FIRST && (
        <button className="btn btn--white btn--sm" onClick={() => setAll((a) => !a)}>{all ? 'Show fewer' : `Show all ${members.length}`}</button>
      )}
    </Card>
  );
}
