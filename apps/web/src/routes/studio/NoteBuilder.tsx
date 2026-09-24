import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type {
  ContentBlock,
  EOQ,
  MiniCheckQuestion,
  Subtopic,
  Topic,
  UnifyNote,
} from '../../types/note';

// Visual note editor: builds the exact UnifyNote JSON through forms, so
// non-technical authors never touch raw JSON. Used both for manual compose
// (from scratch) and for editing converted/imported notes in review.

const input = {
  width: '100%',
  padding: 10,
  marginTop: 4,
  border: '1px solid #e5e5e5',
  borderRadius: 10,
  display: 'block',
  fontSize: 14,
} as const;
const area = { ...input, resize: 'vertical' } as const;
const label = { fontSize: 12, fontWeight: 700, display: 'block' } as const;
const card = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
} as const;
const sectionTitle = { fontFamily: 'Nunito', fontWeight: 800, fontSize: 16, margin: '0 0 8px' } as const;
const hint = { fontSize: 11, color: '#b45309', fontWeight: 700, marginTop: 6 } as const;
const iconBtn = {
  padding: 6,
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #e5e5e5',
  color: '#777',
  display: 'flex',
} as const;
const dangerBtn = { ...iconBtn, color: '#991b1b', border: '1px solid #fecaca' } as const;
const addBtn = {
  padding: '8px 14px',
  borderRadius: 9999,
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  color: '#059669',
  fontWeight: 800,
  fontSize: 12,
  display: 'inline-flex',
  gap: 4,
  alignItems: 'center',
} as const;

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ---- blank factories ----
export function blankSubtopic(topicNum: number): Subtopic {
  return {
    number: `${topicNum}.1`,
    abbr: '',
    title: '',
    content: [{ type: 'paragraph', text: '' }],
    miniCheck: { questions: [{ type: 'reveal', question: '', answer: '' }] },
  };
}

export function blankTopic(n: number): Topic {
  return {
    number: n,
    title: '',
    abbr: '',
    subtopics: [blankSubtopic(n)],
    activeRecall: [],
    pulseCheck: {
      number: n,
      questions: [
        { type: 'mcq', question: '', options: ['', ''], correctIndex: 0 },
        { type: 'mcq', question: '', options: ['', ''], correctIndex: 0 },
        { type: 'fitb', question: '', acceptedAnswers: [''] },
      ],
    },
  };
}

export function blankNote(course: string, week: number): UnifyNote {
  return {
    course,
    week,
    title: '',
    subtitle: '',
    learningOutcome: '',
    metaChips: [course, `Week ${week}`],
    tags: [],
    topics: [blankTopic(1)],
    eoq: { questions: [] },
  };
}

