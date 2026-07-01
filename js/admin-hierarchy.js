import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, setDoc, deleteDoc, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _universities = [];
let _faculties = [];
let _departments = [];
let _selectedUniversityId = null;
let _selectedFacultyId = null;
let _editingUniversityId = null;
let _editingFacultyId = null;
let _editingDeptId = null;

window.onAdminReady = function () { loadAll(); };

async function loadAll() {
  const loading = (id) => { const el = document.getElementById(id); if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>'; };
  loading('universities-list');
  loading('faculties-list');
  loading('depts-list');
  try {
    const [uniSnap, facSnap, deptSnap] = await Promise.all([
      getDocs(collection(db, 'universities')),
      getDocs(collection(db, 'faculties')),
      getDocs(collection(db, 'departments')),
    ]);
    _universities = uniSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    _faculties    = facSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    _departments  = deptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUniversities();
    renderFaculties();
    renderDepts();
  } catch (e) {
    console.error(e);
    const err = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load data.</div>';
    ['universities-list','faculties-list','depts-list'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = err;
    });
  }
}

// ── UNIVERSITIES ──────────────────────────────────────────────────────────────

function renderUniversities() {
  const el = document.getElementById('universities-list');
  if (!el) return;
  const esc = window.escHtml;
  if (!_universities.length) {
    el.innerHTML = '<div class="empty-state"><p>No universities yet. Add the first one to get started.</p></div>';
    return;
  }
  el.innerHTML = _universities.map(u => `
    <div class="hierarchy-card${_selectedUniversityId === u.id ? ' selected' : ''}" style="cursor:pointer" onclick="selectUniversity('${esc(u.id)}')">
      <div class="hc-info">
        <div class="hc-name">${esc(u.name || '—')}</div>
        <div class="hc-meta">${esc(u.shortName || '')}${u.country ? ' · ' + esc(u.country) : ''}</div>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="event.stopPropagation();openUniversityEdit('${esc(u.id)}')">Edit</button>
      </div>
    </div>
  `).join('');
}

window.selectUniversity = (id) => {
  _selectedUniversityId = id;
  _selectedFacultyId = null;
  renderUniversities();
  renderFaculties();
  renderDepts();
  const u = _universities.find(x => x.id === id);
  const fhdr = document.getElementById('faculties-section-hdr');
  if (fhdr) fhdr.textContent = u ? `Faculties — ${u.name}` : 'Faculties';
  const dhdr = document.getElementById('depts-section-hdr');
  if (dhdr) dhdr.textContent = 'Departments';
};

window.openUniversityModal = () => {
  _editingUniversityId = null;
  document.getElementById('uni-modal-title').textContent = 'Add University';
  document.getElementById('uni-name').value = '';
  document.getElementById('uni-short').value = '';
  document.getElementById('uni-country').value = '';
  window.openModal('uni-modal');
};

window.openUniversityEdit = (id) => {
  const u = _universities.find(x => x.id === id);
  if (!u) return;
  _editingUniversityId = id;
  document.getElementById('uni-modal-title').textContent = 'Edit University';
  document.getElementById('uni-name').value = u.name || '';
  document.getElementById('uni-short').value = u.shortName || '';
  document.getElementById('uni-country').value = u.country || '';
  window.openModal('uni-modal');
};

