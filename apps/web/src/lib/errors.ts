// Friendly error handling: raw library/DB messages never reach the UI.
//   isBenignError  — aborts / offline blips that deserve no toast at all
//   describeError  — any thrown value -> one human sentence
//   errorToast     — benign-filter + describe + toast, in one call
// App-authored messages (our API's own user-facing copy) pass through
// untouched; anything that looks technical falls back to "Couldn't <action>".
import { toastError } from './toast';
import { log } from './log';

type ErrLike = { message?: unknown; name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };

function asLike(e: unknown): ErrLike {
  return e && typeof e === 'object' ? (e as ErrLike) : {};
}

function msgOf(e: unknown): string {
  if (typeof e === 'string') return e;
  const m = asLike(e).message;
  return typeof m === 'string' ? m : '';
}

/** Errors caused by navigation/unmount/offline — not worth bothering the user. */
export function isBenignError(e: unknown): boolean {
  const l = asLike(e);
  if (l.name === 'AbortError') return true;
  const m = msgOf(e);
  if (/\babort(ed)?\b|signal is aborted|user aborted/i.test(m)) return true;
  // Offline: the offline banner + queue already tell that story.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return /failed to fetch|networkerror|network request failed|load failed/i.test(m);
  }
  return false;
}

// PostgREST / Postgres SQLSTATE codes.
const CODE_COPY: Record<string, string> = {
  '23505': 'That already exists.',
  '23503': 'That item is linked to something that no longer exists.',
  '23502': 'A required field is missing.',
  '23514': 'One of the values isn’t allowed.',
  '22P02': 'One of the values has the wrong format.',
  '42501': 'You don’t have permission to do that.',
  PGRST116: 'We couldn’t find that.',
  PGRST301: 'Your session expired. Please sign in again.',
};

const STATUS_COPY: Record<number, string> = {
  400: 'That request didn’t look right.',
  401: 'Your session expired. Please sign in again.',
  403: 'You don’t have permission to do that.',
  404: 'We couldn’t find that.',
  408: 'That took too long, likely the network. Try again.',
  409: 'That conflicts with something that already exists.',
  413: 'That file is too large.',
  422: 'Some of the details aren’t valid.',
  429: 'Too many tries. Give it a minute, then try again.',
  500: 'Something went wrong on our side, not yours. Try again in a moment.',
  502: 'We’re waking up the server. Try again in a few seconds.',
  503: 'We’re waking up the server. Try again in a few seconds.',
  504: 'That took too long, likely the network. Try again.',
};

// Supabase Auth messages worth translating (matched on text).
const AUTH_COPY: [RegExp, string][] = [
  [/invalid login credentials/i, 'Wrong email or password.'],
  [/email not confirmed/i, 'Confirm your email first — check your inbox and spam.'],
  [/user already registered|already been registered/i, 'That email already has an account. Try signing in.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Too many tries. Give it a minute, then try again.'],
  [/password should be at least|weak password/i, 'Pick a stronger password (at least 6 characters).'],
  [/jwt|refresh token|session (missing|expired)|not authenticated/i, 'Your session expired. Please sign in again.'],
  [/same as the old|same password/i, 'Choose something different from your current one.'],
];

const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timeout|timed out/i;
// Looks like library/DB internals rather than copy a human wrote.
const TECHNICAL_RE =
  /violates|constraint|relation "|column "|syntax error|pgrst|sqlstate|postgres|\bjwt\b|undefined|\bnull\b|\[object|unexpected token|cannot read|is not a function|typeerror|referenceerror|at \w+\.|https?:\/\/|\{.*\}/i;

/**
 * Turn anything thrown into one friendly sentence.
 * @param action short verb phrase for the fallback: "save your profile"
 */
export function describeError(e: unknown, action = 'do that'): string {
  const l = asLike(e);
  // apiFetch throws "API 404: <server message>": show only the message.
  const m = msgOf(e).trim().replace(/^API \d{3}:?\s*/, '');

  const code = typeof l.code === 'string' ? l.code : '';
  if (code && CODE_COPY[code]) return CODE_COPY[code];

  const status = Number(l.status ?? l.statusCode);
  // Server faults (5xx) are never the user's to read; 4xx keep our own message when we wrote one.
  if (status >= 500 && STATUS_COPY[status]) return STATUS_COPY[status];
  if (status && STATUS_COPY[status] && (!m || TECHNICAL_RE.test(m))) return STATUS_COPY[status];

  for (const [re, copy] of AUTH_COPY) if (re.test(m)) return copy;

  if (NETWORK_RE.test(m)) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'No network right now. We’ll try again as soon as you’re back.'
      : 'The network is poor right now. Check your data or Wi-Fi and try again.';
  }

  // App-authored copy: short, sentence-like, nothing technical.
  if (m && m.length <= 160 && !TECHNICAL_RE.test(m)) return m;

  return `Couldn’t ${action}. Please try again.`;
}

/** Log the raw error, then toast a friendly line unless it's benign. */
export function errorToast(e: unknown, action = 'do that'): void {
  log.warn('error', `${action}: ${msgOf(e) || String(e)}`);
  if (isBenignError(e)) return;
  toastError(describeError(e, action));
}
