import { db } from './firebase-config.js';
import {
  collection, getDocs, setDoc, doc, query, where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { codeToDocId } from './courses-service.js';

const RESOURCE_TYPES = ['Course Outline','Lecture Material PDF','Video Courses','Past Questions','Continuous Assessment'];
const KNOWN_CODES    = ['ECE 302','ECE 308','ECE 310','ECE 312','ECE 314','ECE 316','ECE 320','ECE 350','ECE 352',
  'CHE 352','MEE 352','GNS 312','ENT 312','MEE 354','IPE 316','ASE 363','ASE 366',
  'CVE 304','CVE 308','CVE 310','CHE 312','CHE 314'];

let _cache = [], _filter = 'all';
let _faculties = [], _departments = [];
let _universityId = null;

window.onAdminReady = function (user, profile) {
  _universityId = profile?.universityId || null;
  load();
};

async function load() {
  const el = document.getElementById('courses-grid');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const byUni = (col) => _universityId
      ? query(collection(db, col), where('universityId', '==', _universityId))
      : collection(db, col);
    const [coursesSnap, facSnap, deptSnap] = await Promise.all([
      getDocs(byUni('courses')),
      getDocs(byUni('faculties')),
      getDocs(byUni('departments')),
    ]);
    _cache = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_cache.length && !_universityId) _cache = KNOWN_CODES.map(code => ({ id: code, code, resources: {} }));
    _faculties = facSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    _departments = deptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load courses.</div>'; }
}

