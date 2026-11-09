import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Video } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, type AttendanceRegister } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import MeetLinkField from '../components/MeetLinkField';
import { isHttpsLink } from '../lib/meet';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import Drop from '../components/Drop';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard, ListRow, Pill } from '../components/redesign/ui';

// Take attendance (lecturer): open a session for a course, show the rotating
// 6-digit code + QR (a new one every 30s, so a photo of the screen goes stale),
// watch students tick in live, close when class is settled.
// Route kept at /attendance/scanner so existing links keep working.
const MINUTES = [5, 10, 15, 30, 60];
const ONLINE_MINUTES = [60, 90, 120, 180];

function useCountdown(closesAt: string | undefined, open: boolean) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!closesAt || !open) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(closesAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [closesAt, open]);
  return left;
}

export default function ScannerRoute() {
  const [courses, setCourses] = useState<string[]>([]);
  const [course, setCourse] = useState('');
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'room' | 'online'>(params.get('online') === '1' ? 'online' : 'room');
  const [minutes, setMinutes] = useState(15);
  const [meetLink, setMeetLink] = useState('');
  const [reg, setReg] = useState<AttendanceRegister | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const isHoc = !!(me.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc;
        const taught = me.isAdmin ? (await api.courses()).map((c) => c.code) : (await api.teaching()).courses;
        // Class reps can also run attendance for the courses they take.
        const list = [...new Set([...taught, ...(isHoc ? (me.courses || []).map((x) => String(x)) : [])])];
        setCourses(list);
        if (list[0]) setCourse(list[0]);
      } catch (e) {
        errorToast(e, 'load your courses');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!course) return;
    try {
      setReg(await api.attendanceRegister(course));
    } catch (e) {
      errorToast(e, 'load the register');
    }
  }, [course]);

  // Load on course change; poll while a session is open.
  useEffect(() => { setReg(null); void refresh(); }, [refresh]);
  const open = !!reg?.session?.open;
  // Lecturer and class rep share one session per course, so keep checking even
  // when nothing is open: the other person may start it any moment.
  useEffect(() => {
    if (!course) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, open ? 5000 : 8000);
    return () => clearInterval(t);
  }, [open, course, refresh]);

  // Fetch the new code the moment the current one rotates.
  const rotatesAt = reg?.session?.rotatesAt;
  useEffect(() => {
    if (!open || !rotatesAt) return;
    const ms = Math.max(300, new Date(rotatesAt).getTime() - Date.now() + 400);
    const t = setTimeout(() => void refresh(), ms);
    return () => clearTimeout(t);
  }, [open, rotatesAt, refresh]);
  const rotateIn = useCountdown(rotatesAt, open);

  const left = useCountdown(reg?.session?.closesAt, open);
  useEffect(() => { if (open && left === 0 && reg?.session) void refresh(); }, [left, open, reg?.session, refresh]);

  // Online: start from the course's saved class link, if the timetable has one.
  useEffect(() => {
    if (mode !== 'online' || !course) return;
    let gone = false;
    api.timetable(course).then((r) => {
      const l = r.slots.find((x) => x.meetLink)?.meetLink;
      if (!gone && l) setMeetLink((cur) => cur || l);
    }).catch(() => {});
    return () => { gone = true; };
  }, [mode, course]);
  useEffect(() => { setMinutes(mode === 'online' ? 90 : 15); }, [mode]);

  const start = async () => {
    if (mode === 'online' && meetLink && !isHttpsLink(meetLink)) {
      errorToast(new Error('That meeting link does not look right. Create one with the button, then paste it.'), 'start the online class');
      return;
    }
    setBusy(true);
    try { setReg(await api.attendanceStart(course, undefined, minutes, mode === 'online' ? { meetLink } : undefined)); }
    catch (e) { errorToast(e, 'start attendance'); }
    finally { setBusy(false); }
  };
  const end = async () => {
    if (!reg?.session) return;
    setBusy(true);
    try { await api.attendanceClose(reg.session.id); await refresh(); }
    catch (e) { errorToast(e, 'end the session'); }
    finally { setBusy(false); }
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 720px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  if (loaded && courses.length === 0)
    return (
      <div style={shell}>
        <BackButton to={ROUTES.lecturer} />
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="peeking" width={110} />
          <div className="t-15 w-6">No courses to take attendance for</div>
          <div className="t-13 muted">You can take attendance for courses you teach. An admin assigns those.</div>
        </Card>
      </div>
    );

  return (
    <div style={shell}>
      <BackButton to={ROUTES.lecturer} />
      <Label>Attendance</Label>
      <Display size={30}>Take attendance</Display>

      <div style={{ marginTop: 16 }}>
        <Drop label="Course" value={course} onChange={setCourse} options={courses.map((c) => ({ value: c, label: c }))} />
      </div>

      {open && reg?.session ? (
        reg.session.online ? (
          <Card tone="dark" style={{ alignItems: 'center', textAlign: 'center', marginTop: 16 }}>
            {reg.session.startedBy && (
              <Pill tone="amber">{reg.session.startedBy.mine ? 'You started this' : `Started by ${reg.session.startedBy.name}${reg.session.startedBy.role ? ` (${reg.session.startedBy.role})` : ''}`} · online class</Pill>
            )}
            <div className="eyebrow" style={{ opacity: 0.7 }}>Share this code in the meeting chat</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 8, fontFamily: 'var(--font-body)', color: 'var(--u-green)' }} aria-label="Attendance code">
              {reg.session.code}
            </div>
            <div className="t-13" style={{ opacity: 0.75 }}>Students open Unify, tap Mark attendance and type it. New code in {Math.max(1, Math.ceil(rotateIn / 60))} min.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
              <button
                className="btn btn--amber btn--sm"
                onClick={() => {
                  const msg = `Unify attendance code for ${reg.session?.course}: ${reg.session?.code}. Open Unify, tap Mark attendance, take the selfie and type this code. It works for the next ${Math.max(1, Math.ceil(rotateIn / 60))} minutes.`;
                  void navigator.clipboard.writeText(msg).then(() => toastSuccess('Copied. Paste it in the meeting chat.')).catch(() => errorToast(new Error('Copying was blocked. Select the code and copy it yourself.'), 'copy the code'));
                }}
              >
                <Copy size={14} /> Copy message for the chat
              </button>
              {meetLink && <a className="btn btn--white btn--sm" href={meetLink} target="_blank" rel="noopener noreferrer"><Video size={14} /> Open the meeting</a>}
            </div>
            <Pill tone="amber">Closes in {mm}:{ss}</Pill>
            <div className="t-15" style={{ marginTop: 6 }}>{reg.present.length} of {reg.enrolled} present</div>
            <button className="btn btn--white" disabled={busy} onClick={() => void end()} style={{ marginTop: 10 }}>End class</button>
          </Card>
        ) : (
          <Card tone="dark" style={{ alignItems: 'center', textAlign: 'center', marginTop: 16 }}>
          {reg.session.startedBy && (
            <Pill tone="amber">{reg.session.startedBy.mine ? 'You started this' : `Started by ${reg.session.startedBy.name}${reg.session.startedBy.role ? ` (${reg.session.startedBy.role})` : ''}`} · shared live</Pill>
          )}
          <div className="eyebrow" style={{ opacity: 0.7 }}>Students scan this QR in the app</div>
          <div style={{ background: '#fff', padding: 12, borderRadius: 16, lineHeight: 0 }} aria-label="Attendance QR code">
            <QRCodeSVG value={`${window.location.origin}/attendance/pass?c=${reg.session.code}`} size={260} level="M" />
          </div>
          <div className="t-13" style={{ opacity: 0.7 }}>QR changes in {rotateIn}s</div>
          <div className="t-12" style={{ opacity: 0.6, marginTop: 2 }}>No camera? Students can type this code instead</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 6, fontFamily: 'var(--font-body)', color: 'var(--u-green)' }} aria-label="Attendance code">
            {reg.session.code}
          </div>
          <Pill tone="amber">Closes in {mm}:{ss}</Pill>
          <div className="t-15" style={{ marginTop: 6 }}>{reg.present.length} of {reg.enrolled} present</div>
          <button className="btn btn--white" disabled={busy} onClick={() => void end()} style={{ marginTop: 10 }}>End session</button>
        </Card>
        )
      ) : (
        <Card style={{ marginTop: 16, gap: 14 }}>
          {reg?.session && <div className="t-13 muted">Last session: {reg.present.length} of {reg.enrolled} present.</div>}
          <div role="tablist" aria-label="Class type" style={{ display: 'flex', gap: 6 }}>
            {([['room', 'In class'], ['online', 'Online class']] as const).map(([id, name]) => (
              <button key={id} role="tab" aria-selected={mode === id} className={`chip chip--sm${mode === id ? ' chip--on' : ''}`} onClick={() => setMode(id)}>{name}</button>
            ))}
          </div>
          {mode === 'online' && (
            <>
              <MeetLinkField value={meetLink} onChange={setMeetLink} label="Meeting link (students get it with the notice)" />
              <div className="t-12 muted">Students are told the class is live. You share a code in the meeting chat; they type it in Unify to be marked present. The code lasts 10 minutes at a time.</div>
            </>
          )}
          <Label>Open for</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(mode === 'online' ? ONLINE_MINUTES : MINUTES).map((m) => (
              <button key={m} className={`chip chip--sm${m === minutes ? ' chip--on' : ''}`} onClick={() => setMinutes(m)}>{m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}`.replace('1.5 hrs', '1½ hrs') : `${m} min`}</button>
            ))}
          </div>
          <button className="btn btn--amber btn--block" disabled={busy || !course} onClick={() => void start()}>
            {busy ? 'Starting…' : mode === 'online' ? 'Start online class' : 'Start attendance'}
          </button>
        </Card>
      )}

      {reg && reg.present.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <Label>Present ({reg.present.length})</Label>
          <ListCard style={{ marginTop: 8 }}>
            {reg.present.map((p) => (
              <ListRow
                key={p.studentId}
                title={p.name}
                leading={p.photo ? <img src={p.photo} alt="" width={40} height={40} loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 9999, objectFit: 'cover', display: 'block' }} /> : undefined}
                sub={p.matric || undefined}
                right={<span className="t-13 muted">{new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              />
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}
