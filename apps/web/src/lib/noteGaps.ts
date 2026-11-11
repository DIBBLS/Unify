import type { UnifyNote, ContentBlock, MiniCheckQuestion } from '../types/note';
import { parses } from './mathAnswer';

// What is still missing before a week can go to Review. Review stays greyed out until this
// list is empty, so nothing half-written reaches the checker or the students. Optional fields
// (tags, quiz feedback lines, diagram images) are not counted here; the Review step still
// lists those as warnings.

const filled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

function blockHasContent(b: ContentBlock): boolean {
  switch (b.type) {
    case 'paragraph':
    case 'insight':
    case 'analogy':
      return filled(b.text);
    case 'bullets':
      return b.items.some(filled);
    case 'formula':
      return filled(b.equation);
    case 'symbol':
      return filled(b.symbol) && filled(b.name);
    case 'workedExample':
      return filled(b.title) && b.steps.length > 0 && filled(b.result);
    case 'diagram':
      return filled(b.caption) || filled(b.description);
  }
}

function questionGap(q: MiniCheckQuestion): string | null {
  if (!filled(q.question)) return 'the question text';
  if (q.type === 'mcq') {
    if (q.options.length < 2 || !q.options.every(filled)) return 'every option';
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) return 'the right answer';
  } else if (q.type === 'fitb') {
    if (!q.acceptedAnswers.some(filled)) return 'an accepted answer';
  } else if (!filled(q.answer)) return 'the answer';
  return null;
}

export function noteGaps(note: UnifyNote | null | undefined, course: string, week: string | number): string[] {
  if (!note) return ['a note to review'];
  const gaps: string[] = [];
  const w = Number(week);
  if (!course.trim()) gaps.push('the course');
  if (!Number.isInteger(w) || w < 1) gaps.push('a valid week number');
  if (!filled(note.title)) gaps.push('the week title');
  if (!filled(note.subtitle)) gaps.push('the subtitle');
  if (!filled(note.learningOutcome)) gaps.push('the learning outcome');
  if (!note.topics.length) gaps.push('at least one topic');

  note.topics.forEach((t, ti) => {
    const T = `Topic ${t.number ?? ti + 1}`;
    if (!filled(t.title)) gaps.push(`${T}: the title`);
    if (!t.subtopics.length) gaps.push(`${T}: at least one part`);
    t.subtopics.forEach((s) => {
      const P = `${T} · Part ${s.number}`;
      if (!filled(s.title)) gaps.push(`${P}: the title`);
      if (!s.content.some(blockHasContent)) gaps.push(`${P}: some content`);
      else if (s.content.some((b) => !blockHasContent(b))) gaps.push(`${P}: an empty block (fill it or delete it)`);
      if (!s.miniCheck.questions.length) gaps.push(`${P}: a quick check`);
      s.miniCheck.questions.forEach((q, qi) => {
        const g = questionGap(q);
        if (g) gaps.push(`${P} · check ${qi + 1}: ${g}`);
      });
    });
    const cards = t.activeRecall || [];
    if (!cards.length) gaps.push(`${T}: a recall card`);
    cards.forEach((c, ci) => {
      if (!filled(c.question) || !filled(c.answer)) gaps.push(`${T} · recall ${ci + 1}: question and answer`);
    });
    const pq = t.pulseCheck?.questions || [];
    if (pq.length < 3) gaps.push(`${T}: the pulse check (3 questions)`);
    pq.forEach((q, qi) => {
      const g = questionGap(q);
      if (g) gaps.push(`${T} · pulse ${qi + 1}: ${g}`);
    });
  });

  const qs = note.eoq.questions;
  const mcq = qs.filter((q) => q.type === 'mcq').length;
  if (qs.length !== 10 || mcq < 6) gaps.push(`the quiz: 10 questions with at least 6 multiple choice (now ${qs.length}, ${mcq} multiple choice)`);
  qs.forEach((q, qi) => {
    const Q = `Quiz question ${qi + 1}`;
    if (!filled(q.question)) gaps.push(`${Q}: the question text`);
    if (q.type === 'mcq') {
      const opts = q.options || [];
      if (opts.length < 2 || !opts.every(filled)) gaps.push(`${Q}: every option`);
      else if (!q.correct || q.correct.charCodeAt(0) - 65 >= opts.length) gaps.push(`${Q}: the right answer`);
    } else if (q.type === 'number') {
      if (!(typeof q.answer === 'number' && Number.isFinite(q.answer))) gaps.push(`${Q}: the number answer`);
    } else if (!(q.acceptedAnswers || []).some(filled)) gaps.push(`${Q}: ${q.type === 'maths' ? 'an accepted expression' : 'an accepted answer'}`);
    // Maths answers must parse, or no student could ever match them.
    if (q.type === 'maths') {
      const bad = (q.acceptedAnswers || []).filter(filled).find((a) => !parses(a));
      if (bad) gaps.push(`${Q}: "${bad}" isn't a maths expression the checker can read`);
    }
  });
  return gaps;
}

export function gapsSummary(gaps: string[], max = 3): string {
  if (!gaps.length) return '';
  const shown = gaps.slice(0, max).join('; ');
  return gaps.length > max ? `${shown}; and ${gaps.length - max} more` : shown;
}
