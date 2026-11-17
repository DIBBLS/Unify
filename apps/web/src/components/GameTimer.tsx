import { useEffect } from 'react';
import { Timer } from 'lucide-react';

// Game clock: time played (only while the game is on screen) and a countdown
// so a run has an end. `played` lives in the game's saved state; this ticks
// it once a second while `running` and the tab is visible.
export const mmss = (secs: number) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.max(0, Math.floor(secs)) % 60).padStart(2, '0')}`;

// Time allowed for a run: per level/word, kept between 4 and 12 minutes.
export const timeLimit = (units: number, perUnit: number) => Math.min(720, Math.max(240, Math.round(units * perUnit / 30) * 30));

export function useGameClock(running: boolean, tick: () => void) {
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') tick(); }, 1000);
    return () => window.clearInterval(t);
  }, [running, tick]);
}

export default function GameTimer({ played, limit }: { played: number; limit: number }) {
  const left = Math.max(0, limit - played);
  const tone = left <= 20 ? 'bad' : left <= 60 ? 'warn' : 'ok';
  return (
    <div className={`g-timer g-timer--${tone}`} role="timer" aria-label={`${mmss(left)} left, ${mmss(played)} played`}>
      <span className="g-timer-played"><Timer size={14} /> {mmss(played)}</span>
      <span className="g-timer-track"><i style={{ width: `${(left / Math.max(1, limit)) * 100}%` }} /></span>
      <span className="g-timer-left">{mmss(left)} left</span>
    </div>
  );
}

// Before a run: pick how long to play. The suggestion fits the puzzle's size;
// the last choice is remembered on this device.
const LAST = 'unify:game-minutes';
export const OPTIONS = [3, 5, 8, 12];
export function lastMinutes(): number | null {
  try { const n = Number(localStorage.getItem(LAST)); return OPTIONS.includes(n) ? n : null; } catch { return null; }
}

export function TimeChoice({ suggested, what, onPick }: { suggested: number; what: string; onPick: (secs: number) => void }) {
  const sugMin = OPTIONS.reduce((best, m) => (Math.abs(m * 60 - suggested) < Math.abs(best * 60 - suggested) ? m : best), OPTIONS[0]);
  const last = lastMinutes();
  const pick = (m: number) => {
    try { localStorage.setItem(LAST, String(m)); } catch { /* fine */ }
    onPick(m * 60);
  };
  return (
    <div className="g-clue g-win" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: 18 }}>
      <Timer size={28} />
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22 }}>How long do you want to play?</div>
      <div className="t-14 muted">{what} The clock only runs while the game is on screen, and when it ends your score still counts.</div>
      <div className="g-time-opts">
        {OPTIONS.map((m) => (
          <button key={m} className={`g-time-opt${m === (last ?? sugMin) ? ' on' : ''}`} onClick={() => pick(m)}>
            <b>{m}</b> min
            {m === sugMin && <span>Suggested</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
