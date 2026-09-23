import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Flash from '../../components/Flash';
import Loading from '../../components/Loading';
import Mascot from '../../components/Mascot';
import { TopicSlice } from '../../components/TopicSlice';
import { api } from '../../lib/api';
import type { UnifyNote } from '../../types/note';

const MODES = [
  { id: 'whole-week-headers', label: 'Whole week, my headers (recommended)' },
  { id: 'per-topic', label: 'Per-topic (one topic at a time)' },
  { id: 'whole-week-ai', label: 'Whole week, AI decides boundaries' },
];

const WORK_MSGS = ['Gathering your notes…', 'Structuring topics…', 'Building checks…'];

type Meta = { course: string; week: number; title: string; subtitle: string };

export default function StudioRoute() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [course, setCourse] = useState('MEE 352');
  const [week, setWeek] = useState('1');
  const [weeks, setWeeks] = useState<{ week: number; title: string }[]>([]);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tags, setTags] = useState('');
  const [mode, setMode] = useState(MODES[0].id);
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors?: unknown } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [working, setWorking] = useState(false);
  const [workMsg, setWorkMsg] = useState(0);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!working) return;
    setWorkMsg(0);
    const t = setInterval(() => setWorkMsg((i) => (i + 1) % WORK_MSGS.length), 2500);
    return () => clearInterval(t);
  }, [working]);

  const suggestWeek = async () => {
    setError('');
    const code = course.trim().toUpperCase();
    if (!code) {
      setError('Enter a course code first.');
      return;
    }
    try {
      const res = await api.courseWeeks(code);
      setWeeks(res.weeks);
      const max = res.weeks.reduce((m, w) => Math.max(m, w.week), 0);
      setWeek(String(max + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load weeks.');
    }
  };

  const convert = async () => {
    setError('');
    if (!raw.trim()) {
      setError('Paste your raw lecture notes first.');
      return;
    }
    const weekNum = Number(week);
    const code = course.trim().toUpperCase();
    if (!code || !Number.isInteger(weekNum) || weekNum < 1) {
      setError('Enter a course code and a valid week number.');
      return;
    }
    setWorking(true);
    try {
      const res = await api.convert({
        course: code,
        week: weekNum,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        segmentationMode: mode,
        rawNotesText: raw,
      });
      setNote(res.note as UnifyNote);
      setMeta({ course: code, week: weekNum, title: title.trim(), subtitle: subtitle.trim() });
      setValidation(res.validation);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setWorking(false);
    }
  };

  const revalidate = async () => {
    if (!note) return;
    setError('');
    try {
      const res = await api.validateNote(note);
      setValidation(res);
      if (!res.valid) setError('Validation found problems — fix the JSON and retry.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.');
    }
  };

  const publish = async () => {
    if (!note || !meta) return;
    setError('');
    setSuccess('');
    setPublishing(true);
    try {
      const res = await api.publish({
        course: meta.course,
        week: meta.week,
        title: meta.title || note.title,
        subtitle: meta.subtitle || note.subtitle,
        noteJson: note,
      });
      setSuccess(`${res.course} · Week ${res.week} is now live for students.`);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const reset = () => {
    setStep(0);
    setNote(null);
    setMeta(null);
    setValidation(null);
    setError('');
    setSuccess('');
    setRaw('');
  };

  if (working) return <Loading text={WORK_MSGS[workMsg]} />;

  const input = {
    width: '100%',
    padding: 12,
    marginTop: 6,
    border: '1px solid #e5e5e5',
    borderRadius: 12,
    display: 'block',
    fontSize: 14,
  } as const;
  const label = { fontSize: 12, fontWeight: 700 } as const;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24 }}>Author a week</h1>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 20px' }}>
        {['Paste', 'Review', 'Live'].map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#10b981' : '#e5e5e5' }} />
            <div style={{ fontSize: 11, color: i <= step ? '#059669' : '#afafaf', fontWeight: 700, marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ ...label, flex: 1, minWidth: 140 }}>
              Course
              <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="MEE 352" style={input} />
            </label>
            <label style={{ ...label, width: 100 }}>
              Week
              <input value={week} onChange={(e) => setWeek(e.target.value)} inputMode="numeric" placeholder="1" style={input} />
            </label>
          </div>
          <button onClick={suggestWeek} style={{ padding: 10, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontWeight: 700, fontSize: 13, color: '#059669' }}>
            Suggest next free week
          </button>
          {weeks.length > 0 && (
            <div style={{ fontSize: 12, color: '#777' }}>
              Already live: {weeks.map((w) => `W${w.week}`).join(', ')}
            </div>
          )}
          <label style={label}>
            Raw lecture notes
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder="Paste messy lecture notes here…" style={{ ...input, resize: 'vertical' }} />
          </label>
          <details style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: '10px 14px' }}>
            <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Advanced (title, tags, mode)</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <label style={label}>
                Week title
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Energy Sources" style={input} />
              </label>
              <label style={label}>
                Subtitle
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One-line summary" style={input} />
              </label>
              <label style={label}>
                Tags (comma-separated)
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Turbine, Density, Torque" style={input} />
              </label>
              <label style={label}>
                Segmentation
                <select value={mode} onChange={(e) => setMode(e.target.value)} style={input}>
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <button onClick={convert} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            Generate note <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 1 && note && meta && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
              Review · {meta.course} · Week {meta.week}
            </div>
            <h2 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20, margin: '8px 0 4px' }}>{note.title}</h2>
            <p style={{ fontSize: 13, color: '#777' }}>{note.subtitle}</p>
            {validation && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', color: validation.valid ? '#059669' : '#991b1b' }}>
                {validation.valid ? <Check size={14} /> : <X size={14} />}
                {validation.valid ? 'Schema valid' : 'Schema has problems'}
              </div>
            )}
          </div>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {note.topics.map((t) => (
              <TopicSlice key={t.number} topic={t} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, minWidth: 120, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800 }}>
              Edit inputs
            </button>
            <button onClick={publish} disabled={publishing} style={{ flex: 2, minWidth: 160, padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {publishing ? 'Publishing…' : 'Publish to students'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Mascot size={120} animate="wave" />
          <h2 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22, marginTop: 12 }}>Live for students</h2>
          <p style={{ fontSize: 13, color: '#777', margin: '8px 0 20px' }}>Find it under your level and course, and on your dashboard.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ flex: 1, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800 }}>
              Author another
            </button>
            <button onClick={() => navigate('/dashboard')} style={{ flex: 1, padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800 }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
