import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, setDoc, deleteDoc, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _faculties = [];
let _editingFacultyId = null;

window.onAdminReady = function () { loadFaculties(); };

async function loadFaculties() {
  const el = document.getElementById('faculties-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(collection(db, 'faculties'));
    _faculties = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFaculties();
  } catch {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load faculties.</div>';
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
      const ref = await addDoc(collection(db, 'faculties'), { ...payload, createdAt: serverTimestamp() });
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
