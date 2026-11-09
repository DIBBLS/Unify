import { PERSONAS } from '../components/redesign/brand';

export const PICTURE_EVENT = 'unify:picture';

type ProfileLike = { avatar_url?: string | null; box_boy_persona?: string | null } | null | undefined;

/**
 * What to show as someone's picture. Order: uploaded photo, then their chosen
 * Box Boy, then the Google/SSO photo, then nothing (callers show the initial).
 * `meAvatar` is the API's resolved URL: the upload when avatar_url is set,
 * otherwise the sign-in provider's photo.
 */
export function resolvePicture(profile: ProfileLike, meAvatar?: string | null): { kind: 'photo' | 'persona' | 'sso' | 'none'; src: string } {
  if (profile?.avatar_url) return { kind: 'photo', src: profile.avatar_url || meAvatar || '' };
  const persona = PERSONAS.find((p) => p.key === profile?.box_boy_persona);
  if (persona) return { kind: 'persona', src: persona.img };
  if (meAvatar) return { kind: 'sso', src: meAvatar };
  return { kind: 'none', src: '' };
}

/** Tell the header chip (and anything else listening) the picture changed. */
export function announcePicture(): void {
  window.dispatchEvent(new Event(PICTURE_EVENT));
}
