import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api, type SchoolGuide } from '../lib/api';
import { describeError } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// S44 Guide: your school's step-by-step (course registration and the like),
// kept current by the school's admin. Ticks are yours, saved on this device.
const DONE_KEY = (g: SchoolGuide) => `unify:guide-done:${g.institution}:${g.updated_at}`;

export default function GuideRoute() {
  const [guide, setGuide] = useState<SchoolGuide | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    api.guide().then((r) => {
      setGuide(r.guide);
      if (r.guide) {
        try { setDone(JSON.parse(localStorage.getItem(DONE_KEY(r.guide)) || '[]')); } catch { /* fresh */ }
        try { localStorage.setItem('unify:guide-seen', r.guide.updated_at); } catch { /* fine */ }
      }
    }).catch((e) => { setErr(describeError(e, 'load the guide')); setGuide(null); });
  }, []);

  const toggle = (i: number) => {
    if (!guide) return;
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(DONE_KEY(guide), JSON.stringify(next)); } catch { /* fine */ }
  };

  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 640px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <BackButton to={ROUTES.me} />
      <Label>Guide</Label>
      {guide === undefined ? (
        <div className="t-13 muted" style={{ marginTop: 12 }}>Loading…</div>
      ) : !guide ? (
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 12, gap: 10 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={24}>No guide yet</Display>
          <div className="t-14 muted">{err || "Your school's admin hasn't put one up yet. Check back soon."}</div>
        </Card>
      ) : (
        <>
          <Display size={30}>{guide.title}</Display>
          {guide.intro && <p className="t-15 muted" style={{ marginTop: 6 }}>{guide.intro}</p>}
          <div className="t-13 muted" style={{ marginTop: 4 }}>
            {done.length} of {guide.steps.length} done · updated {new Date(guide.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {guide.steps.map((s, i) => {
              const on = done.includes(i);
              return (
                <Card key={i} pad={14} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <button
                    onClick={() => toggle(i)}
                    aria-label={on ? `Mark step ${i + 1} not done` : `Mark step ${i + 1} done`}
                    aria-pressed={on}
                    style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: `2px solid ${on ? 'var(--u-good)' : 'var(--border)'}`, background: on ? 'var(--u-good)' : 'transparent', color: on ? '#fff' : 'var(--text2)', fontWeight: 800, fontSize: 13 }}
                  >
                    {on ? '✓' : i + 1}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-15 w-7" style={{ textDecoration: on ? 'line-through' : undefined, opacity: on ? 0.7 : 1 }}>{s.title}</div>
                    {s.body && <div className="t-13 muted" style={{ marginTop: 2 }}>{s.body}</div>}
                    {s.where && (
                      <div className="t-13" style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', color: 'var(--u-good)', fontWeight: 600 }}>
                        <MapPin size={13} /> {s.where}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
