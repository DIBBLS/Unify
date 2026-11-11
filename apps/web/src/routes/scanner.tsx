import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Video } from 'lucide-react';
import { api, type AttendanceRegister, type AttendanceSession, type ScanResult } from '../lib/api';
import { errorToast, describeError } from '../lib/errors';
import { startQrScan } from '../lib/qrscan';
import { resolvePicture } from '../lib/picture';
import { toastSuccess } from '../lib/toast';
import MeetLinkField from '../components/MeetLinkField';
import { isHttpsLink } from '../lib/meet';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import Drop from '../components/Drop';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard, ListRow, Pill } from '../components/redesign/ui';

// Take attendance (lecturer or class rep): open a session for a course, then
// scan each student's pass (My pass in their app). A student with a dead phone
// is typed in by matric number. Online classes share a 6-digit code in the
// meeting chat instead. Route kept at /attendance/scanner so links keep working.
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
  // From the course page: which week and which class (timetable slot or extra),
  // or one past register to look at (?session=).
  const wantCourse = (params.get('course') || '').toUpperCase();
  const week = Number(params.get('week')) || undefined;
  const which = params.get('extra') === '1' ? { extra: true } : params.get('slot') ? { slotId: params.get('slot') as string } : undefined;
  const [viewSession, setViewSession] = useState(params.get('session') || '');

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const isHoc = !!(me.profile as unknown as { is_hoc?: boolean } | null)?.is_hoc;
        const taught = me.isAdmin ? (await api.courses()).map((c) => c.code) : (await api.teaching()).courses;
        // Class reps can also run attendance for the courses they take.
        const list = [...new Set([...taught, ...(isHoc ? (me.courses || []).map((x) => String(x)) : [])])];
        setCourses(list);
        const norm = (c: string) => c.replace(/\s/g, '').toUpperCase();
        const pick = wantCourse ? list.find((c) => norm(c) === norm(wantCourse)) : undefined;
        if (pick || list[0]) setCourse(pick || list[0]);
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
      setReg(await api.attendanceRegister(course, viewSession || undefined));
    } catch (e) {
      errorToast(e, 'load the register');
    }
  }, [course, viewSession]);

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
    try {
      setViewSession('');
      setReg(await api.attendanceStart(course, week, minutes, mode === 'online' ? { meetLink } : undefined, which));
    }
    catch (e) { errorToast(e, 'start attendance'); }
    finally { setBusy(false); }
  };
  const extend = async () => {
    if (!reg?.session) return;
    setBusy(true);
    try { await api.attendanceExtend(reg.session.id, 30); toastSuccess('Added 30 minutes.'); await refresh(); }
    catch (e) { errorToast(e, 'add time'); }
    finally { setBusy(false); }
  };
  const end = async () => {
    if (!reg?.session) return;
    setBusy(true);
    try { await api.attendanceClose(reg.session.id); await refresh(); }
    catch (e) { errorToast(e, 'end the session'); }
    finally { setBusy(false); }
  };

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    if (!reg?.session) return;
    setExporting(true);
    try { await api.attendanceExport(reg.session.id, reg.session.course); }
    catch (e) { errorToast(e, 'download the register'); }
    finally { setExporting(false); }
  };
  // With a class list the register counts against it; without one, against enrolled students.
  const expected = reg?.listed ?? reg?.enrolled ?? 0;
  const ofWhat = reg?.listed != null ? 'on the class list' : 'enrolled';

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
        <Drop label="Course" value={course} onChange={(c) => { setViewSession(''); setCourse(c); }} options={courses.map((c) => ({ value: c, label: c }))} />
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
            <div className="t-13" style={{ opacity: 0.75 }}>Students open My pass in Unify, tap "Online class? Enter the code" and type it. New code in {Math.max(1, Math.ceil(rotateIn / 60))} min.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
              <button
                className="btn btn--amber btn--sm"
                onClick={() => {
                  const msg = `Unify attendance code for ${reg.session?.course}: ${reg.session?.code}. Open Unify, tap My pass, then "Online class? Enter the code" and type this code. It works for the next ${Math.max(1, Math.ceil(rotateIn / 60))} minutes.`;
                  void navigator.clipboard.writeText(msg).then(() => toastSuccess('Copied. Paste it in the meeting chat.')).catch(() => errorToast(new Error('Copying was blocked. Select the code and copy it yourself.'), 'copy the code'));
                }}
              >
                <Copy size={14} /> Copy message for the chat
              </button>
              {meetLink && <a className="btn btn--white btn--sm" href={meetLink} target="_blank" rel="noopener noreferrer"><Video size={14} /> Open the meeting</a>}
            </div>
            <Pill tone="amber">Closes in {mm}:{ss}</Pill>
            <div className="t-15" style={{ marginTop: 6 }}>{reg.present.length} of {expected} {ofWhat} present</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {/* L19: lectures overrun; add time without starting a new register. */}
              <button className="btn btn--white" disabled={busy} onClick={() => void extend()}>Add 30 min</button>
              <button className="btn btn--white" disabled={busy} onClick={() => void end()}>End class</button>
            </div>
          </Card>
        ) : (
          <PassScanner
            session={reg.session}
            presentCount={reg.present.length}
            enrolled={expected}
            ofWhat={ofWhat}
            closesIn={`${mm}:${ss}`}
            busy={busy}
            onEnd={() => void end()}
            onMarked={() => void refresh()}
          />
        )
      ) : (
        <Card style={{ marginTop: 16, gap: 14 }}>
          {reg?.session && (
            <div className="t-13 muted">
              {viewSession ? 'This register' : 'Last session'}
              {reg.session.week ? ` (Week ${reg.session.week}${reg.session.label ? ` · ${reg.session.label}` : ''}, ${new Date(reg.session.opensAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})` : ''}: {reg.present.length} of {expected} {ofWhat} present.
            </div>
          )}
          {(week || which) && (
            <div className="t-13 w-6">
              New register for {week ? `Week ${week}` : 'this class'}{which && 'extra' in which ? ' · Extra class' : which ? ' · the class you picked on the course page' : ''}
            </div>
          )}
          {reg && reg.listed == null && (
            <div className="t-12 muted">No class list for this course yet. Once your class rep uploads one, the register shows who's absent and checks typed matric numbers against it.</div>
          )}
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

      {reg?.session && (reg.present.length > 0 || reg.absent.length > 0) && (
        <button className="btn btn--white btn--block" disabled={exporting} onClick={() => void exportCsv()} style={{ marginTop: 16 }}>
          {exporting ? 'Preparing…' : 'Download register (CSV)'}
        </button>
      )}

      {reg && reg.present.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <Label>Present ({reg.present.length})</Label>
          <ListCard style={{ marginTop: 8 }}>
            {reg.present.map((p, i) => {
              const pic = resolvePicture({ avatar_url: p.avatar, box_boy_persona: p.persona });
              const how = p.method === 'typed' ? `Typed in${p.by ? ` by ${p.by}` : ''}` : p.method === 'scan' ? `Scanned${p.by ? ` by ${p.by}` : ''}` : 'Online code';
              return (
                <ListRow
                  key={p.entryId || p.studentId || i}
                  title={p.name}
                  leading={pic.kind !== 'none' ? <img src={pic.src} alt="" width={40} height={40} loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 9999, objectFit: 'cover', display: 'block' }} /> : undefined}
                  sub={[p.matric, how, p.onList === false ? 'Not on the class list' : ''].filter(Boolean).join(' · ')}
                  right={<span className="t-13 muted">{new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                />
              );
            })}
          </ListCard>
        </section>
      )}

      {reg?.session && reg.absent.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <Label>{reg.session.open ? 'Not marked yet' : 'Absent'} ({reg.absent.length})</Label>
          <ListCard style={{ marginTop: 8 }}>
            {reg.absent.map((a) => (
              <ListRow key={a.entryId} title={a.name} sub={[a.matric, a.joined ? (a.notTaking ? `Hasn't added ${reg.session?.course || 'this course'} on Unify` : '') : 'Not on Unify yet'].filter(Boolean).join(' · ')} />
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}

const STATUS = {
  marked: { text: 'Marked present', color: 'var(--u-green)' },
  already: { text: 'Already scanned', color: 'var(--u-amber)' },
  not_enrolled: { text: 'Not taking this course', color: 'var(--u-red, #dc2626)' },
  not_on_list: { text: 'Not on this class list', color: 'var(--u-red, #dc2626)' },
} as const;

// The camera reads students' passes; each read marks them and shows who it was.
function PassScanner({ session, presentCount, enrolled, ofWhat, closesIn, busy, onEnd, onMarked }: {
  session: AttendanceSession;
  presentCount: number;
  enrolled: number;
  ofWhat: string;
  closesIn: string;
  busy: boolean;
  onEnd: () => void;
  onMarked: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camErr, setCamErr] = useState('');
  const [msg, setMsg] = useState('');
  // Several passes can be in view at once: each is sent on its own, and the
  // latest five results stack up (newest first).
  const [results, setResults] = useState<(ScanResult & { key: number })[]>([]);
  const [matric, setMatric] = useState('');
  const [typing, setTyping] = useState(false);
  const inFlight = useRef(new Set<string>());
  // Student id -> when we last heard back about them: the camera sees the same pass
  // many times a second, and the pass changes every 30 s, so dedupe by student.
  const done = useRef(new Map<string, number>());
  const keyRef = useRef(0);
  const onMarkedRef = useRef(onMarked);
  onMarkedRef.current = onMarked;

  const send = useCallback(async (input: { token: string } | { matric: string }) => {
    const id = 'token' in input ? input.token.split('.')[1] || input.token : `m:${input.matric}`;
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    try {
      const r = await api.attendanceScan(session.id, input);
      done.current.set(id, Date.now());
      setResults((rs) => [{ ...r, key: ++keyRef.current }, ...rs].slice(0, 5));
      setMsg('');
      try { navigator.vibrate?.(r.status === 'marked' ? 60 : [40, 60, 40]); } catch { /* optional */ }
      if (r.status === 'marked') onMarkedRef.current();
      // Keep a typed number that isn't on the list in the box, so a typo is easy to fix.
      return r.status !== 'not_on_list';
    } catch (e) {
      // A bad or expired pass would otherwise be retried on every frame; pause it briefly.
      if ('token' in input) done.current.set(id, Date.now() - 15000);
      setMsg(describeError(e, 'mark that student'));
      return false;
    } finally {
      inFlight.current.delete(id);
    }
  }, [session.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    let handle: { stop: () => void } | null = null;
    let gone = false;
    void startQrScan(
      videoRef.current,
      (text) => {
        // The camera reads the same pass several times a second: act once per student.
        const id = text.split('.')[1] || text;
        const at = done.current.get(id);
        if (at && Date.now() - at < 20000) return;
        void send({ token: text });
      },
      (m) => setCamErr(m),
    ).then((h) => { if (gone) h.stop(); else handle = h; });
    return () => { gone = true; handle?.stop(); };
  }, [send]);

  const typeIn = async () => {
    const m = matric.trim();
    if (m.length < 3) return;
    setTyping(true);
    if (await send({ matric: m })) setMatric('');
    setTyping(false);
  };

  return (
    <Card tone="dark" style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 10 }}>
      {session.startedBy && (
        <Pill tone="amber">{session.startedBy.mine ? 'You started this' : `Started by ${session.startedBy.name}${session.startedBy.role ? ` (${session.startedBy.role})` : ''}`} · shared live</Pill>
      )}
      <div className="eyebrow" style={{ opacity: 0.7 }}>Scan passes: up to 5 at once</div>
      {camErr ? (
        <div className="t-13" style={{ color: 'var(--u-red, #dc2626)', maxWidth: 320 }}>{camErr}</div>
      ) : (
        <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1 / 1', borderRadius: 18, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} aria-label="Camera" />
          <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /><span className="scan-line" /></div>
        </div>
      )}
      <div role="status" aria-live="polite" style={{ width: '100%', maxWidth: 320, minHeight: 64, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(msg || !results.length) && (
          <div className="t-13" style={{ color: msg ? 'var(--u-red, #dc2626)' : undefined, opacity: msg ? 1 : 0.7 }}>
            {msg || 'Students open My pass in Unify and hold it up to your camera. A few can hold theirs up together.'}
          </div>
        )}
        {results.map((r, i) => {
          const st = STATUS[r.status];
          const pic = resolvePicture({ avatar_url: r.student.avatar, box_boy_persona: r.student.persona });
          const size = i === 0 ? 48 : 36;
          return (
            <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: i === 0 ? 10 : 7, borderRadius: 14, border: `2px solid ${st.color}`, background: 'rgba(255,255,255,0.04)', opacity: i === 0 ? 1 : 0.85 }}>
              {pic.kind !== 'none' ? (
                <img src={pic.src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <BoxBoy pose="phoneOut" width={size} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className={i === 0 ? 't-15 w-6' : 't-13 w-6'}>{r.status === 'not_on_list' ? r.student.matric : r.student.name}</div>
                {i === 0 && (
                  <div className="t-12" style={{ opacity: 0.75 }}>
                    {r.status === 'not_on_list'
                      ? 'Check the number. If they belong here, the class rep can add them to the class list.'
                      : [r.student.matric, r.student.level, r.student.department].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className={i === 0 ? 't-13 w-6' : 't-12 w-6'} style={{ color: st.color }}>
                  {r.status === 'not_enrolled' ? `Not taking ${r.course}` : st.text}{r.status === 'marked' && r.method === 'typed' ? ' (typed in)' : ''}
                </div>
                {r.status === 'marked' && r.onList === false && (
                  <div className="t-12" style={{ color: 'var(--u-amber)' }}>Not on the class list (carryover or not added yet)</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
        <input
          value={matric}
          onChange={(e) => setMatric(e.target.value.toUpperCase().slice(0, 30))}
          onKeyDown={(e) => { if (e.key === 'Enter') void typeIn(); }}
          placeholder="Phone dead? Matric no."
          aria-label="Matric number"
          autoCapitalize="characters"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: 'inherit', fontSize: 14 }}
        />
        <button className="btn btn--amber btn--sm" disabled={typing || matric.trim().length < 3} onClick={() => void typeIn()}>
          {typing ? 'Adding…' : 'Type in'}
        </button>
      </div>
      <Pill tone="amber">Closes in {closesIn}</Pill>
      <div className="t-15" style={{ marginTop: 2 }}>{presentCount} of {enrolled} {ofWhat} present</div>
      <button className="btn btn--white" disabled={busy} onClick={onEnd} style={{ marginTop: 6 }}>End session</button>
    </Card>
  );
}
