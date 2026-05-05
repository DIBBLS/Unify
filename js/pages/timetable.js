import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, getDocs, collection, query, orderBy, onSnapshot, where, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
let currentUser = null, userProfile = {};
let timetable = {}; // { Monday: [...classes], Tuesday: [...] }
let activeDay = '';
let saveTimeout = null;
let isAdminUser = false;
let editingClass = null; // { cls, day } — used by edit modal
let timetableSource = 'static'; // 'firestore' | 'static'

function normField(s) {
  return String(s || '').trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ');
}

// ── THEME handled by js/theme.js ──────────────────────

// ── AUTH ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'Auth.html'; return; }
  currentUser = user;
  await loadData();
  initPage();
  document.getElementById('loadingOverlay').style.display = 'none';
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await signOut(auth); window.location.href = 'Auth.html';
});

// ── LOAD DATA ─────────────────────────────────────────
async function loadData() {
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (snap.exists()) {
      const d = snap.data();
      userProfile = d;
      isAdminUser = d.isAdmin === true || d.role === 'class_rep';
      if (isAdminUser) {
        const badge = document.getElementById('adminBadge');
        if (badge) badge.style.display = 'inline-flex';
      }

      // Try Firestore shared timetable first; fall back to user-saved or static
      const firestoreTT = await loadFirestoreTimetable(d);
      if (firestoreTT) {
        timetable = firestoreTT;
        timetableSource = 'firestore';
      } else {
        timetable = d.timetable || getDefaultTimetable(d.department, d.level);
        timetableSource = 'static';
      }
    }
  } catch(e) {
    timetable = getDefaultTimetable('', '');
  }

  subscribeNotifications();
}

async function loadFirestoreTimetable(profile) {
  if (!profile.department || !profile.level) return null;
  try {
    const snap = await getDocs(query(
      collection(db, 'timetableEntries'),
      where('department', '==', profile.department),
      where('level', '==', profile.level),
    ));
    if (snap.empty) return null;
    const tt = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    snap.docs.forEach(d => {
      const e = d.data();
      if (!DAYS.includes(e.day)) return;
      tt[e.day].push({
        id: d.id,
        code: e.courseCode,
        name: e.courseCode,
        start: e.startTime,
        end: e.endTime,
        lecturer: e.lecturer || '',
        location: e.venue || '',
        status: 'scheduled',
        note: '',
      });
    });
    return tt;
  } catch(e) {
    console.warn('[timetable] loadFirestoreTimetable failed:', e);
    return null;
  }
}

// ── NOTIFICATION BELL ─────────────────────────────────
let unreadCount = 0;

function subscribeNotifications() {
  const q = query(collection(db, 'courseUpdates'), orderBy('postedAt', 'desc'));

  onSnapshot(q, snap => {
    const myCourseCodes = [];
    Object.values(timetable).forEach(day => {
      day.forEach(cls => { if (cls.code && !myCourseCodes.includes(cls.code)) myCourseCodes.push(cls.code); });
    });

    const updates = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => {
        // If the update targets a specific class, skip unless the student matches
        if (u.targetDepartment) {
          if (normField(userProfile.department) !== normField(u.targetDepartment)) return false;
          if (u.targetLevel && normField(userProfile.level) !== normField(u.targetLevel)) return false;
        }
        return !myCourseCodes.length || myCourseCodes.includes(u.courseCode);
      });

    const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
    unreadCount = updates.filter(u => !readIds.includes(u.id)).length;
    updateBell(unreadCount);
    renderNotifDrawer(updates.slice(0, 30), readIds);

    // Also merge latest courseStatus into timetable cards (live updates)
    updates.forEach(u => {
      if (!u.courseCode) return;
      Object.keys(timetable).forEach(day => {
        timetable[day] = timetable[day].map(cls => {
          if (cls.code !== u.courseCode) return cls;
          return {
            ...cls,
            lecturer: u.lecturer || cls.lecturer,
            location: u.venue || cls.location,
            status: ['confirmed','postponed','cancelled'].includes(u.status) ? u.status : cls.status,
            adminMessage: u.message || cls.adminMessage || '',
            adminUpdated: true,
          };
        });
      });
    });
    renderClasses();
  });
}

