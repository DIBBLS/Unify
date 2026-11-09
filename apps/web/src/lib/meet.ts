// Google Meet helpers.
//
// Creating a meeting automatically would need each lecturer to sign in with Google and grant
// Calendar access (an OAuth app registered with Google). Until that exists, the dependable way
// is Google's own "new meeting" address: it opens a fresh meeting in a new tab and the lecturer
// pastes the link back. These helpers make that quick and catch typos.

export const MEET_NEW_URL = 'https://meet.google.com/new';

const CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;

/** Turn what people paste ("meet.google.com/abc-defg-hij", with spaces, or inside a sentence) into a clean https link. */
export function cleanMeetLink(raw: string): string {
  const t = (raw || '').trim();
  const found = t.match(/(?:https?:\/\/)?(meet\.google\.com\/[a-z0-9\-_/?=&.]+)/i);
  if (found) return 'https://' + found[1].replace(/[.,;)\]]+$/, '');
  return t.startsWith('http') ? t : t ? 'https://' + t : '';
}

/** A proper Google Meet meeting link (meet.google.com/abc-defg-hij). */
export function isMeetLink(link: string): boolean {
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:' || u.hostname !== 'meet.google.com') return false;
    return CODE.test(u.pathname.replace(/^\//, '').split('/')[0]) || u.pathname.startsWith('/lookup/');
  } catch {
    return false;
  }
}

/** Any link we are happy to store: https, on a real host. Zoom and Teams links are allowed too. */
export function isHttpsLink(link: string): boolean {
  try {
    const u = new URL(link);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}
