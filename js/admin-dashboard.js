import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  getCountFromServer,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const SUPER_ADMIN = 'olotuchjosh@gmail.com';

// ── Auth gate ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const loading = document.getElementById('loadingScreen');
  const denied  = document.getElementById('accessDenied');
  const main    = document.getElementById('mainContent');

  if (!user) {
    window.location.href = 'Auth.html';
    return;
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  const profile = snap.exists() ? snap.data() : {};

  const isSuperAdmin = user.email === SUPER_ADMIN;
  const isAdmin      = isSuperAdmin || profile.isAdmin === true;
  const isClassRep   = profile.role === 'class_rep';

  // Bootstrap super-admin flag on first login
  if (isSuperAdmin && !profile.isAdmin) {
    await setDoc(doc(db, 'users', user.uid), { isAdmin: true, role: 'super_admin', email: user.email }, { merge: true });
    profile.isAdmin = true;
    profile.role = 'super_admin';
  }

  if (!isAdmin && !isClassRep) {
    loading.style.display = 'none';
    denied.style.display  = 'block';
    return;
  }

  loading.style.display = 'none';
  main.style.display    = 'block';

  hydrateHero(user, profile);
  loadMetrics();
  listenActivity();
  listenAnnouncements();
  loadFeedback('all');
});

// ── Sign out ──────────────────────────────────────────────
document.getElementById('signOutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = 'Auth.html';
});

// ── Hero ──────────────────────────────────────────────────
function hydrateHero(user, profile) {
  const fullName  = profile.name || profile.firstName || user.displayName || user.email.split('@')[0];
  const firstName = fullName.split(' ')[0];
  const initials  = fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const roleMap = { super_admin: 'Super Admin', academic_lead: 'Academic Lead', class_rep: 'Class Rep' };
  const role = profile.role || (profile.isAdmin ? 'academic_lead' : 'student');

  setText('heroName', firstName);
  setText('heroFirstName', firstName);
  setText('heroRole', roleMap[role] || 'Administrator');
  setText('userInitials', initials);
}

// ── Metrics ───────────────────────────────────────────────
async function loadMetrics() {
  try {
    const [usersSnap, coursesSnap, updatesSnap, feedbackSnap] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'courses')),
      getCountFromServer(collection(db, 'courseUpdates')),
      getDocs(query(collection(db, 'feedback'), where('status', '!=', 'resolved'))),
    ]);

    const totalUsers   = usersSnap.data().count;
    const totalCourses = coursesSnap.data().count;
    const totalUpdates = updatesSnap.data().count;
    const openFeedback = feedbackSnap.size;

    setText('metricStudents', totalUsers.toLocaleString());
    setText('metricCourses',  totalCourses.toLocaleString());
    setText('metricAnnouncements', totalUpdates.toLocaleString());
    setText('metricFeedback', openFeedback.toLocaleString());

    // Deltas
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSnap = await getDocs(
      query(collection(db, 'courseUpdates'), where('postedAt', '>=', sevenDaysAgo))
    );
    const recentCount = recentSnap.size;
    const el = document.getElementById('metricAnnouncementsDelta');
    if (el) el.textContent = recentCount > 0 ? `${recentCount} in last 7 days` : 'None this week';

    // Notif badge
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (openFeedback > 0) {
        badge.textContent = openFeedback > 99 ? '99+' : String(openFeedback);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }

    const fbDelta = document.getElementById('metricFeedbackDelta');
    if (fbDelta) fbDelta.textContent = openFeedback === 1 ? '1 open item' : `${openFeedback} open items`;

  } catch (e) {
    console.error('[metrics]', e);
  }
}

// ── Recent Activity (live) ────────────────────────────────
function listenActivity() {
  const q = query(collection(db, 'courseUpdates'), orderBy('postedAt', 'desc'), limit(5));
  onSnapshot(q, (snap) => {
    const el = document.getElementById('activityList');
    if (!el) return;
    if (snap.empty) {
      el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px 0">No activity yet.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const u  = d.data();
      const ts = u.postedAt?.toDate?.();
      const timeStr = ts ? relativeTime(ts) : 'Just now';
      const isGeneral = u.kind === 'general';
      const color = isGeneral ? 'green' : statusColor(u.status);
      const icon  = isGeneral ? announceSvg : courseSvg;
      const title = isGeneral ? (u.title || 'Announcement') : `${u.courseCode || '—'} · ${statusLabel(u.status)}`;
      const sub   = isGeneral ? `By ${u.postedBy || 'Admin'}` : (u.message || u.venue || u.lecturer || 'Update posted');
      return `<div class="activity-item">
        <div class="act-icon ${color}">${icon}</div>
        <div class="act-body">
          <div class="act-title">${escHtml(title)}</div>
          <div class="act-sub">${escHtml(sub)}</div>
        </div>
        <div class="act-time">${timeStr}</div>
      </div>`;
    }).join('');
  });
}

