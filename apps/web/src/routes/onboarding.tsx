import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import Loading from '../components/Loading';

type Uni = { id: string; name: string; shortName?: string };

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [universities, setUniversities] = useState<Uni[]>([]);
  const [firstName, setFirstName] = useState('');
  const [university, setUniversity] = useState<Uni | null>(null);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [gradTarget, setGradTarget] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate('/auth');
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      const isEdit = new URLSearchParams(window.location.search).get('edit') === '1';
      if (snap.exists() && snap.data().university && !isEdit) return navigate('/dashboard');
      const us = await getDocs(collection(db, 'universities'));
      setUniversities(us.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
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
    if (!user) return;
    setLoading(true);
    try {
      if (firstName && !user.displayName) await updateProfile(user, { displayName: firstName }).catch(() => {});
      const payload: any = { firstName, email: user.email?.toLowerCase(), university: university?.name, faculty, department, level };
      if (university?.id) payload.universityId = university.id;
      if (!skipTarget && gradTarget) payload.gradePlanner = { target: gradTarget, updatedAt: serverTimestamp() };
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      navigate('/dashboard');
    } catch {
      alert('Something went wrong');
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
      <div style={{ background: '#58cc02', color: '#fff', padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.8 }}>{left.s}</div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28, marginTop: 6 }}>{left.t}</h1>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#fff' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 0 && (
          <>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Joshua" style={{ padding: 12, border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 16 }} />
            {firstName && <div style={{ fontSize: 14 }}>Good morning, <strong>{firstName}</strong></div>}
            <button onClick={() => firstName.trim() && setStep(1)} style={{ padding: 14, background: '#58cc02', color: '#fff', border: 'none', borderBottom: '4px solid #58a700', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              Continue <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === 1 && (
          <>
            {universities.map((u) => (
              <button key={u.id} onClick={() => { setUniversity(u); setStep(2); }} style={{ padding: 14, border: `1px solid ${university?.id === u.id ? '#58cc02' : '#e5e5e5'}`, borderRadius: 12, background: '#fff', textAlign: 'left' }}>
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
          <button key={l} onClick={() => { setLevel(l); setStep(5); }} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: level === l ? '#dbf8c5' : '#fff' }}>{l}</button>
        ))}
        {step === 5 && (
          <>
            {[
              { label: 'First Class', val: 4.5 },
              { label: '2nd Class Upper', val: 3.5 },
              { label: '2nd Class Lower', val: 2.4 },
              { label: 'Pass', val: 1.5 },
            ].map((t) => (
              <button key={t.label} onClick={() => setGradTarget(t.val)} style={{ padding: 14, border: `1px solid ${gradTarget === t.val ? '#58cc02' : '#e5e5e5'}`, borderRadius: 12, background: gradTarget === t.val ? '#dbf8c5' : '#fff' }}>
                {t.label} — {t.val}
              </button>
            ))}
            <button onClick={() => save(false)} style={{ padding: 14, background: '#58cc02', color: '#fff', border: 'none', borderBottom: '4px solid #58a700', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
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
