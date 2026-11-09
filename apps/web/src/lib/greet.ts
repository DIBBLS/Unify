// Greeting engine: time-of-day hellos (device-local timezone) plus a
// rotating daily line — motivation in the morning, a fact afterwards.
// One pick per calendar day so it feels personal, not random.

import { dailyProverb } from './naija';

export type Daypart = 'morning' | 'afternoon' | 'evening';

export function daypart(h = new Date().getHours()): Daypart {
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function greeting(part: Daypart = daypart()): string {
  if (part === 'morning') return 'Good morning';
  if (part === 'afternoon') return 'Good afternoon';
  return 'Good evening';
}

// The daily line is a Nigerian proverb or value (lib/naija.ts), not trivia:
// hard work, patience, respect, community and integrity. One per day.
export function dailyLine(_part: Daypart = daypart(), now = new Date()): string {
  return dailyProverb(now);
}

export function dailyKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${daypart(now.getHours())}`;
}

