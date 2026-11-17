import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api, type ClassListClaim, type ClassListData, type ClassListEntry, type ClassListLog, type ClassListParse } from '../lib/api';
import { errorToast, describeError } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import ErrorState from '../components/ErrorState';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard, Pill } from '../components/redesign/ui';

// Class list (class reps, admins): upload names + matric numbers once, fix them
// here, and answer students who can't find themselves on it. Students only ever
// see their own entry; lecturers see names through the register of their course.
const field: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 15,
};
const MAX_FILE = 4 * 1024 * 1024;
const ISSUE: Record<string, string> = {
  duplicate: 'Listed twice',
  no_name: 'No name',
  odd_matric: 'Matric looks different from the rest',
};

type Draft = { key: number; name: string; matric: string; issue?: string; existing: { name: string; removed: boolean } | null; keep: boolean };

export default function ClassListRoute() {
  const [data, setData] = useState<ClassListData | null>(null);
  const [err, setErr] = useState<{ msg: string; status?: number } | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    try {
      const d = await api.classList();
      setData(d);
      setErr(null);
      if (!d.list) setShowUpload(true);
    } catch (e) {
      setErr({ msg: describeError(e, 'load the class list'), status: (e as { status?: number }).status });
    }
  };
  useEffect(() => { void load(); }, []);

  const shell = { maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err)
    return (
      <div style={shell}>
        <BackButton to={ROUTES.hoc} />
        {err.status === 403 || err.status === 400 ? (
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
            <BoxBoy pose="peeking" width={110} />
            <div className="t-15 w-6">Class reps manage the class list</div>
            <div className="t-13 muted">{err.msg}</div>
          </Card>
        ) : (
          <ErrorState message="We couldn't load the class list." onRetry={() => void load()} />
        )}
      </div>
    );
  if (!data) return <div style={shell}><SectionSkeleton rows={4} /></div>;

  const live = data.entries.filter((e) => !e.removed);
  const joined = live.filter((e) => e.claimed).length;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.hoc} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BoxBoy pose="teaching" width={64} />
        <div>
          <Label>{data.class.department} · {data.class.level}</Label>
          <Display size={28}>Class list</Display>
        </div>
      </div>
      {data.list && (
        <div className="t-13 muted" style={{ marginTop: 8 }}>
          {live.length} students · {joined} on Unify · only you, your co-reps and the lecturers of your courses see this list
        </div>
      )}

      {data.claims.length > 0 && <Requests claims={data.claims} onDone={() => void load()} />}

      {showUpload ? (
        <Upload hasList={!!data.list} onSaved={() => { setShowUpload(false); void load(); }} onCancel={data.list ? () => setShowUpload(false) : undefined} />
      ) : (
        <button className="btn btn--white btn--block" onClick={() => setShowUpload(true)} style={{ marginTop: 16 }}>Upload more names</button>
      )}

      {data.list && <Entries entries={data.entries} onChange={() => void load()} />}
      {data.log.length > 0 && <History log={data.log} />}
    </div>
  );
}

