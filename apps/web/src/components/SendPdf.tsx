import { useEffect, useRef, useState } from 'react';
import { FileText, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { supabaseBrowser } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { compressPdf, PDF_MAX_BYTES, sizeText } from '../lib/pdfCompress';
import Drop from './Drop';

// Send a PDF (lecturer): pick a file, it's compressed on the phone, uploaded
// straight to storage, then posted to every class taking the course (bell +
// push) and saved to the course's materials for its contributor.
type Stage = 'pick' | 'compressing' | 'uploading' | 'sending' | 'done';
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, marginTop: 4 };

export default function SendPdf({ courses, course: fixed, week: presetWeek, onClose }: { courses?: string[]; course?: string; week?: number; onClose: () => void }) {
  const [course, setCourse] = useState(fixed || courses?.[0] || '');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [week, setWeek] = useState(presetWeek || 1);
  const [type, setType] = useState<'slides' | 'notes' | 'past-paper'>('slides');
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  const [reached, setReached] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Default the week to this week of the semester.
  useEffect(() => {
    if (presetWeek) return;
    api.settings().then((s) => {
      if (!s.semesterStart) return;
      const w = Math.floor((Date.now() - new Date(`${s.semesterStart}T00:00:00+01:00`).getTime()) / (7 * 86400000)) + 1;
      if (w >= 1 && w <= 30) setWeek(w);
    }).catch(() => {});
  }, []);

  const pick = (f: File | null) => {
    setErr('');
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setErr('Pick a PDF file.'); return; }
    if (f.size > PDF_MAX_BYTES) { setErr(`That PDF is ${sizeText(f.size)}. The limit is 25 MB.`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 120));
  };

  const send = async () => {
    if (!file || !course || !title.trim()) return;
    setErr('');
    try {
      setStage('compressing');
      setProgress('Getting it ready…');
      const c = await compressPdf(file, (done, total) => setProgress(`Shrinking page ${done} of ${total}…`)).catch(() => ({ file, before: file.size, after: file.size, compressed: false, pages: 0 }));
      setProgress(c.compressed ? `${sizeText(c.before)} → ${sizeText(c.after)}` : `${sizeText(c.after)}`);
      setStage('uploading');
      const up = await api.lecturerPdfUploadUrl({ course, filename: c.file.name, size: c.file.size });
      const sb = supabaseBrowser();
      if (!sb) throw new Error('Sign-in session missing. Reload and try again.');
      const { error } = await sb.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, c.file, { contentType: 'application/pdf' });
      if (error) throw error;
      setStage('sending');
      const r = await api.lecturerPdfSend({ course, path: up.path, title: title.trim(), message: message.trim() || undefined, week, type, sizeKb: Math.round(c.file.size / 1024) });
      setReached(r.reached);
      setStage('done');
    } catch (e) {
      setErr(describeError(e, 'send that PDF'));
      setStage('pick');
    }
  };

  const busy = stage === 'compressing' || stage === 'uploading' || stage === 'sending';
  return (
    <div role="dialog" aria-modal="true" aria-label="Send a PDF" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => { if (!busy) onClose(); }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '92svh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '22px 22px 0 0', padding: '18px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22 }}>Send a PDF</span>
          {!busy && <button aria-label="Close" onClick={onClose} style={{ display: 'flex', background: 'none', border: 'none', color: 'var(--text2)' }}><X size={20} /></button>}
        </div>
        {stage === 'done' ? (
          <div style={{ textAlign: 'center', padding: '24px 0 4px' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div className="t-15 w-7" style={{ marginTop: 8 }}>Sent to {reached} student{reached === 1 ? '' : 's'} taking {course}</div>
            <div className="t-13 muted" style={{ marginTop: 4 }}>{progress ? `${progress} · ` : ''}It's also saved under Week {week} for the course's contributor.</div>
            <button className="btn btn--amber btn--block" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="t-13 muted" style={{ marginTop: 4 }}>It's shrunk on your phone so it sends fast, then every class taking the course gets it (bell + push), and the contributor gets it to turn into notes.</div>
            {!fixed && courses && courses.length > 0 && (
              <div style={{ marginTop: 12 }}><Drop value={course} onChange={setCourse} label="Course" options={courses.map((c) => ({ value: c, label: c }))} style={{ width: '100%' }} /></div>
            )}
            <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0] || null)} />
            <button className="btn btn--white btn--block" style={{ marginTop: 12 }} disabled={busy} onClick={() => input.current?.click()}>
              <FileText size={16} /> {file ? `${file.name.slice(0, 32)} · ${sizeText(file.size)}` : 'Choose a PDF (up to 25 MB)'}
            </button>
            {file && (
              <>
                <label className="t-13 w-7" style={{ display: 'block', marginTop: 12 }}>Title
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} style={field} disabled={busy} />
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <label className="t-13 w-7" style={{ flex: 1 }}>Week
                    <input type="number" min={1} max={30} value={week} onChange={(e) => setWeek(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={field} disabled={busy} />
                  </label>
                  <div style={{ flex: 2 }}>
                    <span className="t-13 w-7">Type</span>
                    <div style={{ marginTop: 4 }}><Drop value={type} onChange={(v) => setType(v as typeof type)} label="Type" options={[{ value: 'slides', label: 'Slides' }, { value: 'notes', label: 'Notes / handout' }, { value: 'past-paper', label: 'Past questions' }]} style={{ width: '100%' }} /></div>
                  </div>
                </div>
                <label className="t-13 w-7" style={{ display: 'block', marginTop: 10 }}>Message to students <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Read pages 4–9 before Thursday's class." style={{ ...field, resize: 'vertical' }} disabled={busy} />
                </label>
              </>
            )}
            {busy && <div className="t-13 w-7" style={{ marginTop: 12, color: 'var(--u-good)' }}>{stage === 'compressing' ? progress : stage === 'uploading' ? `Uploading… ${progress}` : 'Sending to your students…'}</div>}
            {err && <div className="t-13" style={{ marginTop: 10, color: 'var(--u-red)', fontWeight: 700 }}>{err}</div>}
            <button className="btn btn--amber btn--block" style={{ marginTop: 14 }} disabled={!file || !course || !title.trim() || busy} onClick={() => void send()}>
              <Send size={16} /> {busy ? 'Sending…' : 'Send to students'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