// ── Recent Announcements (live) ───────────────────────────
function listenAnnouncements() {
  const q = query(
    collection(db, 'courseUpdates'),
    where('kind', '==', 'general'),
    orderBy('postedAt', 'desc'),
    limit(3)
  );
  onSnapshot(q, (snap) => {
    const el = document.getElementById('dashAnnouncements');
    if (!el) return;
    if (snap.empty) {
      el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px 0">No announcements yet.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const u  = d.data();
      const ts = u.postedAt?.toDate?.();
      const timeStr = ts ? relativeTime(ts) : 'Just now';
      return `<div class="ann-item">
        <span class="ann-tag general">General</span>
        <div class="ann-body">
          <div class="ann-title">${escHtml(u.title || 'Announcement')}</div>
          <div class="ann-preview">${escHtml(u.message || '')}</div>
          <div class="ann-meta">${timeStr} · ${escHtml(u.postedBy || 'Admin')}</div>
        </div>
        <span class="pub-badge">Published</span>
      </div>`;
    }).join('');
  });
}

// ── Feedback Inbox ────────────────────────────────────────
let _feedbackCache = [];

async function loadFeedback(filter) {
  const el = document.getElementById('dashFeedback');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px 0">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('timestamp', 'desc'), limit(20)));
    _feedbackCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeedback(filter);
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px 0">Could not load feedback.</div>';
    console.error('[feedback]', e);
  }
}

