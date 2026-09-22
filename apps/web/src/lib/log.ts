// Tiny frontend logger: user actions, session transitions, and API traffic
// narrate themselves in the browser console. Never logs tokens, passwords,
// emails, or bodies — actions + codes + timings only.
const now = () => new Date().toISOString().slice(11, 23);

function line(area: string, msg: string, data?: Record<string, unknown>): [string, ...unknown[]] {
  return [`[unify ${now()}] ${area}: ${msg}`, ...(data ? [data] : [])];
}

export const log = {
  info: (area: string, msg: string, data?: Record<string, unknown>) => console.log(...line(area, msg, data)),
  warn: (area: string, msg: string, data?: Record<string, unknown>) => console.warn(...line(area, msg, data)),
  error: (area: string, msg: string, data?: Record<string, unknown>) => console.error(...line(area, msg, data)),
};
