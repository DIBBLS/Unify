import { FormSkeleton } from '../components/Skeletons';
import { StepBars } from '../components/redesign/ui';
import { toastError } from '../lib/toast';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type University } from '../lib/api';
import Loading from '../components/Loading';
import { BoxBoy } from '../components/redesign/brand';
import Typewriter from '../components/Typewriter';
import { localGreeting } from '../lib/naija';
import Flash from '../components/Flash';
import { describeError } from '../lib/errors';

type Uni = { id: string; name: string; shortName?: string };
type Role = 'student' | 'lecturer' | 'contributor' | 'admin';

// Fallback so onboarding never dead-ends when the backend has no universities yet.
const FALLBACK_UNIS: Uni[] = [{ id: 'lasu', name: 'Lagos State University', shortName: 'LASU' }];

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const isEdit = new URLSearchParams(window.location.search).get('edit') === '1';
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  // Read from the profile only. Nobody picks a role: staff are granted server-side.
  const [role, setRole] = useState<Role | null>(null);
  const [universities, setUniversities] = useState<Uni[]>([]);
  const [firstName, setFirstName] = useState('');
  const [university, setUniversity] = useState<Uni | null>(null);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [gradTarget, setGradTarget] = useState<number | null>(null);
  const daypart = localGreeting().text;
  const [activeSemester, setActiveSemester] = useState('First Semester');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<{ code: string; title: string }[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        navigate('/auth');
        return;
      }
      try {
        const { onboarded, profile } = await api.me();
        if (onboarded && profile && !isEdit) {
          navigate('/home');
          return;
        }
        if (profile?.first_name) setFirstName(profile.first_name);
        else {
          // OAuth signups (Google) carry the name in auth metadata —
          // prefill so the first step is already done.
          const meta = sessionData.session?.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
          const full = typeof meta?.full_name === 'string' ? meta.full_name : typeof meta?.name === 'string' ? meta.name : '';
          if (full.trim()) setFirstName(full.trim().split(/\s+/)[0].slice(0, 60));
        }
        if (profile?.role === 'student' || profile?.role === 'lecturer' || profile?.role === 'contributor' || profile?.role === 'admin') {
          setRole(profile.role);
        }
        let list: Uni[] = [];
        try {
          const unis = await api.universities();
          list = unis.map((u: University) => ({ id: u.id, name: u.name, shortName: u.short_name }));
        } catch {
          list = [];
        }
        if (!list.length) list = FALLBACK_UNIS;
        try {
          const s = await api.settings();
          if (s.currentSemester) setActiveSemester(s.currentSemester);
        } catch {
          // default active semester stands
        }
        setUniversities(list);
        if (profile?.university) {
          const match = list.find((u) => u.name === profile.university);
          if (match) setUniversity(match);
        }
        if (profile?.faculty) setFaculty(profile.faculty);
        if (profile?.department) setDepartment(profile.department);
        if (profile?.level) setLevel(profile.level);
        if (typeof profile?.grad_target === 'number') setGradTarget(profile.grad_target);
      } catch {
        setUniversities(FALLBACK_UNIS);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const faculties = [{ name: 'Faculty of Engineering', sub: '6 departments' }];
  const departments = [
    { name: 'Electronic & Computer Engineering', sub: 'ECE' },
    { name: 'Mechanical Engineering', sub: 'MEE' },
    { name: 'Industrial & Petroleum Engineering', sub: 'IPE' },
    { name: 'Chemical & Polymer Engineering', sub: 'CPE' },
    { name: 'Civil Engineering', sub: 'CVE' },
    { name: 'Aerospace Engineering', sub: 'ASE' },
  ];
  const levels = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];

  const save = async (skipTarget = false, overrides: Record<string, unknown> = {}) => {
    setError('');
    setLoading(true);
    try {
      // Staff level and courses are the admin's job, never self-picked.
      const staffSetup = !isEdit && (role === 'lecturer' || role === 'contributor');
      const payload: Record<string, unknown> = {
        firstName,
        university: university?.name,
        faculty,
        department,
        level: staffSetup ? null : level,
        semester: activeSemester,
        courses: staffSetup ? [] : selectedCourses,
        ...overrides,
      };
      if (university?.id && UUID_RE.test(university.id)) payload.universityId = university.id;
      if (!skipTarget && gradTarget) payload.gradTarget = gradTarget;
      await api.onboarding(payload);
      navigate('/home');
    } catch (err) {
      setError(describeError(err, 'finish that'));
      setLoading(false);
    }
  };

  // Courses step is students-only now: staff levels + courses are assigned
  // by admins on approval, never self-picked during onboarding.
  useEffect(() => {
    const showCourses = step === 6 && (role === 'student' || !role);
    if (!showCourses || !level) {
      if (showCourses) setAvailableCourses([]);
      return;
    }
    let cancelled = false;
    setCoursesLoading(true);
    api
      .courses(level, activeSemester)
      .then((list) => {
        if (!cancelled) setAvailableCourses(list.map((c) => ({ code: c.code, title: c.title })));
      })
      .catch(() => {
        if (!cancelled) setAvailableCourses([]);
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, role, level, activeSemester]);

  const toggleCourse = (code: string) =>
    setSelectedCourses((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));

  const semesterNote = (
    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
      Active semester: <strong>{activeSemester}</strong> (set by admin)
    </div>
  );

  const courseList = coursesLoading ? (
    <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', padding: 12 }}>Loading courses…</div>
  ) : availableCourses.length === 0 ? (
    <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', padding: 12 }}>No courses found for this level and semester yet.</div>
  ) : (
    availableCourses.map((c) => {
      const on = selectedCourses.includes(c.code);
      return (
        <button
          key={c.code}
          onClick={() => toggleCourse(c.code)}
          style={{ padding: 12, border: `1px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, borderRadius: 12, background: on ? 'var(--u-good-tint)' : 'var(--surface)', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-amber)' : 'var(--surface)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
            {on ? '✓' : ''}
          </span>
          <span>
            <span style={{ fontWeight: 700, display: 'block', fontSize: 14 }}>{c.code}</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.title}</span>
          </span>
        </button>
      );
    })
  );

  if (loading) return <FormSkeleton />;

  const STEP_TITLES = [
    "What's your first name?",
    'Where are you studying?',
    "What's your faculty?",
    'Which department?',
    'What level are you in?',
    'Which courses are you taking?',
    "What's your graduation target?",
  ];
  // Steps run from 1. Students get 7 (name, uni, faculty, dept, level,
  // courses, target); staff stop after 4 (name, uni, faculty, dept).
  const totalSteps = role === 'student' || !role ? 7 : 4;
  const shownStep = Math.min(step, totalSteps);
  const left = { s: `Step ${shownStep} of ${totalSteps}`, t: STEP_TITLES[shownStep - 1] };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', minHeight: '100vh', background: 'var(--u-page)' }}>
      <div className="african-band" style={{ background: 'var(--u-green)', color: 'var(--u-black)', padding: '20px 20px 24px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ opacity: 0.7 }}>{left.s}</div>
            <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, marginTop: 6, minHeight: 76 }}>
              <Typewriter key={step} text={left.t} speed={30} />
            </h1>
          </div>
          <BoxBoy pose="peeking" width={84} />
        </div>
        <div style={{ marginTop: 12 }}>
          <StepBars step={shownStep} total={totalSteps} />
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <BoxBoy pose="wavePhone" width={88} />
            </div>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Joshua" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, fontSize: 16 }} />
            {firstName && <div style={{ fontSize: 14 }}>{daypart}, <strong>{firstName}</strong></div>}
            <button onClick={() => { if (!firstName.trim()) return; if (isEdit) { void save(false); return; } setStep(2); }} style={{ padding: 14, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {isEdit ? (<>Finish setup <ArrowRight size={18} /></>) : (<>Continue <ArrowRight size={18} /></>)}
            </button>
          </>
        )}
        {step === 2 && (
          <>
            {universities.map((u) => (
              <button key={u.id} onClick={() => { setUniversity(u); setStep(3); }} style={{ padding: 14, border: `1px solid ${university?.id === u.id ? 'var(--u-amber)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface)', textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{u.shortName}</div>
              </button>
            ))}
          </>
        )}
        {step === 3 && faculties.map((f) => (
          <button key={f.name} onClick={() => { setFaculty(f.name); setStep(4); }} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', textAlign: 'left' }}>{f.name}</button>
        ))}
        {step === 4 && departments.map((d) => (
          <button key={d.name} onClick={() => { setDepartment(d.name); if (role === 'lecturer' || role === 'contributor') { void save(false, { department: d.name }); return; } setStep(5); }} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', textAlign: 'left' }}>
            {d.name} <span style={{ color: 'var(--text2)', fontSize: 12 }}>{d.sub}</span>
          </button>
        ))}
        {step === 5 && (role === 'student' || !role) && levels.map((l) => (
          <button key={l} onClick={() => { setLevel(l); setStep(6); }} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: level === l ? 'var(--u-good-tint)' : 'var(--surface)' }}>{l}</button>
        ))}
        {step === 6 && (role === 'student' || !role) && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Level: <strong>{level || '—'}</strong></div>
            {semesterNote}
            {courseList}
            <button onClick={() => setStep(7)} style={{ padding: 14, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
              Continue <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === 7 && (
          <>
            {[
              { label: 'First Class', val: 4.5 },
              { label: '2nd Class Upper', val: 3.5 },
              { label: '2nd Class Lower', val: 2.4 },
              { label: 'Third Class', val: 1.5 },
              { label: 'Pass', val: 1.0 },
            ].map((t) => (
              <button key={t.label} onClick={() => setGradTarget(t.val)} style={{ padding: 14, border: `1px solid ${gradTarget === t.val ? 'var(--u-amber)' : 'var(--border)'}`, borderRadius: 12, background: gradTarget === t.val ? 'var(--u-good-tint)' : 'var(--surface)' }}>
                {t.label} — {t.val}
              </button>
            ))}
            <button onClick={() => save(false)} style={{ padding: 14, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
              Finish setup <ArrowRight size={18} />
            </button>
            <button onClick={() => save(true)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13 }}>
              Skip for now
            </button>
          </>
        )}
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ background: 'none', border: 'none', color: 'var(--text2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <ChevronLeft size={16} /> Back
          </button>
        )}
      </div>
    </div>
  );
}

