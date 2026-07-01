/**
 * Unify — Courses Service
 *
 * Single source of truth for course data lookups. Reads from Firestore
 * (`courses` collection) first; falls back to the hard-coded
 * `window.coursesDatabase` (engineering) and `window.UNIFY_COURSE_CONTENT`
 * (per-course week structure) so the existing Learn flow keeps working
 * even before any course has been migrated to Firestore.
 *
 * Suggested Firestore document shape (collection: `courses`):
 *   {
 *     code:      "ECE 301",          // canonical, normalized with one space
 *     title:     "Signals & Systems",
 *     faculty:   "Faculty of Engineering",
 *     department:"Electronic & Computer Engineering",
 *     level:     "300 Level",
 *     semester:  "First Semester",
 *     units:     3,
 *     description: "...",
 *     createdAt: serverTimestamp(),
 *     createdBy: "<uid>"
 *   }
 *
 * Suggested security rules (paste into Firebase console — NOT applied here):
 *   match /courses/{code} {
 *     allow read: if request.auth != null;
 *     allow write: if request.auth != null
 *       && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
 *   }
 */

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Document IDs cannot contain spaces; codes are stored normalized.
export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}
export function codeToDocId(raw) {
  return normalizeCode(raw).replace(/\s+/g, '_');
}

// ── READ ────────────────────────────────────────────────────────
export async function getCourse(code) {
  const id = codeToDocId(code);
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, 'courses', id));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  } catch (e) {
    console.warn('[courses-service] getCourse failed, using fallback:', e);
  }
  return null;
}

export async function listCourses({ universityId } = {}) {
  try {
    let snap;
    if (universityId) {
      // Composite index would be needed for orderBy + where, so sort client-side instead.
      snap = await getDocs(query(collection(db, 'courses'), where('universityId', '==', universityId)));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return docs.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }
    snap = await getDocs(query(collection(db, 'courses'), orderBy('code')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[courses-service] listCourses failed:', e);
    throw e;
  }
}

// ── WRITE (admin) ───────────────────────────────────────────────
export async function upsertCourse(course, actorUid) {
  const code = normalizeCode(course.code);
  if (!code) throw new Error('Course code required');
  const id = codeToDocId(code);
  const payload = {
    code,
    title: course.title || '',
    faculty: course.faculty || '',
    department: course.department || '',
    level: course.level || '',
    semester: course.semester || '',
    units: Number.isFinite(+course.units) ? +course.units : 3,
    description: course.description || '',
    updatedAt: serverTimestamp(),
    updatedBy: actorUid || null,
  };
  // Preserve createdAt on edits
  const existing = await getDoc(doc(db, 'courses', id));
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = actorUid || null;
  }
  await setDoc(doc(db, 'courses', id), payload, { merge: true });
  return { id, ...payload };
}

export async function deleteCourse(code) {
  const id = codeToDocId(code);
  if (!id) return;
  await deleteDoc(doc(db, 'courses', id));
}

// ── FALLBACK (read-only, hard-coded) ────────────────────────────
// Searches the existing window.coursesDatabase for a course code and
// returns a synthetic course record so course.html can still render
// a meaningful page for legacy courses that haven't been migrated.
export function getHardcodedCourse(code) {
  const target = normalizeCode(code);
  const db = (typeof window !== 'undefined' && window.coursesDatabase) || null;
  if (!db) return null;
  for (const [faculty, depts] of Object.entries(db)) {
    for (const [department, levels] of Object.entries(depts)) {
      for (const [level, sems] of Object.entries(levels)) {
        for (const [semester, list] of Object.entries(sems)) {
          if (Array.isArray(list) && list.some((c) => normalizeCode(c) === target)) {
            return {
              code: target,
              title: '',
              faculty,
              department,
              level,
              semester,
              units: 3,
              description: '',
              _source: 'hardcoded',
            };
          }
        }
      }
    }
  }
  return null;
}

// Resolve a course from Firestore first, then fall back to hard-coded.
// Returns { course, source } where source is 'firestore' | 'hardcoded' | null.
export async function resolveCourse(code) {
  const fromDb = await getCourse(code);
  if (fromDb) return { course: fromDb, source: 'firestore' };
  const fromHc = getHardcodedCourse(code);
  if (fromHc) return { course: fromHc, source: 'hardcoded' };
  return { course: null, source: null };
}

// Returns the legacy 12-week structure from window.UNIFY_COURSE_CONTENT,
// or null if none is defined for this code.
export function getHardcodedWeeks(code) {
  const target = normalizeCode(code);
  const all = (typeof window !== 'undefined' && window.UNIFY_COURSE_CONTENT) || null;
  if (!all) return null;
  const entry = all[target] || all[target.replace(/\s+/g, '')];
  if (!entry || !Array.isArray(entry.weeks)) return null;
  return entry.weeks;
}
