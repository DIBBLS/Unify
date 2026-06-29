import { db } from './firebase-config.js';
import {
  collection, query, orderBy, limit,
  getDocs, updateDoc, deleteDoc, doc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _cache = [], _filter = 'all';

window.onAdminReady = function () { load(); };

async function load() {
  const el = document.getElementById('fb-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('timestamp', 'desc'), limit(200)));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load feedback.</div>'; }
}

function render() {
  const el = document.getElementById('fb-list');
  if (!el) return;
  const search = (document.getElementById('fb-search')?.value || '').toLowerCase();
  let items = _filter === 'all' ? _cache : _cache.filter(f => (f.status || 'open') === _filter);
  if (search) items = items.filter(f =>
    (f.message || '').toLowerCase().includes(search) ||
    (f.category || '').toLowerCase().includes(search) ||
    (f.name || f.uid || '').toLowerCase().includes(search)
  );
  if (!items.length) { el.innerHTML = emptyState('No feedback items', ''); return; }

  const esc = window.escHtml;
  const rt  = window.relativeTime;
  el.innerHTML = items.map(f => {
    const ts     = f.timestamp ? rt(new Date(f.timestamp.seconds * 1000)) : '';
    const isOpen = (f.status || 'open') !== 'resolved';
    const init   = (f.name || f.uid || '?').slice(0,2).toUpperCase();
    return `<div class="ann-full-item">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--text2);flex-shrink:0">${esc(init)}</div>
      <div class="ann-full-body">
        <div class="ann-full-title">
          ${esc(f.category || 'Feedback')}
          ${isOpen ? '<span style="font-size:10px;font-weight:700;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 7px;border-radius:20px;border:1px solid rgba(239,68,68,0.2);margin-left:6px">OPEN</span>' : '<span style="font-size:10px;font-weight:700;background:rgba(74,222,128,0.1);color:#16a34a;padding:2px 7px;border-radius:20px;border:1px solid rgba(74,222,128,0.25);margin-left:6px">RESOLVED</span>'}
        </div>
        <div class="ann-full-msg">${esc(f.message || '')}</div>
        <div class="ann-full-meta">${ts} · ${esc(f.name || f.uid || 'Anonymous')}${f.page ? ` · ${esc(f.page)}` : ''}</div>
      </div>
      <div class="row-actions">
        ${isOpen ? `<button class="btn-sm success" onclick="resolve('${f.id}')">Resolve</button>` : ''}
        <button class="btn-sm danger" onclick="del('${f.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.filterFeedback = (f, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  _filter = f; render();
};
window.searchFeedback = () => render();

window.resolve = async (id) => {
  try {
    await updateDoc(doc(db, 'feedback', id), { status: 'resolved' });
    const f = _cache.find(f => f.id === id);
    if (f) f.status = 'resolved';
    render();
    window.showToast('Marked as resolved');
  } catch { window.showToast('Update failed'); }
};

window.del = async (id) => {
  if (!confirm('Delete this feedback?')) return;
  try {
    await deleteDoc(doc(db, 'feedback', id));
    _cache = _cache.filter(f => f.id !== id);
    render();
    window.showToast('Deleted');
  } catch { window.showToast('Delete failed'); }
};

function emptyState(title, sub) {
  return `<div class="empty-state"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg><p>${window.escHtml(title)}</p>${sub ? `<span>${window.escHtml(sub)}</span>` : ''}</div>`;
}
