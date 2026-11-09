import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, type AttendanceRegister } from '../lib/api';
import { errorToast } from '../lib/errors';
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
  const [minutes, setMinutes] = useState(15);
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

  const start = async () => {
    setBusy(true);
    try { setReg(await api.attendanceStart(course, undefined, minutes)); }
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
      ) : (
        <Card style={{ marginTop: 16, gap: 14 }}>
          {reg?.session && <div className="t-13 muted">Last session: {reg.present.length} of {reg.enrolled} present.</div>}
          <Label>Open for</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MINUTES.map((m) => (
              <button key={m} className={`chip chip--sm${m === minutes ? ' chip--on' : ''}`} onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>
          <button className="btn btn--amber btn--block" disabled={busy || !course} onClick={() => void start()}>
            {busy ? 'Starting…' : 'Start attendance'}
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
