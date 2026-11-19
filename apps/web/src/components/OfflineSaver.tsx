import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import { isWeekSaved, saveWeekOffline } from '../lib/offline';

// Keeps every published week of the student's courses on the phone, so notes,
// quizzes and all the games open offline without visiting each week first.
//  - On Wi-Fi: saved quietly in the background (at most every 6 hours).
//  - On mobile data, or when the phone doesn't say: asks first, because it
//    uses data. "Not now" hides the ask for 3 days.
//  - Never on Data Saver.
const LAST_AUTO = 'unify:offline-auto-at';
const SNOOZE = 'unify:offline-ask-snooze';
type Conn = { type?: string; saveData?: boolean };

const conn = (): Conn | undefined => (navigator as Navigator & { connection?: Conn }).connection;
const onWifi = () => ['wifi', 'ethernet'].includes(conn()?.type || '');
const getNum = (k: string) => { try { return Number(localStorage.getItem(k) || 0); } catch { return 0; } };
const setNum = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* fine */ } };

export default function OfflineSaver({ courses }: { courses: string[] }) {
  const [missing, setMissing] = useState<{ course: string; week: number }[]>([]);
  const [ask, setAsk] = useState(false);
  const [saving, setSaving] = useState('');
  const ran = useRef(false);
  const list = courses.map((c) => c.trim()).filter(Boolean).join('|');

  const saveAll = async (todo: { course: string; week: number }[], quiet: boolean) => {
    let done = 0;
    for (const w of todo) {
      if (!navigator.onLine) break;
      if (!quiet) setSaving(`Saving ${done + 1} of ${todo.length}…`);
      try { await saveWeekOffline(w.course, w.week); done += 1; } catch { /* next one */ }
    }
    setSaving('');
    setAsk(false);
    setMissing([]);
  };

  useEffect(() => {
    if (ran.current || !list || !navigator.onLine || conn()?.saveData) return;
    ran.current = true;
    let gone = false;
    // After Home has settled, so this never slows the first screen.
    const t = window.setTimeout(async () => {
      const codes = list.split('|');
      const weeks = await Promise.all(codes.map((c) => api.courseWeeks(c).then((r) => r.weeks.map((w) => ({ course: c, week: w.week }))).catch(() => [])));
      const todo = weeks.flat().filter((w) => !isWeekSaved(w.course, w.week));
      if (gone || !todo.length) return;
      if (onWifi()) {
        if (Date.now() - getNum(LAST_AUTO) < 6 * 3600000) return;
        setNum(LAST_AUTO, Date.now());
        void saveAll(todo, true);
        return;
      }
      if (Date.now() < getNum(SNOOZE)) return;
      setMissing(todo);
      setAsk(true);
    }, 4000);
    return () => { gone = true; window.clearTimeout(t); };
  }, [list]);

  if (!ask || !missing.length) return null;
  const courseCount = new Set(missing.map((m) => m.course)).size;
  return (
    <div className="rise" style={{ margin: '0 16px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--u-good-tint)', color: 'var(--u-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Download size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Save your courses for offline?</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {missing.length} week{missing.length === 1 ? '' : 's'} across {courseCount} course{courseCount === 1 ? '' : 's'}, so notes, quizzes and games work without data. This uses some mobile data. On Wi-Fi it happens by itself.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn--amber btn--sm" disabled={!!saving} onClick={() => void saveAll(missing, false)}>{saving || 'Save now'}</button>
          {!saving && <button className="btn btn--white btn--sm" onClick={() => { setNum(SNOOZE, Date.now() + 3 * 86400000); setAsk(false); }}>Not now</button>}
        </div>
      </div>
    </div>
  );
}
