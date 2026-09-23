import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Flash from '../../components/Flash';
import Mascot from '../../components/Mascot';
import { TopicSlice } from '../../components/TopicSlice';
import { api } from '../../lib/api';
import type { UnifyNote } from '../../types/note';

type LocationState = {
  note: UnifyNote;
  meta: { course: string; week: number; title: string; subtitle: string };
  validation?: { valid: boolean; errors?: unknown };
};

export default function StudioReviewRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || null) as LocationState | null;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [validation, setValidation] = useState<LocationState['validation'] | null>(state?.validation ?? null);

  if (!state?.note) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <Mascot size={110} />
        <p style={{ color: '#777', fontSize: 14, margin: '12px 0 20px' }}>Nothing to review yet. Convert some notes first.</p>
        <Link to="/studio" style={{ padding: '10px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', textDecoration: 'none', fontWeight: 800, borderBottom: '4px solid #059669' }}>
          Back to Studio
        </Link>
      </div>
    );
  }

  const { note, meta } = state;

  const revalidate = async () => {
    setError('');
    try {
      const res = await api.validateNote(note);
      setValidation(res);
      if (!res.valid) setError('Validation found problems — see details in console.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.');
    }
  };

  const publish = async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/studio" label="Back to Studio" />
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
          Review · {meta.course} · Week {meta.week}
        </div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22, margin: '8px 0 4px' }}>{note.title}</h1>
        <p style={{ fontSize: 13, color: '#777' }}>{note.subtitle}</p>
        {validation && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', color: validation.valid ? '#059669' : '#991b1b' }}>
            {validation.valid ? <Check size={14} /> : <X size={14} />}
            {validation.valid ? 'Schema valid' : 'Schema has problems'}
          </div>
        )}
      </div>

      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}

      {note.topics.map((t) => (
        <TopicSlice key={t.number} topic={t} />
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <button onClick={revalidate} style={{ flex: 1, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800 }}>
          Re-validate
        </button>
        <button onClick={publish} disabled={publishing} style={{ flex: 2, padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          {publishing ? 'Publishing…' : 'Publish to students'} <ArrowRight size={18} />
        </button>
      </div>
      <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#777', fontSize: 13, marginTop: 12, width: '100%' }}>
        Done — back to dashboard
      </button>
    </div>
  );
}
