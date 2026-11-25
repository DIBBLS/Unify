import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoxBoy, type Pose } from './redesign/brand';
import { ROUTES } from '../lib/routes';

// Review 4: a step 1, 2, 3 walkthrough the first time a class rep opens Class.
// It shows them around, then hands over to the setup checklist (/hoc/welcome).
// Shown once per device; "Class rep guide" on the Class page opens it again.
const SEEN_KEY = 'unify.hocTour.v1';
export const HOC_TOUR_EVENT = 'unify:hoc-tour';

const STEPS: { pose: Pose; title: string; body: string }[] = [
  {
    pose: 'teaching',
    title: 'Your class board',
    body: 'Post announcements, tips and polls here. Questions from classmates come to you first; answer one and the whole class sees it.',
  },
  {
    pose: 'thumbsUpPhone',
    title: 'Your class list',
    body: 'Upload the list once. Classmates link their matric number to their place on it, and you see each person with their photo.',
  },
  {
    pose: 'phoneOut',
    title: 'Classes and attendance',
    body: "Confirm today's classes from Home so everyone knows what's on. In class, scan your classmates' passes with the scanner.",
  },
];

export function hocTourSeen(): boolean {
  try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; }
}

export default function HocTour() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !hocTourSeen());
  const [i, setI] = useState(0);
  useEffect(() => {
    const show = () => { setI(0); setOpen(true); };
    window.addEventListener(HOC_TOUR_EVENT, show);
    return () => window.removeEventListener(HOC_TOUR_EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!open) return null;

  function close() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* shows again next time */ }
    setOpen(false);
  }
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hoc-tour-title" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="soft-in" style={{ width: '100%', maxWidth: 'var(--shell, 480px)', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--u-good)' }}>CLASS REP GUIDE · STEP {i + 1} OF {STEPS.length}</div>
        <BoxBoy pose={s.pose} width={110} style={{ margin: '10px auto 0' }} />
        <h2 id="hoc-tour-title" style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 22, marginTop: 8 }}>{s.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginTop: 6 }}>{s.body}</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '14px 0' }} aria-hidden="true">
          {STEPS.map((_, k) => <span key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 9999, background: k === i ? 'var(--u-green)' : 'var(--border)', transition: 'width .2s' }} />)}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {i > 0
            ? <button className="btn btn--white" style={{ flex: 1 }} onClick={() => setI(i - 1)}>Back</button>
            : <button className="btn btn--white" style={{ flex: 1 }} onClick={close}>Skip</button>}
          <button className="btn btn--amber" style={{ flex: 2 }} onClick={() => { if (!last) { setI(i + 1); return; } close(); navigate(ROUTES.hocWelcome); }}>
            {last ? 'Set up my class' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