function renderFeedback(filter) {
  const el = document.getElementById('dashFeedback');
  if (!el) return;
  const items = filter === 'all'
    ? _feedbackCache
    : _feedbackCache.filter(f => (f.status || 'open') === filter);

  if (!items.length) {
    el.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:10px 0">No ${filter === 'all' ? '' : filter + ' '}feedback yet.</div>`;
    return;
  }
  el.innerHTML = items.slice(0, 5).map(f => {
    const ts = f.timestamp ? relativeTime(new Date(f.timestamp.seconds * 1000)) : '';
    const isOpen = (f.status || 'open') !== 'resolved';
    const initials = (f.name || f.uid || '?').slice(0, 2).toUpperCase();
    return `<div class="fb-item">
      <div class="fb-avatar">${initials}</div>
      <div class="fb-body">
        <div class="fb-name">${escHtml(f.name || f.uid || 'Anonymous')}</div>
        <div class="fb-msg">${escHtml(f.message || '')}</div>
      </div>
      <div class="fb-right">
        <span class="fb-time">${ts}</span>
        ${isOpen ? '<span class="fb-new">NEW</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

window.filterDashFeedback = function (filter, btn) {
  document.querySelectorAll('.fb-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFeedback(filter);
};

// ── Helpers ───────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusLabel(s) {
  return { confirmed: 'Confirmed', postponed: 'Postponed', cancelled: 'Cancelled', venue_change: 'Venue Change' }[s] || s || 'Update';
}

function statusColor(s) {
  return { confirmed: 'green', postponed: 'orange', cancelled: 'orange', venue_change: 'blue' }[s] || 'purple';
}

const announceSvg = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/></svg>`;

const courseSvg = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`;

// ── View dispatcher ───────────────────────────────────────────
window.onViewSwitch = function (view) {
  if (view === 'announcements') loadAnnouncements('all');
  else if (view === 'courses')  loadCourses();
  else if (view === 'content')  loadContent();
  else if (view === 'timetable') loadTimetable('300');
  else if (view === 'exams')    loadExams('upcoming');
  else if (view === 'users')    loadUsers('all');
  else if (view === 'feedback') loadFeedbackFull('all');
  else if (view === 'settings') loadSettings();
};

// ── ANNOUNCEMENTS ─────────────────────────────────────────────
let _annCache = [];
let _annFilter = 'all';

async function loadAnnouncements(filter) {
  _annFilter = filter;
  const el = document.getElementById('ann-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(
      query(collection(db, 'courseUpdates'), orderBy('postedAt', 'desc'), limit(50))
    );
    _annCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements();
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Could not load announcements.</div>';
  }
}

function renderAnnouncements() {
  const el = document.getElementById('ann-list');
  if (!el) return;
  const search = (document.getElementById('ann-search')?.value || '').toLowerCase();
  let items = _annCache;
  if (_annFilter === 'general') items = items.filter(a => a.kind === 'general');
  else if (_annFilter === 'course') items = items.filter(a => a.kind !== 'general');
  if (search) items = items.filter(a =>
    (a.title || '').toLowerCase().includes(search) ||
    (a.message || '').toLowerCase().includes(search) ||
    (a.courseCode || '').toLowerCase().includes(search)
  );
  if (!items.length) {
    el.innerHTML = emptyState('No announcements found', 'Post one using the button above');
    return;
  }
  el.innerHTML = items.map(a => {
    const ts = a.postedAt?.toDate?.();
    const timeStr = ts ? relativeTime(ts) : '—';
    const isGeneral = a.kind === 'general';
    const tag = isGeneral
      ? '<span class="ann-tag general" style="background:rgba(74,222,128,0.1);color:#16a34a;border:1px solid rgba(74,222,128,0.25)">General</span>'
      : `<span class="ann-tag" style="background:rgba(59,130,246,0.1);color:#2563eb;border:1px solid rgba(59,130,246,0.25);font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px">${escHtml(a.courseCode || 'Course')}</span>`;
    return `<div class="ann-full-item">
      ${tag}
      <div class="ann-full-body">
        <div class="ann-full-title">${escHtml(a.title || a.courseCode || 'Update')}</div>
        <div class="ann-full-msg">${escHtml(a.message || '')}</div>
        <div class="ann-full-meta">${timeStr} · ${escHtml(a.postedBy || 'Admin')}</div>
      </div>
      <div class="row-actions">
        <button class="btn-sm danger" onclick="deleteAnn('${a.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.filterAnn = function (filter, btn) {
  document.querySelectorAll('#view-announcements .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _annFilter = filter;
  renderAnnouncements();
};

window.searchAnn = function (val) { renderAnnouncements(); };

window.deleteAnn = async function (id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await deleteDoc(doc(db, 'courseUpdates', id));
    _annCache = _annCache.filter(a => a.id !== id);
    renderAnnouncements();
    window.showToast('Announcement deleted');
  } catch (e) { window.showToast('Delete failed'); }
};

window.submitAnnouncement = async function () {
  const title   = document.getElementById('ann-title').value.trim();
  const message = document.getElementById('ann-message').value.trim();
  const audience = document.getElementById('ann-audience').value;
  if (!title || !message) { window.showToast('Fill in title and message'); return; }
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'courseUpdates'), {
      kind: 'general',
      title, message, audience,
      postedBy: user?.displayName || user?.email || 'Admin',
      postedAt: serverTimestamp(),
    });
    window.closeModal('ann-modal');
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-message').value = '';
    window.showToast('Announcement published');
    loadAnnouncements(_annFilter);
  } catch (e) { window.showToast('Failed to publish'); }
};

// ── COURSES ───────────────────────────────────────────────────
let _coursesCache = [];
let _coursesFilter = 'all';

async function loadCourses() {
  const el = document.getElementById('courses-grid');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'courses'), orderBy('code')));
    _coursesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_coursesCache.length) {
      // Fallback: show static known codes from window.coursesDatabase if available
      _coursesCache = buildFallbackCourses();
    }
    renderCourses();
  } catch (e) {
    el.innerHTML = emptyState('Could not load courses', 'Check Firestore permissions');
  }
}

function buildFallbackCourses() {
  const known = ['ECE 302','ECE 308','ECE 310','ECE 312','ECE 314','ECE 316','ECE 320','ECE 350','ECE 352',
    'CHE 352','MEE 352','GNS 312','ENT 312','MEE 354','IPE 316','ASE 363','ASE 366','CVE 304','CVE 308','CVE 310','CHE 312','CHE 314'];
  return known.map(code => ({ id: code, code, name: '', resources: {} }));
}

