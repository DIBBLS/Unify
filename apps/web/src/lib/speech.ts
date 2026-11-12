// Natural read-aloud. The device's speech engine reads punctuation badly:
// em dashes run sentences together, "________" is read as "underscore
// underscore…", LaTeX comes out as letters, and long text runs on without
// a breath. So text is first turned into what a person would SAY, then cut
// into short phrases, each followed by a pause sized to what ended it
// (longer after a heading or a bullet, shorter after a dash or a colon).
// Short phrases also dodge Chrome's habit of stopping long utterances.

export type Seg = { text: string; pause: number };

// Pauses in milliseconds at normal speed (scaled by the reading rate).
export const PAUSE = { heading: 650, block: 480, bullet: 380, sentence: 300, dash: 220, colon: 240, between: 700 } as const;

const WORDS: [RegExp, string][] = [
  [/\be\.g\.,?/gi, 'for example,'],
  [/\bi\.e\.,?/gi, 'that is,'],
  [/\betc\./gi, 'and so on.'],
  [/\bvs\.?(?=\s)/gi, 'versus'],
  [/\bapprox\./gi, 'approximately'],
  [/\bFig\.\s?/g, 'Figure '],
  [/\bEq\.\s?/g, 'Equation '],
  [/\bNo\.\s?(?=\d)/g, 'number '],
  [/\bw\.r\.t\.?/gi, 'with respect to'],
];

const SYMBOLS: [RegExp, string][] = [
  [/≈/g, ' approximately '],
  [/≥/g, ' at least '],
  [/≤/g, ' at most '],
  [/≠/g, ' is not equal to '],
  [/±/g, ' plus or minus '],
  [/×/g, ' times '],
  [/÷/g, ' divided by '],
  [/→|⇒/g, ', so '],
  [/\s=\s/g, ' equals '],
  [/°C\b/g, ' degrees Celsius'],
  [/°F\b/g, ' degrees Fahrenheit'],
  [/°/g, ' degrees'],
  [/∆|Δ/g, ' delta '],
  [/√/g, ' the square root of '],
  [/π/g, ' pi '],
  [/ρ/g, ' rho '],
  [/θ/g, ' theta '],
  [/μ|µ/g, ' micro '],
  [/Ω/g, ' ohms '],
  [/η/g, ' eta '],
  [/λ/g, ' lambda '],
  [/σ/g, ' sigma '],
  [/α/g, ' alpha '],
  [/β/g, ' beta '],
  [/²/g, ' squared'],
  [/³/g, ' cubed'],
  [/&/g, ' and '],
  [/\s\/\s/g, ' or '],
];

// A little LaTeX, as it would be said aloud.
function latex(s: string): string {
  let t = s.replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, ' ');
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 over $2 ')
      .replace(/\\sqrt\{([^{}]*)\}/g, ' the square root of $1 ')
      .replace(/\^\{?2\}?/g, ' squared')
      .replace(/\^\{?3\}?/g, ' cubed')
      .replace(/\^\{([^{}]*)\}/g, ' to the power $1')
      .replace(/\^(\w)/g, ' to the power $1')
      .replace(/_\{([^{}]*)\}/g, ' $1')
      .replace(/(\w)_(\w)/g, '$1 $2');
  }
  return t
    .replace(/\\(times|cdot)/g, ' times ')
    .replace(/\\(approx)/g, ' approximately ')
    .replace(/\\(leq|le)\b/g, ' at most ')
    .replace(/\\(geq|ge)\b/g, ' at least ')
    .replace(/\\(Delta|delta)\b/g, ' delta ')
    .replace(/\\([a-zA-Z]+)/g, ' $1 ')
    .replace(/[{}]/g, ' ');
}

// What a person would say for this written text.
export function sayable(raw: string): string {
  let t = raw;
  t = latex(t);
  // Fill-in blanks: "________" is a gap to say, not punctuation to spell.
  t = t.replace(/_{2,}|…{2,}|\.{4,}/g, ', blank, ');
  // snake_case and stray underscores read as spaces.
  t = t.replace(/(\w)_(?=\w)/g, '$1 ').replace(/_/g, ' ');
  // Naira: "₦45,000" → "45,000 naira".
  t = t.replace(/₦\s?([\d,.]+)\s?(million|billion|k)?/gi, (_m, n: string, scale?: string) => `${n}${scale ? ` ${scale.toLowerCase() === 'k' ? 'thousand' : scale}` : ''} naira`);
  for (const [re, w] of WORDS) t = t.replace(re, w);
  for (const [re, w] of SYMBOLS) t = t.replace(re, w);
  // Per-unit slashes after a number: "60 km/h" → "60 km per h".
  t = t.replace(/(\d\s?[a-zA-Z]{1,3})\/([a-zA-Z]{1,3})\b/g, '$1 per $2');
  t = units(t);
  // Brackets are an aside: a short breath either side.
  t = t.replace(/\s*\(\s*/g, ', ').replace(/\s*\)\s*/g, ', ');
  // Dashes between words are a pause, never "dash" or a run-on.
  t = t.replace(/\s*[—–]\s*/g, ' — ').replace(/\s-{1,2}\s/g, ' — ');
  // Arrows and bullets typed as text.
  t = t.replace(/[•▪◦]/g, ' ').replace(/\s*->\s*/g, ', which gives ');
  // Emoji and other pictographs are skipped.
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
  return t
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,(\s*,)+/g, ',')
    .replace(/,\s*([;:.!?])/g, '$1')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

