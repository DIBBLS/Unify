import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, HelpCircle, ListChecks, PenLine, Radio } from 'lucide-react';
import { api, type HocClass } from '../lib/api';
import { errorToast } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ROUTES } from '../lib/routes';

// Review 3 (C7): the class rep's Home. One quiet tools row (Post, Questions,
// Class list, Live wire) instead of the big live wire button, and a Confirm
// today card for the day's classes. Renders nothing for anyone else (the
// server answers 403 for non-reps).
const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const STATUS: Record<string, { text: string; bg: string; fg: string }> = {
  confirmed: { text: 'Confirmed', bg: 'var(--u-good-tint)', fg: 'var(--u-good)' },
  cancelled: { text: 'Cancelled', bg: 'var(--u-bad-tint)', fg: 'var(--u-red, #dc2626)' },
  moved: { text: 'Moved', bg: 'var(--u-warn-tint)', fg: 'var(--u-warn-ink)' },
  late: { text: 'Running late', bg: 'var(--u-warn-tint)', fg: 'var(--u-warn-ink)' },
};

export default function ClassRepHome({ onRep }: { onRep?: (rep: boolean) => void }) {
  const [data, setData] = useState<{ when: 'today' | 'tomorrow'; date: string; classes: HocClass[] } | null>(null);
  const [busy, setBusy] = useState('');
  // Questions from students waiting for an answer (Review 3, C4/C7).
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let gone = false;
    api.hocToday()
      .then((d) => {
        if (gone) return;
        setData(d);
        onRep?.(true);
        api.hocPosts().then((r) => { if (!gone) setWaiting(r.waiting || 0); }).catch(() => {});
      })
      .catch(() => { if (!gone) onRep?.(false); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return null;

  const confirm = async (c: HocClass) => {
    setBusy(c.id);
    try {
      await api.slotChange(c.id, { status: 'confirmed', ...(data.when === 'tomorrow' ? { date: data.date } : {}) });
      setData((d) => d && { ...d, classes: d.classes.map((x) => (x.id === c.id ? { ...x, status: 'confirmed' } : x)) });
      toastSuccess(`${c.course} confirmed. Your class is told.`);
    } catch (e) {
      errorToast(e, 'confirm that class');
    } finally {
      setBusy('');
    }
  };

  const tools = [
    { to: `${ROUTES.hoc}#post`, label: 'Post', Icon: PenLine },
    { to: `${ROUTES.hoc}?filter=question`, label: 'Questions', Icon: HelpCircle, badge: waiting },
    { to: ROUTES.classList, label: 'Class list', Icon: ListChecks },
    { to: ROUTES.liveWire, label: 'Live wire', Icon: Radio },
  ];
  const open = data.classes.filter((c) => !c.past);
  return (
    <>
      <nav aria-label="Class rep tools" style={{ margin: '0 16px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {tools.map(({ to, label, Icon, badge }) => (
          <Link key={label} to={to} aria-label={badge ? `${label}, ${badge} waiting` : label} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
            <Icon size={18} color="var(--text2)" /> {label}
            {!!badge && <span style={{ position: 'absolute', top: 4, right: 8, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
          </Link>
        ))}
      </nav>
      {open.length > 0 && (
        <section aria-label={`Confirm ${data.when}`} style={{ margin: '0 16px 12px', padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>Confirm {data.when}</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{open.filter((c) => c.status === 'confirmed').length} of {open.length} confirmed</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Is each class still on? Your class is told when you confirm.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {open.map((c) => {
              const st = STATUS[c.status];
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'var(--surface2)' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{c.course}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>
                      {hhmm(c.newStart || c.start)}{(c.newVenue || c.venue) ? ` · ${c.newVenue || c.venue}` : ''}
                    </span>
                  </span>
                  {st ? (
                    <span style={{ padding: '4px 10px', borderRadius: 9999, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{st.text}</span>
                  ) : (
                    <button onClick={() => void confirm(c)} disabled={busy === c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 9999, border: 'none', background: 'var(--u-amber)', color: 'var(--u-black)', fontWeight: 800, fontSize: 12 }}>
                      <Check size={14} /> {busy === c.id ? '…' : 'Confirm'}
                    </button>
                  )}
                  <Link to={`/timetable/class/${encodeURIComponent(c.course)}/${c.id}`} aria-label={`Change ${c.course}`} style={{ display: 'flex', color: 'var(--text3)' }}><ChevronRight size={18} /></Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
