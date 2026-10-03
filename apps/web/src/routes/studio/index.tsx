import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Flash from '../../components/Flash';
import Loading from '../../components/Loading';
import Mascot from '../../components/Mascot';
import { TopicSlice } from '../../components/TopicSlice';
import EoqQuiz from '../../components/EoqQuiz';
import { NoteBuilder, blankNote, normalizeNote, extractJsonPayload } from './NoteBuilder';
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [convertHint, setConvertHint] = useState('');
  const [canRetryConvert, setCanRetryConvert] = useState(false);
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

  // Course dropdown: collaborators see ONLY assigned courses (server
  // enforces on publish too); everyone else sees the full catalog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, me] = await Promise.all([api.courses(), api.me().catch(() => null)]);
        if (cancelled) return;
        const role = me?.profile?.role;
        const isCollab = role === 'collaborator' && !me?.isAdmin;
        const assigned = new Set((me?.courses || []).map((c) => (c || '').toUpperCase().trim()));
        const scoped = isCollab
          ? list.filter((c) => assigned.has((c.code || '').toUpperCase().trim()))
          : list;
        setCatalog(scoped.map((c) => ({ code: c.code, title: c.title })));
      } catch {
        // offline: manual input fallback below stays
      }
    })();
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
    setConvertHint('');
    setCanRetryConvert(false);
    setWarnings([]);
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
    // Large inputs split server-side into sequential parts — warn upfront
    // so a long conversion never looks stuck.
    const estParts = Math.min(3, Math.max(1, Math.ceil(raw.length / 20000)));
    if (estParts > 1) {
      setConvertHint(`Large input (~${raw.length.toLocaleString()} chars) — converting in ~${estParts} parts. Stay on this page; progress shows below.`);
    }
    setWorking(true);
    try {
      // Async jobs: POST plans instantly, then poll for real part progress.
      const started = await api.convert({
        course: code,
        week: weekNum,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        segmentationMode: mode,
        rawNotesText: raw,
      });
      const total = Math.max(1, started.parts || 1);
      const deadline = Date.now() + 10 * 60000;
      let res: Awaited<ReturnType<typeof api.convertStatus>> | null = null;
      for (;;) {
        if (Date.now() > deadline) throw new Error('Conversion is taking too long — the job may still finish; press Generate again in a minute.');
        await new Promise((r) => setTimeout(r, 3000));
        const st = await api.convertStatus(started.jobId);
        if (st.status === 'working') {
          setConvertHint(`Converting part ${Math.min(st.partsDone + 1, total)} of ${total}${st.currentModel ? ` · ${st.currentModel}` : ''}…`);
          continue;
        }
        res = st;
        break;
      }
      if (!res || res.status !== 'done') throw new Error('Conversion ended unexpectedly.');
      setNote(res.note as UnifyNote);
      setMeta({ course: code, week: weekNum, title: title.trim(), subtitle: subtitle.trim() });
      setValidation(res.validation);
      if (res.warnings?.length) setWarnings(res.warnings);
      if (res.split) {
        const made = (res.parts || []).map((p) => `part ${p.index} (${p.topics} topics, ${p.attempts} attempt${p.attempts === 1 ? '' : 's'})`).join(' + ');
        setConvertHint(made ? `Converted in parts and merged: ${made}. Review before publishing.` : 'Converted in parts and merged. Review before publishing.');
      } else {
        setConvertHint('');
      }
      setEditing(false);
      setStep(1);
    } catch (err) {
      const hint = (err as { hint?: string })?.hint;
      const code = (err as { code?: string })?.code;
      setError(err instanceof Error ? err.message : 'Conversion failed.');
      if (hint) setConvertHint(hint);
      // Retryable by design: rate limits, overloads, model failures.
      // Auth/key and oversize errors need a fix first, not a retry.
      setCanRetryConvert(!code || !['BAD_KEY', 'INPUT_TOO_LARGE'].includes(code));
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

  // External-AI import: paste back whatever your own AI produced with our
  // format pack, normalize defensively, then review like any other note.
  const importPasted = async () => {
    setError('');
    setSuccess('');
    if (!pasted.trim()) {
      setError('Paste the AI output first.');
      return;
    }
    const extracted = extractJsonPayload(pasted);
    if (!extracted.ok) {
      setError(extracted.error);
      return;
    }
    const raw = extracted.value as { topics?: unknown };
    if (!Array.isArray(raw?.topics)) {
      setError('JSON parsed, but it has no "topics" array — ask the AI to follow the format strictly.');
      return;
    }
    if (raw.topics.length === 0) {
      setError('JSON parsed, but "topics" is empty — ask the AI for at least 1 topic.');
      return;
    }
    const clean = normalizeNote(extracted.value);
    if (!clean) {
      setError('JSON parsed, but the topics are unusable — check they have titles and content.');
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
      const tCount = synced.topics.length;
      const qCount = synced.eoq.questions.length;
      if (!res.valid) setSuccess(`Imported (${tCount} topics, ${qCount} quiz Qs) — the checker found problems (listed below). Fix in Edit content or publish anyway.`);
      else setSuccess(`Imported and valid (${tCount} topics, ${qCount} quiz Qs). Review below.`);
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

  const publish = async (mode?: 'add' | 'replace') => {
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
        ...(mode ? { mode } : {}),
      });
      const tags = (res.versions || []).map((v) => `Topic ${v.topic} → v${v.version}`).join(' · ');
      setSuccess(
        mode === 'replace'
          ? `${res.course} · Week ${res.week} replaced (${tags}). Old versions are gone.`
          : tags ? `${res.course} · Week ${res.week} is live (${tags}). Old versions are kept.` : `${res.course} · Week ${res.week} is now live for students.`
      );
      setStep(2);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const existing = (err as { existing?: { topics?: number[]; versions?: number; titles?: string[] } })?.existing;
      if (code === 'WEEK_OCCUPIED' && !mode) {
        const t = (existing?.topics || []).join(', ');
        setOccupy({
          kind: 'week',
          summary: `Week ${meta.week} already has ${existing?.versions || 'some'} published version(s)${t ? ` (topics ${t})` : ''}${existing?.titles?.length ? `: ${existing.titles.join(' · ')}` : ''}.`,
        });
        return;
      }
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

  // Occupied-week/topic choice sheet (BUG-007): Replace / Add as new
  // version / Cancel. Nothing stacks or overwrites silently.
  const [occupy, setOccupy] = useState<null | { kind: 'week' | 'topic'; topic?: number; summary: string }>(null);

  // Publish a single topic as a new version (v1, v2, v3...) without
  // touching the other topics in the week.
  const publishTopic = async (topicNumber: number, mode?: 'add' | 'replace') => {
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
        ...(mode ? { mode } : {}),
      });
      setSuccess(
        mode === 'replace'
          ? `${meta.course} · Week ${meta.week} · Topic ${topicNumber} replaced as fresh v${res.version}. Old versions are gone.`
          : `${meta.course} · Week ${meta.week} · Topic ${topicNumber} saved as v${res.version}. Old versions are kept.`
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const existing = (err as { existing?: { versions?: number[]; title?: string } })?.existing;
      if (code === 'TOPIC_OCCUPIED' && !mode) {
        setOccupy({
          kind: 'topic',
          topic: topicNumber,
          summary: `Topic ${topicNumber} already published (${(existing?.versions || []).map((v) => `v${v}`).join(', ') || 'existing versions'})${existing?.title ? ` — ${existing.title}` : ''}.`,
        });
        return;
      }
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
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'block',
    fontSize: 14,
  } as const;
  const label = { fontSize: 12, fontWeight: 700 } as const;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
      <BackButton to="/dashboard" />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24 }}>Author a week</h1>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 20px' }}>
        {['Compose', 'Review', 'Live'].map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#10b981' : 'var(--border)' }} />
            <div style={{ fontSize: 11, color: i <= step ? '#059669' : 'var(--text3)', fontWeight: 700, marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {error && <Flash tone="error" message={error} onDismiss={() => setError('')} />}
      {success && <Flash tone="success" message={success} onDismiss={() => setSuccess('')} />}
      {convertHint && (
        <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 13, color: '#92400e' }}>
          {convertHint}
          {canRetryConvert && !working && (
            <div style={{ marginTop: 8 }}>
              <button onClick={convert} style={{ padding: '8px 18px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '3px solid #059669', fontWeight: 800, fontSize: 13 }}>
                Retry conversion
              </button>
            </div>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 13, color: '#92400e' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Review before publishing:</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

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
          <button onClick={suggestWeek} style={{ padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 700, fontSize: 13, color: '#059669' }}>
            Suggest next free week
          </button>
          {weeks.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
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
                  border: `1px solid ${method === m ? '#059669' : 'var(--border)'}`,
                  background: method === m ? '#10b981' : 'var(--surface)',
                  color: method === m ? '#fff' : 'var(--text2)',
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
              <details style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
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
              <div style={{ fontSize: 13, color: 'var(--text2)', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12 }}>
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
              <div style={{ fontSize: 13, color: 'var(--text2)', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12 }}>
                Use your own AI (ChatGPT, Claude, Gemini app) and spend zero server tokens:
                copy our format, paste it plus your raw notes into your AI, paste the JSON it returns below.
              </div>
              <button onClick={copyFormat} disabled={formatLoading} style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 12, fontWeight: 800, fontSize: 14, color: '#059669', opacity: formatLoading ? 0.6 : 1 }}>
                {formatLoading ? 'Loading format…' : copied ? 'Copied — paste it into your AI' : 'Copy AI format'}
              </button>
              {formatPack && (
                <details style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
              Review · {meta.course} · Week {meta.week}
            </div>
            <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20, margin: '8px 0 4px' }}>{note.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>{note.subtitle}</p>
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
              <button onClick={() => { setEditing((v) => !v); }} style={{ flex: 1, padding: 10, background: editing ? '#10b981' : 'var(--surface)', color: editing ? '#fff' : '#059669', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 12, fontWeight: 800, fontSize: 13 }}>
                {editing ? 'Done editing' : 'Edit content'}
              </button>
              {!editing && (
                <button onClick={revalidate} style={{ flex: 1, padding: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 12, fontWeight: 800, fontSize: 13 }}>
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
                      style={{ marginTop: 6, padding: '8px 14px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12, color: '#059669' }}
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
            <button onClick={() => setStep(0)} style={{ flex: 1, minWidth: 120, padding: 14, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 800 }}>
              Back to compose
            </button>
            <button onClick={() => publish()} disabled={publishing} style={{ flex: 2, minWidth: 160, padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {publishing ? 'Publishing…' : 'Publish to students'} <ArrowRight size={18} />
            </button>
          </div>
          {occupy && meta && (
            <div className="modal-veil" onClick={() => setOccupy(null)} role="dialog" aria-modal="true" aria-label="Week already published">
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title" style={{ textAlign: 'center' }}>
                  {occupy.kind === 'week' ? `${meta.course} · Week ${meta.week} is already live` : `Topic ${occupy.topic} is already live`}
                </div>
                <div className="modal-body" style={{ textAlign: 'center' }}>{occupy.summary}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
                  <button
                    onClick={() => {
                      const o = occupy;
                      setOccupy(null);
                      if (o.kind === 'week') void publish('replace');
                      else if (o.topic !== undefined) void publishTopic(o.topic, 'replace');
                    }}
                    disabled={publishing || publishingTopic !== null}
                    style={{ padding: 13, borderRadius: 14, background: '#dc2626', color: '#fff', border: 'none', borderBottom: '3px solid #991b1b', fontWeight: 800, fontSize: 14 }}
                  >
                    Replace — remove the old, publish mine as fresh
                  </button>
                  <button
                    onClick={() => {
                      const o = occupy;
                      setOccupy(null);
                      if (o.kind === 'week') void publish('add');
                      else if (o.topic !== undefined) void publishTopic(o.topic, 'add');
                    }}
                    disabled={publishing || publishingTopic !== null}
                    style={{ padding: 13, borderRadius: 14, background: '#059669', color: '#fff', border: 'none', borderBottom: '3px solid #14532d', fontWeight: 800, fontSize: 14 }}
                  >
                    Add as new version — keep everything
                  </button>
                  <button onClick={() => setOccupy(null)} className="modal-cancel" style={{ padding: 13 }}>
                    Cancel — publish nothing
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Mascot size={120} animate="wave" />
          <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 22, marginTop: 12 }}>Live for students</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '8px 0 20px' }}>Find it under your level and course, and on your dashboard.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ flex: 1, padding: 14, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 800 }}>
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
