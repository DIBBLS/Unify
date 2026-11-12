import type { UnifyNote } from '../types/note';

// Keywords: a word game built from one week's notes. Each level hides one
// key term of the week; its letters sit on a wheel and its clue comes from
// the notes (the symbol's meaning, the blank in a fill-in question, the
// question an answer belongs to). The other words to find are words the
// notes themselves use that can be spelt from the same letters, so every
// word in the game is course vocabulary and nothing extra is downloaded.

export type Term = { word: string; display: string; clue: string };
export type Level = { term: Term; letters: string[]; slots: string[]; bonus: string[] };

const strip = (s: string) => {
  const noTags = s.replace(/<[^>]*>/g, ' ');
  try {
    const el = document.createElement('textarea');
    el.innerHTML = noTags;
    return el.value.replace(/\s+/g, ' ').trim();
  } catch {
    return noTags.replace(/\s+/g, ' ').trim();
  }
};
const noMaths = (s: string) => s.replace(/\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$/g, ' ');
const lettersOf = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

// A term can go on the wheel if it is a word or two made of letters only,
// with 4 to 9 letters in all.
function asTerm(raw: string, clue: string, maxLen = 9): Term | null {
  const display = strip(raw).replace(/[.,;:!?]+$/, '').trim();
  if (!/^[A-Za-z][A-Za-z'’ -]*$/.test(display)) return null;
  if (display.split(/[\s-]+/).length > 2) return null;
  const word = lettersOf(display);
  if (word.length < 4 || word.length > maxLen) return null;
  let c = strip(noMaths(clue));
  // Never give the answer away in its own clue.
  const re = new RegExp(display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  c = c.replace(re, '_____').replace(/_{3,}/g, '_____');
  if (c.length < 8) return null;
  if (c.length > 220) c = c.slice(0, 217).replace(/\s+\S*$/, '') + '…';
  return { word, display, clue: c };
}

export function extractTerms(note: UnifyNote, maxLen = 9): Term[] {
  const out: Term[] = [];
  const term = (raw: string, clue: string) => asTerm(raw, clue, maxLen);
  const add = (t: Term | null) => { if (t && !out.some((x) => x.word === t.word)) out.push(t); };
  for (const topic of note.topics || []) {
    for (const sub of topic.subtopics || []) {
      for (const b of sub.content || []) {
        if (b.type === 'symbol') add(term(b.name, b.desc));
        // Bold terms in the text: the sentence they sit in is the clue.
        const texts = b.type === 'paragraph' || b.type === 'insight' || b.type === 'analogy' ? [b.text] : b.type === 'bullets' ? b.items : [];
        for (const text of texts) {
          for (const m of text.matchAll(/<(?:strong|b)>([^<]+)<\/(?:strong|b)>/gi)) {
            const sentence = text.split(/(?<=[.!?])\s+/).find((s) => s.includes(m[0])) || text;
            add(term(m[1], sentence));
          }
        }
      }
      for (const q of sub.miniCheck?.questions || []) {
        if (q.type === 'fitb') add(term(q.acceptedAnswers?.[0] || '', q.question));
        if (q.type === 'mcq') add(term(q.options?.[q.correctIndex] || '', q.question));
        if (q.type === 'reveal') {
          const m = /<strong>([^<]+)<\/strong>/i.exec(q.answer || '');
          if (m) add(term(m[1], q.question));
        }
      }
    }
    for (const q of topic.pulseCheck?.questions || []) {
      if (q.type === 'fitb') add(term(q.acceptedAnswers?.[0] || '', q.question));
      if (q.type === 'mcq') add(term(q.options?.[q.correctIndex] || '', q.question));
    }
    for (const r of topic.activeRecall || []) {
      // "What is a capacitor?" → the term is in the question, the clue is the answer.
      const m = /^(?:what|who)\s+(?:is|are|was|were)\s+(?:an?\s+|the\s+)?([^?]+)\?\s*$/i.exec(strip(r.question));
      if (m) add(term(m[1], r.answer));
    }
  }
  for (const q of note.eoq?.questions || []) {
    if (q.type === 'fitb') add(term(q.acceptedAnswers?.[0] || '', q.question));
    if (q.type === 'mcq' && q.options && q.correct) {
      const idx = 'ABCDEFGH'.indexOf(q.correct.trim().toUpperCase());
      const opt = idx >= 0 ? q.options[idx] : q.options.find((o) => o.trim() === q.correct?.trim());
      if (opt) add(term(opt, q.question));
    }
  }
  return out;
}

// Every word the week's notes use (3 to 9 letters), plus the terms.
export function courseDictionary(note: UnifyNote, terms: Term[]): Set<string> {
  const words = new Set<string>(terms.map((t) => t.word));
  const take = (s?: string) => {
    if (!s) return;
    for (const w of strip(noMaths(s)).split(/[^A-Za-z]+/)) {
      if (w.length >= 3 && w.length <= 9 && !/[A-Z].*[A-Z]/.test(w.slice(1))) words.add(w.toUpperCase());
    }
  };
  take(note.title);
  take(note.subtitle);
  for (const t of note.topics || []) {
    take(t.title);
    for (const s of t.subtopics || []) {
      take(s.title);
      for (const b of s.content || []) {
        if (b.type === 'paragraph' || b.type === 'insight' || b.type === 'analogy') take(b.text);
        if (b.type === 'bullets') b.items.forEach(take);
        if (b.type === 'symbol') { take(b.name); take(b.desc); }
        if (b.type === 'formula') { take(b.label); take(b.note); }
        if (b.type === 'diagram') { take(b.caption); take(b.description); }
      }
      for (const q of s.miniCheck?.questions || []) take(q.question);
    }
    for (const r of t.activeRecall || []) { take(r.question); take(r.answer); }
  }
  return words;
}

// Can `word` be spelt from `letters` (each letter used at most as often as it appears)?
export function spellable(word: string, letters: string[]): boolean {
  const pool: Record<string, number> = {};
  for (const l of letters) pool[l] = (pool[l] || 0) + 1;
  for (const c of word) {
    if (!pool[c]) return false;
    pool[c] -= 1;
  }
  return true;
}

function shuffle<T>(a: T[], seed: number): T[] {
  const out = [...a];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never start with the answer already spelt out.
  if (out.join('') === a.join('') && out.length > 1) [out[0], out[1]] = [out[1], out[0]];
  return out;
}

export function buildLevels(note: UnifyNote, max = 12): Level[] {
  const terms = extractTerms(note);
  const dict = courseDictionary(note, terms);
  // Mid-length terms make the best wheels; keep the notes' order otherwise.
  const picked = terms
    .map((t, i) => ({ t, i, score: Math.abs(t.word.length - 6) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.t);
  return picked.map((term, n) => {
    const letters = term.word.split('');
    const fits = [...dict].filter((w) => w !== term.word && w.length >= 3 && w.length <= letters.length && spellable(w, letters));
    fits.sort((a, b) => b.length - a.length || a.localeCompare(b));
    const slots = [term.word, ...fits.slice(0, 5)];
    const bonus = fits.slice(5);
    return { term, letters: shuffle(letters, term.word.length * 31 + n * 7 + 3), slots, bonus };
  });
}
