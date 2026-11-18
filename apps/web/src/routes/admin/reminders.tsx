import { useEffect, useState } from 'react';
import { askConfirm } from '../../lib/dialog';
import { api, type ScheduledReminder } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';

// Admin › Reminders: nudges for everyone at set times and days (Lagos time),
// sent to the bell and as a push. People also keep their own study reminders
// in Settings › Notifications; these are on top of those.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AUDIENCE: Record<ScheduledReminder['audience'], string> = { all: 'Everyone', students: 'Students', lecturers: 'Lecturers', staff: 'Lecturers and contributors' };
type Draft = Omit<ScheduledReminder, 'id' | 'lastSentOn'>;
const EMPTY: Draft = { title: '', body: '', link: '', audience: 'all', sendAt: '19:00', days: [0, 1, 2, 3, 4, 5, 6], active: true };

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, width: '100%' };

function daysLabel(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  if (days.join() === '0,6') return 'Weekends';
  return days.map((d) => DAYS[d]).join(', ');
}
function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function AdminReminders() {
  const [list, setList] = useState<ScheduledReminder[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.adminReminders().then((r) => setList(r.reminders)).catch((e) => { setList([]); errorToast(e, 'load reminders'); });
  useEffect(() => { void load(); }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleDay = (d: number) => set('days', draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort());

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim() || !draft.days.length) return;
    setBusy(true);
    try {
      if (editing) await api.adminReminderUpdate(editing, draft);
      else await api.adminReminderCreate(draft);
      toastSuccess(editing ? 'Reminder updated.' : `Scheduled: ${daysLabel(draft.days).toLowerCase()} at ${timeLabel(draft.sendAt)}.`);
      setDraft(EMPTY);
      setEditing(null);
      await load();
    } catch (e) { errorToast(e, 'save the reminder'); }
    finally { setBusy(false); }
  };
  const flip = async (r: ScheduledReminder) => {
    try { await api.adminReminderUpdate(r.id, { active: !r.active }); setList((l) => (l || []).map((x) => (x.id === r.id ? { ...x, active: !x.active } : x))); }
    catch (e) { errorToast(e, 'change that reminder'); }
  };
  const remove = async (r: ScheduledReminder) => {
    if (!(await askConfirm({ title: `Delete "${r.title}"?`, body: 'It stops for everyone.', confirmLabel: 'Delete' }))) return;
    try { await api.adminReminderDelete(r.id); setList((l) => (l || []).filter((x) => x.id !== r.id)); toastSuccess('Reminder deleted.'); }
    catch (e) { errorToast(e, 'delete that reminder'); }
  };
  const test = async (r: ScheduledReminder) => {
    try { await api.adminReminderTest(r.id); toastSuccess('Sent to you only. Check your bell and phone.'); }
    catch (e) { errorToast(e, 'send a test'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 12, fontSize: 13, color: 'var(--text2)' }}>
        Reminders for everyone, on the days and time you pick (Lagos time). Each one rings the bell and sends a push. Everyone also gets their own study reminders, which they set in Settings › Notifications.
      </div>

      <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{editing ? 'Edit reminder' : 'New reminder'}</div>
        <input value={draft.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Title, e.g. Revise before the weekend" style={input} />
        <textarea value={draft.body} maxLength={240} rows={2} onChange={(e) => set('body', e.target.value)} placeholder="What should the reminder say?" style={{ ...input, resize: 'vertical' }} />
        <input value={draft.link} maxLength={300} onChange={(e) => set('link', e.target.value)} placeholder="Opens (optional): /home, /timetable, /revision" style={input} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Time
            <input type="time" value={draft.sendAt} onChange={(e) => set('sendAt', e.target.value)} style={{ ...input, width: 130 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
            Who
            <select value={draft.audience} onChange={(e) => set('audience', e.target.value as Draft['audience'])} style={input}>
              {Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Days">
          {DAYS.map((d, i) => {
            const on = draft.days.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(i)} style={{ padding: '6px 10px', borderRadius: 9999, border: '1px solid ' + (on ? 'var(--u-good)' : 'var(--border)'), background: on ? 'var(--u-good-tint)' : 'var(--surface)', color: on ? 'var(--u-good)' : 'var(--text2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {d}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--amber btn--sm" disabled={busy || !draft.title.trim() || !draft.body.trim() || !draft.days.length} onClick={() => void save()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule'}
          </button>
          {editing && <button className="btn btn--white btn--sm" onClick={() => { setEditing(null); setDraft(EMPTY); }}>Cancel</button>}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 12px 4px', fontSize: 12, fontWeight: 800 }}>Scheduled{list ? ` · ${list.length}` : ''}</div>
        {list === null && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>Loading…</div>}
        {list && list.length === 0 && <div style={{ padding: '8px 12px 12px', fontSize: 13, color: 'var(--text2)' }}>No reminders yet.</div>}
        {(list || []).map((r) => (
          <div key={r.id} style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', opacity: r.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{r.body}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {daysLabel(r.days)} at {timeLabel(r.sendAt)} · {AUDIENCE[r.audience]}{r.lastSentOn ? ` · last sent ${r.lastSentOn}` : ''}
                </span>
              </span>
              <input type="checkbox" aria-label={r.active ? 'Pause' : 'Resume'} title={r.active ? 'On' : 'Paused'} checked={r.active} onChange={() => void flip(r)} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn btn--white btn--sm" onClick={() => { setEditing(r.id); setDraft({ title: r.title, body: r.body, link: r.link, audience: r.audience, sendAt: r.sendAt, days: r.days, active: r.active }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
              <button className="btn btn--white btn--sm" onClick={() => void test(r)}>Send to me</button>
              <button className="btn btn--white btn--sm" onClick={() => void remove(r)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
