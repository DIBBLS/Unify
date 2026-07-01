import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, setDoc, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _universities = [];
let _editingId = null;

window.onAdminReady = function (user, profile) {
  loadUniversities();
};

async function loadUniversities() {
  const el = document.getElementById('universities-list');
  if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(collection(db, 'universities'));
    _universities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUniversities();
  } catch {
    if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load universities.</div>';
  }
}

function renderUniversities() {
  const el = document.getElementById('universities-list');
  if (!el) return;
  const esc = window.escHtml;
  if (!_universities.length) {
    el.innerHTML = '<div class="empty-state"><p>No universities yet. Add the first one to get started.</p></div>';
    return;
  }
  el.innerHTML = _universities.map(u => `
    <div class="hierarchy-card">
      <div class="hc-info">
        <div class="hc-name">${esc(u.name || '—')}</div>
        <div class="hc-meta">${esc(u.shortName || '')}${u.country ? ' · ' + esc(u.country) : ''}</div>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="openUniversityEdit('${esc(u.id)}')">Edit</button>
      </div>
    </div>
  `).join('');
}

window.openUniversityModal = () => {
  _editingId = null;
  document.getElementById('uni-modal-title').textContent = 'Add University';
  document.getElementById('uni-name').value = '';
  document.getElementById('uni-short').value = '';
  document.getElementById('uni-country').value = '';
  window.openModal('uni-modal');
};

window.openUniversityEdit = (id) => {
  const u = _universities.find(x => x.id === id);
  if (!u) return;
  _editingId = id;
  document.getElementById('uni-modal-title').textContent = 'Edit University';
  document.getElementById('uni-name').value = u.name || '';
  document.getElementById('uni-short').value = u.shortName || '';
  document.getElementById('uni-country').value = u.country || '';
  window.openModal('uni-modal');
};

window.submitUniversity = async () => {
  const name = document.getElementById('uni-name').value.trim();
  const shortName = document.getElementById('uni-short').value.trim();
  const country = document.getElementById('uni-country').value.trim();
  if (!name) { window.showToast('University name is required'); return; }
  if (!shortName) { window.showToast('Short name (e.g. LASU) is required'); return; }
  const payload = { name, shortName, country, updatedAt: serverTimestamp() };
  try {
    if (_editingId) {
      await setDoc(doc(db, 'universities', _editingId), payload, { merge: true });
      const idx = _universities.findIndex(u => u.id === _editingId);
      if (idx !== -1) _universities[idx] = { ..._universities[idx], name, shortName, country };
      window.showToast(`Updated "${name}"`);
    } else {
      const ref = await addDoc(collection(db, 'universities'), {
        ...payload, createdAt: serverTimestamp(),
      });
      _universities.push({ id: ref.id, name, shortName, country });
      window.showToast(`Added "${name}"`);
    }
    window.closeModal('uni-modal');
    renderUniversities();
    populateMigrateSelect();
  } catch (e) {
    console.error(e);
    window.showToast('Save failed');
  }
};

// ── LASU MIGRATION ───────────────────────────────────────────────────────────

function populateMigrateSelect() {
  const sel = document.getElementById('migrate-uni-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select university —</option>' +
    _universities.map(u =>
      `<option value="${window.escHtml(u.id)}">${window.escHtml(u.name)} (${window.escHtml(u.shortName)})</option>`
    ).join('');
}

window.initMigration = function () {
  populateMigrateSelect();
};

window.runMigration = async function () {
  const universityId = document.getElementById('migrate-uni-select').value;
  if (!universityId) { window.showToast('Select a university first'); return; }

  const btn = document.getElementById('migrate-btn');
  const log = document.getElementById('migrate-log');
  btn.disabled = true;
  log.style.display = 'block';
  log.textContent = 'Starting migration…\n';

  const append = (msg) => { log.textContent += msg + '\n'; log.scrollTop = log.scrollHeight; };
  let facCount = 0, deptCount = 0, courseCount = 0, userCount = 0;

  try {
    // 1 — Faculties
    append('Stamping faculties…');
    const facSnap = await getDocs(collection(db, 'faculties'));
    for (const d of facSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'faculties', d.id), { universityId, updatedAt: serverTimestamp() }, { merge: true });
        facCount++;
      }
    }
    append(`  ✓ ${facCount} faculties updated (skipped ${facSnap.size - facCount} already tagged)`);

    // 2 — Departments
    append('Stamping departments…');
    const deptSnap = await getDocs(collection(db, 'departments'));
    for (const d of deptSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'departments', d.id), { universityId, updatedAt: serverTimestamp() }, { merge: true });
        deptCount++;
      }
    }
    append(`  ✓ ${deptCount} departments updated (skipped ${deptSnap.size - deptCount} already tagged)`);

    // 3 — Courses
    append('Stamping courses…');
    const courseSnap = await getDocs(collection(db, 'courses'));
    for (const d of courseSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'courses', d.id), { universityId }, { merge: true });
        courseCount++;
      }
    }
    append(`  ✓ ${courseCount} courses updated (skipped ${courseSnap.size - courseCount} already tagged)`);

    // 4 — Users (student accounts — only those without universityId)
    append('Stamping user accounts…');
    const userSnap = await getDocs(collection(db, 'users'));
    for (const d of userSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'users', d.id), { universityId, updatedAt: serverTimestamp() }, { merge: true });
        userCount++;
      }
    }
    append(`  ✓ ${userCount} users updated (skipped ${userSnap.size - userCount} already tagged)`);

    append(`\n✅ Migration complete — ${facCount} faculties, ${deptCount} departments, ${courseCount} courses, ${userCount} users.`);
    window.showToast('Migration complete');
  } catch (e) {
    console.error('[migration]', e);
    append(`\n❌ Error: ${e.message || String(e)}`);
    window.showToast('Migration failed — see log');
  } finally {
    btn.disabled = false;
  }
};