window.submitUniversity = async () => {
  const name     = document.getElementById('uni-name').value.trim();
  const shortName = document.getElementById('uni-short').value.trim();
  const country  = document.getElementById('uni-country').value.trim();
  if (!name) { window.showToast('University name is required'); return; }
  if (!shortName) { window.showToast('Short name (e.g. LASU) is required'); return; }
  const payload = { name, shortName, country, updatedAt: serverTimestamp() };
  try {
    if (_editingUniversityId) {
      await setDoc(doc(db, 'universities', _editingUniversityId), payload, { merge: true });
      const idx = _universities.findIndex(u => u.id === _editingUniversityId);
      if (idx !== -1) _universities[idx] = { ..._universities[idx], name, shortName, country };
      window.showToast(`Updated "${name}"`);
    } else {
      const ref = await addDoc(collection(db, 'universities'), { ...payload, createdAt: serverTimestamp() });
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

// ── FACULTIES ─────────────────────────────────────────────────────────────────

function renderFaculties() {
  const el = document.getElementById('faculties-list');
  if (!el) return;
  const esc = window.escHtml;
  if (!_selectedUniversityId) {
    el.innerHTML = '<div class="empty-state"><p>Select a university above to view its faculties.</p></div>';
    return;
  }
  const items = _faculties.filter(f => f.universityId === _selectedUniversityId);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><p>No faculties yet for this university.</p></div>';
    return;
  }
  el.innerHTML = items.map(f => `
    <div class="hierarchy-card${_selectedFacultyId === f.id ? ' selected' : ''}" style="cursor:pointer" onclick="selectFaculty('${esc(f.id)}')">
      <div class="hc-info">
        <div class="hc-name">${esc(f.name || '—')}</div>
        <div class="hc-meta">${f.programDurationYears ? `${f.programDurationYears}-year programme` : 'Duration not set'}</div>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="event.stopPropagation();openFacultyEdit('${esc(f.id)}')">Edit</button>
        <button class="btn-sm danger" onclick="event.stopPropagation();deleteFaculty('${esc(f.id)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

window.selectFaculty = (id) => {
  _selectedFacultyId = id;
  renderFaculties();
  renderDepts();
  const f = _faculties.find(x => x.id === id);
  const dhdr = document.getElementById('depts-section-hdr');
  if (dhdr) dhdr.textContent = f ? `Departments — ${f.name}` : 'Departments';
};

window.openFacultyModal = () => {
  if (!_selectedUniversityId) { window.showToast('Select a university first'); return; }
  _editingFacultyId = null;
  document.getElementById('faculty-modal-title').textContent = 'Add Faculty';
  document.getElementById('faculty-name').value = '';
  document.getElementById('faculty-duration').value = '';
  window.openModal('faculty-modal');
};

window.openFacultyEdit = (id) => {
  const f = _faculties.find(x => x.id === id);
  if (!f) return;
  _editingFacultyId = id;
  document.getElementById('faculty-modal-title').textContent = 'Edit Faculty';
  document.getElementById('faculty-name').value = f.name || '';
  document.getElementById('faculty-duration').value = f.programDurationYears ?? '';
  window.openModal('faculty-modal');
};

window.submitFaculty = async () => {
  const name = document.getElementById('faculty-name').value.trim();
  const rawDuration = document.getElementById('faculty-duration').value.trim();
  const duration = rawDuration === '' ? null : parseInt(rawDuration, 10);
  if (!name) { window.showToast('Faculty name is required'); return; }
  if (duration === null || isNaN(duration) || duration < 1 || duration > 10) {
    window.showToast('Programme duration (1–10 years) is required');
    return;
  }
  const payload = { name, programDurationYears: duration, updatedAt: serverTimestamp() };
  try {
    if (_editingFacultyId) {
      await setDoc(doc(db, 'faculties', _editingFacultyId), payload, { merge: true });
      const idx = _faculties.findIndex(f => f.id === _editingFacultyId);
      if (idx !== -1) _faculties[idx] = { ..._faculties[idx], name, programDurationYears: duration };
      window.showToast(`Updated "${name}"`);
    } else {
      const ref = await addDoc(collection(db, 'faculties'), {
        ...payload, createdAt: serverTimestamp(), universityId: _selectedUniversityId,
      });
      _faculties.push({ id: ref.id, name, programDurationYears: duration, universityId: _selectedUniversityId });
      window.showToast(`Added "${name}"`);
    }
    window.closeModal('faculty-modal');
    renderFaculties();
  } catch (e) {
    console.error(e);
    window.showToast('Save failed');
  }
};

window.deleteFaculty = async (id) => {
  const f = _faculties.find(x => x.id === id);
  if (!f) return;
  if (!confirm(`Delete "${f.name}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, 'faculties', id));
    _faculties = _faculties.filter(x => x.id !== id);
    if (_selectedFacultyId === id) {
      _selectedFacultyId = null;
      const dhdr = document.getElementById('depts-section-hdr');
      if (dhdr) dhdr.textContent = 'Departments';
    }
    renderFaculties();
    renderDepts();
    window.showToast(`Deleted "${f.name}"`);
  } catch {
    window.showToast('Delete failed');
  }
};

// ── DEPARTMENTS ──────────────────────────────────────────────────────────────

function renderDepts() {
  const el = document.getElementById('depts-list');
  if (!el) return;
  const esc = window.escHtml;
  if (!_selectedFacultyId) {
    el.innerHTML = '<div class="empty-state"><p>Select a faculty above to view its departments.</p></div>';
    return;
  }
  const items = _departments.filter(d => d.facultyId === _selectedFacultyId);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><p>No departments yet for this faculty.</p></div>';
    return;
  }
  el.innerHTML = items.map(d => `
    <div class="hierarchy-card">
      <div class="hc-info">
        <div class="hc-name">${esc(d.name || '—')}</div>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="openDeptEdit('${esc(d.id)}')">Edit</button>
        <button class="btn-sm danger" onclick="deleteDept('${esc(d.id)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function populateFacultySelect(selectId, selectedFacultyId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const available = _selectedUniversityId
    ? _faculties.filter(f => f.universityId === _selectedUniversityId)
    : _faculties;
  sel.innerHTML = available.length
    ? available.map(f => `<option value="${window.escHtml(f.id)}"${f.id === selectedFacultyId ? ' selected' : ''}>${window.escHtml(f.name)}</option>`).join('')
    : '<option value="" disabled>No faculties yet — add a faculty first</option>';
}

window.openDeptModal = () => {
  if (!_selectedFacultyId) { window.showToast('Select a faculty first'); return; }
  _editingDeptId = null;
  document.getElementById('dept-modal-title').textContent = 'Add Department';
  document.getElementById('dept-name').value = '';
  populateFacultySelect('dept-faculty-id', _selectedFacultyId);
  window.openModal('dept-modal');
};

window.openDeptEdit = (id) => {
  const d = _departments.find(x => x.id === id);
  if (!d) return;
  _editingDeptId = id;
  document.getElementById('dept-modal-title').textContent = 'Edit Department';
  document.getElementById('dept-name').value = d.name || '';
  populateFacultySelect('dept-faculty-id', d.facultyId);
  window.openModal('dept-modal');
};

window.submitDept = async () => {
  const name = document.getElementById('dept-name').value.trim();
  const facultyId = document.getElementById('dept-faculty-id').value;
  if (!name) { window.showToast('Department name is required'); return; }
  if (!facultyId) { window.showToast('Faculty is required'); return; }
  const payload = { name, facultyId, updatedAt: serverTimestamp() };
  try {
    if (_editingDeptId) {
      await setDoc(doc(db, 'departments', _editingDeptId), payload, { merge: true });
      const idx = _departments.findIndex(d => d.id === _editingDeptId);
      if (idx !== -1) _departments[idx] = { ..._departments[idx], name, facultyId };
      window.showToast(`Updated "${name}"`);
    } else {
      const ref = await addDoc(collection(db, 'departments'), {
        ...payload, createdAt: serverTimestamp(), universityId: _selectedUniversityId,
      });
      _departments.push({ id: ref.id, name, facultyId, universityId: _selectedUniversityId });
      window.showToast(`Added "${name}"`);
    }
    window.closeModal('dept-modal');
    renderDepts();
  } catch (e) {
    console.error(e);
    window.showToast('Save failed');
  }
};

window.deleteDept = async (id) => {
  const d = _departments.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, 'departments', id));
    _departments = _departments.filter(x => x.id !== id);
    renderDepts();
    window.showToast(`Deleted "${d.name}"`);
  } catch {
    window.showToast('Delete failed');
  }
};

// ── MIGRATION ─────────────────────────────────────────────────────────────────

function populateMigrateSelect() {
  const sel = document.getElementById('migrate-uni-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select university —</option>' +
    _universities.map(u =>
      `<option value="${window.escHtml(u.id)}">${window.escHtml(u.name)} (${window.escHtml(u.shortName)})</option>`
    ).join('');
}

window.initMigration = function () { populateMigrateSelect(); };

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
    append('Stamping faculties…');
    const facSnap = await getDocs(collection(db, 'faculties'));
    for (const d of facSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'faculties', d.id), { universityId, updatedAt: serverTimestamp() }, { merge: true });
        facCount++;
      }
    }
    append(`  ✓ ${facCount} faculties updated (skipped ${facSnap.size - facCount} already tagged)`);

    append('Stamping departments…');
    const deptSnap = await getDocs(collection(db, 'departments'));
    for (const d of deptSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'departments', d.id), { universityId, updatedAt: serverTimestamp() }, { merge: true });
        deptCount++;
      }
    }
    append(`  ✓ ${deptCount} departments updated (skipped ${deptSnap.size - deptCount} already tagged)`);

    append('Stamping courses…');
    const courseSnap = await getDocs(collection(db, 'courses'));
    for (const d of courseSnap.docs) {
      if (!d.data().universityId) {
        await setDoc(doc(db, 'courses', d.id), { universityId }, { merge: true });
        courseCount++;
      }
    }
    append(`  ✓ ${courseCount} courses updated (skipped ${courseSnap.size - courseCount} already tagged)`);

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

    // Reload local caches so the page reflects the migration
    const [facReload, deptReload] = await Promise.all([
      getDocs(collection(db, 'faculties')),
      getDocs(collection(db, 'departments')),
    ]);
    _faculties   = facReload.docs.map(d => ({ id: d.id, ...d.data() }));
    _departments = deptReload.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFaculties();
    renderDepts();
  } catch (e) {
    console.error('[migration]', e);
    append(`\n❌ Error: ${e.message || String(e)}`);
    window.showToast('Migration failed — see log');
  } finally {
    btn.disabled = false;
  }
};
