// Daily goal (Duolingo-style): how much study a day the student aims for,
// counted in XP. A topic is 10 XP, Term of the Day 10, Keywords 15,
// Crossword 20, so Light is about one topic a day. Kept on the phone.
export const GOALS = [
  { key: 'light', xp: 10, label: 'Light', sub: 'About one topic a day' },
  { key: 'steady', xp: 20, label: 'Steady', sub: 'Two topics, or a topic and a game' },
  { key: 'serious', xp: 40, label: 'Serious', sub: 'A few topics and games' },
] as const;
export type GoalKey = (typeof GOALS)[number]['key'];

const KEY = 'unify:daily-goal';
const MET = 'unify:daily-goal-met';

export function getGoal(): (typeof GOALS)[number] {
  let k = '';
  try { k = localStorage.getItem(KEY) || ''; } catch { /* default */ }
  return GOALS.find((g) => g.key === k) || GOALS[0];
}
export function setGoal(key: GoalKey) {
  try { localStorage.setItem(KEY, key); } catch { /* fine */ }
}

// Days are counted the way the server stores them (UTC dates).
export const todayKey = () => new Date().toISOString().slice(0, 10);

// Celebrate meeting the goal once a day, not on every Home visit.
export function firstMeetToday(): boolean {
  try {
    if (localStorage.getItem(MET) === todayKey()) return false;
    localStorage.setItem(MET, todayKey());
    return true;
  } catch {
    return false;
  }
}
