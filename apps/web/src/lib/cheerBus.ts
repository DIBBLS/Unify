import type { CheerKind } from '../components/Cheer';

// A cheer that isn't tied to one screen (the "−5 XP" when leaving midway, as
// the app moves on to the next screen). GlobalCheer, mounted once in App,
// shows it with the same pop-up as the games' cheers.
const EVENT = 'unify:cheer';
export type CheerRequest = { kind: CheerKind; text?: string; sub?: string };

export function cheerEverywhere(kind: CheerKind, opts?: { text?: string; sub?: string }): void {
  window.dispatchEvent(new CustomEvent<CheerRequest>(EVENT, { detail: { kind, ...opts } }));
}
export function onCheerEverywhere(fn: (r: CheerRequest) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<CheerRequest>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
