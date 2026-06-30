/**
 * Canonical 300 Level auto-enrol map — single source of truth.
 *
 * Previously duplicated in js/pages/Onboarding.js and js/pages/dashboard.js;
 * consolidated here so edits only happen in one place.
 *
 * This data will become unnecessary once the Hierarchy Builder (Step 5 of
 * the Build Plan) populates canonical course lists in Firestore — at that
 * point, auto-enrol reads from courseRegistrations instead of this map.
 */
const _SHARED = ['CHE 352', 'MEE 352', 'ECE 316', 'ECE 352', 'GNS 312', 'ENT 312'];

export const COURSES_300L = {
  'Electronic & Computer Engineering':  [..._SHARED, 'ECE 302', 'ECE 308', 'ECE 310', 'ECE 312', 'ECE 314', 'ECE 320', 'ECE 350'],
  'Mechanical Engineering':             [..._SHARED, 'MEE 354'],
  'Industrial & Petroleum Engineering': [..._SHARED, 'IPE 316'],
  'Aerospace Engineering':              [..._SHARED, 'ASE 363', 'ASE 366'],
  'Civil Engineering':                  _SHARED.filter(c => c !== 'CHE 352').concat(['CVE 304', 'CVE 308', 'CVE 310']),
  'Chemical & Polymer Engineering':     _SHARED.filter(c => c !== 'CHE 352' && c !== 'ECE 316').concat(['CHE 312', 'CHE 314']),
};
