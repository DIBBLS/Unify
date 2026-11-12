import type { UnifyNote } from '../types/note';
import { extractTerms, moreTerms, type Term } from './wordgame';

// Crossword from one week's notes: the key terms cross each other where they
// share a letter, numbered the usual way, with clues from the notes.
// Built by trying several word orders and keeping the layout that fits the
// most words in the smallest grid.

export type Entry = { num: number; dir: 'across' | 'down'; row: number; col: number; word: string; display: string; clue: string };
export type Puzzle = { rows: number; cols: number; entries: Entry[]; cells: (string | null)[][]; nums: (number | null)[][] };

type Placed = { term: Term; row: number; col: number; dir: 'across' | 'down' };

function fits(grid: Map<string, string>, word: string, row: number, col: number, dir: 'across' | 'down'): number {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  // The cells just before and after the word must be empty.
  if (grid.has(`${row - dr},${col - dc}`) || grid.has(`${row + dr * word.length},${col + dc * word.length}`)) return -1;
  let crossings = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const here = grid.get(`${r},${c}`);
    if (here) {
      if (here !== word[i]) return -1;
      crossings += 1;
      continue;
    }
    // A new letter must not touch another word side by side.
    const side1 = dir === 'across' ? `${r - 1},${c}` : `${r},${c - 1}`;
    const side2 = dir === 'across' ? `${r + 1},${c}` : `${r},${c + 1}`;
    if (grid.has(side1) || grid.has(side2)) return -1;
  }
  return crossings;
}

function layout(terms: Term[]): Placed[] {
  const grid = new Map<string, string>();
  const placed: Placed[] = [];
  const put = (p: Placed) => {
    for (let i = 0; i < p.term.word.length; i++) {
      grid.set(p.dir === 'across' ? `${p.row},${p.col + i}` : `${p.row + i},${p.col}`, p.term.word[i]);
    }
    placed.push(p);
  };
  const [first, ...rest] = terms;
  put({ term: first, row: 0, col: 0, dir: 'across' });
  let pending = rest;
  // A few passes: a word that didn't fit early may fit once others are down.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const still: Term[] = [];
    for (const t of pending) {
      let best: { p: Placed; score: number } | null = null;
      for (const q of placed) {
        for (let i = 0; i < q.term.word.length; i++) {
          for (let j = 0; j < t.word.length; j++) {
            if (q.term.word[i] !== t.word[j]) continue;
            const dir = q.dir === 'across' ? 'down' : 'across';
            const row = q.dir === 'across' ? q.row - j : q.row + i;
            const col = q.dir === 'across' ? q.col + i : q.col - j;
            const s = fits(grid, t.word, row, col, dir);
            if (s > 0 && (!best || s > best.score)) best = { p: { term: t, row, col, dir }, score: s };
          }
        }
      }
      if (best) put(best.p);
      else still.push(t);
    }
    pending = still;
  }
  return placed;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function buildCrossword(note: UnifyNote, max = 12): Puzzle | null {
  const marked = extractTerms(note, 12);
  const terms = [...marked, ...moreTerms(note, marked, 12, 20)].slice(0, 24);
  if (terms.length < 3) return null;
  let best: Placed[] = [];
  let bestArea = Infinity;
  const rand = seeded(terms.length * 97 + (note.week || 1));
  for (let attempt = 0; attempt < 30; attempt++) {
    // Longest first works best; later attempts shuffle within that.
    const order = [...terms].sort((a, b) => b.word.length - a.word.length + (attempt ? (rand() - 0.5) * 6 : 0)).slice(0, max + 4);
    const p = layout(order).slice(0, max);
    const rs = p.flatMap((x) => [x.row, x.dir === 'down' ? x.row + x.term.word.length - 1 : x.row]);
    const cs = p.flatMap((x) => [x.col, x.dir === 'across' ? x.col + x.term.word.length - 1 : x.col]);
    const area = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
    const width = Math.max(...cs) - Math.min(...cs) + 1;
    if (width > 15) continue; // keep it playable on a phone
    if (p.length > best.length || (p.length === best.length && area < bestArea)) {
      best = p;
      bestArea = area;
    }
  }
  if (best.length < 3) return null;

  const minR = Math.min(...best.map((p) => p.row));
  const minC = Math.min(...best.map((p) => p.col));
  const norm = best.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  const rows = Math.max(...norm.map((p) => (p.dir === 'down' ? p.row + p.term.word.length : p.row + 1)));
  const cols = Math.max(...norm.map((p) => (p.dir === 'across' ? p.col + p.term.word.length : p.col + 1)));
  const cells: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  for (const p of norm) {
    for (let i = 0; i < p.term.word.length; i++) {
      if (p.dir === 'across') cells[p.row][p.col + i] = p.term.word[i];
      else cells[p.row + i][p.col] = p.term.word[i];
    }
  }
  // Number the starts, row by row.
  const nums: (number | null)[][] = Array.from({ length: rows }, () => Array<number | null>(cols).fill(null));
  let n = 0;
  const starts = new Map<string, number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (norm.some((p) => p.row === r && p.col === c)) {
        n += 1;
        nums[r][c] = n;
        starts.set(`${r},${c}`, n);
      }
    }
  }
  const entries: Entry[] = norm
    .map((p) => ({ num: starts.get(`${p.row},${p.col}`) || 0, dir: p.dir, row: p.row, col: p.col, word: p.term.word, display: p.term.display, clue: p.term.clue }))
    .sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  return { rows, cols, entries, cells, nums };
}
