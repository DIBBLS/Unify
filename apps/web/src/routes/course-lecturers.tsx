import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { DetailSkeleton } from '../components/Skeletons';
import { api, type CourseLecturers } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import { toastSuccess } from '../lib/toast';

// Review 3 (C10): the class rep sets how many lecturers teach a course, their
// names and the weeks each one teaches, and moves the weeks when a lecturer
// starts late. Students see them on the course page. A name links to the
// lecturer's profile once they're on Unify Learn and teach the course.
type Row = { name: string; weekFrom: number; weekTo: number };
const WEEKS = 12;

// Split the weeks evenly: 3 lecturers -> 1-4, 5-8, 9-12.
function spread(rows: Row[], n: number): Row[] {
  const size = Math.floor(WEEKS / n);
  return Array.from({ length: n }, (_, i) => ({
    name: rows[i]?.name || '',
    weekFrom: i * size + 1,
    weekTo: i === n - 1 ? WEEKS : (i + 1) * size,
  }));
}

export default function CourseLecturersRoute() {
  const { courseCode = '' } = useParams();
  const course = courseCode.trim();
  const navigate = useNavigate();
  const [data, setData] = useState<CourseLecturers | null>(null);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [intro, setIntro] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.courseLecturers(course)
      .then((d) => {
        setData(d);
        setIntro(d.intro || '');
        const start: Row[] = d.lecturers.map((l) => ({ name: l.name, weekFrom: l.weekFrom ?? 1, weekTo: l.weekTo ?? WEEKS }));
        setRows(d.set ? start : spread(start.length ? start : [{ name: '', weekFrom: 1, weekTo: WEEKS }], Math.max(1, Math.min(4, start.length))));
      })
      .catch((e) => setErr(describeError(e, 'load the lecturers')));
  }, [course]);

  if (err) return <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px' }}><BackButton to={ROUTES.course(course)} /><p className="t-15">{err}</p></div>;
  if (!data) return <DetailSkeleton />;
  if (!data.canEdit)
    return (
      <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px' }}>
        <BackButton to={ROUTES.course(course)} />
        <p className="t-15">Only the class rep for {course} can set its lecturers.</p>
      </div>
    );

  const setCount = (n: number) => setRows((r) => spread(r, n));
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const onApp = (name: string) => {
    const s = (n: string) => n.replace(/^((prof|dr|engr|mr|mrs|ms)\.?\s+)+/i, '').split(/[\s.]+/).filter(Boolean).slice(-1)[0]?.toLowerCase() || '';
    return data.onApp.some((a) => s(a.name) === s(name));
  };
  const bad = rows.find((r) => r.name.trim().length < 2) ? 'Add each lecturer\'s name.' : rows.find((r) => r.weekTo < r.weekFrom) ? 'A lecturer\'s last week can\'t be before their first.' : '';

  const save = async () => {
    if (bad) return errorToast(new Error(bad), 'save');
    setSaving(true);
    try {
      await api.saveCourseLecturers(course, { intro, lecturers: rows.map((r) => ({ name: r.name.trim(), weekFrom: r.weekFrom, weekTo: r.weekTo })) });
      toastSuccess(`Saved. Everyone in ${course} sees the lecturers on the course page.`);
      navigate(ROUTES.course(course), { replace: true });
    } catch (e) {
      errorToast(e, 'save the lecturers');
    } finally {
      setSaving(false);
    }
  };

  const select: React.CSSProperties = { padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14 };
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 120px' }}>
      <BackButton to={ROUTES.course(course)} />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24 }}>{course} lecturers</h1>
      <p className="t-13 muted" style={{ marginTop: 6 }}>How many lecturers teach this course? Students see their names on the course page. Lecturers confirm it when they join.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => setCount(n)} aria-pressed={rows.length === n} style={{ width: 44, height: 44, borderRadius: 9999, border: `1px solid ${rows.length === n ? 'var(--u-black)' : 'var(--border)'}`, background: rows.length === n ? 'var(--u-black)' : 'var(--surface)', color: rows.length === n ? '#fff' : 'var(--text)', fontWeight: 800, fontSize: 15 }}>{n}</button>
        ))}
      </div>
      <datalist id="lecturer-names">
        {data.onApp.map((a) => <option key={a.id} value={a.name} />)}
      </datalist>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {rows.map((r, i) => {
          const joined = r.name.trim().length >= 2 && onApp(r.name);
          return (
            <div key={i} style={{ padding: 14, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <label className="t-12 muted" htmlFor={`lect-${i}`}>Lecturer {i + 1}</label>
              <input id={`lect-${i}`} list="lecturer-names" value={r.name} onChange={(e) => update(i, { name: e.target.value.slice(0, 80) })} placeholder="e.g. Dr. O. Adeyemi" style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 15, fontWeight: 700 }} />
              <div className="t-12" style={{ marginTop: 4, color: joined ? 'var(--u-good)' : 'var(--text3)' }}>{r.name.trim().length < 2 ? ' ' : joined ? 'On Unify Learn · teaches this course' : 'Not on Unify Learn yet · name only'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <span className="t-13 muted">Weeks</span>
                <select aria-label={`Lecturer ${i + 1} first week`} value={r.weekFrom} onChange={(e) => update(i, { weekFrom: Number(e.target.value) })} style={select}>
                  {Array.from({ length: WEEKS }, (_, k) => k + 1).map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <span className="t-13 muted">to</span>
                <select aria-label={`Lecturer ${i + 1} last week`} value={r.weekTo} onChange={(e) => update(i, { weekTo: Number(e.target.value) })} style={select}>
                  {Array.from({ length: WEEKS }, (_, k) => k + 1).map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <div className="t-13" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--u-warn-tint)', border: '1px solid var(--u-amber)', color: 'var(--u-warn-ink)' }}>
        Lecturer started late? Move their weeks here. The course page updates for everyone.
      </div>
      <label className="t-13 w-7" htmlFor="course-intro" style={{ display: 'block', marginTop: 18 }}>About this course (optional)</label>
      <textarea id="course-intro" value={intro} onChange={(e) => setIntro(e.target.value.slice(0, 600))} rows={3} placeholder="Two or three lines on what the course covers." style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
      <div className="t-12 muted" style={{ marginTop: 4 }}>Shows under the course title. {600 - intro.length} characters left.</div>
      <button className="btn btn--amber btn--block" disabled={saving} onClick={() => void save()} style={{ marginTop: 18 }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  );
}
