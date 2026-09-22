import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase';
import { api, type University } from '../lib/api';
import Loading from '../components/Loading';
import Mascot from '../components/Mascot';

type Uni = { id: string; name: string; shortName?: string };

// Fallback so onboarding never dead-ends when the backend has no universities yet.
const FALLBACK_UNIS: Uni[] = [{ id: 'lasu', name: 'Lagos State University', shortName: 'LASU' }];

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configError, setConfigError] = useState('');
  const [universities, setUniversities] = useState<Uni[]>([]);
  const [firstName, setFirstName] = useState('');
  const [university, setUniversity] = useState<Uni | null>(null);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [gradTarget, setGradTarget] = useState<number | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setConfigError('App is not configured yet (Supabase keys missing).');
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
        const isEdit = new URLSearchParams(window.location.search).get('edit') === '1';
        const { onboarded, profile } = await api.me();
        if (onboarded && profile && !isEdit) {
          navigate('/dashboard');
          return;
        }
        if (profile?.first_name) setFirstName(profile.first_name);
        let list: Uni[] = [];
        try {
          const unis = await api.universities();
          list = unis.map((u: University) => ({ id: u.id, name: u.name, shortName: u.short_name }));
        } catch {
          list = [];
        }
        if (!list.length) list = FALLBACK_UNIS;
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

  const save = async (skipTarget = false) => {
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        firstName,
        university: university?.name,
        faculty,
        department,
        level,
      };
      if (university?.id && UUID_RE.test(university.id)) payload.universityId = university.id;
      if (!skipTarget && gradTarget) payload.gradTarget = gradTarget;
      await api.onboarding(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (loading) return <Loading text="Loading onboarding…" />;

  const left = [
    { s: 'Step 1 of 6', t: "What's your first name?" },
    { s: 'Step 2 of 6', t: 'Where are you studying?' },
    { s: 'Step 3 of 6', t: "What's your faculty?" },
    { s: 'Step 4 of 6', t: 'Which department?' },
    { s: 'Step 5 of 6', t: 'What level are you in?' },
    { s: 'Step 6 of 6', t: "What's your graduation target?" },
  ][step];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#fff' }}>
      <div style={{ background: '#10b981', color: '#fff', padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.8 }}>{left.s}</div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28, marginTop: 6 }}>{left.t}</h1>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#fff' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {configError && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 10, color: '#9a3412', fontSize: 13 }}>{configError}</div>}
        {error && <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 12, padding: 10, color: '#cc0000', fontSize: 13 }}>{error}</div>}
        {step === 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <Mascot size={110} />
            </div>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Joshua" style={{ padding: 12, border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 16 }} />
            {firstName && <div style={{ fontSize: 14 }}>Good morning, <strong>{firstName}</strong></div>}
            <button onClick={() => firstName.trim() && setStep(1)} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              Continue <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === 1 && (
          <>
            {universities.map((u) => (
              <button key={u.id} onClick={() => { setUniversity(u); setStep(2); }} style={{ padding: 14, border: `1px solid ${university?.id === u.id ? '#10b981' : '#e5e5e5'}`, borderRadius: 12, background: '#fff', textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: '#777' }}>{u.shortName}</div>
              </button>
            ))}
          </>
        )}
        {step === 2 && faculties.map((f) => (
          <button key={f.name} onClick={() => { setFaculty(f.name); setStep(3); }} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff', textAlign: 'left' }}>{f.name}</button>
        ))}
        {step === 3 && departments.map((d) => (
          <button key={d.name} onClick={() => { setDepartment(d.name); setStep(4); }} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff', textAlign: 'left' }}>
            {d.name} <span style={{ color: '#777', fontSize: 12 }}>{d.sub}</span>
          </button>
        ))}
        {step === 4 && levels.map((l) => (
          <button key={l} onClick={() => { setLevel(l); setStep(5); }} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: level === l ? '#d1fae5' : '#fff' }}>{l}</button>
        ))}
        {step === 5 && (
          <>
            {[
              { label: 'First Class', val: 4.5 },
              { label: '2nd Class Upper', val: 3.5 },
              { label: '2nd Class Lower', val: 2.4 },
              { label: 'Pass', val: 1.5 },
            ].map((t) => (
              <button key={t.label} onClick={() => setGradTarget(t.val)} style={{ padding: 14, border: `1px solid ${gradTarget === t.val ? '#10b981' : '#e5e5e5'}`, borderRadius: 12, background: gradTarget === t.val ? '#d1fae5' : '#fff' }}>
                {t.label} — {t.val}
              </button>
            ))}
            <button onClick={() => save(false)} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
              Finish setup <ArrowRight size={18} />
            </button>
            <button onClick={() => save(true)} style={{ background: 'none', border: 'none', color: '#777', fontSize: 13 }}>
              Skip for now
            </button>
          </>
        )}
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{ background: 'none', border: 'none', color: '#777', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <ChevronLeft size={16} /> Back
          </button>
        )}
      </div>
    </div>
  );
}