function updateBell(count) {
  const bell = document.getElementById('notifBell');
  const badge = document.getElementById('notifBadge');
  if (!bell || !badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderNotifDrawer(updates, readIds) {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!updates.length) {
    list.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><div class="notif-empty-text">No updates for your courses yet.</div></div>`;
    return;
  }

  const chipClass = { confirmed:'notif-chip-confirmed', postponed:'notif-chip-postponed', cancelled:'notif-chip-cancelled', venue_change:'notif-chip-venue_change' };
  const chipLabel = { confirmed:'Confirmed', postponed:'Postponed', cancelled:'Cancelled', venue_change:'Venue Change' };

  list.innerHTML = updates.map(u => {
    const isUnread = !readIds.includes(u.id);
    const ts = u.postedAt?.toDate();
    const timeStr = ts ? ts.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' · ' + ts.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
    const chip = `<span class="notif-chip ${chipClass[u.status]||'notif-chip-venue_change'}">${chipLabel[u.status]||u.status}</span>`;
    const details = [u.lecturer?`Lecturer: ${u.lecturer}`:null, u.venue?`Venue: ${u.venue}`:null].filter(Boolean).join(' · ');

    return `<div class="notif-item ${isUnread?'unread':''}" onclick="markRead('${u.id}')">
      <div class="notif-item-top">
        <span class="notif-course-code">${u.courseCode}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          ${chip}
          ${isUnread ? '<div class="notif-unread-dot"></div>' : ''}
        </div>
      </div>
      ${u.message ? `<div class="notif-msg">${u.message}</div>` : ''}
      ${details ? `<div class="notif-detail">${details}</div>` : ''}
      <div class="notif-meta">Posted by ${u.postedBy||'Admin'} · ${timeStr}</div>
    </div>`;
  }).join('');
}

window.markRead = function(id) {
  const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
  if (!readIds.includes(id)) readIds.push(id);
  localStorage.setItem('unify-read-notifs', JSON.stringify(readIds));
  updateBell(Math.max(0, unreadCount - 1));
};

window.markAllRead = function() {
  const list = document.getElementById('notifList');
  const ids = Array.from(list.querySelectorAll('.notif-item')).map(el => {
    const m = el.getAttribute('onclick')?.match(/'([^']+)'/);
    return m ? m[1] : null;
  }).filter(Boolean);
  const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
  ids.forEach(id => { if (!readIds.includes(id)) readIds.push(id); });
  localStorage.setItem('unify-read-notifs', JSON.stringify(readIds));
  unreadCount = 0;
  updateBell(0);
  list.querySelectorAll('.notif-item').forEach(el => { el.classList.remove('unread'); });
  list.querySelectorAll('.notif-unread-dot').forEach(el => el.remove());
};

window.toggleNotifDrawer = function() {
  const drawer = document.getElementById('notifDrawer');
  const overlay = document.getElementById('notifOverlay');
  const isOpen = drawer.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
};

window.closeNotifDrawer = function() {
  document.getElementById('notifDrawer')?.classList.remove('open');
  document.getElementById('notifOverlay')?.classList.remove('active');
};

function saveData() {
  if (!currentUser) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { timetable }, { merge: true });
    } catch(e) { console.error(e); }
  }, 800);
}

// ── DEFAULT TIMETABLE ─────────────────────────────────
// LASU Faculty of Engineering — 2025/2026 Second Semester Timetable
// Departments: ECE, MEE, ASE, CPE, IPE, CVE — Levels: 200, 300, 500

const TIMETABLES = {
  ECE: {
    '200': {
      Monday: [
        { id: 'm1', code: 'ECE 220', name: 'ECE 220', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'm2', code: 'CHE 206', name: 'CHE 206', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 't2', code: 'ECE 206', name: 'ECE 206', start: '13:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory · Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'ECE 204', name: 'ECE 204', start: '10:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units TBD · Compulsory · Title TBD' },
        { id: 'w3', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory · Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'th2', code: 'ECE 204', name: 'ECE 204', start: '10:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units TBD · Compulsory · Title TBD' },
        { id: 'th3', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory · Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'GNS 212', name: 'GNS 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f2', code: 'ECE 210', name: 'ECE 210', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'f3', code: 'ECE 202', name: 'ECE 202', start: '15:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'f4', code: 'MEE 202', name: 'MEE 202', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'ECE 308', name: 'Digital Electronics II', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
        { id: 'm2', code: 'ECE 351', name: 'Introduction to AI/ML', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'm3', code: 'ECE 316', name: 'Electrical Machines', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 't2', code: 'ECE 302', name: 'Analogue Electronics', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 't3', code: 'ECE 310', name: 'Introduction to Telecommunications and Broadcasting', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'ECE 308', name: 'Digital Electronics II', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
        { id: 'w3', code: 'ECE 351', name: 'Introduction to AI/ML', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
      ],
      Thursday: [
        { id: 'th1', code: 'ENT 312', name: 'Venture Creation', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th2', code: 'ECE 306', name: 'Electronic Laboratory II', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory' },
        { id: 'th3', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th4', code: 'ECE 314', name: 'Microprocessor Fundamentals and Applications', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
      ],
      Friday: [
        { id: 'f1', code: 'ECE 320', name: 'Electromagnetic Fields and Waves', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
        { id: 'f2', code: 'MEE 352', name: 'Renewable Energy Systems and Technology', start: '10:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'f3', code: 'ECE 312', name: 'Signals and Systems', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
      ],
    },
    '500': {
      Monday: [
        { id: 'm1', code: 'ECE 524', name: 'ECE 524', start: '09:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm2', code: 'ECE 522', name: 'ECE 522', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm3', code: 'ECE 504', name: 'ECE 504', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'ECE 512', name: 'ECE 512', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 't2', code: 'ECE 514', name: 'ECE 514', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 502', name: 'ECE 502', start: '10:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'w2', code: 'ECE 520', name: 'ECE 520', start: '12:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 508', name: 'ECE 508', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th2', code: 'ECE 506', name: 'ECE 506', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th3', code: 'ECE 516', name: 'ECE 516', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'ECE 514', name: 'ECE 514', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f2', code: 'ECE 520', name: 'ECE 520', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
    },
  },

  MEE: {
    '200': {
      Monday: [
        { id: 'm1', code: 'MEE 212', name: 'MEE 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'm2', code: 'CHE 206', name: 'CHE 206', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'm3', code: 'MEE 208', name: 'MEE 208', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
      ],
      Tuesday: [],
      Wednesday: [
        { id: 'w1', code: 'ENT 202', name: 'ENT 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'w2', code: 'MEE 206', name: 'MEE 206', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units TBD · Compulsory · Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'th2', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory · Title TBD' },
        { id: 'th3', code: 'MEE 216', name: 'MEE 216', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'GNS 212', name: 'GNS 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f2', code: 'ECE 210', name: 'ECE 210', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'f3', code: 'ECE 202', name: 'ECE 202', start: '15:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
      ],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'ECE 351', name: 'Introduction to AI/ML', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'm2', code: 'ECE 316', name: 'Electrical Machines', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'SPORTS', name: 'Sports', start: '14:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Sports period' },
      ],
      Thursday: [
        { id: 'th1', code: 'ENT 312', name: 'Venture Creation', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th2', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th3', code: 'MEE 354', name: 'Computer-Aided Design and Manufacture', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Friday: [
        { id: 'f1', code: 'MEE 352', name: 'Renewable Energy Systems and Technology', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'f2', code: 'ECE 302', name: 'Analogue Electronics', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
    },
    '500': {
      Monday: [
        { id: 'm1', code: 'MEE 516', name: 'MEE 516', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm2', code: 'MEE 526', name: 'MEE 526', start: '12:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm3', code: 'MEE 518', name: 'MEE 518', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'MEE 354', name: 'Computer-Aided Design and Manufacture', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 't2', code: 'MEE 518', name: 'MEE 518', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 't3', code: 'MEE 526', name: 'MEE 526', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'MEE 504', name: 'Energy Source and Conversion', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'w2', code: 'MEE 512', name: 'MEE 512', start: '10:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'w3', code: 'MEE 524', name: 'MEE 524', start: '12:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'MEE 510', name: 'MEE 510', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th2', code: 'MEE 508', name: 'MEE 508', start: '10:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th3', code: 'MEE 514', name: 'MEE 514', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'MEE 520', name: 'MEE 520', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f2', code: 'MEE 506', name: 'MEE 506', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
    },
  },

  ASE: {
    '200': {
      Monday: [
        { id: 'm1', code: 'MEE 212', name: 'MEE 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'm2', code: 'CHE 206', name: 'CHE 206', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'm3', code: 'MEE 208', name: 'MEE 208', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'ASE 204', name: 'ASE 204', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ENT 202', name: 'ENT 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'w2', code: 'ASE 202', name: 'ASE 202', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'th2', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Compulsory · Title TBD' },
        { id: 'th3', code: 'ASE 212', name: 'ASE 212', start: '14:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'GNS 212', name: 'GNS 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f2', code: 'ECE 210', name: 'ECE 210', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'f3', code: 'MEE 212', name: 'MEE 212', start: '12:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f4', code: 'ECE 202', name: 'ECE 202', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'f5', code: 'MEE 202', name: 'MEE 202', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'ASE 344', name: 'ASE 344', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm2', code: 'ASE 362', name: 'Aerospace Technology Lab II', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'm3', code: 'ECE 351', name: 'Introduction to AI/ML', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'm4', code: 'ASE 352', name: 'ASE 352', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 't2', code: 'ASE 378', name: 'ASE 378', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 't3', code: 'ASE 366', name: 'Principle of Aerodynamics', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
        { id: 't4', code: 'ASE 364', name: 'ASE 364', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'ASE 380', name: 'ASE 380', start: '11:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ASE 312', name: 'ASE 312', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th2', code: 'ASE 360', name: 'ASE 360', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th3', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th4', code: 'ASE 366', name: 'Principle of Aerodynamics', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
      ],
      Friday: [
        { id: 'f1', code: 'ECE 302', name: 'Analogue Electronics', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'f2', code: 'ASE 352', name: 'ASE 352', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f3', code: 'ASE 366', name: 'Principle of Aerodynamics', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
        { id: 'f4', code: 'ENT 302', name: 'ENT 302', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
    },
    '500': {
      Monday: [
        { id: 'm1', code: 'ASE 508', name: 'Airline Enterprise Operations', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Required' },
      ],
      Tuesday: [
        { id: 't1', code: 'ASE 580', name: 'ASE 580', start: '14:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ASE 524', name: 'Aircraft Materials', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
        { id: 'w2', code: 'ASE 504', name: 'Aircraft Maintenance', start: '11:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Required' },
      ],
      Thursday: [
        { id: 'th1', code: 'ASE 566', name: 'Safety & Reliability', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
        { id: 'th2', code: 'ASE 588', name: 'Aircraft Design II', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Required' },
      ],
      Friday: [],
    },
  },

  CPE: {
    '200': {
      Monday: [
        { id: 'm1', code: 'CHE 206', name: 'CHE 206', start: '08:00', end: '09:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'm2', code: 'CHE 206', name: 'CHE 206', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'm3', code: 'CPE 206', name: 'CPE 206', start: '14:00', end: '15:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm4', code: 'CPE 202', name: 'CPE 202', start: '15:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 202', name: 'CHE 202', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 't2', code: 'CHE 202', name: 'CHE 202', start: '14:00', end: '15:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 't3', code: 'CPE 204', name: 'CPE 204', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ENT 202', name: 'ENT 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'w2', code: 'CPE 206', name: 'CPE 206', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ENT 202', name: 'ENT 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'th2', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'GNS 212', name: 'GNS 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f2', code: 'CPE 204', name: 'CPE 204', start: '10:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'CHE 308', name: 'Numerical Method in Chemical Engineering', start: '08:00', end: '09:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'm2', code: 'CPE 306', name: 'CPE 306', start: '09:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm3', code: 'CHE 312', name: 'Transfer Process II', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Required' },
        { id: 'm4', code: 'CPE 316', name: 'CPE 316', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 't2', code: 'CPE 314', name: 'CPE 314', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 't3', code: 'CPE 314', name: 'CPE 314', start: '14:00', end: '15:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD · 2nd slot' },
        { id: 't4', code: 'CPE 304', name: 'CPE 304', start: '15:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'CHE 314', name: 'Chemical Engineering Laboratory', start: '11:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: '1 Unit · Required' },
        { id: 'w3', code: 'CPE 310', name: 'CPE 310', start: '12:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ENT 312', name: 'Venture Creation', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th2', code: 'CPE 316', name: 'CPE 316', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th3', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'th4', code: 'CPE 302', name: 'CPE 302', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'CPE 308', name: 'CPE 308', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f2', code: 'CHE 304', name: 'Separation Process', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'f3', code: 'CPE 312', name: 'CPE 312', start: '15:00', end: '17:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f4', code: 'CHE 308', name: 'Numerical Method in Chemical Engineering', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
    },
    '500': {
      Monday: [
        { id: 'm1', code: 'CPE 510', name: 'CPE 510', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm2', code: 'CPE 502', name: 'CPE 502', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'm3', code: 'CPE 520', name: 'CPE 520', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'CPE 504', name: 'CPE 504', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 't2', code: 'CPE 522', name: 'CPE 522', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'CPE 516', name: 'CPE 516', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'w2', code: 'CPE 508', name: 'CPE 508', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'CPE 508', name: 'CPE 508', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th2', code: 'CPE 506', name: 'CPE 506', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'th3', code: 'CPE 524', name: 'CPE 524', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'CPE 518', name: 'CPE 518', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
    },
  },

  IPE: {
    '200': {
      Monday: [
        { id: 'm1', code: 'MEE 212', name: 'MEE 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'm2', code: 'MEE 208', name: 'MEE 208', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
      ],
      Tuesday: [
        { id: 't1', code: 'IPE 212', name: 'IPE 212', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ENT 202', name: 'ENT 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 202', name: 'ECE 202', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'th2', code: 'MEE 204', name: 'MEE 204', start: '11:00', end: '12:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'th3', code: 'IPE 214', name: 'IPE 214', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
      Friday: [
        { id: 'f1', code: 'GNS 212', name: 'GNS 212', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
        { id: 'f2', code: 'ECE 210', name: 'ECE 210', start: '10:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory · Title TBD' },
        { id: 'f3', code: 'ECE 202', name: 'ECE 202', start: '15:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'f4', code: 'MEE 202', name: 'MEE 202', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory · Title TBD' },
      ],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'ECE 351', name: 'Introduction to AI/ML', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'm2', code: 'ECE 316', name: 'Electrical Machines', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'w2', code: 'IPE 316', name: 'Ergonomics', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
        { id: 'w3', code: 'IPE 306', name: 'Operations Research II', start: '13:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 312', name: 'Signals and Systems', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
        { id: 'th2', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '13:00', end: '14:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Friday: [
        { id: 'f1', code: 'ECE 302', name: 'Analogue Electronics', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
    },
    '500': {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
    },
  },

  CVE: {
    '200': {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
    },
    '300': {
      Monday: [
        { id: 'm1', code: 'ECE 351', name: 'Introduction to AI/ML', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 'm2', code: 'ECE 316', name: 'Electrical Machines', start: '16:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Tuesday: [
        { id: 't1', code: 'CHE 352', name: 'Engineering Mathematics IV', start: '08:00', end: '11:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
        { id: 't2', code: 'CVE 304', name: 'CVE 304', start: '11:00', end: '13:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
      ],
      Wednesday: [
        { id: 'w1', code: 'ECE 352', name: 'Technical Writing and Communication', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '3 Units · Compulsory' },
      ],
      Thursday: [
        { id: 'th1', code: 'ECE 312', name: 'Signals and Systems', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Elective' },
        { id: 'th2', code: 'GNS 312', name: 'Peace and Conflict Resolution', start: '14:00', end: '16:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
      Friday: [
        { id: 'f1', code: 'CVE 308', name: 'CVE 308', start: '08:00', end: '10:00', lecturer: '', location: '', status: 'scheduled', note: 'Units/Title TBD' },
        { id: 'f2', code: 'ECE 302', name: 'Analogue Electronics', start: '17:00', end: '18:00', lecturer: '', location: '', status: 'scheduled', note: '2 Units · Compulsory' },
      ],
    },
    '500': {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
    },
  },
};

function guessDeptKey(dept) {
  if (!dept) return 'ECE';
  const d = dept.toUpperCase();
  if (d.includes('ELECTRICAL') || d.includes('ECE') || d.includes('COMPUTER')) return 'ECE';
  if (d.includes('MECHANICAL') || d.includes('MEE')) return 'MEE';
  if (d.includes('AEROSPACE') || d.includes('ASE')) return 'ASE';
  if (d.includes('CHEMICAL') || d.includes('CPE')) return 'CPE';
  if (d.includes('INDUSTRIAL') || d.includes('IPE')) return 'IPE';
  if (d.includes('CIVIL') || d.includes('CVE')) return 'CVE';
  return 'ECE';
}

function getDefaultTimetable(dept, level) {
  const lvlKey = level ? level.replace(/\D/g, '').slice(0, 3) : '300';
  const deptKey = guessDeptKey(dept);
  return (TIMETABLES[deptKey] && TIMETABLES[deptKey][lvlKey]) || TIMETABLES['ECE']['300'];
}

// ── INIT PAGE ─────────────────────────────────────────
function initPage() {
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = dayNames[now.getDay()];
  activeDay = DAYS.includes(todayName) ? todayName : 'Monday';

  document.getElementById('todayDayDisplay').textContent = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('todayDateSub').textContent = 'Today';
  document.getElementById('headerSub').textContent = `${userProfile.department || 'Engineering'} · ${userProfile.level || '300 Level'}`;

  // Today banner
  const todayClasses = (timetable[activeDay] || []).filter(c => c.status !== 'cancelled');
  if (todayClasses.length === 0) {
    document.getElementById('todayBannerText').textContent = 'No classes today — enjoy the break!';
    document.getElementById('todayClassesCount').textContent = 'Free day';
  } else {
    const confirmed = todayClasses.filter(c => c.status === 'confirmed').length;
    document.getElementById('todayBannerText').textContent =
      confirmed > 0
        ? `${confirmed} class${confirmed > 1 ? 'es' : ''} confirmed today`
        : `${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''} scheduled today`;
    document.getElementById('todayClassesCount').textContent = `${todayClasses.length} classes`;
  }

  // Show live-timetable note if data came from Firestore
  const sourceNote = document.getElementById('timetableSourceNote');
  if (sourceNote) {
    if (timetableSource === 'firestore') {
      sourceNote.textContent = 'Live timetable — set by your class rep';
      sourceNote.style.display = 'block';
    } else {
      sourceNote.style.display = 'none';
    }
  }

  renderDayTabs();
  renderClasses();
}

// ── DAY TABS ──────────────────────────────────────────
function renderDayTabs() {
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = dayNames[now.getDay()];

  document.getElementById('dayTabs').innerHTML = DAYS.map(day => {
    const isToday = day === todayName;
    const isActive = day === activeDay;
    const classes = (timetable[day] || []).filter(c => c.status !== 'cancelled');
    return `<button class="day-tab ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}"
      onclick="switchDay('${day}')">
      <span class="day-tab-name">${day.slice(0,3)}</span>
      <span class="day-tab-date">${classes.length} class${classes.length !== 1 ? 'es' : ''}</span>
      <div class="day-tab-dot"></div>
    </button>`;
  }).join('');
}

window.switchDay = function(day) {
  activeDay = day;
  renderDayTabs();
  renderClasses();
}

// ── RENDER CLASSES ────────────────────────────────────
function renderClasses() {
  const list = document.getElementById('classesList');
  const classes = (timetable[activeDay] || []).sort((a,b) => a.start.localeCompare(b.start));

  if (!classes.length) {
    list.innerHTML = `<div class="empty-day">
      <div class="empty-day-icon">😴</div>
      <p class="empty-day-text">No classes on ${activeDay}.<br>Use the form below to add one.</p>
    </div>`;
    return;
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const isToday = activeDay === dayNames[now.getDay()];

  list.innerHTML = classes.map(cls => {
    const startMins = timeToMins(cls.start);
    const endMins = timeToMins(cls.end);
    const isOngoing = isToday && nowMins >= startMins && nowMins < endMins && cls.status !== 'cancelled';
    const displayStatus = cls.status === 'cancelled' ? 'cancelled' : isOngoing ? 'ongoing' : cls.status;
    const duration = endMins - startMins;
    const durationText = duration >= 60 ? Math.floor(duration/60) + 'h' + (duration%60 ? (duration%60)+'m' : '') : duration + 'min';

    const badgeMap = {
      scheduled: '<span class="class-status-badge badge-scheduled"><div class="status-dot"></div>Scheduled</span>',
      confirmed: '<span class="class-status-badge badge-confirmed"><div class="status-dot"></div>Confirmed</span>',
      cancelled: '<span class="class-status-badge badge-cancelled"><div class="status-dot"></div>Cancelled</span>',
      ongoing: '<span class="class-status-badge badge-ongoing"><div class="status-dot"></div>Ongoing now</span>',
      postponed: '<span class="class-status-badge" style="background:rgba(251,191,36,.12);color:#b45309;border:1px solid rgba(251,191,36,.3);"><div class="status-dot" style="background:#b45309;"></div>Postponed</span>',
      rescheduled: '<span class="class-status-badge" style="background:rgba(59,130,246,.1);color:#2563eb;border:1px solid rgba(59,130,246,.25);"><div class="status-dot" style="background:#2563eb;"></div>Rescheduled</span>',
    };

    const editBtn = isAdminUser
      ? `<button class="class-action-btn edit-class" onclick="openEditModal('${cls.id}','${activeDay}')">✏ Edit</button>`
      : '';
    const confirmBtn = `<button class="class-action-btn confirm" onclick="updateStatus('${cls.id}','confirmed')">✓ Confirm</button>`;
    const cancelBtn  = `<button class="class-action-btn cancel"  onclick="updateStatus('${cls.id}','cancelled')">✕ Cancel</button>`;
    const pendingBtn = `<button class="class-action-btn undo"    onclick="updateStatus('${cls.id}','scheduled')">⏸ Pending</button>`;
    let actions;
    if (cls.status === 'confirmed') {
      actions = pendingBtn + cancelBtn + editBtn;
    } else if (cls.status === 'cancelled') {
      actions = pendingBtn + confirmBtn + editBtn;
    } else {
      // scheduled / postponed / anything else → pending is the current state
      actions = confirmBtn + cancelBtn + editBtn;
    }

    return `<div class="class-card ${displayStatus}" id="card-${cls.id}">
      <div class="class-status-strip"></div>
      <div class="class-inner">
        <div class="class-time-col">
          <div class="class-time-start">${formatTime(cls.start)}</div>
          <div class="class-time-end">${formatTime(cls.end)}</div>
          <span class="class-duration">${durationText}</span>
        </div>
        <div class="class-divider"></div>
        <div class="class-info">
          <div class="class-code">${cls.code}</div>
          <div class="class-name">${cls.name}</div>
          <div class="class-meta">
            ${cls.lecturer ? `<span class="class-meta-item">👤 ${cls.lecturer}</span>` : ''}
            ${cls.location ? `<span class="class-meta-item">📍 ${cls.location}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            ${badgeMap[displayStatus]}
            <div class="class-actions">${actions}</div>
          </div>
          ${cls.note ? `<div class="class-note">📝 ${cls.note}</div>` : ''}
          ${cls.adminMessage ? `<div style="margin-top:8px;padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);border-radius:8px;font-size:12px;line-height:1.6;color:var(--text2);"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#16a34a;display:block;margin-bottom:4px;">HOC Update</span>${cls.adminMessage}</div>` : ''}
          ${cls.rescheduleTime ? `<div style="margin-top:6px;font-size:12px;color:#2563eb;font-weight:500;">🔄 Rescheduled to: ${cls.rescheduleTime}</div>` : ''}
          ${['postponed','rescheduled'].includes(cls.status) ? `<div style="margin-top:6px;padding:8px 12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:6px;font-size:12px;color:#b45309;">Check the notification bell for details.</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── UPDATE STATUS ─────────────────────────────────────
window.updateStatus = function(id, newStatus) {
  const dayClasses = timetable[activeDay] || [];
  const cls = dayClasses.find(c => c.id === id);
  if (!cls) return;
  cls.status = newStatus;
  renderClasses();
  saveData();
  const msgs = {
    confirmed: '✅ Class confirmed — it\'s happening!',
    cancelled: '❌ Class marked as cancelled.',
    scheduled: '⏸ Class set back to pending.',
  };
  showToast(msgs[newStatus] || 'Updated');
}

// ── ADD CLASS ─────────────────────────────────────────
window.toggleAddForm = function() {
  const form = document.getElementById('addClassForm');
  form.classList.toggle('open');
}

window.addClass = function() {
  const code = document.getElementById('newCode').value.trim();
  const name = document.getElementById('newName').value.trim();
  const day = document.getElementById('newDay').value;
  const start = document.getElementById('newStart').value;
  const end = document.getElementById('newEnd').value;
  const lecturer = document.getElementById('newLecturer').value.trim();
  const location = document.getElementById('newLocation').value.trim();
  if (!code || !name) { showToast('Course code and name are required'); return; }

  const newClass = {
    id: day[0].toLowerCase() + Date.now(),
    code, name, start, end, lecturer, location,
    status: 'scheduled', note: ''
  };
  if (!timetable[day]) timetable[day] = [];
  timetable[day].push(newClass);

  activeDay = day;
  renderDayTabs();
  renderClasses();
  saveData();
  toggleAddForm();
  ['newCode','newName','newLecturer','newLocation'].forEach(id => document.getElementById(id).value = '');
  showToast('📅 Class added to ' + day);
}

// ── HELPERS ───────────────────────────────────────────
function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2,'0')} ${ampm}`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── ADMIN / COURSE REP EDIT MODAL ────────────────────
window.openEditModal = function(id, day) {
  const dayClasses = timetable[day] || [];
  const cls = dayClasses.find(c => c.id === id);
  if (!cls) return;
  editingClass = { cls, day };
  document.getElementById('editModalCourseChip').textContent = `${cls.code} · ${day}`;
  document.getElementById('editStatus').value =
    ['scheduled','confirmed','cancelled','postponed','venue_change'].includes(cls.status) ? cls.status : 'scheduled';
  document.getElementById('editLecturer').value = cls.lecturer || '';
  document.getElementById('editVenue').value = cls.location || '';
  document.getElementById('editMessage').value = '';
  document.getElementById('editModal').classList.add('open');
};

window.closeEditModal = function() {
  document.getElementById('editModal').classList.remove('open');
  editingClass = null;
};

window.handleModalOverlayClick = function(e) {
  if (e.target === document.getElementById('editModal')) closeEditModal();
};

window.submitCourseUpdate = async function() {
  if (!editingClass || !currentUser) return;
  const { cls, day } = editingClass;
  const status   = document.getElementById('editStatus').value;
  const lecturer = document.getElementById('editLecturer').value.trim();
  const venue    = document.getElementById('editVenue').value.trim();
  const message  = document.getElementById('editMessage').value.trim();

  const btn = document.getElementById('editSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Posting...';

  try {
    const updateId = `${cls.code.replace(/\s/g,'-')}_${Date.now()}`;
    const payload = {
      courseCode: cls.code,
      status,
      lecturer: lecturer || null,
      venue: venue || null,
      message: message || null,
      postedAt: serverTimestamp(),
      postedBy: userProfile?.name || currentUser.email,
      postedByEmail: currentUser.email,
    };
    await setDoc(doc(db, 'courseUpdates', updateId), payload);

    // Update local copy immediately so the card reflects the change
    if (lecturer) cls.lecturer = lecturer;
    if (venue) cls.location = venue;
    if (message) cls.adminMessage = message;
    if (['confirmed','cancelled','postponed'].includes(status)) cls.status = status;
    else if (status === 'scheduled') cls.status = 'scheduled';
    saveData();
    renderClasses();

    closeEditModal();
    showToast('✅ Update posted to all students');
  } catch(e) {
    console.error(e);
    showToast('❌ Failed to post update');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Update →';
  }
};

// ── SERVICE WORKER (Push Notifications) ───────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('Unify SW registered:', reg.scope);

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Store subscription in Firestore for server-side push (future)
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // Replace with your VAPID public key when setting up Web Push server
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBrqLTkVSmeZWZoRkU'
      )
    }).catch(() => null);

    if (sub && currentUser) {
      await setDoc(doc(db, 'users', currentUser.uid), {
        pushSubscription: JSON.stringify(sub)
      }, { merge: true });
    }
  } catch(e) {
    console.log('SW registration skipped:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

// Register SW after auth
setTimeout(registerServiceWorker, 2000);
