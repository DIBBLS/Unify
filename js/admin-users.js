import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, limit,
  getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _cache = [], _filter = 'all';

window.onAdminReady = function () { load(); };

async function load() {
  const el = document.getElementById('users-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('email'), limit(200)));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">Could not load users.</div>';
  }
}

function render() {
  const el = document.getElementById('users-list');
  if (!el) return;
  const search = (document.getElementById('users-search')?.value || '').toLowerCase();
  let items = _cache;
  if (_filter === 'admin')     items = items.filter(u => u.isAdmin);
  else if (_filter === 'class_rep') items = items.filter(u => u.role === 'class_rep');
  else if (_filter === 'student')  items = items.filter(u => !u.isAdmin && u.role !== 'class_rep');
  if (search) items = items.filter(u =>
    (u.email || '').toLowerCase().includes(search) ||
    (u.name || u.firstName || '').toLowerCase().includes(search)
  );
  if (!items.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">No users found.</div>'; return; }

  const esc = window.escHtml;
  const roleLabel = r => ({ super_admin: 'Super Admin', academic_lead: 'Academic Lead', class_rep: 'Class Rep', student: 'Student' }[r] || r || 'Student');
  const roleCls   = r => ({ super_admin: 'super', academic_lead: 'admin', class_rep: 'rep' }[r] || 'student');

  el.innerHTML = items.map(u => {
    const name     = u.name || u.firstName || u.email?.split('@')[0] || '—';
    const role     = u.role || (u.isAdmin ? 'academic_lead' : 'student');
    const initials = name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="dt-row" style="grid-template-columns:2fr 1fr 1fr 1fr 110px;">
      <div class="user-cell">
        <div class="user-av">${esc(initials)}</div>
        <div>
          <div class="user-name">${esc(name)}</div>
          <div class="user-dept">${esc(u.email || '')}</div>
        </div>
      </div>
      <span style="font-size:12px;color:var(--text2)">${esc(u.department || '—')}</span>
      <span style="font-size:12px;color:var(--text2)">${esc(u.level || '—')}</span>
      <span class="role-badge ${roleCls(role)}">${roleLabel(role)}</span>
      <div class="row-actions">
        <button class="btn-sm" onclick="cycleRole('${u.id}','${role}')">Role ↻</button>
        <button class="btn-sm danger" onclick="removeUser('${u.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

window.filterUsers = (f, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  _filter = f; render();
};
window.searchUsers = () => render();

window.cycleRole = async (uid, current) => {
  const next = { student: 'class_rep', class_rep: 'academic_lead', academic_lead: 'student' }[current] || 'student';
  if (!confirm(`Change role to "${next}"?`)) return;
  try {
    await updateDoc(doc(db, 'users', uid), { role: next, isAdmin: next === 'academic_lead' });
    const u = _cache.find(u => u.id === uid);
    if (u) { u.role = next; u.isAdmin = next === 'academic_lead'; }
    render();
    window.showToast('Role updated');
  } catch { window.showToast('Update failed'); }
};

window.removeUser = async (uid) => {
  if (!confirm('Remove this user? Does not delete their sign-in account.')) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
    _cache = _cache.filter(u => u.id !== uid);
    render();
    window.showToast('User removed');
  } catch { window.showToast('Remove failed'); }
};

window.submitInvite = async () => {
  const email = document.getElementById('invite-email').value.trim().toLowerCase();
  const role  = document.getElementById('invite-role').value;
  if (!email) { window.showToast('Enter an email address'); return; }
  try {
    await addDoc(collection(db, 'invites'), {
      email, role,
      invitedBy: auth.currentUser?.email || 'admin',
      invitedAt: serverTimestamp(),
      used: false,
    });
    window.closeModal('invite-modal');
    window.showToast(`Invite recorded for ${email}`);
  } catch { window.showToast('Failed to save invite'); }
};
