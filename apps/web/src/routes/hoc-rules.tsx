import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { api, type ClassRules } from '../lib/api';
import { describeError, errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import { toastSuccess } from '../lib/toast';

// Review 3 (C11): the class rep sets when each class gets confirmed (they get
// a reminder then) and the latest a lecturer can cancel through Unify Learn.
// One rule for all the rep's courses.
const CONFIRM: { v: ClassRules['confirmWhen']; label: string; hint: string }[] = [
  { v: 'evening', label: 'The evening before', hint: 'Reminder at 6 PM the day before' },
  { v: '2h', label: '2 hours before', hint: 'Reminder 2 hours before it starts' },
  { v: '1h', label: '1 hour before', hint: 'Reminder 1 hour before it starts' },
];
const CANCEL: { v: ClassRules['cancelBy']; label: string }[] = [
  { v: 'evening', label: 'By 6 PM the evening before' },
  { v: '2h', label: 'Up to 2 hours before' },
  { v: '1h', label: 'Up to 1 hour before' },
  { v: 'any', label: 'Any time' },
];

export default function HocRulesRoute() {
  const [rules, setRules] = useState<(ClassRules & { courses: number }) | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.hocRules().then(setRules).catch((e) => setErr(describeError(e, 'load your class rules')));
  }, []);

  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err) return <div style={shell}><BackButton to={ROUTES.hoc} /><p className="t-15">{err}</p></div>;
  if (!rules) return <div style={shell}><SectionSkeleton rows={3} /></div>;

  const save = async () => {
    setSaving(true);
    try {
      await api.hocSaveRules({ confirmWhen: rules.confirmWhen, cancelBy: rules.cancelBy });
      toastSuccess(`Saved for your ${rules.courses} course${rules.courses === 1 ? '' : 's'}.`);
      setRules({ ...rules, set: true });
    } catch (e) {
      errorToast(e, 'save your class rules');
    } finally {
      setSaving(false);
    }
  };
  const option = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 14,
    border: `1.5px solid ${on ? 'var(--u-black)' : 'var(--border)'}`, background: on ? 'var(--surface)' : 'var(--surface2)', color: 'var(--text)',
  });
  const dot = (on: boolean) => <span style={{ width: 18, height: 18, borderRadius: 9999, border: `2px solid ${on ? 'var(--u-black)' : 'var(--border)'}`, background: on ? 'var(--u-black)' : 'transparent', boxShadow: on ? 'inset 0 0 0 3px var(--surface)' : undefined, flexShrink: 0 }} />;

  return (
    <div style={shell}>
      <BackButton to={ROUTES.hoc} />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24 }}>Class rules</h1>
      <p className="t-13 muted" style={{ marginTop: 6 }}>For all {rules.courses} of your courses. Your class sees each class as confirmed once you confirm it.</p>

      <h2 className="t-15 w-7" style={{ marginTop: 20 }}>When do you confirm each class?</h2>
      <div role="radiogroup" aria-label="When classes are confirmed" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {CONFIRM.map((o) => (
          <button key={o.v} role="radio" aria-checked={rules.confirmWhen === o.v} onClick={() => setRules({ ...rules, confirmWhen: o.v })} style={option(rules.confirmWhen === o.v)}>
            {dot(rules.confirmWhen === o.v)}
            <span>
              <span className="t-15 w-7" style={{ display: 'block' }}>{o.label}</span>
              <span className="t-12 muted">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="t-15 w-7" style={{ marginTop: 22 }}>Latest a lecturer can cancel</h2>
      <p className="t-12 muted" style={{ marginTop: 2 }}>After this, a lecturer can't cancel in the app. You still can, or you can send a live wire.</p>
      <div role="radiogroup" aria-label="Latest a lecturer can cancel" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {CANCEL.map((o) => (
          <button key={o.v} role="radio" aria-checked={rules.cancelBy === o.v} onClick={() => setRules({ ...rules, cancelBy: o.v })} style={option(rules.cancelBy === o.v)}>
            {dot(rules.cancelBy === o.v)}
            <span className="t-15 w-7">{o.label}</span>
          </button>
        ))}
      </div>

      <button className="btn btn--amber btn--block" disabled={saving || !rules.courses} onClick={() => void save()} style={{ marginTop: 22 }}>{saving ? 'Saving…' : 'Save'}</button>
      {!rules.courses && <p className="t-12 muted" style={{ marginTop: 8, textAlign: 'center' }}>Add your class's courses first.</p>}
    </div>
  );
}
