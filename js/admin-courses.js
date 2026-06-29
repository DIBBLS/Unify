import { db } from './firebase-config.js';
import {
  collection, getDocs, setDoc, doc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const RESOURCE_TYPES = ['Course Outline','Lecture Material PDF','Video Courses','Past Questions','Continuous Assessment'];
const KNOWN_CODES    = ['ECE 302','ECE 308','ECE 310','ECE 312','ECE 314','ECE 316','ECE 320','ECE 350','ECE 352',
  'CHE 352','MEE 352','GNS 312','ENT 312','MEE 354','IPE 316','ASE 363','ASE 366',
  'CVE 304','CVE 308','CVE 310','CHE 312','CHE 314'];

let _cache = [], _filter = 'all';

window.onAdminReady = function () { load(); };

async function load() {
  const el = document.getElementById('courses-grid');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(collection(db, 'courses'));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_cache.length) _cache = KNOWN_CODES.map(code => ({ id: code, code, resources: {} }));
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
      <div class="cc-name">${esc(c.name || '')}</div>
      <div class="cc-chips">${chips}</div>
      <div class="cc-footer">
        <span>${count}/${RESOURCE_TYPES.length} resources</span>
        <button class="btn-sm" onclick="editRes('${esc(code)}')">Edit links</button>
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
    await setDoc(doc(db, 'courses', code), { code, resources: { [type]: url } }, { merge: true });
    const existing = _cache.find(c => (c.code||c.id) === code);
    if (existing) { existing.resources = existing.resources || {}; existing.resources[type] = url; }
    else _cache.push({ id: code, code, resources: { [type]: url } });
    window.closeModal('res-modal');
    render();
    window.showToast(`Saved ${type} for ${code}`);
  } catch { window.showToast('Save failed'); }
};