// ---------- Requests from students ----------
function Requests({ claims, onDone }: { claims: ClassListClaim[]; onDone: () => void }) {
  const [busy, setBusy] = useState('');
  const answer = async (c: ClassListClaim, action: 'approve' | 'reject') => {
    let note: string | undefined;
    if (action === 'reject') {
      const n = window.prompt('Tell them why (optional):', '');
      if (n === null) return;
      note = n.trim() || undefined;
    }
    setBusy(c.id);
    try {
      await api.classListAnswer(c.id, action, note);
      toastSuccess(action === 'approve' ? 'Done. They now show on the list.' : 'Declined. They were told.');
      onDone();
    } catch (e) {
      errorToast(e, 'answer that request');
    } finally {
      setBusy('');
    }
  };
  return (
    <section style={{ marginTop: 18 }}>
      <Label>Requests ({claims.length})</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {claims.map((c) => (
          <Card key={c.id} style={{ gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill tone={c.reason === 'already_claimed' ? 'warn' : 'amber'}>{c.reason === 'already_claimed' ? 'Says this entry is theirs' : 'Not on the list'}</Pill>
              {c.verifiedEmail && <Pill tone="good">LASU email verified</Pill>}
            </div>
            <div className="t-15 w-6">{c.name || c.account} · {c.matric}</div>
            <div className="t-13 muted">
              Unify account: {c.account}{c.accountEmail ? ` (${c.accountEmail})` : ''}
              {c.entry && (c.entry.claimedBy ? ` · ${c.matric} is listed as ${c.entry.name}, claimed by ${c.entry.claimedBy}` : ` · listed as ${c.entry.name}`)}
            </div>
            {c.note && <div className="t-13">"{c.note}"</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn--amber btn--sm" disabled={busy === c.id} onClick={() => void answer(c, 'approve')}>
                {c.reason === 'already_claimed' ? 'Give them this entry' : 'Add to the list'}
              </button>
              <button className="btn btn--white btn--sm" disabled={busy === c.id} onClick={() => void answer(c, 'reject')}>Decline</button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- Upload: file or paste, then review ----------
function Upload({ hasList, onSaved, onCancel }: { hasList: boolean; onSaved: () => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ClassListParse | null>(null);
  const [rows, setRows] = useState<Draft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (input: { text: string } | { filename: string; data: string }) => {
    setBusy(true);
    try {
      const r = await api.classListParse(input);
      setParsed(r);
      // Second copy of a duplicate starts unticked.
      const seen = new Set<string>();
      setRows(
        r.rows.map((x, i) => {
          const dup = seen.has(x.matric);
          seen.add(x.matric);
          return { key: i, name: x.name, matric: x.matric, issue: x.issue, existing: x.existing, keep: !dup };
        })
      );
    } catch (e) {
      errorToast(e, 'read that list');
    } finally {
      setBusy(false);
    }
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE) {
      errorToast(new Error('That file is over 4 MB. Save just the list part, or paste it.'), 'read that list');
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || '');
      void read({ filename: f.name, data: s.slice(s.indexOf(',') + 1) });
    };
    fr.onerror = () => errorToast(new Error("Couldn't open that file."), 'read that list');
    fr.readAsDataURL(f);
  };

  const kept = rows.filter((r) => r.keep);
  const fresh = kept.filter((r) => !r.existing || r.existing.removed).length;
  const invalid = kept.filter((r) => r.name.trim().length < 2 || r.matric.trim().length < 4);
  const dupes = (() => {
    const c = new Map<string, number>();
    for (const r of kept) c.set(r.matric.trim().toUpperCase(), (c.get(r.matric.trim().toUpperCase()) || 0) + 1);
    return new Set([...c].filter(([, n]) => n > 1).map(([m]) => m));
  })();

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.classListSave(kept.map((x) => ({ name: x.name.trim(), matric: x.matric.trim() })), parsed?.source);
      const bits = [`${r.added} added`];
      if (r.restored) bits.push(`${r.restored} brought back`);
      if (r.unchanged) bits.push(`${r.unchanged} already there`);
      if (r.linked) bits.push(`${r.linked} linked to their Unify account`);
      toastSuccess(`Class list saved: ${bits.join(', ')}.`);
      if (r.nameDiffers) toastSuccess(`${r.nameDiffers} names differ from the list; the list kept its spelling. Edit them below if needed.`);
      onSaved();
    } catch (e) {
      errorToast(e, 'save the class list');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: number, patch: Partial<Draft>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (parsed)
    return (
      <Card style={{ marginTop: 16, gap: 10 }}>
        <div className="t-15 w-7">Check before saving</div>
        <div className="t-13 muted">
          Found {parsed.rows.length} students: {fresh} new{hasList ? `, ${kept.length - fresh} already on the list` : ''}.
          {parsed.skipped ? ` ${parsed.skipped} title or header lines skipped.` : ''} Fix anything flagged, untick rows you don't want, then save.
        </div>
        {parsed.problems.length > 0 && (
          <div className="t-13" style={{ padding: 10, borderRadius: 10, background: 'var(--u-warn-tint, #fef3c7)', color: 'var(--u-warn-ink, #92400e)' }}>
            {parsed.problems.length} line{parsed.problems.length > 1 ? 's' : ''} had no matric number and {parsed.problems.length > 1 ? 'were' : 'was'} left out:
            {parsed.problems.slice(0, 8).map((p) => <div key={p.line}>Line {p.line}: {p.text}</div>)}
            {parsed.problems.length > 8 && <div>…and {parsed.problems.length - 8} more</div>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflowY: 'auto' }}>
          {rows.map((r) => {
            const bad = r.keep && (r.name.trim().length < 2 || r.matric.trim().length < 4 || dupes.has(r.matric.trim().toUpperCase()));
            const flag = r.keep && dupes.has(r.matric.trim().toUpperCase()) ? ISSUE.duplicate : r.issue && r.issue !== 'duplicate' ? ISSUE[r.issue] : '';
            return (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 9.5em', gap: 6, alignItems: 'center', opacity: r.keep ? 1 : 0.5, padding: 6, borderRadius: 10, border: `1px solid ${bad ? 'var(--u-red, #dc2626)' : 'transparent'}` }}>
                <input type="checkbox" checked={r.keep} onChange={(e) => set(r.key, { keep: e.target.checked })} aria-label={`Include ${r.name || r.matric}`} />
                <input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Full name" aria-label="Full name" style={field} />
                <input value={r.matric} onChange={(e) => set(r.key, { matric: e.target.value.toUpperCase() })} placeholder="Matric" aria-label="Matric number" style={field} />
                {(flag || r.existing) && (
                  <div className="t-12" style={{ gridColumn: '2 / 4', color: flag ? 'var(--u-red, #dc2626)' : 'var(--text3)' }}>
                    {flag || (r.existing!.removed ? 'Was removed: saving brings it back' : r.existing!.name.toLowerCase() === r.name.trim().toLowerCase() ? 'Already on the list' : `Already on the list as "${r.existing!.name}" (kept)`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn btn--amber btn--block" disabled={busy || !kept.length || invalid.length > 0 || dupes.size > 0} onClick={() => void save()}>
          {busy ? 'Saving…' : invalid.length || dupes.size ? 'Fix the rows marked in red' : `Save ${kept.length} to the class list`}
        </button>
        <button className="btn btn--white btn--block" disabled={busy} onClick={() => { setParsed(null); setRows([]); }}>Start again</button>
      </Card>
    );

  return (
    <Card style={{ marginTop: 16, gap: 10 }}>
      <div className="t-15 w-7">{hasList ? 'Add names to the list' : 'Upload your class list'}</div>
      <div className="t-13 muted">
        The list your department gave you: Excel, Word, PDF or CSV, or paste it. It needs each student's name and matric number. Photos can't be read.
        {hasList ? ' Students already on the list stay as they are.' : ''}
      </div>
      <div role="tablist" aria-label="How to add" style={{ display: 'flex', gap: 6 }}>
        {([['file', 'Upload a file'], ['paste', 'Paste']] as const).map(([id, name]) => (
          <button key={id} role="tab" aria-selected={mode === id} className={`chip chip--sm${mode === id ? ' chip--on' : ''}`} onClick={() => setMode(id)}>{name}</button>
        ))}
      </div>
      {mode === 'file' ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.docx,.pdf,.txt,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button className="btn btn--amber btn--block" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Reading…' : 'Choose file'}</button>
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={'One student per line, e.g.\nAdaeze Okafor, 190401001\nTunde Bakare, 190401002'}
            style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-body)' }}
          />
          <button className="btn btn--amber btn--block" disabled={busy || !text.trim()} onClick={() => void read({ text })}>{busy ? 'Reading…' : 'Read the list'}</button>
        </>
      )}
      {onCancel && <button className="btn btn--white btn--block" onClick={onCancel}>Cancel</button>}
    </Card>
  );
}

// ---------- The list ----------
function Entries({ entries, onChange }: { entries: ClassListEntry[]; onChange: () => void }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string>('');
  const [showRemoved, setShowRemoved] = useState(false);
  const live = entries.filter((e) => !e.removed);
  const removed = entries.filter((e) => e.removed);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? live.filter((e) => e.name.toLowerCase().includes(s) || e.matric.toLowerCase().includes(s)) : live;
  }, [live, q]);

  const act = async (fn: () => Promise<unknown>, what: string, done?: string) => {
    try {
      await fn();
      if (done) toastSuccess(done);
      onChange();
    } catch (e) {
      errorToast(e, what);
    }
  };

  return (
    <section style={{ marginTop: 22 }}>
      <Label>Students ({live.length})</Label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or matric" aria-label="Search the class list" style={{ ...field, marginTop: 8 }} />
      <AddOne onAdded={onChange} />
      <ListCard style={{ marginTop: 8 }}>
        {shown.map((e) =>
          editing === e.id ? (
            <EditRow key={e.id} entry={e} onClose={() => setEditing('')} onSaved={() => { setEditing(''); onChange(); }} />
          ) : (
            <div key={e.id} className="row" style={{ gap: 10, padding: '12px 16px', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-15 w-6">{e.name}</div>
                <div className="t-13 muted">
                  {e.matric} · {e.claimed ? `On Unify as ${e.claimedBy}${e.verifiedEmail ? ' · email verified' : e.claimMethod === 'auto' ? ' · linked by matric' : ''}` : 'Not on Unify yet'}
                </div>
              </div>
              <button className="btn btn--white btn--sm" onClick={() => setEditing(e.id)}>Edit</button>
            </div>
          )
        )}
        {shown.length === 0 && <div className="t-13 muted" style={{ padding: 16 }}>{q ? 'No one matches that.' : 'No students yet.'}</div>}
      </ListCard>
      {removed.length > 0 && (
        <>
          <button className="btn btn--white btn--sm" style={{ marginTop: 10 }} onClick={() => setShowRemoved((v) => !v)}>
            {showRemoved ? 'Hide' : 'Show'} removed ({removed.length})
          </button>
          {showRemoved && (
            <ListCard style={{ marginTop: 8 }}>
              {removed.map((e) => (
                <div key={e.id} className="row" style={{ gap: 10, padding: '12px 16px', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-15" style={{ textDecoration: 'line-through' }}>{e.name}</div>
                    <div className="t-13 muted">{e.matric}</div>
                  </div>
                  <button className="btn btn--white btn--sm" onClick={() => void act(() => api.classListRestore(e.id), 'restore that student', 'Back on the list.')}>Restore</button>
                </div>
              ))}
            </ListCard>
          )}
        </>
      )}
    </section>
  );
}

function AddOne({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [matric, setMatric] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn btn--white btn--sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>Add one student</button>;
  const add = async () => {
    setBusy(true);
    try {
      const r = await api.classListSave([{ name: name.trim(), matric: matric.trim() }], 'manual');
      toastSuccess(r.added || r.restored ? 'Added.' : 'That matric is already on the list.');
      setName(''); setMatric(''); setOpen(false);
      onAdded();
    } catch (e) {
      errorToast(e, 'add that student');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginTop: 8, gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" style={field} />
      <input value={matric} onChange={(e) => setMatric(e.target.value.toUpperCase())} placeholder="Matric number" aria-label="Matric number" style={field} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn--amber btn--sm" disabled={busy || name.trim().length < 2 || matric.trim().length < 4} onClick={() => void add()}>{busy ? 'Adding…' : 'Add'}</button>
        <button className="btn btn--white btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </Card>
  );
}

function EditRow({ entry, onClose, onSaved }: { entry: ClassListEntry; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(entry.name);
  const [matric, setMatric] = useState(entry.matric);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, what: string, done: string) => {
    setBusy(true);
    try {
      await fn();
      toastSuccess(done);
      onSaved();
    } catch (e) {
      errorToast(e, what);
    } finally {
      setBusy(false);
    }
  };
  const patch: { name?: string; matric?: string } = {};
  if (name.trim() !== entry.name) patch.name = name.trim();
  if (matric.trim().toUpperCase() !== entry.matric) patch.matric = matric.trim();
  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="t-13 muted">Edit entry</span>
        <button aria-label="Close" onClick={onClose} style={{ display: 'flex', padding: 4, color: 'var(--text3)' }}><X size={16} /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" style={field} />
      <input value={matric} onChange={(e) => setMatric(e.target.value.toUpperCase())} aria-label="Matric number" style={field} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--amber btn--sm" disabled={busy || !Object.keys(patch).length || name.trim().length < 2 || matric.trim().length < 4} onClick={() => void run(() => api.classListEdit(entry.id, patch), 'save that change', 'Saved.')}>Save</button>
        {entry.claimed && (
          <button
            className="btn btn--white btn--sm"
            disabled={busy}
            onClick={() => { if (window.confirm(`Unlink ${entry.claimedBy}'s Unify account from ${entry.matric}? They'll need to claim their entry again.`)) void run(() => api.classListUnclaim(entry.id), 'unlink that account', 'Unlinked.'); }}
          >
            Unlink account
          </button>
        )}
        <button
          className="btn btn--white btn--sm"
          disabled={busy}
          onClick={() => { if (window.confirm(`Remove ${entry.name} from the class list? Their attendance is kept, and you can restore them.`)) void run(() => api.classListRemove(entry.id), 'remove that student', 'Removed.'); }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ---------- What changed ----------
const describe = (l: ClassListLog): string => {
  const d = l.detail as Record<string, unknown>;
  const who = `${d.name || ''}${d.matric ? ` (${d.matric})` : ''}`.trim();
  switch (l.action) {
    case 'upload': return `${l.by} uploaded names: ${d.added ?? 0} added${d.restored ? `, ${d.restored} brought back` : ''}`;
    case 'add': return `${l.by} added ${who}`;
    case 'edit': {
      const from = d.from as { name?: string; matric?: string } | undefined;
      const to = d.to as { name?: string; matric?: string } | undefined;
      const parts = [to?.name ? `name to "${to.name}"` : '', to?.matric ? `matric to ${to.matric}` : ''].filter(Boolean).join(' and ');
      return `${l.by} changed ${from?.name || 'an entry'}: ${parts}`;
    }
    case 'remove': return `${l.by} removed ${who}`;
    case 'restore': return `${l.by} restored ${who}`;
    case 'claim': return `${who} claimed by a student${d.method === 'email' ? ' (LASU email verified)' : d.method === 'auto' ? ' (matched by matric)' : d.method === 'hoc' ? ' (approved by a class rep)' : ''}`;
    case 'unclaim': return `${who} unlinked from an account${d.why ? `: ${d.why}` : ''}`;
    case 'approve': return `${l.by} approved a request for ${who}`;
    case 'reject': return `${l.by} declined a request for ${who}`;
    default: return `${l.by}: ${l.action}`;
  }
};

function History({ log }: { log: ClassListLog[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ marginTop: 22 }}>
      <button className="btn btn--white btn--sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} change history</button>
      {open && (
        <ListCard style={{ marginTop: 8 }}>
          {log.map((l) => (
            <div key={l.id} className="row" style={{ padding: '10px 16px', gap: 10 }}>
              <div className="t-13" style={{ flex: 1, minWidth: 0 }}>{describe(l)}</div>
              <span className="t-12 muted" style={{ flexShrink: 0 }}>{new Date(l.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
        </ListCard>
      )}
    </section>
  );
}
