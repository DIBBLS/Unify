// Sound effects: a soft chime for a right answer, a low bump for a wrong
// one, a rising fanfare for finishing, and a bright arpeggio for the daily
// goal. Made in the browser (Web Audio), so there are no files to download
// and they work offline. On by default, short and quiet; Settings has the
// off switch. Browsers only allow sound after a tap, which every one of
// these follows.
const KEY = 'unify:sounds';

export type Sfx = 'correct' | 'wrong' | 'finish' | 'goal' | 'tap';

export function soundsOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSoundsOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// One note: frequency (Hz), start offset and length (s), waveform, volume.
function note(c: AudioContext, freq: number, at: number, len: number, type: OscillatorType = 'sine', vol = 0.12) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + at);
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + len);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at);
  o.stop(c.currentTime + at + len + 0.02);
}

export function play(kind: Sfx) {
  if (!soundsOn() || typeof document === 'undefined' || document.hidden) return;
  const c = audio();
  if (!c) return;
  try {
    switch (kind) {
      case 'correct': // two bright notes, up a fifth
        note(c, 880, 0, 0.12, 'sine', 0.11);
        note(c, 1318.5, 0.08, 0.2, 'sine', 0.1);
        break;
      case 'wrong': // a soft low bump, never harsh
        note(c, 196, 0, 0.18, 'triangle', 0.12);
        note(c, 164.8, 0.09, 0.22, 'triangle', 0.1);
        break;
      case 'finish': // rising major arpeggio
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(c, f, i * 0.09, 0.28, 'sine', 0.1));
        break;
      case 'goal': // arpeggio with a sparkle on top
        [659.3, 784, 987.8, 1318.5].forEach((f, i) => note(c, f, i * 0.07, 0.25, 'sine', 0.1));
        note(c, 2637, 0.32, 0.18, 'sine', 0.05);
        break;
      case 'tap':
        note(c, 1200, 0, 0.05, 'sine', 0.05);
        break;
    }
  } catch {
    // sound is a nicety
  }
}
