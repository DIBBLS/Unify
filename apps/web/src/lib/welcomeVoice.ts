import { api } from './api';
import { PAUSE, phrases, speakPhrases, voiceScore, type Seg } from './speech';

// Spoken welcome: "Good morning, Tunde. Welcome back to Unify Learn. You have
// two new notifications, one from your class rep." Off unless the student
// turns it on in Settings (a phone talking out loud in a lecture hall is
// nobody's idea of fun). Browsers only let a page speak after a tap, so it
// speaks on the first tap after the app opens, at most once a day, and
// never in the student's quiet hours.
const ON_KEY = 'unify:spoken-welcome';
const DAY_KEY = 'unify:spoken-welcome-day';

export const spokenWelcomeSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export function spokenWelcomeOn(): boolean {
  try { return localStorage.getItem(ON_KEY) === 'on'; } catch { return false; }
}
export function setSpokenWelcome(on: boolean) {
  try { localStorage.setItem(ON_KEY, on ? 'on' : 'off'); } catch { /* fine */ }
}

const lagosNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = (n: number) => (n <= 10 ? NUM[n] : String(n));

function inQuiet(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const d = lagosNow();
  const now = d.getHours() * 60 + d.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? now >= s && now < e : now >= s || now < e;
}

// What to say, from the unread notifications.
export async function welcomeLines(name: string): Promise<Seg[]> {
  const h = lagosNow().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const lines: string[] = [`${greet}${name ? `, ${name}` : ''}.`, 'Welcome back to Unify Learn.'];
  try {
    const r = await api.notifications(30);
    const unread = r.notifications.filter((n) => !n.read);
    const total = r.unread ?? unread.length;
    if (!total) {
      lines.push("You're all caught up. Nothing new since you were last here.");
    } else {
      lines.push(`You have ${say(total)} new notification${total === 1 ? '' : 's'}.`);
      const count = (t: string[]) => unread.filter((n) => t.includes(n.type || '')).length;
      const bits: string[] = [];
      const rep = count(['hoc_post']);
      const lect = count(['lecturer_post']);
      const unify = count(['announce']);
      const cls = count(['class_change', 'online_class', 'attendance_started']);
      const notes = count(['new_note']);
      if (rep) bits.push(rep === 1 ? 'a message from your class rep' : `${say(rep)} messages from your class rep`);
      if (lect) bits.push(lect === 1 ? 'a post from your lecturer' : `${say(lect)} posts from your lecturers`);
      if (cls) bits.push(cls === 1 ? 'a change to your classes' : `${say(cls)} changes to your classes`);
      if (notes) bits.push(notes === 1 ? 'new notes for one of your courses' : `new notes in ${say(notes)} places`);
      if (unify) bits.push(unify === 1 ? 'an update from Unify' : `${say(unify)} updates from Unify`);
      if (bits.length) lines.push(`There's ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}.`);
    }
  } catch {
    // offline: the greeting alone is fine
  }
  return lines.flatMap((l, i) => phrases(l, i === lines.length - 1 ? PAUSE.block : PAUSE.sentence + 120));
}

let stop: (() => void) | null = null;

export async function speakWelcome(name: string): Promise<void> {
  if (!spokenWelcomeSupported()) return;
  const segs = await welcomeLines(name);
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  let voice: SpeechSynthesisVoice | null = null;
  try {
    const saved = localStorage.getItem('unify.voice.v1');
    voice = voices.find((v) => v.voiceURI === saved) || null;
  } catch { /* fine */ }
  if (!voice) voice = [...voices].sort((a, b) => voiceScore(a) - voiceScore(b))[0] || null;
  stop?.();
  stop = speakPhrases(segs, { voice, rate: () => 1 });
}

// Arm once per app load: speak on the first tap, if switched on, not yet
// spoken today and not in quiet hours.
let armed = false;
export function armSpokenWelcome(profile: { first_name?: string | null; quiet_start?: string | null; quiet_end?: string | null } | null) {
  if (armed || !spokenWelcomeSupported() || !spokenWelcomeOn() || !profile) return;
  let last = '';
  try { last = localStorage.getItem(DAY_KEY) || ''; } catch { /* fine */ }
  if (last === today() || inQuiet(profile.quiet_start, profile.quiet_end)) return;
  armed = true;
  const go = () => {
    window.removeEventListener('pointerdown', go, true);
    window.removeEventListener('keydown', go, true);
    try { localStorage.setItem(DAY_KEY, today()); } catch { /* fine */ }
    // Something already speaking (a note being read) wins.
    if (window.speechSynthesis.speaking) return;
    void speakWelcome((profile.first_name || '').split(' ')[0]);
  };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
}