// Defensive normalizer for pasted external-AI JSON (and legacy weeks):
// fills every field the reader and this editor touch, drops nothing.
export function normalizeNote(raw: unknown): UnifyNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.topics) || r.topics.length === 0) return null;
  const topics: Topic[] = (r.topics as unknown[]).map((t, ti) => {
    const tt = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
    const subs = Array.isArray(tt.subtopics) && tt.subtopics.length ? tt.subtopics : [{}];
    const pulse =
      tt.pulseCheck && typeof tt.pulseCheck === 'object'
        ? (tt.pulseCheck as { number?: unknown; questions?: unknown })
        : null;
    return {
      number: typeof tt.number === 'number' ? tt.number : ti + 1,
      title: typeof tt.title === 'string' ? tt.title : '',
      abbr: typeof tt.abbr === 'string' ? tt.abbr : '',
      subtopics: subs.map((s, si) => {
        const ss = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
        const mc =
          ss.miniCheck && typeof ss.miniCheck === 'object'
            ? (ss.miniCheck as { questions?: unknown })
            : {};
        return {
          number: typeof ss.number === 'string' ? ss.number : `${ti + 1}.${si + 1}`,
          abbr: typeof ss.abbr === 'string' ? ss.abbr : '',
          title: typeof ss.title === 'string' ? ss.title : '',
          content: Array.isArray(ss.content) ? (ss.content as ContentBlock[]) : [],
          miniCheck: {
            questions: Array.isArray(mc.questions) ? (mc.questions as MiniCheckQuestion[]) : [],
          },
        };
      }),
      activeRecall: Array.isArray(tt.activeRecall)
        ? (tt.activeRecall as NonNullable<Topic['activeRecall']>)
        : [],
      pulseCheck: pulse
        ? {
            number: typeof pulse.number === 'number' ? pulse.number : ti + 1,
            questions: Array.isArray(pulse.questions)
              ? (pulse.questions as MiniCheckQuestion[])
              : [],
          }
        : undefined,
    };
  });
  const eoqRaw = (r.eoq && typeof r.eoq === 'object' ? r.eoq : {}) as { questions?: unknown };
  return {
    course: typeof r.course === 'string' ? r.course : '',
    week: typeof r.week === 'number' ? r.week : 1,
    title: typeof r.title === 'string' ? r.title : '',
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : '',
    learningOutcome: typeof r.learningOutcome === 'string' ? r.learningOutcome : '',
    metaChips: Array.isArray(r.metaChips) ? (r.metaChips as string[]).filter((x) => typeof x === 'string') : [],
    tags: Array.isArray(r.tags) ? (r.tags as string[]).filter((x) => typeof x === 'string') : [],
    topics,
    eoq: { questions: Array.isArray(eoqRaw.questions) ? (eoqRaw.questions as EOQ['questions']) : [] },
  };
}

function blankBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', text: '' };
    case 'bullets':
      return { type: 'bullets', items: [] };
    case 'formula':
      return { type: 'formula', label: '', equation: '', note: '' };
    case 'symbol':
      return { type: 'symbol', symbol: '', name: '', desc: '' };
    case 'insight':
      return { type: 'insight', text: '' };
    case 'analogy':
      return { type: 'analogy', text: '' };
    case 'diagram':
      return { type: 'diagram', caption: '', description: '', imageRef: null };
    case 'workedExample':
      return { type: 'workedExample', eyebrow: 'Worked Example', title: '', given: [], steps: [], result: '' };
  }
}

function blankQuestion(type: MiniCheckQuestion['type']): MiniCheckQuestion {
  if (type === 'mcq') return { type: 'mcq', question: '', options: ['', ''], correctIndex: 0 };
  if (type === 'fitb') return { type: 'fitb', question: '', acceptedAnswers: [''] };
  return { type: 'reveal', question: '', answer: '' };
}

const BLOCK_TYPES: { id: ContentBlock['type']; label: string }[] = [
  { id: 'paragraph', label: 'Text' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'formula', label: 'Formula' },
  { id: 'insight', label: 'Insight' },
  { id: 'analogy', label: 'Analogy' },
  { id: 'symbol', label: 'Symbol' },
  { id: 'diagram', label: 'Diagram' },
];

const CHECK_TYPES: { id: MiniCheckQuestion['type']; label: string }[] = [
  { id: 'mcq', label: 'MCQ' },
  { id: 'fitb', label: 'Fill-in' },
  { id: 'reveal', label: 'Reveal' },
];

