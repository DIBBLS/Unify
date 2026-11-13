import { useEffect, useState } from 'react';
import { useSchool } from '../lib/school';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import Drop from '../components/Drop';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// L01–L06: a short first-time setup for lecturers, in the app's usual look.
// Welcome → department → courses → how students see your name → all set.
// (The lecturer role itself is given by Unify; nobody picks it.)
const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, marginTop: 6 };

export default function LecturerWelcomeRoute() {
  const school = useSchool();
  const DEPARTMENTS = school.departments.map((d) => d.name);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dept, setDept] = useState('');
  const [name, setName] = useState('');
  const [courses, setCourses] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then((m) => { setDept(m.profile?.department || ''); setName(m.profile?.first_name || ''); }).catch(() => {});
    api.teaching().then((r) => setCourses(r.courses)).catch(() => setCourses([]));
  }, []);

  const save = async (patch: Record<string, unknown>, next: number) => {
    setBusy(true);
    try { await api.updateMe(patch); setStep(next); }
    catch (e) { errorToast(e, 'save that'); }
    finally { setBusy(false); }
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  const total = 5;
  return (
    <div style={shell}>
      <BackButton to={ROUTES.lecturer} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }} aria-label={`Step ${step + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => <span key={i} style={{ flex: 1, height: 6, borderRadius: 9999, background: i <= step ? 'var(--u-green)' : 'var(--border)' }} />)}
      </div>

      {step === 0 && (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 10 }}>
            <BoxBoy pose="teaching" width={120} />
            <Label>Unify Learn for lecturers</Label>
            <Display size={26}>Send it once</Display>
            <ul className="t-15" style={{ margin: 0, paddingLeft: 20, textAlign: 'left', lineHeight: 1.6 }}>
              <li>Share slides and notes once; every student taking the course gets them</li>
              <li>Take attendance by scanning students' passes</li>
              <li>Post to everyone taking your course</li>
              <li>See how the class is doing, counts only, never names</li>
            </ul>
          </Card>
          <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => setStep(1)}>Set up</button>
        </>
      )}

      {step === 1 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>Your department</Display>
          <Drop value={dept} onChange={setDept} label="Pick your department" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} style={{ width: '100%' }} />
          <button className="btn btn--amber btn--block" disabled={busy || !dept} onClick={() => void save({ department: dept, faculty: school.facultyOf(dept) || 'Faculty of Engineering', university: 'Lagos State University' }, 2)}>{busy ? 'Saving…' : 'Next'}</button>
        </Card>
      )}

      {step === 2 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>Your courses</Display>
          {courses === null ? (
            <div className="t-13 muted">Loading…</div>
          ) : courses.length ? (
            <>
              <div className="t-13 muted">Unify has you down for these. Something missing? Tell the Unify team from Me → Help.</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{courses.map((c) => <span key={c} className="pill pill--good">{c}</span>)}</div>
            </>
          ) : (
            <div className="t-13 muted">No courses yet. The Unify team assigns them; tell them which you teach from Me → Help and they'll show up here.</div>
          )}
          <button className="btn btn--amber btn--block" onClick={() => setStep(3)}>Next</button>
        </Card>
      )}

      {step === 3 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>How students see you</Display>
          <div className="t-13 muted">On course pages, posts and the timetable. For example "Dr Yussuf" or "Engr. Bello".</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr Yussuf" maxLength={60} style={field} />
          <button className="btn btn--amber btn--block" disabled={busy || name.trim().length < 2} onClick={() => void save({ firstName: name.trim() }, 4)}>{busy ? 'Saving…' : 'Next'}</button>
        </Card>
      )}

      {step === 4 && (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 10 }}>
            <BoxBoy pose="cheer" width={130} />
            <Display size={26}>You're all set</Display>
            <div className="t-15">Your class rep sets the timetable. When your class is on, Classroom shows it with a button to take attendance.</div>
          </Card>
          <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => navigate(ROUTES.lecturer)}>Go to Classroom</button>
          {courses && courses[0] && <Link to={`/lecturer/course/${encodeURIComponent(courses[0])}`} className="btn btn--white btn--block" style={{ marginTop: 10 }}>Open {courses[0]}</Link>}
        </>
      )}
    </div>
  );
}
