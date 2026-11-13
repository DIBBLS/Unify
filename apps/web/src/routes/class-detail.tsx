import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Video } from 'lucide-react';
import { api, type ClassSlot } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { Card, Display, Label, Pill } from '../components/redesign/ui';

// S41: one class on the timetable. Its time, place and lecturer, this week's
// status, and links. The class rep (or lecturer) marks this week's class as
// cancelled, moved or not confirmed yet; everyone taking the course is told.
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, marginTop: 4 };

export default function ClassDetailRoute() {
  const { course = '', id = '' } = useParams();
  const [slot, setSlot] = useState<ClassSlot | null>(null);
  const [err, setErr] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [mode, setMode] = useState<'' | 'moved' | 'cancelled' | 'unconfirmed'>('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.timetable(course).then((r) => {
      const s = r.slots.find((x) => x.id === id) || null;
      setSlot(s);
      if (!s) setErr('That class is no longer on the timetable.');
    }).catch((e) => setErr(describeError(e, 'load the class')));

  useEffect(() => {
    void load();
    api.me().then((m) => {
      const role = m.profile?.role;
      setCanEdit(!!(m.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc || role === 'lecturer' || !!m.isAdmin);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, id]);

  const apply = async (status: 'cancelled' | 'moved' | 'unconfirmed' | 'normal') => {
    if (!slot) return;
    setBusy(true);
    try {
      await api.slotChange(slot.id, { status, start: status === 'moved' ? start || undefined : undefined, end: status === 'moved' ? end || undefined : undefined, venue: status === 'moved' ? venue.trim() || undefined : undefined, note: note.trim() || undefined });
      toastSuccess(status === 'normal' ? 'Back to normal. The class was told.' : 'Saved. Everyone taking the course was told.');
      setMode('');
      await load();
    } catch (e) {
      errorToast(e, 'change this class');
    } finally {
      setBusy(false);
    }
  };

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.timetable} /><Card style={{ marginTop: 8 }}><div className="t-13 muted">{err}</div></Card></div>;
  if (!slot) return <div style={shell}><SectionSkeleton rows={2} /></div>;
  const ch = slot.change;
  const when = slot.date ? new Date(`${slot.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : DAY_LONG[slot.day];

  return (
    <div style={shell}>
      <BackButton to={ROUTES.timetable} />
      <Label>{when}</Label>
      <Display size={30}>{slot.course}</Display>
      <Card style={{ marginTop: 12, gap: 8 }}>
        {ch && (
          <div>
            <Pill tone={ch.status === 'cancelled' ? 'bad' : ch.status === 'moved' ? 'dark' : 'amber'}>{ch.status === 'cancelled' ? 'Cancelled this week' : ch.status === 'moved' ? 'Moved this week' : 'Not confirmed yet'}</Pill>
          </div>
        )}
        <div className="t-15 w-7" style={{ textDecoration: ch?.status === 'cancelled' || (ch?.status === 'moved' && ch.start) ? 'line-through' : undefined }}>{slot.start}–{slot.end}</div>
        {ch?.status === 'moved' && ch.start && <div className="t-15 w-7">Now {ch.start}{ch.end ? `–${ch.end}` : ''}</div>}
        {(slot.venue || ch?.venue) && (
          <div className="t-14" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <MapPin size={14} /> {ch?.status === 'moved' && ch.venue ? <><span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{slot.venue}</span> <b>{ch.venue}</b></> : slot.venue}
          </div>
        )}
        {slot.lecturer && <div className="t-14 muted">{slot.lecturer}</div>}
        {ch?.note && <div className="t-14">"{ch.note}"</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <Link to={`/courses/${encodeURIComponent(slot.course)}`} className="btn btn--white btn--sm">Open the course</Link>
          {slot.meetLink && <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="btn btn--amber btn--sm"><Video size={14} /> Join online</a>}
        </div>
      </Card>

      {canEdit && (
        <section style={{ marginTop: 18 }}>
          <Label>This week's class</Label>
          {mode === '' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button className="btn btn--white btn--sm" onClick={() => { setMode('moved'); setStart(slot.start); setEnd(slot.end); setVenue(slot.venue); }}>It moved</button>
              <button className="btn btn--white btn--sm" onClick={() => setMode('cancelled')}>Cancel it</button>
              <button className="btn btn--white btn--sm" onClick={() => setMode('unconfirmed')}>Not confirmed yet</button>
              {ch && <button className="btn btn--amber btn--sm" disabled={busy} onClick={() => void apply('normal')}>Back to normal</button>}
            </div>
          ) : (
            <Card style={{ marginTop: 8, gap: 8 }}>
              {mode === 'moved' && (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="t-13 w-6" style={{ flex: 1 }}>Starts<input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={field} /></label>
                    <label className="t-13 w-6" style={{ flex: 1 }}>Ends<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={field} /></label>
                  </div>
                  <label className="t-13 w-6">Venue<input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={120} style={field} /></label>
                </>
              )}
              <label className="t-13 w-6">Note to the class (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={mode === 'cancelled' ? 'e.g. Lecturer is at a conference' : 'e.g. Confirming with the lecturer'} style={field} /></label>
              <div className="t-12 muted">Only this week changes. Everyone taking {slot.course} gets a notification.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--amber" disabled={busy} onClick={() => void apply(mode)}>{busy ? 'Saving…' : 'Save and tell the class'}</button>
                <button className="btn btn--white" onClick={() => setMode('')}>Back</button>
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