function renderCourses() {
  const el = document.getElementById('courses-grid');
  if (!el) return;
  const search = (document.getElementById('courses-search')?.value || '').toLowerCase();
  let items = _coursesCache;
  if (_coursesFilter === 'ece')    items = items.filter(c => (c.code || c.id || '').startsWith('ECE'));
  else if (_coursesFilter === 'mee')  items = items.filter(c => (c.code || c.id || '').startsWith('MEE'));
  else if (_coursesFilter === 'shared') items = items.filter(c => {
    const code = c.code || c.id || '';
    return ['GNS','ENT','CHE 352','MEE 352','ECE 316','ECE 352'].some(p => code.startsWith(p));
  });
  if (search) items = items.filter(c =>
    (c.code || c.id || '').toLowerCase().includes(search) ||
    (c.name || '').toLowerCase().includes(search)
  );
  if (!items.length) {
    el.innerHTML = emptyState('No courses found', 'Adjust the filter or search');
    return;
  }
  const resourceTypes = ['Course Outline','Lecture Material PDF','Video Courses','Past Questions','Continuous Assessment'];
  el.innerHTML = items.map(c => {
    const code = c.code || c.id || '—';
    const res  = c.resources || {};
    const chips = resourceTypes.map(t =>
      `<span class="cc-chip ${res[t] ? 'has' : 'miss'}">${t.replace('Lecture Material PDF','Slides').replace('Continuous Assessment','CA')}</span>`
    ).join('');
    const hasCount = resourceTypes.filter(t => res[t]).length;
    return `<div class="course-card">
      <div class="cc-code">${escHtml(code)}</div>
      ${c.name ? `<div class="cc-name">${escHtml(c.name)}</div>` : '<div class="cc-name" style="height:14px"></div>'}
      <div class="cc-chips">${chips}</div>
      <div class="cc-footer">
        <span>${hasCount}/${resourceTypes.length} resources</span>
        <button class="btn-sm" onclick="editCourseRes('${escHtml(code)}')">Edit</button>
      </div>
    </div>`;
  }).join('');
}

window.filterCourses = function (filter, btn) {
  document.querySelectorAll('#view-courses .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _coursesFilter = filter;
  renderCourses();
};

window.searchCourses = function () { renderCourses(); };

window.editCourseRes = function (code) {
  document.getElementById('res-code').value = code;
  window.openModal('content-modal');
};

window.submitResource = async function () {
  const code = document.getElementById('res-code').value.trim().toUpperCase();
  const type = document.getElementById('res-type').value;
  const url  = document.getElementById('res-url').value.trim();
  if (!code || !url) { window.showToast('Course code and URL are required'); return; }
  try {
    await setDoc(doc(db, 'courses', code), { code, resources: { [type]: url } }, { merge: true });
    window.closeModal('content-modal');
    window.showToast(`Resource saved for ${code}`);
    loadCourses();
  } catch (e) { window.showToast('Save failed'); }
};

// ── CONTENT (resource link list view) ────────────────────────
async function loadContent() {
  const el = document.getElementById('content-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(collection(db, 'courses'));
    const all = [];
    snap.forEach(d => {
      const data = d.data();
      const res  = data.resources || {};
      Object.entries(res).forEach(([type, url]) => {
        if (url) all.push({ code: d.id, type, url });
      });
    });
    renderContent(all);
  } catch (e) {
    el.innerHTML = emptyState('Could not load content links', '');
  }
}

function renderContent(all) {
  const el = document.getElementById('content-list');
  if (!el) return;
  const search = (document.getElementById('content-search')?.value || '').toLowerCase();
  const items = search ? all.filter(r =>
    r.code.toLowerCase().includes(search) || r.type.toLowerCase().includes(search)
  ) : all;
  if (!items.length) {
    el.innerHTML = emptyState('No content links yet', 'Add links from the Courses section');
    return;
  }
  el.innerHTML = items.map(r => `
    <div class="content-item">
      <div class="content-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
      </div>
      <div class="content-body">
        <div class="content-code">${escHtml(r.code)}</div>
        <div class="content-type">${escHtml(r.type)}</div>
        <div class="content-url">${escHtml(r.url)}</div>
      </div>
      <a class="btn-sm" href="${escHtml(r.url)}" target="_blank" rel="noopener">Open</a>
    </div>`).join('');
}

window.searchContent = function () { loadContent(); };

// ── TIMETABLE ─────────────────────────────────────────────────
const TT_TIMES  = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
const TT_DAYS   = ['Mon','Tue','Wed','Thu','Fri'];
let _ttLevel = '300';
let _ttCache = [];

async function loadTimetable(level) {
  _ttLevel = level;
  try {
    const snap = await getDocs(
      query(collection(db, 'timetable'), where('level', '==', level))
    );
    _ttCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTimetable();
  } catch (e) {
    renderTimetable();
  }
}

function renderTimetable() {
  const grid = document.getElementById('tt-grid');
  if (!grid) return;
  // Keep header row (7 cells), rebuild time rows
  const hdrs = Array.from(grid.querySelectorAll('.hdr'));
  grid.innerHTML = '';
  hdrs.forEach(h => grid.appendChild(h));

  TT_TIMES.forEach(t => {
    const timeCell = document.createElement('div');
    timeCell.className = 'tt-cell ttime';
    timeCell.textContent = t;
    grid.appendChild(timeCell);
    TT_DAYS.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'tt-cell';
      const slot = _ttCache.find(s => s.day === day && s.time === t);
      if (slot) {
        cell.innerHTML = `<div class="tt-slot">${escHtml(slot.course)}<br>${escHtml(slot.venue || '')}</div>`;
      }
      grid.appendChild(cell);
    });
  });
}

