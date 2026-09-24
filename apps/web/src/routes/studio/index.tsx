import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Flash from '../../components/Flash';
import Loading from '../../components/Loading';
import Mascot from '../../components/Mascot';
import { TopicSlice } from '../../components/TopicSlice';
import EoqQuiz from '../../components/EoqQuiz';
import { NoteBuilder, blankNote, normalizeNote } from './NoteBuilder';
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
  const [course, setCourse] = useState('');
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
  const [publishingTopic, setPublishingTopic] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<{ code: string; title: string }[]>([]);
  const [method, setMethod] = useState<'ai' | 'manual' | 'external'>('ai');
  const [editing, setEditing] = useState(false);
  const [formatPack, setFormatPack] = useState('');
  const [formatLoading, setFormatLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!working) return;
    setWorkMsg(0);
    const t = setInterval(() => setWorkMsg((i) => (i + 1) % WORK_MSGS.length), 2500);
    return () => clearInterval(t);
  }, [working]);

  // Course dropdown: only courses in the system (admin adds new ones).
  useEffect(() => {
    let cancelled = false;
    api
      .courses()
      .then((list) => {
        if (!cancelled) setCatalog(list.map((c) => ({ code: c.code, title: c.title })));
      })
      .catch(() => {
        // offline: manual input fallback below stays
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep link from author preview: /studio?edit=COURSE&week=N loads the
  // published week straight into review for editing, then re-publish.
  useEffect(() => {
    const editCourse = searchParams.get('edit');
    const editWeek = Number(searchParams.get('week'));
    if (!editCourse || !Number.isInteger(editWeek) || editWeek < 1) return;
    let cancelled = false;
    (async () => {
      setError('');
      setWorking(true);
      try {
        const data = await api.week(editCourse, editWeek);
        const loaded = normalizeNote(data.note_json);
        if (!loaded) throw new Error('Week has no readable content yet.');
        if (cancelled) return;
        setNote(loaded);
        setMeta({ course: data.course, week: data.week, title: data.title || loaded.title, subtitle: data.subtitle || '' });
        setValidation(null);
        setEditing(false);
        setStep(1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load week.');
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setEditing(false);
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
      if (!res.valid) setError('Validation found problems — fix them in Edit content (list below).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.');
    }
  };

  // Manual compose: start a blank note, or keep editing the current draft.
  const startManual = () => {
    setError('');
    if (note) return;
    const weekNum = Number(week);
    const code = course.trim().toUpperCase();
    if (!code || !Number.isInteger(weekNum) || weekNum < 1) {
      setError('Pick a course and a valid week number first.');
      return;
    }
    setNote({
      ...blankNote(code, weekNum),
      title: title.trim(),
      subtitle: subtitle.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  // Manual/external path into review: sync the selected course+week,
  // validate once for guidance, then preview.
  const goReview = async () => {
    if (!note) return;
    const weekNum = Number(week);
    const code = course.trim().toUpperCase();
    if (!code || !Number.isInteger(weekNum) || weekNum < 1) {
      setError('Pick a course and a valid week number first.');
      return;
    }
    const synced = { ...note, course: code, week: weekNum };
    setNote(synced);
    setMeta({ course: code, week: weekNum, title: synced.title, subtitle: synced.subtitle });
    setError('');
    setSuccess('');
    try {
      const res = await api.validateNote(synced);
      setValidation(res);
      if (!res.valid) setError('Heads up — the checker found problems (listed below). You can still publish.');
    } catch {
      // validation offline; publish still allowed
    }
    setEditing(false);
    setStep(1);
  };

  const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // External-AI import: paste back whatever your own AI produced with our
  // format pack, normalize defensively, then review like any other note.
  const importPasted = async () => {
    setError('');
    setSuccess('');
    if (!pasted.trim()) {
      setError('Paste the AI output first.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(pasted));
    } catch {
      setError('That is not valid JSON — copy only the JSON block from the AI.');
      return;
    }
    const clean = normalizeNote(parsed);
    if (!clean) {
      setError('JSON parsed, but it has no usable topics array.');
      return;
    }
    const weekNum = Number(week);
    const code = course.trim().toUpperCase();
    if (!code || !Number.isInteger(weekNum) || weekNum < 1) {
      setError('Pick a course and a valid week number first.');
      return;
    }
    const synced = { ...clean, course: code, week: weekNum };
    setNote(synced);
    setMeta({ course: code, week: weekNum, title: synced.title, subtitle: synced.subtitle });
    try {
      const res = await api.validateNote(synced);
      setValidation(res);
      if (!res.valid) setSuccess('Imported — the checker found problems (listed below). Fix in Edit content or publish anyway.');
      else setSuccess('Imported and valid. Review below.');
    } catch {
      setSuccess('Imported. Review below.');
    }
    setEditing(false);
    setStep(1);
  };

  const copyFormat = async () => {
    setError('');
    try {
      let pack = formatPack;
      if (!pack) {
        setFormatLoading(true);
        const res = await api.formatPack();
        pack = res.prompt;
        setFormatPack(pack);
      }
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(pack);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Copy failed — open "View format text" below and copy manually.');
    } finally {
      setFormatLoading(false);
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
      const tags = (res.versions || []).map((v) => `Topic ${v.topic} → v${v.version}`).join(' · ');
      setSuccess(tags ? `${res.course} · Week ${res.week} is live (${tags}). Old versions are kept.` : `${res.course} · Week ${res.week} is now live for students.`);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const reset = () => {
    setStep(0);
    setMethod('ai');
    setNote(null);
    setMeta(null);
    setValidation(null);
    setError('');
    setSuccess('');
    setRaw('');
    setPasted('');
    setEditing(false);
  };

  // Publish a single topic as a new version (v1, v2, v3...) without
  // touching the other topics in the week.
  const publishTopic = async (topicNumber: number) => {
    if (!note || !meta || publishingTopic !== null) return;
    const single = note.topics.find((t) => t.number === topicNumber);
    if (!single) return;
    setError('');
    setSuccess('');
    setPublishingTopic(topicNumber);
    try {
      const res = await api.topicPublish({
        course: meta.course,
        week: meta.week,
        topic: topicNumber,
        title: single.title,
        noteJson: single,
      });
      setSuccess(`${meta.course} · Week ${meta.week} · Topic ${topicNumber} saved as v${res.version}. Old versions are kept.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Topic publish failed.');
    } finally {
      setPublishingTopic(null);
    }
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
        {['Compose', 'Review', 'Live'].map((s, i) => (
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
              {catalog.length > 0 ? (
                <select value={course} onChange={(e) => setCourse(e.target.value)} style={input}>
                  {!catalog.some((c) => c.code === course) && <option value={course}>{course}</option>}
                  {catalog.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.title}</option>
                  ))}
                </select>
              ) : (
                <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course code" style={input} />
              )}
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
          <div style={{ display: 'flex', gap: 6 }}>
            {(['ai', 'manual', 'external'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setError(''); }}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${method === m ? '#059669' : '#e5e5e5'}`,
                  background: method === m ? '#10b981' : '#fff',
                  color: method === m ? '#fff' : '#777',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {m === 'ai' ? 'AI Generate' : m === 'manual' ? 'Manual' : 'External AI'}
              </button>
            ))}
          </div>

          {method === 'ai' && (
            <>
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
            </>
          )}

          {method === 'manual' && (
            <>
              <div style={{ fontSize: 13, color: '#777', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12 }}>
                Compose the week yourself with guided forms — same format the AI produces, no JSON, no tokens spent.
              </div>
              {!note ? (
                <button onClick={startManual} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                  Start composing <ArrowRight size={18} />
                </button>
              ) : (
                <>
                  <NoteBuilder note={note} onChange={setNote} />
                  <button onClick={goReview} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    Continue to review <ArrowRight size={18} />
                  </button>
                </>
              )}
            </>
          )}

          {method === 'external' && (
            <>
              <div style={{ fontSize: 13, color: '#777', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12 }}>
                Use your own AI (ChatGPT, Claude, Gemini app) and spend zero server tokens:
                copy our format, paste it plus your raw notes into your AI, paste the JSON it returns below.
              </div>
              <button onClick={copyFormat} disabled={formatLoading} style={{ padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 12, fontWeight: 800, fontSize: 14, color: '#059669', opacity: formatLoading ? 0.6 : 1 }}>
                {formatLoading ? 'Loading format…' : copied ? 'Copied — paste it into your AI' : 'Copy AI format'}
              </button>
              {formatPack && (
                <details style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: '10px 14px' }}>
                  <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View format text (manual copy)</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: '#fafafa', padding: 10, borderRadius: 8, marginTop: 8, maxHeight: 240, overflow: 'auto' }}>{formatPack}</pre>
                </details>
              )}
              <label style={label}>
                AI output (JSON)
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} spellCheck={false} placeholder="Paste the JSON your AI returned…" style={{ ...input, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
              </label>
              <button onClick={importPasted} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                Import into review <ArrowRight size={18} />
              </button>
            </>
          )}
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
            {validation && !validation.valid && Array.isArray(validation.errors) && validation.errors.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
                {(validation.errors as unknown[]).slice(0, 8).map((e, i) => (
                  <li key={i}>{String(e)}</li>
                ))}
                {(validation.errors as unknown[]).length > 8 && (
                  <li>…and {(validation.errors as unknown[]).length - 8} more</li>
                )}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setEditing((v) => !v); }} style={{ flex: 1, padding: 10, background: editing ? '#10b981' : '#fff', color: editing ? '#fff' : '#059669', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 12, fontWeight: 800, fontSize: 13 }}>
                {editing ? 'Done editing' : 'Edit content'}
              </button>
              {!editing && (
                <button onClick={revalidate} style={{ flex: 1, padding: 10, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 12, fontWeight: 800, fontSize: 13 }}>
                  Check again
                </button>
              )}
            </div>
          </div>
          {editing ? (
            <NoteBuilder note={note} onChange={(n) => { setNote(n); setValidation(null); }} />
          ) : (
            <>
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {note.topics.map((t) => (
                  <div key={t.number} style={{ marginBottom: 12 }}>
                    <TopicSlice topic={t} />
                    <button
                      onClick={() => publishTopic(t.number)}
                      disabled={publishingTopic !== null}
                      style={{ marginTop: 6, padding: '8px 14px', borderRadius: 9999, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 700, fontSize: 12, color: '#059669' }}
                    >
                      {publishingTopic === t.number ? 'Publishing…' : `Publish only Topic ${t.number}`}
                    </button>
                  </div>
                ))}
              </div>
              {note.eoq.questions.length > 0 && (
                <div style={{ maxWidth: 640, margin: '16px auto 0' }}>
                  <EoqQuiz eoq={note.eoq} course={note.course} week={note.week} preview />
                </div>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, minWidth: 120, padding: 14, background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 800 }}>
              Back to compose
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
