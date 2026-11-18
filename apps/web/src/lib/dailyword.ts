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

// The day's term for a course, or null when its notes have nothing playable.
export async function dailyFor(course: string, day = today()): Promise<Daily | null> {
  const { weeks } = await api.courseWeeks(course);
  const nums = [...new Set(weeks.map((w) => w.week))].sort((a, b) => a - b);
  if (!nums.length) return null;
  const seed = hash(`${course.toUpperCase().replace(/\s/g, '')}|${day}`);
  // Try weeks in a seeded order until one has a playable term.
  for (let k = 0; k < nums.length; k++) {
    const week = nums[(seed + k) % nums.length];
    try {
      const d = await api.week(course, week);
      const note = d.note_json as UnifyNote;
      const base = extractTerms(note, 8);
      const terms = [...base, ...moreTerms(note, base, 8, 20)].filter(playable);
      if (terms.length) return { course, day, week, term: terms[(seed >>> 3) % terms.length] };
    } catch {
      // a week that won't load: try the next
    }
  }
  return null;
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
