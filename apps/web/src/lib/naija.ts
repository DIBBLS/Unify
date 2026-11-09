// Nigerian voice for the app: greetings in the four languages students hear
// every day (Yoruba, Igbo, Hausa, Pidgin) and a pool of proverbs and values
// (hard work, patience, respect, community, integrity) for the Home hero.
// One pick per calendar day so it feels personal, not random.
//
// NOTE: the Yoruba, Igbo and Hausa lines should be read by native speakers
// before launch (diacritics especially). English meanings are given alongside
// so a wrong word never leaves the user guessing.

export type Daypart = 'morning' | 'afternoon' | 'evening';
export type Lang = 'Yoruba' | 'Igbo' | 'Hausa' | 'Pidgin';

type Greet = { text: string; lang: Lang; english: string };

const GREETINGS: Record<Daypart, Greet[]> = {
  morning: [
    { text: 'Ẹ káàárọ̀', lang: 'Yoruba', english: 'Good morning' },
    { text: 'Ụtụtụ ọma', lang: 'Igbo', english: 'Good morning' },
    { text: 'Barka da safiya', lang: 'Hausa', english: 'Good morning' },
    { text: 'Morning o', lang: 'Pidgin', english: 'Good morning' },
  ],
  afternoon: [
    { text: 'Ẹ káàsán', lang: 'Yoruba', english: 'Good afternoon' },
    { text: 'Ehihie ọma', lang: 'Igbo', english: 'Good afternoon' },
    { text: 'Barka da rana', lang: 'Hausa', english: 'Good afternoon' },
    { text: 'How body?', lang: 'Pidgin', english: 'How are you?' },
  ],
  evening: [
    { text: 'Ẹ kú ìrọ̀lẹ́', lang: 'Yoruba', english: 'Good evening' },
    { text: 'Mgbede ọma', lang: 'Igbo', english: 'Good evening' },
    { text: 'Barka da yamma', lang: 'Hausa', english: 'Good evening' },
    { text: 'Evening o', lang: 'Pidgin', english: 'Good evening' },
  ],
};

/** Welcome in the three big languages, then English. */
export const WELCOME_LINE = 'Ẹ káàbọ̀ · Nnọọ · Barka da zuwa';

/** "Well done on your work" the way each language says it. */
export const WELL_DONE: Greet[] = [
  { text: 'Ẹ kú iṣẹ́', lang: 'Yoruba', english: 'Well done on your work' },
  { text: 'Sannu da aiki', lang: 'Hausa', english: 'Well done on your work' },
  { text: 'You try!', lang: 'Pidgin', english: 'Well done' },
];

export function daypartOf(h = new Date().getHours()): Daypart {
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function dayOfYear(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 0).getTime();
  return Math.floor((now.getTime() - start) / 86400000);
}

/** Today's greeting: the language rotates daily, so a week shows all four. */
export function localGreeting(now = new Date()): Greet {
  const list = GREETINGS[daypartOf(now.getHours())];
  return list[dayOfYear(now) % list.length];
}

export type Proverb = { text: string; meaning?: string; from: string; value: string };

// `text` is what is shown first; `meaning` (when `text` is not English) follows.
export const PROVERBS: Proverb[] = [
  { text: 'However long the night, the dawn will break.', from: 'Hausa proverb', value: 'perseverance' },
  { text: 'Hakuri maganin duniya.', meaning: 'Patience is the medicine of the world.', from: 'Hausa proverb', value: 'patience' },
  { text: 'Ìwà lẹ̀wà ọmọnìyàn.', meaning: 'Good character is a person’s beauty.', from: 'Yoruba proverb', value: 'integrity' },
  { text: 'Ọmọdé tó bá mọ ọwọ́ wẹ̀ yóò bá àgbà jẹun.', meaning: 'A child who knows how to wash their hands eats with elders.', from: 'Yoruba proverb', value: 'respect' },
  { text: 'Egbe bere, ugo bere.', meaning: 'Let the kite perch and let the eagle perch: there is room for everyone.', from: 'Igbo proverb', value: 'fairness' },
  { text: 'It takes a village to raise a child.', from: 'African proverb', value: 'community' },
  { text: 'When the roots are deep, there is no reason to fear the wind.', from: 'African proverb', value: 'resilience' },
  { text: 'Be an Ọmọlúàbí: honest, hardworking, respectful.', from: 'Yoruba ideal', value: 'integrity' },
  { text: 'Leave no sibling behind.', from: 'Igbo value of umunna', value: 'community' },
  { text: 'No condition is permanent.', from: 'Naija wisdom', value: 'hope' },
  { text: 'Hustle with integrity: the shortcut always costs more.', from: 'Naija wisdom', value: 'hard work' },
  { text: 'Aim high, work hard, carry your people along.', from: 'Naija wisdom', value: 'ambition' },
  { text: 'Small small, you go reach there.', from: 'Pidgin', value: 'consistency' },
  { text: 'The one who asks questions does not miss the road.', from: 'Nigerian proverb', value: 'curiosity' },
];

/** Today's line, one per day, formatted for a single text node. */
export function dailyProverb(now = new Date()): string {
  const p = PROVERBS[dayOfYear(now) % PROVERBS.length];
  return `${p.text}${p.meaning ? ` ${p.meaning}` : ''} — ${p.from}`;
}

/** Short, checkable facts for loading screens: Nigeria, engineering, and how learning works. */
export type Fact = { text: string; tag: string };
export const FACTS: Fact[] = [
  { tag: 'Nigeria', text: 'Nigeria is the most populous country in Africa.' },
  { tag: 'Nigeria', text: 'Nigerians speak more than 500 languages. Yoruba, Igbo and Hausa are the three biggest.' },
  { tag: 'Nigeria', text: 'The Niger and Benue rivers meet at Lokoja, in Kogi State.' },
  { tag: 'Nigeria', text: 'The University of Ibadan was founded in 1948, Nigeria’s first university.' },
  { tag: 'Nigeria', text: 'The naira replaced the Nigerian pound in 1973.' },
  { tag: 'Engineering', text: 'Kainji Dam on the River Niger, finished in 1968, was Nigeria’s first major hydroelectric dam.' },
  { tag: 'Engineering', text: 'Engineers in Nigeria are registered with COREN, the Council for the Regulation of Engineering in Nigeria.' },
  { tag: 'Engineering', text: 'One joule is one watt for one second.' },
  { tag: 'Engineering', text: 'Ohm’s law: voltage equals current times resistance, V = IR.' },
  { tag: 'Engineering', text: 'Pi is irrational: its decimals never end and never repeat.' },
  { tag: 'Study tip', text: 'Testing yourself beats re-reading. Pulling an answer out of memory is what makes it stick.' },
  { tag: 'Study tip', text: 'Short sessions spread over several days beat one long night before the exam.' },
  { tag: 'Study tip', text: 'Sleep after studying helps your brain lock in what you learned.' },
  { tag: 'Study tip', text: 'If you can explain it simply to a friend, you really know it.' },
  { tag: 'Study tip', text: 'Do the hard topic first, while your mind is fresh.' },
];

export type LoadingLine = { kind: 'proverb'; p: Proverb } | { kind: 'fact'; f: Fact };
/** A shuffled mix of proverbs and facts; a different order every time. */
export function loadingLines(): LoadingLine[] {
  const all: LoadingLine[] = [...PROVERBS.map((p) => ({ kind: 'proverb' as const, p })), ...FACTS.map((f) => ({ kind: 'fact' as const, f }))];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
