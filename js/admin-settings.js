import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

window.onAdminReady = async function () {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    if (!snap.exists()) return;
    const s = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('set-registrations',  s.registrations   !== false);
    set('set-feedback',       s.feedbackEnabled  !== false);
    set('set-maintenance',    s.maintenanceMode  === true);
    set('set-push',           s.pushEnabled      === true);
    set('set-exam-reminders', s.examReminders    !== false);
  } catch {}
};

window.saveSetting = async (key, value) => {
  try {
    await setDoc(doc(db, 'settings', 'platform'), { [key]: value }, { merge: true });
    window.showToast('Setting saved');
  } catch { window.showToast('Failed to save'); }
};

// ── COURSE SEEDER ─────────────────────────────────────────────────────────────

function collectUniqueCourses() {
  const catalog = window.coursesDatabase;
  if (!catalog) return [];
  const seen = new Set();
  const results = [];
  for (const [faculty, depts] of Object.entries(catalog)) {
    for (const [department, levels] of Object.entries(depts)) {
      for (const [level, sems] of Object.entries(levels)) {
        for (const [semester, codes] of Object.entries(sems)) {
          for (const raw of codes) {
            const code = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
            if (code && !seen.has(code)) {
              seen.add(code);
              results.push({ code, faculty, department, level, semester });
            }
          }
        }
      }
    }
  }
  return results;
}

window.seedCourses = async () => {
  const btn = document.getElementById('seed-btn');
  const statusEl = document.getElementById('seed-status');
  if (btn) btn.disabled = true;
  statusEl.textContent = 'Collecting courses…';

  const courses = collectUniqueCourses();
  if (!courses.length) {
    statusEl.textContent = 'courses.js not loaded or catalog is empty.';
    if (btn) btn.disabled = false;
    return;
  }

  statusEl.textContent = `Found ${courses.length} unique codes. Writing to Firestore…`;
  const BATCH_SIZE = 400;
  let written = 0;
  try {
    for (let i = 0; i < courses.length; i += BATCH_SIZE) {
      const chunk = courses.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const c of chunk) {
        const id = c.code.replace(/\s+/g, '_');
        batch.set(doc(db, 'courses', id), {
          code: c.code,
          title: '',
          faculty: c.faculty,
          department: c.department,
          level: c.level,
          semester: c.semester,
          units: 0,
          description: '',
        }, { merge: true });
      }
      await batch.commit();
      written += chunk.length;
      statusEl.textContent = `Seeded ${written}/${courses.length}…`;
    }
    statusEl.textContent = `Done — ${written} courses seeded.`;
    window.showToast(`Seeded ${written} courses`);
  } catch (e) {
    console.error(e);
    statusEl.textContent = `Failed after ${written} — ${e.message}`;
    window.showToast('Seed failed');
  } finally {
    if (btn) btn.disabled = false;
  }
};
