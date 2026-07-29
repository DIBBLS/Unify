/**
 * Shared auth gate for all admin section pages.
 * Handles loading/denied screens, hero hydration, sign-out.
 * Calls window.onAdminReady(user, profile) once auth passes.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const SUPER_ADMIN = 'olotuchjosh@gmail.com';

onAuthStateChanged(auth, async (user) => {
  const loading = document.getElementById('loadingScreen');
  const denied  = document.getElementById('accessDenied');
  const main    = document.getElementById('mainContent');

  if (!user) { window.location.href = 'Auth.html'; return; }

  const snap    = await getDoc(doc(db, 'users', user.uid));
  const profile = snap.exists() ? snap.data() : {};

  const isSuperAdmin = user.email === SUPER_ADMIN;
  const isAdmin      = isSuperAdmin || profile.isAdmin === true;
  const isClassRep   = profile.role === 'class_rep';

  if (isSuperAdmin && !profile.isAdmin) {
    await setDoc(doc(db, 'users', user.uid), { isAdmin: true, role: 'super_admin', email: user.email }, { merge: true });
    profile.isAdmin = true; profile.role = 'super_admin';
  }

  if (!isAdmin && !isClassRep) {
    loading.style.display = 'none';
    denied.style.display  = 'block';
    return;
  }

  loading.style.display = 'none';
  main.style.display    = 'block';

  const fullName  = profile.name || profile.firstName || user.displayName || user.email.split('@')[0];
  const firstName = fullName.split(' ')[0];
  const initials  = fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleMap   = { super_admin: 'Super Admin', academic_lead: 'Academic Lead', class_rep: 'Class Rep' };
  const role      = profile.role || (profile.isAdmin ? 'academic_lead' : 'student');

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('heroName', firstName);
  set('heroFirstName', firstName);
  set('heroRole', roleMap[role] || 'Administrator');
  set('userInitials', initials);

  if (window.onAdminReady) window.onAdminReady(user, profile);
});

const signOutBtn = document.getElementById('signOutBtn');
if (signOutBtn) {
  signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = 'Auth.html';
  });
}

window.showToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

window.escHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

window.relativeTime = function (date) {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

window.openModal  = (id) => document.getElementById(id)?.classList.add('open');
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });
  const menuBtn = document.querySelector('.topbar-menu');
  if (menuBtn) menuBtn.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('sidebar--collapsed'));
  const d = new Date();
  const dateEl = document.getElementById('currentDate');
  if (dateEl) dateEl.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
});