window.filterTT = function (level, btn) {
  document.querySelectorAll('#view-timetable .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTimetable(level);
};

window.submitTTClass = async function () {
  const course = document.getElementById('tt-course').value.trim().toUpperCase();
  const level  = document.getElementById('tt-level').value;
  const day    = document.getElementById('tt-day').value;
  const time   = document.getElementById('tt-time').value.replace(/^0/, '').replace(/:00$/, ':00');
  const venue  = document.getElementById('tt-venue').value.trim();
  if (!course) { window.showToast('Enter a course code'); return; }
  try {
    await addDoc(collection(db, 'timetable'), { course, level, day, time, venue });
    window.closeModal('tt-modal');
    window.showToast('Class added');
    loadTimetable(_ttLevel);
  } catch (e) { window.showToast('Failed to add class'); }
};

// ── EXAMS ─────────────────────────────────────────────────────
let _examFilter = 'upcoming';
let _examCache  = [];

async function loadExams(filter) {
  _examFilter = filter;
  const el = document.getElementById('exam-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(
      query(collection(db, 'exams'), orderBy('date'))
    );
    _examCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExams();
  } catch (e) {
    el.innerHTML = emptyState('No exam schedule yet', 'Add exams using the button above');
  }
}

function renderExams() {
  const el = document.getElementById('exam-list');
  if (!el) return;
  const now = new Date();
  let items = _examCache;
  if (_examFilter === 'upcoming') items = items.filter(e => new Date(e.date) >= now);
  else if (_examFilter === 'past') items = items.filter(e => new Date(e.date) < now);
  if (!items.length) {
    el.innerHTML = emptyState('No exams found', _examFilter === 'upcoming' ? 'No upcoming exams scheduled' : '');
    return;
  }
  el.innerHTML = items.map(e => {
    const d = e.date ? new Date(e.date) : null;
    const month = d ? d.toLocaleString('en-US', { month: 'short' }) : '—';
    const day   = d ? d.getDate() : '—';
    return `<div class="exam-item">
      <div class="exam-date-col">
        <div class="exam-month">${month}</div>
        <div class="exam-day">${day}</div>
      </div>
      <div class="exam-body">
        <div class="exam-code">${escHtml(e.course || '—')}</div>
        <div class="exam-meta">${escHtml(e.time || '')}${e.duration ? ` · ${e.duration}h` : ''}${e.venue ? ` · ${escHtml(e.venue)}` : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn-sm danger" onclick="deleteExam('${e.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

window.filterExams = function (filter, btn) {
  document.querySelectorAll('#view-exams .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _examFilter = filter;
  renderExams();
};

window.deleteExam = async function (id) {
  if (!confirm('Remove this exam?')) return;
  try {
    await deleteDoc(doc(db, 'exams', id));
    _examCache = _examCache.filter(e => e.id !== id);
    renderExams();
    window.showToast('Exam removed');
  } catch (e) { window.showToast('Delete failed'); }
};

window.submitExam = async function () {
  const course   = document.getElementById('exam-course').value.trim().toUpperCase();
  const date     = document.getElementById('exam-date').value;
  const time     = document.getElementById('exam-time').value;
  const duration = document.getElementById('exam-duration').value;
  const venue    = document.getElementById('exam-venue').value.trim();
  if (!course || !date) { window.showToast('Course and date are required'); return; }
  try {
    await addDoc(collection(db, 'exams'), { course, date, time, duration: Number(duration), venue, createdAt: serverTimestamp() });
    window.closeModal('exam-modal');
    window.showToast('Exam published');
    loadExams(_examFilter);
  } catch (e) { window.showToast('Failed to publish exam'); }
};

// ── USERS ─────────────────────────────────────────────────────
let _usersCache = [];
let _usersFilter = 'all';

async function loadUsers(filter) {
  _usersFilter = filter;
  const el = document.getElementById('users-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('email'), limit(100)));
    _usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers();
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">Could not load users.</div>';
  }
}

function renderUsers() {
  const el = document.getElementById('users-list');
  if (!el) return;
  const search = (document.getElementById('users-search')?.value || '').toLowerCase();
  let items = _usersCache;
  if (_usersFilter === 'admin')     items = items.filter(u => u.isAdmin);
  else if (_usersFilter === 'class_rep') items = items.filter(u => u.role === 'class_rep');
  else if (_usersFilter === 'student')  items = items.filter(u => !u.isAdmin && u.role !== 'class_rep');
  if (search) items = items.filter(u =>
    (u.email || '').toLowerCase().includes(search) ||
    (u.name || u.firstName || '').toLowerCase().includes(search)
  );
  if (!items.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 20px">No users found.</div>';
    return;
  }
  const roleLabel = r => ({ super_admin: 'Super Admin', academic_lead: 'Academic Lead', class_rep: 'Class Rep', student: 'Student' }[r] || r || 'Student');
  const roleCls   = r => ({ super_admin: 'super', academic_lead: 'admin', class_rep: 'rep' }[r] || 'student');
  el.innerHTML = items.map(u => {
    const name  = u.name || u.firstName || u.email?.split('@')[0] || '—';
    const role  = u.role || (u.isAdmin ? 'academic_lead' : 'student');
    const initials = name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="dt-row" style="grid-template-columns:2fr 1fr 1fr 1fr 100px;">
      <div class="user-cell">
        <div class="user-av">${initials}</div>
        <div>
          <div class="user-name">${escHtml(name)}</div>
          <div class="user-dept">${escHtml(u.email || '')}</div>
        </div>
      </div>
      <span style="font-size:12px;color:var(--text2)">${escHtml(u.department || '—')}</span>
      <span style="font-size:12px;color:var(--text2)">${escHtml(u.level || '—')}</span>
      <span class="role-badge ${roleCls(role)}">${roleLabel(role)}</span>
      <div class="row-actions">
        <button class="btn-sm" onclick="cycleRole('${u.id}','${role}')">Role</button>
        <button class="btn-sm danger" onclick="removeUser('${u.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

window.filterUsers = function (filter, btn) {
  document.querySelectorAll('#view-users .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _usersFilter = filter;
  renderUsers();
};

window.searchUsers = function () { renderUsers(); };

window.cycleRole = async function (uid, currentRole) {
  const next = { student: 'class_rep', class_rep: 'academic_lead', academic_lead: 'student' }[currentRole] || 'student';
  if (!confirm(`Change this user's role to "${next}"?`)) return;
  try {
    await updateDoc(doc(db, 'users', uid), { role: next, isAdmin: next === 'academic_lead' });
    const u = _usersCache.find(u => u.id === uid);
    if (u) { u.role = next; u.isAdmin = next === 'academic_lead'; }
    renderUsers();
    window.showToast('Role updated');
  } catch (e) { window.showToast('Update failed'); }
};

window.removeUser = async function (uid) {
  if (!confirm('Remove this user from the system? This does not delete their Auth account.')) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
    _usersCache = _usersCache.filter(u => u.id !== uid);
    renderUsers();
    window.showToast('User removed');
  } catch (e) { window.showToast('Remove failed'); }
};

window.submitInvite = async function () {
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
    window.showToast(`Invite sent to ${email}`);
  } catch (e) { window.showToast('Failed to send invite'); }
};

