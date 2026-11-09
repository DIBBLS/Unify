import type { Profile } from './api';

// What is genuinely still missing from a profile. The "Finish your profile" card on Home only
// shows when this is not empty, and says exactly what to add. A picture counts if the person
// uploaded one, chose a Box Boy, or has a sign-in (Google) photo.
export function profileGaps(profile: Profile | null | undefined, signInPhoto?: string | null): string[] {
  if (!profile) return [];
  const gaps: string[] = [];
  const blank = (v?: string | null) => !v || !v.trim();
  if (blank(profile.first_name)) gaps.push('your name');
  if (blank(profile.university)) gaps.push('your university');
  if (blank(profile.faculty)) gaps.push('your faculty');
  if (blank(profile.department)) gaps.push('your department');
  if ((profile.role || 'student') === 'student' && blank(profile.level)) gaps.push('your level');
  if (blank(profile.avatar_url) && blank(profile.box_boy_persona) && blank(signInPhoto)) gaps.push('a picture');
  return gaps;
}

export function gapsText(gaps: string[]): string {
  if (gaps.length === 1) return gaps[0];
  return gaps.slice(0, -1).join(', ') + ' and ' + gaps[gaps.length - 1];
}