// ---- block editor ----
function BlockEditor({
  block,
  onChange,
  onDelete,
  onUp,
  onDown,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const head = (title: string) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
      <select
        value={block.type}
        onChange={(e) => onChange(blankBlock(e.target.value as ContentBlock['type']))}
        style={{ ...input, marginTop: 0, width: 'auto', padding: '6px 10px', fontSize: 12, fontWeight: 700 }}
        aria-label="Block type"
      >
        {BLOCK_TYPES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <span style={{ flex: 1 }} />
      <button onClick={onUp} style={iconBtn} aria-label="Move up"><ChevronUp size={14} /></button>
      <button onClick={onDown} style={iconBtn} aria-label="Move down"><ChevronDown size={14} /></button>
      <button onClick={onDelete} style={dangerBtn} aria-label="Delete block"><Trash2 size={14} /></button>
    </div>
  );
  if (block.type === 'paragraph') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Text')}
        <textarea value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} rows={3} placeholder="Paragraph text (HTML like <strong> allowed)…" style={area} />
      </div>
    );
  }
  if (block.type === 'bullets') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Bullets')}
        <textarea
          value={block.items.join('\n')}
          onChange={(e) => onChange({ ...block, items: e.target.value.split('\n') })}
          rows={4}
          placeholder={'One bullet per line…'}
          style={area}
        />
      </div>
    );
  }
  if (block.type === 'formula') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Formula')}
        <label style={label}>Label<input value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} placeholder="e.g. Arithmetic mean" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Equation (LaTeX)<textarea value={block.equation} onChange={(e) => onChange({ ...block, equation: e.target.value })} rows={2} placeholder="\[ P = \frac{a}{b} \]" style={area} /></label>
        <label style={{ ...label, marginTop: 8 }}>Note (optional)<input value={block.note || ''} onChange={(e) => onChange({ ...block, note: e.target.value })} placeholder="What the symbols mean…" style={input} /></label>
      </div>
    );
  }
  if (block.type === 'symbol') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Symbol')}
        <label style={label}>Symbol<input value={block.symbol} onChange={(e) => onChange({ ...block, symbol: e.target.value })} placeholder="e.g. Ns" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Name<input value={block.name} onChange={(e) => onChange({ ...block, name: e.target.value })} placeholder="e.g. Synchronous speed" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Description<textarea value={block.desc} onChange={(e) => onChange({ ...block, desc: e.target.value })} rows={2} style={area} /></label>
      </div>
    );
  }
  if (block.type === 'insight') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Insight')}
        <textarea value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} rows={2} placeholder="Key insight, common mistake…" style={area} />
      </div>
    );
  }
  if (block.type === 'analogy') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Analogy')}
        <textarea value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} rows={2} placeholder="Real-world analogy…" style={area} />
      </div>
    );
  }
  if (block.type === 'diagram') {
    return (
      <div style={{ ...card, background: '#fafafa' }}>
        {head('Diagram')}
        <label style={label}>Caption<input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Fig 2.1 — …" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Description<textarea value={block.description} onChange={(e) => onChange({ ...block, description: e.target.value })} rows={2} placeholder="What the figure shows…" style={area} /></label>
      </div>
    );
  }
  // workedExample: advanced shape — preserved read-only, deletable.
  return (
    <div style={{ ...card, background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>Worked example (advanced — kept as-is)</span>
        <span style={{ flex: 1 }} />
        <button onClick={onUp} style={iconBtn} aria-label="Move up"><ChevronUp size={14} /></button>
        <button onClick={onDown} style={iconBtn} aria-label="Move down"><ChevronDown size={14} /></button>
        <button onClick={onDelete} style={dangerBtn} aria-label="Delete block"><Trash2 size={14} /></button>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{block.title || '(untitled example)'}</div>
      <div style={{ fontSize: 12, color: '#777' }}>{block.steps.length} step(s){block.result ? ` · result: ${block.result.slice(0, 60)}` : ''}</div>
    </div>
  );
}

// ---- check question editor ----
function QuestionEditor({
  q,
  lockType,
  onChange,
  onDelete,
}: {
  q: MiniCheckQuestion;
  lockType?: MiniCheckQuestion['type'];
  onChange: (q: MiniCheckQuestion) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ ...card, background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {lockType ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>{lockType.toUpperCase()} (fixed)</span>
        ) : (
          <select value={q.type} onChange={(e) => onChange(blankQuestion(e.target.value as MiniCheckQuestion['type']))} style={{ ...input, marginTop: 0, width: 'auto', padding: '6px 10px', fontSize: 12, fontWeight: 700 }} aria-label="Question type">
            {CHECK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onDelete} style={dangerBtn} aria-label="Delete question"><Trash2 size={14} /></button>
      </div>
      <label style={label}>Question<textarea value={q.question} onChange={(e) => onChange({ ...q, question: e.target.value })} rows={2} placeholder={q.type === 'fitb' ? 'Use ________ for the blank…' : 'Question text…'} style={area} /></label>
      {q.type === 'mcq' && (
        <>
          <label style={{ ...label, marginTop: 8 }}>Options (one per line)<textarea value={q.options.join('\n')} onChange={(e) => { const options = e.target.value.split('\n'); onChange({ ...q, options, correctIndex: Math.min(q.correctIndex, Math.max(options.length - 1, 0)) }); }} rows={Math.max(q.options.length + 1, 2)} style={area} /></label>
          <label style={{ ...label, marginTop: 8 }}>Correct answer
            <select value={q.correctIndex} onChange={(e) => onChange({ ...q, correctIndex: Number(e.target.value) })} style={input}>
              {q.options.map((o, i) => (
                <option key={i} value={i}>{String.fromCharCode(65 + i)} — {(o || '').slice(0, 40) || `(option ${i + 1})`}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {q.type === 'fitb' && (
        <label style={{ ...label, marginTop: 8 }}>Accepted answers (one per line)<textarea value={q.acceptedAnswers.join('\n')} onChange={(e) => onChange({ ...q, acceptedAnswers: e.target.value.split('\n') })} rows={2} style={area} /></label>
      )}
      {q.type === 'reveal' && (
        <label style={{ ...label, marginTop: 8 }}>Answer<textarea value={q.answer} onChange={(e) => onChange({ ...q, answer: e.target.value })} rows={2} style={area} /></label>
      )}
    </div>
  );
}

// ---- main builder ----
export function NoteBuilder({ note, onChange }: { note: UnifyNote; onChange: (n: UnifyNote) => void }) {
  const set = (patch: Partial<UnifyNote>) => onChange({ ...note, ...patch });
  const setTopics = (topics: Topic[]) => set({ topics });

  const renumber = (topics: Topic[]): Topic[] =>
    topics.map((t, ti) => ({
      ...t,
      number: ti + 1,
      pulseCheck: t.pulseCheck ? { ...t.pulseCheck, number: ti + 1 } : t.pulseCheck,
      subtopics: t.subtopics.map((s, si) => ({ ...s, number: `${ti + 1}.${si + 1}` })),
    }));

  const mcqCount = note.eoq.questions.filter((q) => q.type === 'mcq').length;
  const fitbCount = note.eoq.questions.filter((q) => q.type === 'fitb').length;

  return (
    <div>
      <div style={card}>
        <h3 style={sectionTitle}>Week details</h3>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>{note.course} · Week {note.week}</div>
        <label style={label}>Week title<input value={note.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Energy Sources" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Subtitle<input value={note.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="One-line summary" style={input} /></label>
        <label style={{ ...label, marginTop: 8 }}>Learning outcome<textarea value={note.learningOutcome} onChange={(e) => set({ learningOutcome: e.target.value })} rows={2} placeholder="By the end of this week…" style={area} /></label>
        <label style={{ ...label, marginTop: 8 }}>Tags (comma-separated)<input value={note.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Turbine, Density" style={input} /></label>
      </div>

      {note.topics.map((t, ti) => (
        <div key={ti} style={card}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ ...sectionTitle, margin: 0, flex: 1 }}>Topic {ti + 1}</h3>
            <button onClick={() => setTopics(renumber(move(note.topics, ti, -1)))} style={iconBtn} aria-label="Move topic up"><ChevronUp size={14} /></button>
            <button onClick={() => setTopics(renumber(move(note.topics, ti, 1)))} style={iconBtn} aria-label="Move topic down"><ChevronDown size={14} /></button>
            <button onClick={() => { if (note.topics.length > 1 && window.confirm(`Delete Topic ${ti + 1}?`)) setTopics(renumber(note.topics.filter((_, xi) => xi !== ti))); }} disabled={note.topics.length <= 1} style={{ ...dangerBtn, opacity: note.topics.length <= 1 ? 0.4 : 1 }} aria-label="Delete topic"><Trash2 size={14} /></button>
          </div>
          <label style={label}>Title<input value={t.title} onChange={(e) => { const topics = [...note.topics]; topics[ti] = { ...t, title: e.target.value }; setTopics(topics); }} placeholder="Topic title" style={input} /></label>
          <label style={{ ...label, marginTop: 8 }}>Short tag<input value={t.abbr} onChange={(e) => { const topics = [...note.topics]; topics[ti] = { ...t, abbr: e.target.value }; setTopics(topics); }} placeholder="e.g. HYDRO" style={input} /></label>

          {t.subtopics.map((s, si) => (
            <div key={si} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e5e5' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', marginBottom: 8 }}>Part {s.number} · {s.title || '(untitled)'}</div>
              <label style={label}>Part title<input value={s.title} onChange={(e) => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, title: e.target.value }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }} placeholder="Section title" style={input} /></label>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.content.map((b, bi) => (
                  <BlockEditor
                    key={bi}
                    block={b}
                    onChange={(nb) => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; const blocks = [...subs[si].content]; blocks[bi] = nb; subs[si] = { ...s, content: blocks }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                    onDelete={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, content: subs[si].content.filter((_, xi) => xi !== bi) }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                    onUp={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, content: move(subs[si].content, bi, -1) }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                    onDown={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, content: move(subs[si].content, bi, 1) }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {BLOCK_TYPES.map((bt) => (
                  <button key={bt.id} onClick={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, content: [...subs[si].content, blankBlock(bt.id)] }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }} style={addBtn}>
                    <Plus size={12} /> {bt.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Quick checks ({s.miniCheck.questions.length})</div>
                {s.miniCheck.questions.length === 0 && <div style={hint}>Add at least 1 check question.</div>}
                {s.miniCheck.questions.map((q, qi) => (
                  <QuestionEditor
                    key={qi}
                    q={q}
                    onChange={(nq) => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; const qs = [...subs[si].miniCheck.questions]; qs[qi] = nq; subs[si] = { ...s, miniCheck: { questions: qs } }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                    onDelete={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, miniCheck: { questions: subs[si].miniCheck.questions.filter((_, xi) => xi !== qi) } }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }}
                  />
                ))}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {CHECK_TYPES.map((ct) => (
                    <button key={ct.id} onClick={() => { const topics = [...note.topics]; const subs = [...topics[ti].subtopics]; subs[si] = { ...s, miniCheck: { questions: [...subs[si].miniCheck.questions, blankQuestion(ct.id)] } }; topics[ti] = { ...t, subtopics: subs }; setTopics(topics); }} style={addBtn}>
                      <Plus size={12} /> {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              {t.subtopics.length > 1 && (
                <button onClick={() => { const topics = [...note.topics]; topics[ti] = { ...t, subtopics: t.subtopics.filter((_, xi) => xi !== si) }; setTopics(renumber(topics)); }} style={{ ...dangerBtn, marginTop: 8, fontSize: 12, fontWeight: 700, padding: '6px 12px' }}>
                  Remove this part
                </button>
              )}
            </div>
          ))}
          <button onClick={() => { const topics = [...note.topics]; const subs = [...t.subtopics, blankSubtopic(t.number)]; topics[ti] = { ...t, subtopics: subs }; setTopics(renumber(topics)); }} style={{ ...addBtn, marginTop: 10 }}>
            <Plus size={12} /> Add part
          </button>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e5e5' }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Recall cards ({(t.activeRecall || []).length})</div>
            {(t.activeRecall || []).length === 0 && <div style={hint}>Add at least 1 recall card.</div>}
            {(t.activeRecall || []).map((c, ci) => (
              <div key={ci} style={{ ...card, background: '#fafafa' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>CARD {ci + 1}</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => { const topics = [...note.topics]; topics[ti] = { ...t, activeRecall: (topics[ti].activeRecall || []).filter((_, xi) => xi !== ci) }; setTopics(topics); }} style={dangerBtn} aria-label="Delete recall card"><Trash2 size={14} /></button>
                </div>
                <label style={label}>Badge (Definition / Mechanism / Comparison / Application)<input value={c.badge} onChange={(e) => { const topics = [...note.topics]; const cards = [...(topics[ti].activeRecall || [])]; cards[ci] = { ...c, badge: e.target.value }; topics[ti] = { ...t, activeRecall: cards }; setTopics(topics); }} placeholder="Definition" style={input} /></label>
                <label style={{ ...label, marginTop: 8 }}>Question<textarea value={c.question} onChange={(e) => { const topics = [...note.topics]; const cards = [...(topics[ti].activeRecall || [])]; cards[ci] = { ...c, question: e.target.value }; topics[ti] = { ...t, activeRecall: cards }; setTopics(topics); }} rows={2} style={area} /></label>
                <label style={{ ...label, marginTop: 8 }}>Answer<textarea value={c.answer} onChange={(e) => { const topics = [...note.topics]; const cards = [...(topics[ti].activeRecall || [])]; cards[ci] = { ...c, answer: e.target.value }; topics[ti] = { ...t, activeRecall: cards }; setTopics(topics); }} rows={2} style={area} /></label>
              </div>
            ))}
            <button onClick={() => { const topics = [...note.topics]; topics[ti] = { ...t, activeRecall: [...(topics[ti].activeRecall || []), { badge: 'Definition', question: '', answer: '' }] }; setTopics(topics); }} style={addBtn}>
              <Plus size={12} /> Recall card
            </button>
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e5e5' }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Pulse check (fixed: MCQ, MCQ, Fill-in)</div>
            {(t.pulseCheck?.questions || []).map((q, qi) => (
              <QuestionEditor
                key={qi}
                q={q}
                lockType={qi < 2 ? 'mcq' : 'fitb'}
                onChange={(nq) => {
                  // type locked by position; only fields change
                  const fixed = qi < 2 ? { ...nq, type: 'mcq' as const } : { ...nq, type: 'fitb' as const };
                  const topics = [...note.topics];
                  const qs = [...(topics[ti].pulseCheck?.questions || [])];
                  qs[qi] = fixed as MiniCheckQuestion;
                  topics[ti] = { ...t, pulseCheck: { number: t.number, questions: qs } };
                  setTopics(topics);
                }}
                onDelete={() => {
                  // reset slot instead of removing (shape must stay 3)
                  const topics = [...note.topics];
                  const qs = [...(topics[ti].pulseCheck?.questions || [])];
                  qs[qi] = qi < 2
                    ? { type: 'mcq', question: '', options: ['', ''], correctIndex: 0 }
                    : { type: 'fitb', question: '', acceptedAnswers: [''] };
                  topics[ti] = { ...t, pulseCheck: { number: t.number, questions: qs } };
                  setTopics(topics);
                }}
              />
            ))}
            {!t.pulseCheck && (
              <button onClick={() => { const topics = [...note.topics]; topics[ti] = { ...t, pulseCheck: blankTopic(t.number).pulseCheck }; setTopics(topics); }} style={addBtn}>
                <Plus size={12} /> Add pulse check
              </button>
            )}
          </div>
        </div>
      ))}

      <button onClick={() => setTopics(renumber([...note.topics, blankTopic(note.topics.length + 1)]))} style={{ width: '100%', padding: 14, background: '#fff', border: '1px dashed #a7f3d0', borderRadius: 12, color: '#059669', fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={16} /> Add topic
      </button>

      <div style={{ ...card, marginTop: 12 }}>
        <h3 style={sectionTitle}>End-of-week quiz</h3>
        <div style={{ fontSize: 12, fontWeight: 700, color: mcqCount === 8 && fitbCount === 2 ? '#059669' : '#b45309', marginBottom: 8 }}>
          {note.eoq.questions.length}/10 questions · MCQ {mcqCount}/8 · Fill-in {fitbCount}/2
        </div>
        {note.eoq.questions.map((q, qi) => (
          <div key={qi} style={{ ...card, background: '#fafafa' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>Q{qi + 1}</span>
              <select value={q.type} onChange={(e) => {
                const qs = [...note.eoq.questions];
                qs[qi] = e.target.value === 'mcq'
                  ? { number: qi + 1, type: 'mcq', question: q.question, options: ['', ''], correct: 'A', feedback: q.feedback || { correct: '', wrong: '' }, topicRef: q.topicRef || '1' }
                  : { number: qi + 1, type: 'fitb', question: q.question, acceptedAnswers: [''], feedback: q.feedback || { correct: '', wrong: '' }, topicRef: q.topicRef || '1' };
                set({ eoq: { questions: qs } });
              }} style={{ ...input, marginTop: 0, width: 'auto', padding: '6px 10px', fontSize: 12, fontWeight: 700 }} aria-label="EOQ type">
                <option value="mcq">MCQ</option>
                <option value="fitb">Fill-in</option>
              </select>
              <span style={{ flex: 1 }} />
              <button onClick={() => set({ eoq: { questions: note.eoq.questions.filter((_, xi) => xi !== qi) } })} style={dangerBtn} aria-label="Delete EOQ question"><Trash2 size={14} /></button>
            </div>
            <label style={label}>Question<textarea value={q.question} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, question: e.target.value }; set({ eoq: { questions: qs } }); }} rows={2} placeholder={q.type === 'fitb' ? 'Use ________ for the blank…' : 'Question text…'} style={area} /></label>
            {q.type === 'mcq' && q.options && (
              <>
                <label style={{ ...label, marginTop: 8 }}>Options (one per line)<textarea value={q.options.join('\n')} onChange={(e) => { const qs = [...note.eoq.questions]; const options = e.target.value.split('\n'); qs[qi] = { ...q, options }; set({ eoq: { questions: qs } }); }} rows={Math.max(q.options.length + 1, 2)} style={area} /></label>
                <label style={{ ...label, marginTop: 8 }}>Correct letter
                  <select value={q.correct || 'A'} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, correct: e.target.value }; set({ eoq: { questions: qs } }); }} style={input}>
                    {(q.options.length ? q.options : ['']).map((o, i) => (
                      <option key={i} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)} — {(o || '').slice(0, 40) || `(option ${i + 1})`}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {q.type === 'fitb' && (
              <label style={{ ...label, marginTop: 8 }}>Accepted answers (one per line)<textarea value={(q.acceptedAnswers || []).join('\n')} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, acceptedAnswers: e.target.value.split('\n') }; set({ eoq: { questions: qs } }); }} rows={2} style={area} /></label>
            )}
            <label style={{ ...label, marginTop: 8 }}>Feedback when correct<input value={q.feedback?.correct || ''} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, feedback: { correct: e.target.value, wrong: q.feedback?.wrong || '' } }; set({ eoq: { questions: qs } }); }} style={input} /></label>
            <label style={{ ...label, marginTop: 8 }}>Feedback when wrong<input value={q.feedback?.wrong || ''} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, feedback: { correct: q.feedback?.correct || '', wrong: e.target.value } }; set({ eoq: { questions: qs } }); }} style={input} /></label>
            <label style={{ ...label, marginTop: 8 }}>Topic ref<input value={q.topicRef || ''} onChange={(e) => { const qs = [...note.eoq.questions]; qs[qi] = { ...q, topicRef: e.target.value }; set({ eoq: { questions: qs } }); }} placeholder="e.g. 2" style={input} /></label>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <button onClick={() => { const n = note.eoq.questions.length + 1; set({ eoq: { questions: [...note.eoq.questions, { number: n, type: 'mcq', question: '', options: ['', ''], correct: 'A', feedback: { correct: '', wrong: '' }, topicRef: '1' }] } }); }} style={addBtn}>
            <Plus size={12} /> MCQ
          </button>
          <button onClick={() => { const n = note.eoq.questions.length + 1; set({ eoq: { questions: [...note.eoq.questions, { number: n, type: 'fitb', question: '', acceptedAnswers: [''], feedback: { correct: '', wrong: '' }, topicRef: '1' }] } }); }} style={addBtn}>
            <Plus size={12} /> Fill-in
          </button>
        </div>
      </div>
    </div>
  );
}
