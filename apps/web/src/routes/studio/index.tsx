import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Flash from '../../components/Flash';
import Loading from '../../components/Loading';
import { api } from '../../lib/api';

const MODES = [
  { id: 'whole-week-headers', label: 'Whole week, my headers (recommended)' },
  { id: 'per-topic', label: 'Per-topic (one topic at a time)' },
  { id: 'whole-week-ai', label: 'Whole week, AI decides boundaries' },
];

export default function StudioRoute() {
  const navigate = useNavigate();
  const [course, setCourse] = useState('MEE 352');
  const [week, setWeek] = useState('1');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tags, setTags] = useState('');
  const [mode, setMode] = useState(MODES[0].id);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const convert = async () => {
    setError('');
    if (!raw.trim()) {
      setError('Paste your raw lecture notes first.');
      return;
    }
    const weekNum = Number(week);
    if (!course.trim() || !Number.isInteger(weekNum) || weekNum < 1) {
      setError('Enter a course code and a valid week number.');
      return;
    }
    setWorking(true);
    try {
      const res = await api.convert({
        course: course.trim().toUpperCase(),
        week: weekNum,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        segmentationMode: mode,
        rawNotesText: raw,
      });
      navigate('/studio/review', {
        state: {
          note: res.note,
          meta: { course: course.trim().toUpperCase(), week: weekNum, title: title.trim(), subtitle: subtitle.trim() },
          validation: res.validation,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
      setWorking(false);
    }
  };

  if (working) return <Loading text="Claude is structuring your notes…" />;

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
      <p style={{ fontSize: 13, color: '#777', margin: '4px 0 16px' }}>Paste raw notes, let Claude structure them, review, then publish to students.</p>
      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ ...label, flex: 1 }}>
            Course
            <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="MEE 352" style={input} />
          </label>
          <label style={{ ...label, width: 110 }}>
            Week
            <input value={week} onChange={(e) => setWeek(e.target.value)} inputMode="numeric" placeholder="1" style={input} />
          </label>
        </div>
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
        <label style={label}>
          Raw lecture notes
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder="Paste messy lecture notes here…" style={{ ...input, resize: 'vertical' }} />
        </label>
        <button onClick={convert} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          Convert with Claude <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
