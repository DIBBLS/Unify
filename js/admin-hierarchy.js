import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, setDoc, deleteDoc, doc, serverTimestamp, query, where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _faculties = [];
let _departments = [];
let _editingFacultyId = null;
let _editingDeptId = null;
let _universityId = null;

window.onAdminReady = function (user, profile) {
  _universityId = profile?.universityId || null;
  loadAll();
};

async function loadAll() {
  await Promise.all([loadFaculties(), loadDepts()]);
}

async function loadFaculties() {
  const el = document.getElementById('faculties-list');
  if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const q = _universityId
      ? query(collection(db, 'faculties'), where('universityId', '==', _universityId))
      : collection(db, 'faculties');
    const snap = await getDocs(q);
    _faculties = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFaculties();
  } catch {
    if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load faculties.</div>';
  }
}

async function loadDepts() {
  const el = document.getElementById('depts-list');
  if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const q = _universityId
      ? query(collection(db, 'departments'), where('universityId', '==', _universityId))
      : collection(db, 'departments');
    const snap = await getDocs(q);
    _departments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDepts();
  } catch {
    if (el) el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load departments.</div>';
  }
}

function renderFaculties() {
  const el = document.getElementById('faculties-list');
  if (!el) return;
  if (!_faculties.length) {
    el.innerHTML = '<div class="empty-state"><p>No faculties yet. Add the first one to get started.</p></div>';
    return;
  }
  const esc = window.escHtml;
  el.innerHTML = _faculties.map(f => `
    <div class="hierarchy-card">
      <div class="hc-info">
        <div class="hc-name">${esc(f.name || '—')}</div>
        <div class="hc-meta">${f.programDurationYears ? `${f.programDurationYears}-year programme` : 'Duration not set'}</div>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="openFacultyEdit('${esc(f.id)}')">Edit</button>
        <button class="btn-sm danger" onclick="deleteFaculty('${esc(f.id)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

window.openFacultyModal = () => {
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
      const createPayload = { ...payload, createdAt: serverTimestamp() };
      if (_universityId) createPayload.universityId = _universityId;
      const ref = await addDoc(collection(db, 'faculties'), createPayload);
      _faculties.push({ id: ref.id, name, programDurationYears: duration });
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
    renderFaculties();
    window.showToast(`Deleted "${f.name}"`);
  } catch {
    window.showToast('Delete failed');
  }
};

// ── DEPARTMENTS ──────────────────────────────────────────────────────────────

function renderDepts() {
  const el = document.getElementById('depts-list');
  if (!el) return;
  if (!_departments.length) {
    el.innerHTML = '<div class="empty-state"><p>No departments yet. Add faculties first, then departments.</p></div>';
    return;
  }
  const esc = window.escHtml;
  const facultyName = id => (_faculties.find(f => f.id === id) || {}).name || '—';
  el.innerHTML = _departments.map(d => `
    <div class="hierarchy-card">
      <div class="hc-info">
        <div class="hc-name">${esc(d.name || '—')}</div>
        <div class="hc-meta">${esc(facultyName(d.facultyId))}</div>
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
  sel.innerHTML = _faculties.length
    ? _faculties.map(f => `<option value="${window.escHtml(f.id)}"${f.id === selectedFacultyId ? ' selected' : ''}>${window.escHtml(f.name)}</option>`).join('')
    : '<option value="" disabled>No faculties yet — add a faculty first</option>';
}

window.openDeptModal = () => {
  _editingDeptId = null;
  document.getElementById('dept-modal-title').textContent = 'Add Department';
  document.getElementById('dept-name').value = '';
  populateFacultySelect('dept-faculty-id', null);
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
      const createPayload = { ...payload, createdAt: serverTimestamp() };
      if (_universityId) createPayload.universityId = _universityId;
      const ref = await addDoc(collection(db, 'departments'), createPayload);
      _departments.push({ id: ref.id, name, facultyId });
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
