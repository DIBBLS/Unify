import { db } from './firebase-config.js';
import {
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

window.onAdminReady = function (user, profile) {
  hydrateHero(user, profile);
  loadMetrics();
  listenActivity();
  listenAnnouncements();
  loadFeedback('all');
};

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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSnap = await getDocs(
      query(collection(db, 'courseUpdates'), where('postedAt', '>=', sevenDaysAgo))
    );
    const el = document.getElementById('metricAnnouncementsDelta');
    if (el) el.textContent = recentSnap.size > 0 ? `${recentSnap.size} in last 7 days` : 'None this week';

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
