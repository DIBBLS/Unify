import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, limit,
  getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getRole, getAssignment } from './roles.js';

let _cache = [], _filter = 'all', _catFilter = '';
let _role = 'super_admin', _assignment = {}, _universityId = null;

window.onAdminReady = function (user, profile) {
  _role = getRole(profile);
  _assignment = getAssignment(profile);
  _universityId = profile?.universityId || null;
  initComposeForm();
  load();
};

function initComposeForm() {
  if (_role === 'class_rep') {
    const dept  = _assignment.department || '';
    const level = _assignment.level || '';
    document.getElementById('ann-scope-wrap').style.display  = 'none';
    document.getElementById('ann-class-badge').style.display = '';
    document.getElementById('ann-class-badge-text').textContent =
      `Your class — ${dept}${level ? ', ' + level : ''} (auto-targeted)`;
  }
}

async function load() {
  const el = document.getElementById('ann-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'courseUpdates'), orderBy('postedAt', 'desc'), limit(200)));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (e) {
    el.innerHTML = emptyState('Could not load announcements', 'Check Firestore rules');
  }
}

const PRIORITY_COLORS = {
  critical: { bg: 'rgba(220,38,38,0.10)', color: '#dc2626', border: 'rgba(220,38,38,0.25)', label: '🚨 Critical' },
  urgent:   { bg: 'rgba(234,88,12,0.10)',  color: '#ea580c', border: 'rgba(234,88,12,0.25)',  label: '🟠 High' },
  important:{ bg: 'rgba(217,119,6,0.10)',  color: '#d97706', border: 'rgba(217,119,6,0.25)',  label: '🟡 Normal' },
  normal:   { bg: 'rgba(74,222,128,0.10)', color: '#16a34a', border: 'rgba(74,222,128,0.25)', label: '🟢 Low' },
};

