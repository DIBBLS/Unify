import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type SchoolGuide } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import Drop from '../../components/Drop';

// Admin → Student guide (S44): the school's step-by-step. Students read it
// from Me → Guide; saving moves it to the front of their Home carousel.
type Step = SchoolGuide['steps'][number];
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 } as const;
const field: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 };
const blank: Step = { title: '', body: '', where: '' };

// Admin → Class reps: open any class's Contributors view (S56).
const DEPARTMENTS = ['Electronic & Computer Engineering', 'Mechanical Engineering', 'Industrial & Petroleum Engineering', 'Chemical & Polymer Engineering', 'Civil Engineering', 'Aerospace Engineering'];
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
export function ClassContributorsPicker() {
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [level, setLevel] = useState(LEVELS[1]);
  return (
    <div style={{ ...card, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Contributors by class</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>Who is writing a class's courses, and which courses are behind the semester.</div>
      <Drop value={department} onChange={setDepartment} label="Department" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} style={{ width: '100%' }} />
      <Drop value={level} onChange={setLevel} label="Level" options={LEVELS.map((l) => ({ value: l, label: l }))} style={{ width: '100%' }} />
      <Link to={`/class/contributors?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}`} className="btn btn--white btn--sm" style={{ alignSelf: 'flex-start' }}>Open</Link>
    </div>
  );
}

export default function GuidePanel() {
  const [title, setTitle] = useState('Course registration');
  const [intro, setIntro] = useState('');
  const [steps, setSteps] = useState<Step[]>([blank]);
  const [published, setPublished] = useState(true);
  const [updated, setUpdated] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.guide().then((r) => {
      if (!r.guide) return;
      setTitle(r.guide.title);
      setIntro(r.guide.intro);
      setSteps(r.guide.steps.length ? r.guide.steps : [blank]);
      setPublished(r.guide.published);
      setUpdated(r.guide.updated_at);
    }).catch(() => {});
  }, []);

  const set = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((s) => {
    const j = i + d;
    if (j < 0 || j >= s.length) return s;
    const n = [...s];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const save = async () => {
    const clean = steps.map((s) => ({ title: s.title.trim(), body: s.body.trim(), where: s.where.trim() })).filter((s) => s.title);
    if (!clean.length) return errorToast(new Error('Add at least one step with a title.'), 'save the guide');
    setBusy(true);
    try {
      const r = await api.guideSave({ title: title.trim(), intro: intro.trim(), steps: clean, published });
      setUpdated(r.updated_at);
      setSteps(clean);
      toastSuccess(published ? 'Guide saved. Students see it on Home and in Me → Guide.' : 'Saved as a draft. Students won’t see it until you publish.');
    } catch (e) {
      errorToast(e, 'save the guide');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        LASU's step-by-step for students: course registration, fees, the course form. Students tick steps off as they go.
        {updated && <> Last saved {new Date(updated).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. </>}
        <Link to="/guide" style={{ color: 'var(--u-good)', fontWeight: 700 }}>See it as a student</Link>
      </div>
      <div style={card}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginTop: 10 }}>A line under the title<textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={600} rows={2} style={field} /></label>
      </div>
      {steps.map((s, i) => (
        <div key={i} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, flex: 1 }}>Step {i + 1}</span>
            <button aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} style={{ display: 'flex', padding: 4, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={15} /></button>
            <button aria-label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)} style={{ display: 'flex', padding: 4, opacity: i === steps.length - 1 ? 0.3 : 1 }}><ArrowDown size={15} /></button>
            <button aria-label={`Remove step ${i + 1}`} disabled={steps.length === 1} onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} style={{ display: 'flex', padding: 4, color: 'var(--text3)' }}><X size={15} /></button>
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginTop: 6 }}>What to do<input value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Pay your school fees" maxLength={120} style={field} /></label>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginTop: 8 }}>Details<textarea value={s.body} onChange={(e) => set(i, { body: e.target.value })} placeholder="Keep the receipt. The portal won't open registration without it." maxLength={600} rows={2} style={field} /></label>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginTop: 8 }}>Where<input value={s.where} onChange={(e) => set(i, { where: e.target.value })} placeholder="Faculty office, ground floor" maxLength={120} style={field} /></label>
        </div>
      ))}
      {steps.length < 20 && (
        <button onClick={() => setSteps((s) => [...s, blank])} className="btn btn--white btn--block" style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Plus size={15} /> Add a step
        </button>
      )}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published (students can see it)
      </label>
      <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save guide'}</button>
    </div>
  );
}
