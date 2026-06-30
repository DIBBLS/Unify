/**
 * Unify — Course Registrations Service
 *
 * CRUD layer for the `courseRegistrations` collection — the canonical
 * record of "student X is taking course Y this semester/year." This is
 * deliberately separate from `users/{uid}.courses`, which remains the
 * letter-grade transcript that feeds CGPA calculation.
 *
 * Document shape (collection: `courseRegistrations`):
 *   {
 *     studentId:    "<uid>",
 *     courseId:     "ECE 301",            // normalized course code
 *     semester:     "First Semester",     // "First Semester" | "Second Semester"
 *     academicYear: "2026/2027",          // stored as-is, with the slash
 *     status:       "pending",            // "pending" | "active" | "dropped"
 *     source:       "self",               // "self" | "import" | "portal"
 *     registeredAt: serverTimestamp(),
 *     updatedAt:    serverTimestamp(),
 *   }
 *
 * Document ID: `{studentId}_{courseId-with-underscores}_{semester-with-underscores}_{academicYear-with-dashes}`
 * The academicYear's "/" is replaced with "-" for the ID only — the stored
 * `academicYear` field keeps the "/" form.
 *
 * This file is purely additive: it is not imported by any page yet.
 */

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { normalizeCode, codeToDocId } from './courses-service.js';

const VALID_STATUSES = ['pending', 'active', 'dropped'];
const VALID_SOURCES = ['self', 'import', 'portal'];

function sanitizeIdSegment(raw) {
  return String(raw || '').trim().replace(/\s+/g, '_');
}

// No academic-calendar config exists yet (that's Step 4's "University setup
// form"). Until then, derive a placeholder session from the system date:
// Aug–Dec → "thisYear/nextYear", Jan–Jul → "lastYear/thisYear".
export function getCurrentAcademicYear(date = new Date()) {
  const y = date.getFullYear();
  return date.getMonth() >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// Builds the deterministic document ID for a registration. The
// academicYear's "/" would otherwise be read as a path separator by the
// Firestore SDK's doc() call, so it is replaced with "-" for ID purposes
// only — the stored academicYear field value is left untouched.
export function buildRegistrationId(studentId, courseId, semester, academicYear) {
  const student = sanitizeIdSegment(studentId);
  const course = codeToDocId(courseId);
  const sem = sanitizeIdSegment(semester);
  const year = sanitizeIdSegment(academicYear).replace(/\//g, '-');
  return `${student}_${course}_${sem}_${year}`;
}

// ── READ ────────────────────────────────────────────────────────
export async function getRegistration(studentId, courseId, semester, academicYear) {
  const id = buildRegistrationId(studentId, courseId, semester, academicYear);
  const snap = await getDoc(doc(db, 'courseRegistrations', id));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}

export async function listRegistrationsForStudent(studentId) {
  const q = query(collection(db, 'courseRegistrations'), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listRegistrationsForCourse(courseId, semester, academicYear) {
  const clauses = [where('courseId', '==', normalizeCode(courseId))];
  if (semester) clauses.push(where('semester', '==', semester));
  if (academicYear) clauses.push(where('academicYear', '==', academicYear));
  const q = query(collection(db, 'courseRegistrations'), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── WRITE ───────────────────────────────────────────────────────
// Idempotent: if a registration already exists for this composite key,
// returns it unchanged rather than overwriting (so a later self-declare
// can't regress an already-approved/active registration back to pending).
export async function createRegistration({ studentId, courseId, semester, academicYear, source }) {
  if (!studentId) throw new Error('studentId required');
  const code = normalizeCode(courseId);
  if (!code) throw new Error('courseId required');
  if (!semester) throw new Error('semester required');
  if (!academicYear) throw new Error('academicYear required');
  const src = VALID_SOURCES.includes(source) ? source : 'self';

  const id = buildRegistrationId(studentId, code, semester, academicYear);
  const ref = doc(db, 'courseRegistrations', id);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id: existing.id, ...existing.data() };

  const payload = {
    studentId,
    courseId: code,
    semester,
    academicYear,
    status: 'pending',
    source: src,
    registeredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id, ...payload };
}

export async function updateStatus(studentId, courseId, semester, academicYear, status) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  const id = buildRegistrationId(studentId, courseId, semester, academicYear);
  await setDoc(doc(db, 'courseRegistrations', id), {
    status,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
