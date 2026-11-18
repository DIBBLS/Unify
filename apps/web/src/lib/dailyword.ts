import { api } from './api';
import { extractTerms, moreTerms, type Term } from './wordgame';
import type { UnifyNote } from '../types/note';

// Term of the Day: one key term from a course's published notes, the same for
// everyone taking the course that day (chosen from the date and the course,
// so no server pick is needed). Six guesses; letters go green (right place),
// amber (in the word) or grey (not in it).

export const MAX_GUESSES = 6;
export const CLUE_AFTER = 3;
export type Mark = 'hit' | 'near' | 'miss';
export type Daily = { course: string; day: string; week: number; term: Term };

// Local date (students are in Lagos), so the word changes at their midnight.
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayNumber(day: string): number {
  return Math.floor(new Date(`${day}T12:00:00Z`).getTime() / 86400000);
}

// A small, stable hash (FNV-1a): the same course and day give the same pick everywhere.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// One word, 4 to 8 letters: the size that's fun to guess.
const playable = (t: Term) => /^[A-Za-z]+$/.test(t.display) && t.word.length >= 4 && t.word.length <= 8;

// Today's pick is kept on this phone, so opening the game again is instant.
const PICK = 'unify:daily:pick:';
const norm = (c: string) => c.toUpperCase().replace(/\s/g, '');
function cached(course: string, day: string): Daily | null {
  try { const d = JSON.parse(localStorage.getItem(`${PICK}${norm(course)}:${day}`) || 'null') as Daily | null; return d && d.term ? d : null; } catch { return null; }
}
function remember(d: Daily): void {
  try {
    // Drop picks from other days so storage never grows.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PICK) && !k.endsWith(`:${d.day}`)) localStorage.removeItem(k);
    }
    localStorage.setItem(`${PICK}${norm(d.course)}:${d.day}`, JSON.stringify(d));
  } catch { /* fine: it's only a speed-up */ }
}

const termsOf = (note: UnifyNote): Term[] => {
  const base = extractTerms(note, 8);
  return [...base, ...moreTerms(note, base, 8, 20)].filter(playable);
};

// Weeks in a seeded order; up to 3 notes load at once. The pick is the first
// week (in that order) with a playable term, so it's the same on every phone
// however fast each week loads.
async function pickFromWeeks(course: string, weekNums: number[], day: string): Promise<Daily | null> {
  const nums = [...new Set(weekNums)].sort((a, b) => a - b);
  if (!nums.length) return null;
  const seed = hash(`${norm(course)}|${day}`);
  const order = nums.map((_, k) => nums[(seed + k) % nums.length]);
  for (let i = 0; i < order.length; i += 3) {
    const batch = order.slice(i, i + 3);
    const notes = await Promise.all(batch.map((w) => api.week(course, w).then((d) => d.note_json as UnifyNote).catch(() => null)));
    for (let j = 0; j < batch.length; j++) {
      const terms = notes[j] ? termsOf(notes[j]!) : [];
      if (terms.length) {
        const d: Daily = { course, day, week: batch[j], term: terms[(seed >>> 3) % terms.length] };
        remember(d);
        return d;
      }
    }
  }
  return null;
}

// The day's term for one course, or null when its notes have nothing playable.
export async function dailyFor(course: string, day = today()): Promise<Daily | null> {
  const hit = cached(course, day);
  if (hit) return hit;
  const { weeks } = await api.courseWeeks(course);
  return pickFromWeeks(course, weeks.map((w) => w.week), day);
}

// Today's word across the student's courses: today's course in the rotation,
// or the next one that has notes. Every course's week list loads at once.
export async function dailyForAny(courses: string[], day = today()): Promise<Daily | null> {
  const order = courseOfTheDay(courses, day);
  for (const c of order) {
    const hit = cached(c, day);
    if (hit) return hit;
  }
  const lists = await Promise.all(order.map((c) => api.courseWeeks(c).then((r) => r.weeks.map((w) => w.week)).catch(() => [] as number[])));
  for (let i = 0; i < order.length; i++) {
    if (!lists[i].length) continue;
    const d = await pickFromWeeks(order[i], lists[i], day);
    if (d) return d;
  }
  return null;
}

// Home warms today's word while the phone is idle, so Play opens instantly.
let warming: Promise<unknown> | null = null;
export function prefetchDaily(courses: string[]): void {
  if (warming || !courses.length) return;
  const run = () => { warming = dailyForAny(courses).catch(() => null); };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run); else window.setTimeout(run, 2000);
}

// Which course today: rotate through the student's courses by day, so
// classmates with the same courses share the same word.
export function courseOfTheDay(courses: string[], day = today()): string[] {
  const list = [...new Set(courses.map((c) => c.trim()).filter(Boolean))].sort();
  if (!list.length) return [];
  const start = dayNumber(day) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

// Marks for one guess, counting repeated letters properly (greens first).
export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(answer.length).fill('miss');
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < answer.length; i++) {
    if (marks[i] === 'hit') continue;
    if (left[guess[i]]) { marks[i] = 'near'; left[guess[i]] -= 1; }
  }
  return marks;
}

// The result as coloured squares for WhatsApp: no letters, so no spoilers.
export function shareText(course: string, day: string, rows: Mark[][], solved: boolean, url: string): string {
  const sq = { hit: '🟩', near: '🟨', miss: '⬜' } as const;
  const grid = rows.map((r) => r.map((m) => sq[m]).join('')).join('\n');
  return `Unify Learn · Term of the Day · ${course}\n${day} · ${solved ? rows.length : 'X'}/${MAX_GUESSES}\n${grid}\n${url}`;
}

// This phone's own record: played, solved, solve streak, best.
export type DailyStats = { played: number; solved: number; streak: number; best: number; lastDay: string; dist: number[] };
const STATS = 'unify:daily:stats';
export function readStats(): DailyStats {
  try { return { played: 0, solved: 0, streak: 0, best: 0, lastDay: '', dist: [0, 0, 0, 0, 0, 0], ...JSON.parse(localStorage.getItem(STATS) || '{}') }; }
  catch { return { played: 0, solved: 0, streak: 0, best: 0, lastDay: '', dist: [0, 0, 0, 0, 0, 0] }; }
}
export function recordResult(day: string, solved: boolean, guesses: number): DailyStats {
  const s = readStats();
  if (s.lastDay === day) return s; // one result a day counts
  const consecutive = s.lastDay && dayNumber(day) - dayNumber(s.lastDay) === 1;
  const next: DailyStats = {
    played: s.played + 1,
    solved: s.solved + (solved ? 1 : 0),
    streak: solved ? (consecutive ? s.streak + 1 : 1) : 0,
    best: 0,
    lastDay: day,
    dist: s.dist.map((n, i) => (solved && i === guesses - 1 ? n + 1 : n)),
  };
  next.best = Math.max(s.best, next.streak);
  try { localStorage.setItem(STATS, JSON.stringify(next)); } catch { /* fine */ }
  return next;
}