function render() {
  const el = document.getElementById('courses-grid');
  if (!el) return;
  const search = (document.getElementById('courses-search')?.value || '').toLowerCase();
  let items = _cache;
  if (_filter === 'ece')    items = items.filter(c => (c.code||c.id||'').startsWith('ECE'));
  else if (_filter === 'mee')   items = items.filter(c => (c.code||c.id||'').startsWith('MEE'));
  else if (_filter === 'shared') items = items.filter(c => ['GNS','ENT','CHE 352','MEE 352','ECE 316','ECE 352'].some(p => (c.code||c.id||'').startsWith(p)));
  if (search) items = items.filter(c => (c.code||c.id||'').toLowerCase().includes(search) || (c.name||'').toLowerCase().includes(search));
  if (!items.length) { el.innerHTML = '<div class="empty-state"><p>No courses found</p></div>'; return; }

  const esc = window.escHtml;
  el.innerHTML = items.map(c => {
    const code = c.code || c.id || '—';
    const res  = c.resources || {};
    const chips = RESOURCE_TYPES.map(t =>
      `<span class="cc-chip ${res[t] ? 'has' : 'miss'}">${t.replace('Lecture Material PDF','Slides').replace('Continuous Assessment','CA')}</span>`
    ).join('');
    const count = RESOURCE_TYPES.filter(t => res[t]).length;
    return `<div class="course-card">
      <div class="cc-code">${esc(code)}</div>
      <div class="cc-name">${esc(c.title || c.name || '')}</div>
      <div class="cc-chips">${chips}</div>
      <div class="cc-footer">
        <span>${count}/${RESOURCE_TYPES.length} resources</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="editMeta('${esc(code)}')">Metadata</button>
          <button class="btn-sm" onclick="editRes('${esc(code)}')">Links</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.filterCourses = (f, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  _filter = f; render();
};
window.searchCourses = () => render();

window.editRes = (code) => {
  document.getElementById('res-code').value = code;
  window.openModal('res-modal');
};

window.submitRes = async () => {
  const code = document.getElementById('res-code').value.trim().toUpperCase();
  const type = document.getElementById('res-type').value;
  const url  = document.getElementById('res-url').value.trim();
  if (!code || !url) { window.showToast('Code and URL required'); return; }
  try {
    await setDoc(doc(db, 'courses', codeToDocId(code)), { code, resources: { [type]: url } }, { merge: true });
    const existing = _cache.find(c => (c.code||c.id) === code);
    if (existing) { existing.resources = existing.resources || {}; existing.resources[type] = url; }
    else _cache.push({ id: code, code, resources: { [type]: url } });
    window.closeModal('res-modal');
    render();
    window.showToast(`Saved ${type} for ${code}`);
  } catch { window.showToast('Save failed'); }
};

// ── COURSE METADATA ──────────────────────────────────────────────────────────

function populateMetaDepts(facultyId, selectedDeptId) {
  const deptSel = document.getElementById('meta-dept');
  if (!deptSel) return;
  const filtered = facultyId ? _departments.filter(d => d.facultyId === facultyId) : [];
  deptSel.innerHTML = '<option value="">— Select department —</option>' +
    filtered.map(d => `<option value="${window.escHtml(d.id)}"${d.id === selectedDeptId ? ' selected' : ''}>${window.escHtml(d.name)}</option>`).join('');
}

function updateMetaDuration(facultyId) {
  const f = _faculties.find(x => x.id === facultyId);
  const el = document.getElementById('meta-duration-display');
  if (el) el.textContent = f && f.programDurationYears ? `${f.programDurationYears}-year programme` : '—';
}

window.editMeta = (code) => {
  const c = _cache.find(x => (x.code || x.id) === code) || { code };
  const esc = window.escHtml;
  document.getElementById('meta-code').value = code;
  document.getElementById('meta-title').value = c.title || c.name || '';
  document.getElementById('meta-units').value = c.units != null ? c.units : '';
  document.getElementById('meta-desc').value = c.description || '';
  document.getElementById('meta-compulsory').checked = !!c.isCompulsory;
  document.getElementById('meta-level').value = c.level || '';
  document.getElementById('meta-semester').value = c.semester || '';

  const facSel = document.getElementById('meta-faculty');
  facSel.innerHTML = '<option value="">— Select faculty —</option>' +
    _faculties.map(f => `<option value="${esc(f.id)}"${f.id === c.facultyId ? ' selected' : ''}>${esc(f.name)}</option>`).join('');

  populateMetaDepts(c.facultyId || '', c.departmentId || '');
  updateMetaDuration(c.facultyId || '');
  window.openModal('course-meta-modal');
};

window.onMetaFacultyChange = () => {
  const facultyId = document.getElementById('meta-faculty').value;
  populateMetaDepts(facultyId, null);
  updateMetaDuration(facultyId);
};

window.submitMeta = async () => {
  const code = document.getElementById('meta-code').value.trim().toUpperCase();
  if (!code) { window.showToast('No code'); return; }
  const title = document.getElementById('meta-title').value.trim();
  const facultyId = document.getElementById('meta-faculty').value;
  const departmentId = document.getElementById('meta-dept').value;
  const level = document.getElementById('meta-level').value;
  const semester = document.getElementById('meta-semester').value;
  const rawUnits = document.getElementById('meta-units').value.trim();
  const units = rawUnits !== '' ? parseInt(rawUnits, 10) : null;
  const description = document.getElementById('meta-desc').value.trim();
  const isCompulsory = document.getElementById('meta-compulsory').checked;

  const payload = { code };
  if (title) payload.title = title;
  if (facultyId) payload.facultyId = facultyId;
  if (departmentId) payload.departmentId = departmentId;
  if (level) payload.level = level;
  if (semester) payload.semester = semester;
  if (units !== null && !isNaN(units)) payload.units = units;
  if (description) payload.description = description;
  payload.isCompulsory = isCompulsory;
  if (_universityId) payload.universityId = _universityId;

  try {
    await setDoc(doc(db, 'courses', codeToDocId(code)), payload, { merge: true });
    const idx = _cache.findIndex(c => (c.code || c.id) === code);
    if (idx !== -1) _cache[idx] = { ..._cache[idx], ...payload };
    else _cache.push({ id: codeToDocId(code), ...payload });
    window.closeModal('course-meta-modal');
    render();
    window.showToast(`Saved metadata for ${code}`);
  } catch (e) {
    console.error(e);
    window.showToast('Save failed');
  }
};
