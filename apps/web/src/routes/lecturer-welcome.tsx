import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Check, Search } from 'lucide-react';
import { api } from '../lib/api';
import { errorToast } from '../lib/errors';
import { preparePhoto } from '../lib/image';
import { ROUTES } from '../lib/routes';
import { useSchool } from '../lib/school';
import { clearMeCache } from '../lib/api';
import BackButton from '../components/BackButton';
import Drop from '../components/Drop';
import { StepsSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Lecturer onboarding (Review Round 2, design L01–L06), in the app's usual look:
// 1 Send it once · 2 What should we call you · 3 Your department ·
// 4 What are you teaching (any department, any level; works straight away,
// each class's rep confirms) · 5 Let students know you (optional) · 6 All set.
// ?step=courses opens straight on step 4 (Home's "Add a course").
const TITLES = ['Dr.', 'Prof.', 'Engr.', 'Mr.', 'Mrs.', 'Ms.'];
const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, marginTop: 6 };
type Catalog = { code: string; title: string; levels?: string[]; semesters?: string[] }[];

export default function LecturerWelcomeRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const school = useSchool();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(params.get('step') === 'courses' ? 3 : 0);
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [dept, setDept] = useState('');
  const [teaching, setTeaching] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [sem, setSem] = useState('First Semester');
  const [q, setQ] = useState('');
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState('');
  const [contact, setContact] = useState('');
  const [links, setLinks] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [m, t, c, s] = await Promise.all([
          api.me(),
          api.teaching().catch(() => ({ courses: [] as string[] })),
          api.courses().catch(() => [] as Catalog),
          api.settings().catch(() => ({ currentSemester: 'First Semester' })),
        ]);
        const p = m.profile as unknown as { title?: string; first_name?: string; faculty?: string; department?: string; bio?: string; contact_email?: string; links?: string; avatar_url?: string } | null;
        setTitle(p?.title || '');
        setName(p?.first_name || '');
        setFaculty(p?.faculty || '');
        setDept(p?.department || '');
        setBio(p?.bio || '');
        setContact(p?.contact_email || '');
        setLinks(p?.links || '');
        setPhoto(p?.avatar_url || m.avatar || '');
        setTeaching(t.courses);
        setCatalog(c as Catalog);
        if (s.currentSemester) setSem(s.currentSemester);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const save = async (patch: Record<string, unknown>, next: number) => {
    setBusy(true);
    try { await api.updateMe(patch); clearMeCache(); setStep(next); }
    catch (e) { errorToast(e, 'save that'); }
    finally { setBusy(false); }
  };

  // Step 4: every course, any department, any level, this semester (search narrows).
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog
      .filter((c) => (c.semesters || []).includes(sem) || !(c.semesters || []).length)
      .filter((c) => !needle || c.code.toLowerCase().includes(needle) || (c.title || '').toLowerCase().includes(needle))
      .slice(0, 60);
  }, [catalog, q, sem]);
  const toggle = (code: string) => setPicks((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const addCourses = async () => {
    if (!picks.size) { setStep(4); return; }
    setBusy(true);
    try {
      const r = await api.lecturerClaimAdd([...picks]);
      setTeaching((t) => [...new Set([...t, ...r.added, ...r.already])]);
      setPicks(new Set());
      setStep(4);
    } catch (e) { errorToast(e, 'add those courses'); }
    finally { setBusy(false); }
  };
  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl } = await preparePhoto(file, { size: 320, maxBytes: 60 * 1024 });
      const res = await api.uploadAvatar(dataUrl);
      setPhoto(res.avatarUrl);
      window.dispatchEvent(new CustomEvent('unify:avatar', { detail: res.avatarUrl }));
    } catch (e) { errorToast(e, 'upload that photo'); }
    finally { setBusy(false); }
  };

  const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (!ready) return <StepsSkeleton />;
  const total = 6;
  const facultyList = school.openFaculties;
  const deptList = (facultyList.find((f) => f.name === faculty) || facultyList[0])?.departments || [];
  const levelsOf = (codes: string[]) => new Set(codes.flatMap((c) => catalog.find((x) => x.code === c)?.levels || [])).size;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.home} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }} aria-label={`Step ${step + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <button key={i} aria-label={`Step ${i + 1}`} onClick={() => setStep(i)} style={{ flex: 1, height: 6, borderRadius: 9999, border: 'none', background: i <= step ? 'var(--u-green)' : 'var(--border)' }} />
        ))}
      </div>

      {step === 0 && (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 10 }}>
            <BoxBoy pose="teaching" width={130} />
            <Label>Unify Learn for lecturers</Label>
            <Display size={30}>Send it once</Display>
            <div className="t-15">One place for your materials and announcements, across every class. Send a file or a post once, and every class taking that course gets it.</div>
          </Card>
          <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => setStep(1)}>Set up · two minutes</button>
        </>
      )}

      {step === 1 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>What should we call you?</Display>
          <div className="t-13 muted">Your title and name show on your courses and announcements.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 110 }}><Drop value={title} onChange={setTitle} label="Title" options={TITLES.map((t) => ({ value: t, label: t }))} style={{ width: '100%' }} /></div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name, e.g. Olusegun Adeyemi" maxLength={60} style={{ ...field, marginTop: 0, flex: 1 }} />
          </div>
          <button className="btn btn--amber btn--block" disabled={busy || name.trim().length < 2} onClick={() => void save({ title, firstName: name.trim() }, 2)}>{busy ? 'Saving…' : 'Continue'}</button>
        </Card>
      )}

      {step === 2 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>Your department</Display>
          <div className="t-13 muted">The department you belong to. Next, you can add courses from any department and any level.</div>
          {facultyList.length > 1 && <Drop value={faculty || facultyList[0]?.name || ''} onChange={(v) => { setFaculty(v); setDept(''); }} label="Faculty" options={facultyList.map((f) => ({ value: f.name, label: f.name }))} style={{ width: '100%' }} />}
          <Drop value={dept} onChange={setDept} label="Your department" options={deptList.map((d) => ({ value: d.name, label: d.name }))} style={{ width: '100%' }} />
          <button className="btn btn--amber btn--block" disabled={busy || !dept} onClick={() => void save({ department: dept, faculty: school.facultyOf(dept) || faculty || facultyList[0]?.name, university: 'Lagos State University' }, 3)}>{busy ? 'Saving…' : 'Next'}</button>
        </Card>
      )}

      {step === 3 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>What are you teaching?</Display>
          <div className="t-13 muted">Search for every course you teach this semester, from any department or level. They work straight away; each class's rep is asked to confirm it's you.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['First Semester', 'Second Semester'].map((s) => (
              <button key={s} className={`chip chip--sm${sem === s ? ' chip--on' : ''}`} onClick={() => setSem(s)}>{s.replace(' Semester', ' semester')}</button>
            ))}
          </div>
          <label style={{ position: 'relative', display: 'block' }}>
            <Search size={16} color="#999" style={{ position: 'absolute', left: 12, top: 18 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a course code or title" style={{ ...field, paddingLeft: 36 }} />
          </label>
          {teaching.length > 0 && <div className="t-13"><b>Already yours:</b> {teaching.join(', ')}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '46svh', overflowY: 'auto' }}>
            {results.map((c) => {
              const mine = teaching.includes(c.code);
              const on = mine || picks.has(c.code);
              return (
                <button key={c.code} disabled={mine} onClick={() => toggle(c.code)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: `1px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-good-tint)' : 'var(--surface)', color: 'var(--text)', textAlign: 'left' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-good)' : 'transparent', color: 'var(--u-on-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={14} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800 }}>{c.code}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                  </span>
                  {(c.levels || [])[0] && <span className="pill pill--grey" style={{ fontSize: 11 }}>{(c.levels || [])[0].replace(' Level', 'L')}</span>}
                </button>
              );
            })}
            {!results.length && <div className="t-13 muted">No course matches that. Check the code, or tell the Unify team from Me → Help.</div>}
          </div>
          <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void addCourses()}>{busy ? 'Adding…' : picks.size ? `Done · add ${picks.size} course${picks.size === 1 ? '' : 's'}` : 'Next'}</button>
        </Card>
      )}

      {step === 4 && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Display size={24}>Let students know you</Display>
          <div className="t-13 muted">With hundreds of students, a photo and a short bio help them recognise you and know how to reach you. All optional.</div>
          <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            {photo ? <img src={photo} alt="" style={{ width: 64, height: 64, borderRadius: 9999, objectFit: 'cover' }} /> : <span style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={22} color="var(--text2)" /></span>}
            <span className="t-14 w-7">{photo ? 'Change your photo' : 'Add a profile photo'}</span>
            <input type="file" accept="image/*,.heic,.heif" hidden disabled={busy} onChange={(e) => void uploadPhoto(e.target.files?.[0] || null)} />
          </label>
          <label className="t-13 w-7">Short bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={400} placeholder="e.g. I teach energy systems with real plant data. Office hours Tue, 2 to 4 PM, MEE block, room 7." style={{ ...field, resize: 'vertical' }} />
          </label>
          <label className="t-13 w-7">Email students can use
            <input value={contact} onChange={(e) => setContact(e.target.value)} type="email" placeholder="e.g. o.adeyemi@gmail.com" maxLength={120} style={field} />
          </label>
          <label className="t-13 w-7">Handles (LinkedIn, X, website)
            <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="e.g. linkedin.com/in/oadeyemi" maxLength={300} style={field} />
          </label>
          <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void save({ bio: bio.trim(), contactEmail: contact.trim(), links: links.trim() }, 5)}>{busy ? 'Saving…' : 'Save and continue'}</button>
          <button className="btn btn--white btn--block" onClick={() => setStep(5)}>Do it later</button>
        </Card>
      )}

      {step === 5 && (
        <>
          <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 16, gap: 10 }}>
            <BoxBoy pose="cheer" width={130} />
            <Display size={26}>Your courses are set</Display>
            <div className="t-15">
              {teaching.length ? `${teaching.length} course${teaching.length === 1 ? '' : 's'} across ${levelsOf(teaching) || 1} level${levelsOf(teaching) === 1 ? '' : 's'}, one place. ` : ''}
              Send a file once and every class taking that course gets it. Announcements work the same way. Courses you added show "Waiting for Head of Class" until each class's rep confirms you.
            </div>
          </Card>
          <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={() => navigate(ROUTES.home)}>Go to Home</button>
        </>
      )}
    </div>
  );
}