// ── FEEDBACK (full view) ──────────────────────────────────────
let _fbFullCache = [];
let _fbFullFilter = 'all';

async function loadFeedbackFull(filter) {
  _fbFullFilter = filter;
  const el = document.getElementById('feedback-full-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDocs(
      query(collection(db, 'feedback'), orderBy('timestamp', 'desc'), limit(100))
    );
    _fbFullCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeedbackFull();
  } catch (e) {
    el.innerHTML = emptyState('Could not load feedback', '');
  }
}

function renderFeedbackFull() {
  const el = document.getElementById('feedback-full-list');
  if (!el) return;
  const search = (document.getElementById('feedback-search')?.value || '').toLowerCase();
  let items = _fbFullFilter === 'all'
    ? _fbFullCache
    : _fbFullCache.filter(f => (f.status || 'open') === _fbFullFilter);
  if (search) items = items.filter(f =>
    (f.message || '').toLowerCase().includes(search) ||
    (f.category || '').toLowerCase().includes(search) ||
    (f.name || f.uid || '').toLowerCase().includes(search)
  );
  if (!items.length) {
    el.innerHTML = emptyState('No feedback items', '');
    return;
  }
  el.innerHTML = items.map(f => {
    const ts = f.timestamp ? relativeTime(new Date(f.timestamp.seconds * 1000)) : '';
    const isOpen = (f.status || 'open') !== 'resolved';
    const initials = (f.name || f.uid || '?').slice(0,2).toUpperCase();
    return `<div class="ann-full-item">
      <div class="fb-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--text2);flex-shrink:0">${initials}</div>
      <div class="ann-full-body">
        <div class="ann-full-title">${escHtml(f.category || 'Feedback')}${isOpen ? ' <span style="font-size:10px;font-weight:700;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 7px;border-radius:20px;border:1px solid rgba(239,68,68,0.2)">OPEN</span>' : ''}</div>
        <div class="ann-full-msg">${escHtml(f.message || '')}</div>
        <div class="ann-full-meta">${ts} · ${escHtml(f.name || f.uid || 'Anonymous')} · ${escHtml(f.page || '')}</div>
      </div>
      <div class="row-actions">
        ${isOpen ? `<button class="btn-sm success" onclick="resolveFeedback('${f.id}')">Resolve</button>` : ''}
        <button class="btn-sm danger" onclick="deleteFeedback('${f.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.filterFeedbackFull = function (filter, btn) {
  document.querySelectorAll('#view-feedback .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _fbFullFilter = filter;
  renderFeedbackFull();
};

window.searchFeedback = function () { renderFeedbackFull(); };

window.resolveFeedback = async function (id) {
  try {
    await updateDoc(doc(db, 'feedback', id), { status: 'resolved' });
    const f = _fbFullCache.find(f => f.id === id);
    if (f) f.status = 'resolved';
    renderFeedbackFull();
    window.showToast('Marked as resolved');
  } catch (e) { window.showToast('Failed to update'); }
};

window.deleteFeedback = async function (id) {
  if (!confirm('Delete this feedback?')) return;
  try {
    await deleteDoc(doc(db, 'feedback', id));
    _fbFullCache = _fbFullCache.filter(f => f.id !== id);
    renderFeedbackFull();
    window.showToast('Feedback deleted');
  } catch (e) { window.showToast('Delete failed'); }
};

// ── SETTINGS ─────────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    if (!snap.exists()) return;
    const s = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    set('set-registrations', s.registrations !== false);
    set('set-feedback',      s.feedbackEnabled !== false);
    set('set-maintenance',   s.maintenanceMode === true);
    set('set-push',          s.pushEnabled === true);
    set('set-exam-reminders',s.examReminders !== false);
  } catch (e) {}
}

window.saveSetting = async function (key, value) {
  try {
    await setDoc(doc(db, 'settings', 'platform'), { [key]: value }, { merge: true });
    window.showToast('Setting saved');
  } catch (e) { window.showToast('Failed to save setting'); }
};

// ── Shared helpers ────────────────────────────────────────────
function emptyState(title, sub) {
  return `<div class="empty-state">
    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
    <p>${escHtml(title)}</p>
    ${sub ? `<span>${escHtml(sub)}</span>` : ''}
  </div>`;
}