// Units after a number, as they're said: "60 km per h" → "60 kilometres per hour".
// kVA, kWh and the like stay as letters: that's how people say them.
const UNIT: Record<string, string> = {
  km: 'kilometres', m: 'metres', cm: 'centimetres', mm: 'millimetres',
  kg: 'kilograms', g: 'grams', t: 'tonnes',
  N: 'newtons', kN: 'kilonewtons', Pa: 'pascals', kPa: 'kilopascals', MPa: 'megapascals',
  W: 'watts', kW: 'kilowatts', MW: 'megawatts', J: 'joules', kJ: 'kilojoules',
  V: 'volts', A: 'amps', Hz: 'hertz', s: 'seconds', h: 'hours', min: 'minutes', L: 'litres',
};
const PER: Record<string, string> = { s: 'second', h: 'hour', min: 'minute', m: 'metre', kg: 'kilogram', L: 'litre' };
function units(t: string): string {
  return t
    .replace(/per m cubed\b/g, 'per cubic metre')
    .replace(/per m squared\b/g, 'per square metre')
    .replace(/(\d)\s?m cubed\b/g, '$1 cubic metres')
    .replace(/(\d)\s?m squared\b/g, '$1 square metres')
    .replace(/\bper (s|h|min|m|kg|L)\b/g, (_m, u: string) => `per ${PER[u]}`)
    .replace(/(\d)\s?(km|cm|mm|kg|kN|kPa|MPa|kW|MW|kJ|Hz|min|Pa|m|g|N|W|J|V|A|s|h|L|t)\b(?![.'’]\w)/g, (_m, n: string, u: string) => `${n} ${UNIT[u]}`);
}

// Cut sayable text into phrases with natural pauses. `end` is the pause
// after the last phrase (heading, bullet, end of a block...).
export function phrases(raw: string, end: number = PAUSE.block): Seg[] {
  const t = sayable(raw);
  if (!t) return [];
  const out: Seg[] = [];
  let buf = '';
  const push = (text: string, pause: number) => {
    const s = text.trim();
    if (/\w/.test(s)) out.push({ text: s, pause });
  };
  const spaceAfter = (i: number) => i + 1 >= t.length || /\s/.test(t[i + 1]);
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    // Sentence end: only when a space follows (so 3.5 and 10:30 stay whole),
    // and not after a title like Dr. or Engr.
    if ('.!?'.includes(c) && spaceAfter(i) && !/\b(Dr|Mr|Mrs|Ms|Prof|Engr|St|Arc|Pharm|Barr)$/.test(buf)) {
      while (i + 1 < t.length && '.!?'.includes(t[i + 1])) { buf += t[i + 1]; i++; }
      push(buf + c, PAUSE.sentence);
      buf = '';
    } else if ((c === ';' || c === ':') && spaceAfter(i)) {
      push(buf + c, PAUSE.colon);
      buf = '';
    } else if (c === '—') {
      push(buf.trimEnd() + ',', PAUSE.dash);
      buf = '';
    } else {
      buf += c;
    }
  }
  push(buf, PAUSE.sentence);
  if (out.length) out[out.length - 1].pause = Math.max(out[out.length - 1].pause, end);
  return out;
}

// Voices that sound human (Edge's "Natural"/"Online" neural voices, Google's
// network voices) beat the robotic offline ones; Nigerian English first.
export function voiceScore(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase();
  const name = v.name.toLowerCase();
  const naija = lang.startsWith('en-ng') || name.includes('nigeria');
  const natural = /natural|neural|online|premium|enhanced/.test(name);
  if (naija && natural) return 0;
  if (naija) return 1;
  if (natural && (lang.startsWith('en-gb') || lang.startsWith('en-za') || lang.startsWith('en-ke') || lang.startsWith('en-gh'))) return 2;
  if (natural && lang.startsWith('en')) return 3;
  if (name.includes('google') && lang.startsWith('en')) return 4;
  if (lang.startsWith('en-gb')) return 5;
  if (lang.startsWith('en')) return 6;
  return 9;
}

// Speak a list of phrases one after another, with their pauses. Returns a
// stop function. `onPhrase` reports progress; `onDone` fires at the end.
export function speakPhrases(
  segs: Seg[],
  opts: { voice?: SpeechSynthesisVoice | null; rate?: () => number; onPhrase?: (i: number) => void; onDone?: () => void; onError?: () => void }
): () => void {
  let stopped = false;
  let timer = 0;
  let i = 0;
  const synth = window.speechSynthesis;
  const next = () => {
    if (stopped) return;
    if (i >= segs.length) { opts.onDone?.(); return; }
    const seg = segs[i];
    opts.onPhrase?.(i);
    const u = new SpeechSynthesisUtterance(seg.text);
    const rate = opts.rate ? opts.rate() : 1;
    u.rate = rate;
    if (opts.voice) { u.voice = opts.voice; u.lang = opts.voice.lang; }
    u.onend = () => { i += 1; timer = window.setTimeout(next, Math.round(seg.pause / rate)); };
    u.onerror = (e) => {
      // "interrupted"/"canceled" is us stopping; anything else is a real failure.
      if (stopped || e.error === 'interrupted' || e.error === 'canceled') return;
      opts.onError?.();
    };
    synth.speak(u);
  };
  try { synth.cancel(); } catch { /* fine */ }
  next();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    try { synth.cancel(); } catch { /* fine */ }
  };
}