function render() {
  const el = document.getElementById('ann-list');
  if (!el) return;
  const search = (document.getElementById('ann-search')?.value || '').toLowerCase();
  let items = [..._cache];
  if (_filter === 'general') items = items.filter(a => a.kind === 'general');
  else if (_filter === 'course') items = items.filter(a => a.kind !== 'general');
  if (_catFilter) items = items.filter(a => a.category === _catFilter);
  if (search) items = items.filter(a =>
    (a.title || '').toLowerCase().includes(search) ||
    (a.message || '').toLowerCase().includes(search) ||
    (a.courseCode || '').toLowerCase().includes(search)
  );
  items.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  if (!items.length) { el.innerHTML = emptyState('No announcements found', 'Post one using the button above'); return; }

  const esc = window.escHtml;
  const rt  = window.relativeTime;
  el.innerHTML = items.map(a => {
    const ts = a.postedAt?.toDate?.();
    const p  = PRIORITY_COLORS[a.priority] || PRIORITY_COLORS.normal;
    const priorityTag = `<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:${p.bg};color:${p.color};border:1px solid ${p.border};white-space:nowrap;flex-shrink:0">${p.label}</span>`;
    const kindTag = a.kind === 'general'
      ? `<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:rgba(74,222,128,0.1);color:#16a34a;border:1px solid rgba(74,222,128,0.25);white-space:nowrap;flex-shrink:0">General</span>`
      : `<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:rgba(59,130,246,0.1);color:#2563eb;border:1px solid rgba(59,130,246,0.25);white-space:nowrap;flex-shrink:0">${esc(a.courseCode || 'Course')}</span>`;
    const catTag = a.category
      ? `<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:rgba(107,114,128,0.1);color:var(--text3);border:1px solid rgba(107,114,128,0.2);white-space:nowrap;flex-shrink:0">${esc(a.category)}</span>`
      : '';
    const pinTag = a.isPinned
      ? `<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:rgba(245,158,11,0.1);color:#d97706;border:1px solid rgba(245,158,11,0.25);white-space:nowrap;flex-shrink:0">📌 Pinned</span>`
      : '';
    const targetMeta = a.targetDepartment
      ? ` · ${esc(a.targetDepartment)}${a.targetLevel ? ', ' + esc(a.targetLevel) : ''}`
      : '';
    return `<div class="ann-full-item"${a.isPinned ? ' style="border-left:3px solid #d97706"' : ''}>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${pinTag}${priorityTag}${kindTag}${catTag}</div>
      <div class="ann-full-body">
        <div class="ann-full-title">${esc(a.title || a.courseCode || 'Update')}</div>
        <div class="ann-full-msg">${esc(a.message || '')}</div>
        <div class="ann-full-meta">${ts ? rt(ts) : '—'} · ${esc(a.postedBy || 'Admin')}${targetMeta}</div>
      </div>
      <div class="row-actions">
        <button class="btn-sm" onclick="togglePin('${a.id}',${!a.isPinned})">${a.isPinned ? 'Unpin' : 'Pin'}</button>
        <button class="btn-sm danger" onclick="del('${a.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.filterAnn = (f, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  _filter = f; render();
};
window.filterCat = (cat) => { _catFilter = cat; render(); };
window.searchAnn = () => render();

window.togglePin = async (id, pin) => {
  try {
    await updateDoc(doc(db, 'courseUpdates', id), { isPinned: pin });
    const item = _cache.find(a => a.id === id);
    if (item) item.isPinned = pin;
    render();
    window.showToast(pin ? 'Pinned' : 'Unpinned');
  } catch { window.showToast('Failed to update'); }
};

window.del = async (id) => {
  if (!confirm('Delete this announcement?')) return;
  try {
    await deleteDoc(doc(db, 'courseUpdates', id));
    _cache = _cache.filter(a => a.id !== id);
    render();
    window.showToast('Deleted');
  } catch { window.showToast('Delete failed'); }
};

window.toggleTargetFields = function () {
  const scope = document.getElementById('ann-scope').value;
  document.getElementById('ann-course-wrap').style.display  = scope === 'course' ? '' : 'none';
  document.getElementById('ann-class-fields').style.display = scope === 'class'  ? '' : 'none';
};

window.togglePushField = function () {
  const p    = document.getElementById('ann-priority').value;
  const wrap = document.getElementById('ann-push-wrap');
  if (wrap) wrap.style.display = (p === 'urgent' || p === 'critical') ? 'flex' : 'none';
};

window.submitAnn = async () => {
  const title    = document.getElementById('ann-title').value.trim();
  const message  = document.getElementById('ann-message').value.trim();
  const priority = document.getElementById('ann-priority').value;
  const category = document.getElementById('ann-category').value;
  const isPinned = document.getElementById('ann-pin').checked;
  const sendPush = document.getElementById('ann-push')?.checked || false;

  if (!title || !message) { window.showToast('Fill in title and message'); return; }

  let kind, courseCode, targetDepartment, targetLevel;

  if (_role === 'class_rep') {
    kind             = 'general';
    targetDepartment = _assignment.department || '';
    targetLevel      = _assignment.level || '';
  } else {
    const scope = document.getElementById('ann-scope').value;
    kind = scope === 'course' ? 'course' : 'general';
    if (scope === 'course') {
      courseCode = document.getElementById('ann-course-code').value.trim().toUpperCase()
        .replace(/([A-Z]+)\s*(\d+)/, '$1 $2');
      if (!courseCode) { window.showToast('Enter a course code'); return; }
    } else if (scope === 'class') {
      targetDepartment = document.getElementById('ann-dept').value.trim();
      targetLevel      = document.getElementById('ann-level').value;
      if (!targetDepartment) { window.showToast('Enter a department name'); return; }
    }
  }

  try {
    const user = auth.currentUser;
    const data = {
      kind, title, message, priority, category, isPinned, sendPush,
      postedBy: user?.displayName || user?.email || 'Admin',
      postedAt: serverTimestamp(),
    };
    if (kind === 'course' && courseCode)  data.courseCode = courseCode;
    if (targetDepartment)                 data.targetDepartment = targetDepartment;
    if (targetLevel)                      data.targetLevel = targetLevel;
    if (!targetDepartment && !targetLevel && kind === 'general') data.audience = 'all';
    if (_universityId)                    data.universityId = _universityId;

    await addDoc(collection(db, 'courseUpdates'), data);
    _resetForm();
    window.closeModal('ann-modal');
    window.showToast('Announcement published');
    load();
  } catch { window.showToast('Failed to publish'); }
};

function _resetForm() {
  document.getElementById('ann-title').value    = '';
  document.getElementById('ann-message').value  = '';
  document.getElementById('ann-priority').value = 'important';
  document.getElementById('ann-category').value = 'General';
  document.getElementById('ann-pin').checked    = false;
  const push = document.getElementById('ann-push');
  if (push) push.checked = false;
  const pushWrap = document.getElementById('ann-push-wrap');
  if (pushWrap) pushWrap.style.display = 'none';
  if (_role !== 'class_rep') {
    document.getElementById('ann-scope').value        = 'general';
    document.getElementById('ann-course-wrap').style.display  = 'none';
    document.getElementById('ann-class-fields').style.display = 'none';
    const cc = document.getElementById('ann-course-code');
    if (cc) cc.value = '';
  }
}

function emptyState(title, sub) {
  return `<div class="empty-state"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/></svg><p>${window.escHtml(title)}</p>${sub ? `<span>${window.escHtml(sub)}</span>` : ''}</div>`;
}
