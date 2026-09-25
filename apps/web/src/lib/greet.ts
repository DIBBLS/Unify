// Greeting engine: time-of-day hellos (device-local timezone) plus a
// rotating daily line — motivation in the morning, a fact afterwards.
// One pick per calendar day so it feels personal, not random.

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

const QUOTES = [
  'Small steps every day build engineers.',
  'An hour of focus beats a day of worry.',
  'You do not have to be perfect — just consistent.',
  'Read one topic. Mark it done. Repeat.',
  'Streaks are built one morning at a time.',
  'Confusion is the doorway — walk through it.',
  'Your future self is watching this study session.',
  'Hard topics first, easy wins after.',
  'Ten XP today is ten more than yesterday.',
  'Engineers solve problems. Start with this page.',
  'Discipline opens doors motivation cannot.',
  'Every expert once stared blankly at page one.',
  'Show up today — that is the whole trick.',
  'Learn it well once; revise it fast forever.',
];

const FACTS = [
  'The Hoover Dam holds back about 35 cubic km of water — pure hydrology at work.',
  'A snail can sleep for three years — unlike your streak, which needs you daily.',
  'The first computer programmer was Ada Lovelace, in the 1840s.',
  'The Eiffel Tower grows about 15 cm in summer heat.',
  'Honey never spoils — archaeologists taste 3,000-year-old pots.',
  'A single bolt on the Golden Gate Bridge is over a meter long.',
  'Your brain runs on about 20 watts — a dim light bulb.',
  'The Burj Khalifa needs a full concrete batching plant on site.',
  'Stainless steel stays stainless thanks to an invisible chromium shield.',
  'Lagos traffic loses millions of man-hours yearly — engineers quantify that.',
  'The word "robot" comes from the Czech word for forced labor.',
  'Concrete is the second-most consumed material on Earth after water.',
  'A jumbo jet burns roughly 4 liters of fuel every second at takeoff.',
  'The Philips curve started as an engineer studying machines, not money.',
];

export function dailyLine(part: Daypart = daypart(), now = new Date()): string {
  const start = new Date(now.getFullYear(), 0, 0).getTime();
  const day = Math.floor((now.getTime() - start) / 86400000);
  const pool = part === 'morning' ? QUOTES : FACTS;
  return pool[day % pool.length];
}

export function dailyKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${daypart(now.getHours())}`;
}
