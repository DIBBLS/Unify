import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── STATE ───────────────────────────────────────────────────────
let currentUser = null, userProfile = {};
let courseCode = '', courseName = '';
let courseTopics = [];           // [{ week: N, topic: 'Title' }, ...]
let firestoreContentByWeek = {}; // { weekNum: { htmlContent, youtubeUrl, title, ... } }
let topicProgress = {};          // { "w0_t0": { done, completedAt }, ... }
let activeWeekIdx = null;
let activeTopicType = null;      // 'notes' | 'video'
let saveTimeout = null;
let courseMetadata = null;       // { faculty, dept, level, units }

function normCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// ── AUTH ────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'Auth.html'; return; }
  currentUser = user;

  const params = new URLSearchParams(window.location.search);
  courseCode = normCode(params.get('course') || '');
  courseName = params.get('name') || courseCode;

  await Promise.all([loadUserData(), loadFirestoreContent(courseCode)]);
  buildCurriculum();
  courseMetadata = getCourseMetadata(courseCode);

  hideLoading();

  // Determine initial view from URL params
  const urlWeek = parseInt(params.get('week'), 10);
  const urlTopic = parseInt(params.get('topic'), 10);

  if (Number.isFinite(urlWeek) && urlWeek >= 0 && urlWeek < courseTopics.length) {
    // Don't auto-navigate to notes.html on init — just show week view
    showWeekView(urlWeek);
  } else {
    showCourseView();
  }
});

// ── LOAD DATA ───────────────────────────────────────────────────
async function loadUserData() {
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (snap.exists()) {
      const d = snap.data();
      userProfile = d;
      topicProgress = d.topicProgress?.[courseCode] || {};
    }
  } catch (e) { console.error('[learn] loadUserData:', e); }
}

async function loadFirestoreContent(code) {
  firestoreContentByWeek = {};
  if (!code) return;
  const variants = [...new Set([code, code.replace(/\s/g, '')])];
  for (const variant of variants) {
    try {
      const snap = await getDocs(
        query(collection(db, 'courseContent'), where('courseCode', '==', variant))
      );
      console.log(`[learn] courseContent "${variant}": ${snap.size} doc(s)`);
      if (!snap.empty) {
        const ts = d => { const v = d.updatedAt || d.createdAt; return v?.toMillis ? v.toMillis() : 0; };
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ts(b) - ts(a));
        docs.forEach(data => {
          const wk = Number(data.week);
          if (!Number.isFinite(wk)) return;
          if (firestoreContentByWeek[wk]) return; // newest wins
          firestoreContentByWeek[wk] = data;
        });
        break;
      }
    } catch (e) {
      console.warn(`[learn] Firestore content load failed for "${variant}":`, e);
    }
  }
  console.log('[learn] weeks loaded:', Object.keys(firestoreContentByWeek));
}

async function saveProgress() {
  try { localStorage.setItem('unify-topic-' + courseCode, JSON.stringify(topicProgress)); } catch (e) {}
  if (!currentUser) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', currentUser.uid),
        { topicProgress: { [courseCode]: topicProgress } },
        { merge: true }
      );
    } catch (e) { console.error('[learn] saveProgress:', e); }
  }, 600);
}

// ── CURRICULUM BUILDER ──────────────────────────────────────────
function buildCurriculum() {
  const fsWeekNums = Object.keys(firestoreContentByWeek)
    .map(Number).filter(Number.isFinite).sort((a, b) => a - b);

  courseTopics = fsWeekNums.map(weekNum => {
    const fsData = firestoreContentByWeek[weekNum];
    const topic = fsData?.title || extractTitle(fsData?.htmlContent) || `Week ${weekNum}`;
    return { week: weekNum, topic };
  });
}

function extractTitle(html) {
  if (!html) return null;
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title) return title[1].split(/[—\-·]/)[0].trim() || null;
  return null;
}

// ── HELPERS ─────────────────────────────────────────────────────
function topicKey(wi, ti) { return `w${wi}_t${ti}`; }

function getTopicsForWeek(week) {
  const fs = firestoreContentByWeek[week.week];
  if (!fs) return [];
  const topics = [];
  if (fs.htmlContent) topics.push({ type: 'notes', name: week.topic, subtitle: 'Lecture Notes', time: '~12 min' });
  if (fs.youtubeUrl) topics.push({ type: 'video', name: 'Video Tutorial', subtitle: 'Watch video', time: '~10 min' });
  return topics;
}

function getTotalTopics() {
  return courseTopics.reduce((sum, week) => sum + getTopicsForWeek(week).length, 0);
}

function getDoneCount() {
  let n = 0;
  courseTopics.forEach((week, wi) => {
    getTopicsForWeek(week).forEach((_, ti) => {
      if (topicProgress[topicKey(wi, ti)]?.done) n++;
    });
  });
  return n;
}

function findFirstIncomplete() {
  for (let wi = 0; wi < courseTopics.length; wi++) {
    const topics = getTopicsForWeek(courseTopics[wi]);
    for (let ti = 0; ti < topics.length; ti++) {
      if (!topicProgress[topicKey(wi, ti)]?.done) return { w: wi, t: ti };
    }
  }
  return null;
}

function getCourseMetadata(code) {
  const db = window.coursesDatabase;
  if (!db) return null;
  for (const [faculty, depts] of Object.entries(db)) {
    for (const [dept, levels] of Object.entries(depts)) {
      for (const [level, sems] of Object.entries(levels)) {
        for (const [, list] of Object.entries(sems)) {
          if (Array.isArray(list) && list.some(c => normCode(c) === code)) {
            return { faculty, dept, level, units: 3 };
          }
        }
      }
    }
  }
  return null;
}

function getCourseIcon(code) {
  if (/^ECE/.test(code)) return '📡';
  if (/^MEE/.test(code)) return '⚙️';
  if (/^CHE|^CPE/.test(code)) return '⚗️';
  if (/^CVE/.test(code)) return '🏗️';
  if (/^ASE/.test(code)) return '✈️';
  if (/^IPE/.test(code)) return '🏭';
  if (/^MAT/.test(code)) return '📐';
  if (/^PHY/.test(code)) return '⚡';
  if (/^CSC/.test(code)) return '💻';
  return '📚';
}

// Render admin HTML via Shadow DOM — strips nav/header so only note content shows.
function renderNotesShadow(html) {
  const host = document.getElementById('notesWrapEl');
  if (!host) return;

  const raw = String(html || '').trim();

  // Parse the full HTML so we can surgically remove navigation/chrome
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  // Strip only true navigation chrome — leave hero cards, topic pills, and content intact
  doc.querySelectorAll('nav, footer, script, .back-bar, .week-nav, .wk-nav-strip')
     .forEach(el => el.remove());

  // Prefer the full week block (includes dark hero card + body) over body-only containers
  const main = doc.querySelector(
    'main, article, [role="main"], ' +
    '.week-block, .week-page, ' +          // full block incl. hero card — check these first
    '.main-content, .week-content, .lesson-content, .content-body, ' +
    '#content, #main, .week-body'          // body-only as last resort
  );
  const contentEl = main || doc.body;

  // Collect any <style> blocks from the original document
  const styles = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n');

  if (!host._shadow) host._shadow = host.attachShadow({ mode: 'open' });
  host._shadow.innerHTML = `
    <style>
      :host { display: block; padding: 0; font-family: system-ui, -apple-system, sans-serif;
              color: #111827; font-size: 15px; line-height: 1.75; }
      * { box-sizing: border-box; max-width: 100%; }
      h1, h2, h3, h4 { margin-top: 1.3em; margin-bottom: 0.4em; line-height: 1.25; }
      h1 { font-size: 1.5em; } h2 { font-size: 1.25em; } h3 { font-size: 1.1em; }
      p { margin-bottom: 0.9em; }
      ul, ol { padding-left: 1.4em; margin-bottom: 0.9em; }
      li { margin-bottom: 0.3em; }
      img { max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 1em; }
      th { background: #F9FAFB; padding: 8px 12px; text-align: left; border-bottom: 2px solid #E5E7EB; }
      td { padding: 8px 12px; border-bottom: 1px solid #F3F4F6; }
      pre { background: #F8F9FA; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin-bottom: 1em; }
      code { font-family: ui-monospace, monospace; font-size: 0.88em; background: #F3F4F6; padding: 2px 5px; border-radius: 3px; }
      pre code { background: none; padding: 0; }
      a { color: #16A34A; }
      blockquote { border-left: 3px solid #22C55E; padding-left: 14px; color: #6B7280; margin: 1em 0; }
      ${styles}
    </style>
    ${contentEl.innerHTML}
  `;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('hidden');
  setTimeout(() => overlay.style.display = 'none', 300);
}

// ── VIEW MANAGEMENT ─────────────────────────────────────────────
function goToView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view' + viewId.charAt(0).toUpperCase() + viewId.slice(1));
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.goToView = goToView;

// ── COURSE VIEW ─────────────────────────────────────────────────
function showCourseView() {
  document.getElementById('courseCodeEl').textContent = courseCode;
  document.getElementById('courseDeptEl').textContent = courseMetadata?.dept || '';
  document.getElementById('courseIconEl').textContent = getCourseIcon(courseCode);

  const tags = [];
  if (courseMetadata?.level) tags.push(courseMetadata.level);
  if (courseMetadata?.units) tags.push(courseMetadata.units + ' units');
  document.getElementById('courseTagsEl').innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

  const total = getTotalTopics();
  const done = getDoneCount();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressPctEl').textContent = pct + '% complete';
  document.getElementById('progressFillEl').style.width = pct + '%';
  document.getElementById('progressSubEl').textContent = done + ' / ' + total + ' topics';

  const first = findFirstIncomplete();
  const card = document.getElementById('continueLearningCard');
  if (first) {
    const week = courseTopics[first.w];
    const weekTopics = getTopicsForWeek(week);
    const topicLabel = weekTopics[first.t]?.name || 'Lecture Notes';
    document.getElementById('continueDescEl').textContent = `Week ${week.week} — ${topicLabel}`;
    document.getElementById('continueSubEl').textContent = week.topic;
    card.style.display = 'flex';
    card._wi = first.w;
    card._type = first.t === 0 ? 'notes' : 'video';
  } else {
    card.style.display = 'none';
  }

  renderWeeksList();
  goToView('course');
}
window.showCourseView = showCourseView;

// Called by the week-view ← button: updates URL then renders course view.
window.backFromWeek = function () {
  const url = new URL(window.location.href);
  url.searchParams.delete('week');
  url.searchParams.delete('topic');
  history.pushState({}, '', url);
  showCourseView();
};

let weeksExpanded = false;
const WEEKS_PREVIEW = 5;

function renderWeeksList() {
  const list = document.getElementById('weeksListEl');
  if (courseTopics.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">No content uploaded yet.<br>Check back soon.</div>
    </div>`;
    return;
  }

  const visible = weeksExpanded ? courseTopics : courseTopics.slice(0, WEEKS_PREVIEW);

  const rows = visible.map((week, wi) => {
    const weekTopics = getTopicsForWeek(week);
    const done = weekTopics.filter((_, ti) => topicProgress[topicKey(wi, ti)]?.done).length;
    const total = weekTopics.length;
    const allDone = done === total && total > 0;
    const partial = done > 0 && !allDone;
    const circleClass = allDone ? 'done' : partial ? 'partial' : '';
    const circleContent = allDone ? '✓' : partial ? '◑' : '';

    return `<button class="week-row-btn" onclick="showWeekView(${wi})">
      <div class="week-status-circle ${circleClass}">${circleContent}</div>
      <div class="week-row-info">
        <div class="week-row-name">Week ${week.week}</div>
        <div class="week-row-sub">${week.topic}</div>
      </div>
      <div class="week-row-right">
        <span class="week-row-count">${done}/${total} topics</span>
        <span class="week-row-arrow">›</span>
      </div>
    </button>`;
  }).join('');

  const remaining = courseTopics.length - WEEKS_PREVIEW;
  const expandBtn = courseTopics.length > WEEKS_PREVIEW
    ? `<button class="weeks-expand-btn" onclick="toggleWeeksExpand()">
        ${weeksExpanded
          ? '↑ Show less'
          : `View all weeks (${courseTopics.length}) ↓`}
       </button>`
    : '';

  list.innerHTML = rows + expandBtn;
}

window.toggleWeeksExpand = function () {
  weeksExpanded = !weeksExpanded;
  renderWeeksList();
};

window.resumeLearning = function () {
  const card = document.getElementById('continueLearningCard');
  const wi = card._wi;
  const type = card._type || 'notes';
  if (wi != null) showContentView(wi, type);
};

// ── WEEK VIEW ───────────────────────────────────────────────────
window.showWeekView = function (wi) {
  activeWeekIdx = wi;
  const week = courseTopics[wi];
  if (!week) return;

  const weekTopics = getTopicsForWeek(week);
  const done = weekTopics.filter((_, ti) => topicProgress[topicKey(wi, ti)]?.done).length;
  const total = weekTopics.length;

  document.getElementById('weekTitleEl').textContent = 'Week ' + week.week;
  document.getElementById('weekMetaEl').textContent =
    total + ' topic' + (total !== 1 ? 's' : '') + (total > 0 ? ' · ' + (total * 12) + ' min' : '');

  // Progress ring
  const circ = 188.5;
  const offset = total > 0 ? circ * (1 - done / total) : circ;
  document.getElementById('ringFillEl').style.strokeDashoffset = offset;
  document.getElementById('ringCountEl').textContent = done + '/' + total;

  // Topics
  document.getElementById('topicsListEl').innerHTML = weekTopics.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No topics yet.</div></div>`
    : weekTopics.map((topic, ti) => {
      const isDone = topicProgress[topicKey(wi, ti)]?.done;
      return `<button class="topic-card" onclick="showContentView(${wi}, '${topic.type}')">
        <div class="topic-check-circle ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</div>
        <div class="topic-card-info">
          <div class="topic-card-name">${topic.name}</div>
          <div class="topic-card-sub">${topic.subtitle}</div>
        </div>
        <div class="topic-card-right">
          <span class="topic-time">${topic.time}</span>
          <span class="topic-arrow">›</span>
        </div>
      </button>`;
    }).join('');

  // Resources
  renderResources();

  // Mark week button
  const allDone = done === total && total > 0;
  const btn = document.getElementById('markWeekBtn');
  btn.className = 'action-btn' + (allDone ? ' done-state' : '');
  btn.textContent = allDone ? '✓ Week Complete' : '✓ Mark Week Complete';

  // Update URL without navigating
  const url = new URL(window.location.href);
  url.searchParams.set('week', wi);
  url.searchParams.delete('topic');
  history.pushState({}, '', url);

  goToView('week');
};

function renderResources() {
  const wi = activeWeekIdx;
  const week = courseTopics[wi];
  const fs = week ? firestoreContentByWeek[week.week] : null;
  const staticRes = window.getResources ? window.getResources(courseCode) : {};
  const staticDefs = [
    { key: 'Course Outline',       icon: '📄', label: 'Course Outline',    type: 'PDF'   },
    { key: 'Lecture Material PDF', icon: '📋', label: 'Lecture Material',   type: 'PDF'   },
    { key: 'Video Courses',        icon: '▶',  label: 'Video Courses',      type: 'Video' },
    { key: 'Past Questions',       icon: '📝', label: 'Past Questions',     type: 'PDF'   },
    { key: 'Continuous Assessment',icon: '📊', label: 'Assignments',        type: 'PDF'   },
  ];

  const rows = [];

  // Firestore-based items for this week
  if (fs?.htmlContent) {
    const backU = new URL(window.location.href);
    backU.searchParams.delete('topic');
    const href = `notes.html?courseCode=${encodeURIComponent(courseCode)}&week=${week.week}&back=${encodeURIComponent(backU.toString())}`;
    rows.push(`<a class="resource-row" href="${href}">
      <div class="resource-icon-box">📖</div>
      <div class="resource-info">
        <div class="resource-name">Lecture Notes</div>
        <div class="resource-type">Notes</div>
      </div>
      <span class="resource-arrow">›</span>
    </a>`);
  }
  if (fs?.youtubeUrl) {
    rows.push(`<a class="resource-row" href="${fs.youtubeUrl}" target="_blank" rel="noopener noreferrer">
      <div class="resource-icon-box">▶</div>
      <div class="resource-info">
        <div class="resource-name">Video Tutorial</div>
        <div class="resource-type">Video</div>
      </div>
      <span class="resource-arrow">›</span>
    </a>`);
  }

  // Static Drive links
  staticDefs.filter(r => staticRes[r.key]).forEach(r => {
    rows.push(`<a class="resource-row" href="${staticRes[r.key]}" target="_blank" rel="noopener noreferrer">
      <div class="resource-icon-box">${r.icon}</div>
      <div class="resource-info">
        <div class="resource-name">${r.label}</div>
        <div class="resource-type">${r.type}</div>
      </div>
      <span class="resource-arrow">›</span>
    </a>`);
  });

  const section = document.getElementById('resourcesSectionEl');
  if (rows.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('resourcesListEl').innerHTML = rows.join('');
}

// ── CONTENT VIEW ─────────────────────────────────────────────────
window.showContentView = function (wi, topicType) {
  activeWeekIdx = wi;
  activeTopicType = topicType;

  const week = courseTopics[wi];
  const fs = firestoreContentByWeek[week.week];
  const ti = topicType === 'notes' ? 0 : 1;
  const key = topicKey(wi, ti);
  const isDone = topicProgress[key]?.done;
  const weekTopics = getTopicsForWeek(week);
  const thisTopic = weekTopics.find(t => t.type === topicType) || weekTopics[0];

  document.getElementById('contentTitleEl').textContent = thisTopic?.name || week.topic;
  document.getElementById('contentTypeEl').textContent = thisTopic?.subtitle || '';
  document.getElementById('contentBreadcrumbEl').textContent = `Week ${week.week} — ${thisTopic?.name || 'Topic'}`;

  const badge = document.getElementById('contentStatusEl');
  badge.style.display = isDone ? '' : 'none';

  const btn = document.getElementById('markCompleteBtn');
  btn.className = 'action-btn';
  btn.textContent = isDone ? '✓ Completed' : '✓ Mark as Complete';

  const videoWrap = document.getElementById('videoWrapEl');
  const notesWrap = document.getElementById('notesWrapEl');
  const noContent = document.getElementById('noContentEl');

  videoWrap.style.display = 'none';
  notesWrap.style.display = 'none';
  noContent.style.display = 'none';

  if (topicType === 'video' && fs?.youtubeUrl) {
    const m = fs.youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (m) {
      document.getElementById('videoFrameEl').src = `https://www.youtube.com/embed/${m[1]}`;
      videoWrap.style.display = '';
    } else {
      noContent.style.display = '';
    }
  } else if (topicType === 'notes' && fs?.htmlContent) {
    const backU = new URL(window.location.href);
    backU.searchParams.delete('topic');
    window.location.href = `notes.html?courseCode=${encodeURIComponent(courseCode)}&week=${week.week}&back=${encodeURIComponent(backU.toString())}`;
    return;
  } else {
    noContent.style.display = '';
  }

  const url = new URL(window.location.href);
  url.searchParams.set('week', wi);
  url.searchParams.set('topic', ti);
  history.pushState({}, '', url);

  // Show Next button if there's a next topic or next week
  const nextBtn = document.getElementById('nextTopicBtn');
  if (nextBtn) nextBtn.style.display = getNext(wi, ti) ? '' : 'none';

  goToView('content');
};

window.backFromContent = function () {
  if (activeWeekIdx !== null) {
    showWeekView(activeWeekIdx);
  } else {
    showCourseView();
  }
};

// ── MARK COMPLETE ────────────────────────────────────────────────
window.toggleTopicComplete = function () {
  const ti = activeTopicType === 'notes' ? 0 : 1;
  const key = topicKey(activeWeekIdx, ti);
  const wasDone = topicProgress[key]?.done;

  if (!topicProgress[key]) topicProgress[key] = {};
  topicProgress[key].done = !wasDone;
  if (!wasDone) topicProgress[key].completedAt = Date.now();

  saveProgress();
  showToast(!wasDone ? '🎉 Marked as complete!' : 'Unmarked');

  const isDone = !wasDone;
  document.getElementById('contentStatusEl').style.display = isDone ? '' : 'none';
  const btn = document.getElementById('markCompleteBtn');
  btn.className = 'action-btn';
  btn.textContent = isDone ? '✓ Completed' : '✓ Mark as Complete';
};

window.markWeekComplete = function () {
  const week = courseTopics[activeWeekIdx];
  const weekTopics = getTopicsForWeek(week);
  const allDone = weekTopics.every((_, ti) => topicProgress[topicKey(activeWeekIdx, ti)]?.done);

  weekTopics.forEach((_, ti) => {
    const key = topicKey(activeWeekIdx, ti);
    if (!topicProgress[key]) topicProgress[key] = {};
    topicProgress[key].done = !allDone;
    if (!allDone) topicProgress[key].completedAt = Date.now();
  });

  saveProgress();
  showToast(allDone ? 'Week unmarked' : '🎉 Week complete!');
  showWeekView(activeWeekIdx); // re-render week view with updated state
};

// ── NEXT NAVIGATION ──────────────────────────────────────────────
function getNext(wi, ti) {
  const week = courseTopics[wi];
  if (!week) return null;
  const weekTopics = getTopicsForWeek(week);
  // Next topic within same week
  if (ti + 1 < weekTopics.length) return { w: wi, t: ti + 1, type: weekTopics[ti + 1].type };
  // First topic of next week
  for (let nwi = wi + 1; nwi < courseTopics.length; nwi++) {
    const nextWeekTopics = getTopicsForWeek(courseTopics[nwi]);
    if (nextWeekTopics.length > 0) return { w: nwi, t: 0, type: nextWeekTopics[0].type };
  }
  return null;
}

window.goToNextTopic = function () {
  const ti = activeTopicType === 'notes' ? 0 : 1;
  const next = getNext(activeWeekIdx, ti);
  if (next) showContentView(next.w, next.type);
};

// ── THEME TOGGLE ─────────────────────────────────────────────────
window.toggleLearnTheme = function () {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('unify-theme', next);
};

window.toggleBookmark = function () {
  showToast('🔖 Bookmarks coming soon!');
};

window.showToast = showToast;

// ── EXAM PREP TAB ────────────────────────────────────────────────
let examEntries = [];
let examReadiness = {};
let examDataLoaded = false;

window.showExamView = async function () {
  goToView('exam');
  if (!examDataLoaded) {
    document.getElementById('examScrollEl').innerHTML =
      `<div class="empty-state" style="margin-top:60px;"><div class="loading-spinner"></div></div>`;
    await loadExamData();
    examDataLoaded = true;
  }
  renderExamView();
  sendExamNotifications();
};

async function loadExamData() {
  const dept = userProfile.department || userProfile.assignedDepartment || '';
  if (!dept) return;
  try {
    const snap = await getDoc(doc(db, 'examTimetables', dept));
    if (snap.exists()) examEntries = snap.data().entries || [];
  } catch (e) {
    console.error('[exam] load:', e);
    return;
  }

  const uniqueCodes = [...new Set(
    examEntries.map(e => normCode(e.course || '')).filter(Boolean)
  )];

  await Promise.all(uniqueCodes.map(async code => {
    const progress = userProfile.topicProgress?.[code] || {};
    const done = Object.values(progress).filter(t => t?.done).length;
    let total = 0;
    try {
      const snap = await getDocs(
        query(collection(db, 'courseContent'), where('courseCode', '==', code))
      );
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.htmlContent) total++;
        if (data.youtubeUrl) total++;
      });
    } catch (e) {}
    examReadiness[code] = {
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }));
}

function examDaysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr); exam.setHours(0, 0, 0, 0);
  return Math.round((exam - today) / 86400000);
}

function fmtExamDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getReadinessInfo(pct, daysLeft, total) {
  if (total === 0) return {
    color: '#9CA3AF', pillClass: 'pill-warn', label: 'No content yet',
    msg: 'Course content hasn\'t been uploaded yet. Check the resources section for past questions while you wait.',
  };
  if (pct >= 86) return {
    color: '#22C55E', pillClass: 'pill-great', label: 'Looking prepared',
    msg: `You've completed ${pct}% of this course. You're looking well-prepared — test your knowledge to confirm you're ready.`,
  };
  if (pct >= 61) return {
    color: '#f59e0b', pillClass: 'pill-ok', label: 'Almost ready',
    msg: `You're ${pct}% through the course. Push through the remaining weeks${daysLeft > 0 ? ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} to go` : ''}.`,
  };
  if (pct >= 31) return {
    color: '#f59e0b', pillClass: 'pill-warn', label: 'At risk',
    msg: `You have important topics left to cover. Focus on completing the remaining weeks — there's still time to get ready.`,
  };
  if (pct > 0) return {
    color: '#ef4444', pillClass: 'pill-danger', label: 'Danger zone',
    msg: `Only ${pct}% done.${daysLeft > 1 ? ` You have ${daysLeft} days — start reviewing now.` : daysLeft === 1 ? ' The exam is tomorrow. Study tonight.' : ' The exam is today.'}`,
  };
  return {
    color: '#ef4444', pillClass: 'pill-danger', label: 'Not started',
    msg: `You haven't started this course yet.${daysLeft > 1 ? ` Begin with Week 1 now — ${daysLeft} days left.` : daysLeft === 1 ? ' The exam is tomorrow. Start immediately.' : ' The exam is today.'}`,
  };
}

function renderExamView() {
  const el = document.getElementById('examScrollEl');
  if (!el) return;

  if (!examEntries.length) {
    const dept = userProfile.department || '';
    el.innerHTML = `<div class="empty-state" style="margin-top:60px;">
      <div class="empty-icon">📅</div>
      <div class="empty-text">${dept
        ? 'No exam timetable uploaded yet for your department.<br>Check back when your admin posts the schedule.'
        : 'Your department isn\'t set yet.<br>Complete your profile to see exam data.'
      }</div>
    </div>`;
    return;
  }

  const upcoming = [], past = [];
  examEntries.forEach(e => {
    const d = examDaysLeft(e.date);
    (d !== null && d < 0 ? past : upcoming).push(e);
  });
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

  let html = '';

  if ('Notification' in window && Notification.permission === 'default') {
    html += `<div class="exam-notif-bar">
      <span>🔔</span>
      <span>Get reminders before your exams</span>
      <button onclick="enableExamNotifs()">Enable</button>
    </div>`;
  }

  if (upcoming.length) {
    html += `<div class="exam-section-title">Upcoming Exams</div>`;
    upcoming.forEach(e => {
      const code = normCode(e.course || '');
      const days = examDaysLeft(e.date);
      const r = examReadiness[code] || { done: 0, total: 0, pct: 0 };
      const info = getReadinessInfo(r.pct, days, r.total);

      let cardClass = 'exam-card';
      let badgeClass = 'exam-days-badge badge-ok';
      let badgeText = `${days} days left`;
      if (days === 0) { cardClass += ' exam-today'; badgeClass = 'exam-days-badge badge-today'; badgeText = 'TODAY'; }
      else if (days === 1) { cardClass += ' exam-soon'; badgeClass = 'exam-days-badge badge-warn'; badgeText = 'Tomorrow'; }
      else if (days <= 3) { cardClass += ' exam-soon'; badgeClass = 'exam-days-badge badge-warn'; badgeText = `${days} days left`; }
      else if (days <= 7) { badgeClass = 'exam-days-badge badge-warn'; }

      const resources = window.getResources ? (window.getResources(code) || {}) : {};
      const pastQLink = resources['Past Questions'];
      const learnLink = `Learn.html?course=${encodeURIComponent(code)}`;
      const primaryLabel = r.pct >= 85 ? '🎓 Review Course' : r.pct === 0 ? '🚀 Start Course' : '📚 Continue Learning';

      html += `<div class="${cardClass}">
        <div class="exam-card-header">
          <div class="exam-course-code">${code || e.course}</div>
          <div class="${badgeClass}">${badgeText}</div>
        </div>
        <div class="exam-info-row">
          <div class="exam-info-item">📅 ${fmtExamDate(e.date)}</div>
          ${e.startTime ? `<div class="exam-info-item">🕐 ${fmtTime(e.startTime)}${e.endTime ? ' – ' + fmtTime(e.endTime) : ''}</div>` : ''}
          ${e.venue ? `<div class="exam-info-item">📍 ${e.venue}</div>` : ''}
        </div>
        ${r.total > 0 ? `
          <div class="readiness-label-row">
            <span class="readiness-label">Readiness</span>
            <span class="status-pill ${info.pillClass}">${info.label}</span>
          </div>
          <div class="readiness-track">
            <div class="readiness-fill" style="width:${r.pct}%;background:${info.color}"></div>
          </div>
          <div class="readiness-pct">${r.pct}% · ${r.done} of ${r.total} topics complete</div>
        ` : `
          <div class="readiness-label-row">
            <span class="readiness-label">Readiness</span>
            <span class="status-pill pill-warn">Content not uploaded</span>
          </div>
        `}
        <div class="exam-message">${info.msg}</div>
        <div class="exam-actions">
          <button class="exam-btn exam-btn-primary" onclick="window.location.href='${learnLink}'">${primaryLabel}</button>
          ${pastQLink
            ? `<button class="exam-btn exam-btn-secondary" onclick="window.open('${pastQLink}','_blank')">📝 Past Questions</button>`
            : `<button class="exam-btn exam-btn-secondary" onclick="showToast('Mock tests coming soon!')">🎯 Test Knowledge</button>`}
        </div>
      </div>`;
    });
  }

  if (past.length) {
    html += `<div class="exam-section-title" style="margin-top:28px;">Past Exams</div>`;
    past.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(e => {
      const code = normCode(e.course || '');
      html += `<div class="exam-card exam-past">
        <div class="exam-card-header">
          <div class="exam-course-code" style="font-size:20px;">${code || e.course}</div>
          <div class="exam-days-badge badge-past">Done</div>
        </div>
        <div class="exam-info-row">
          <div class="exam-info-item">📅 ${fmtExamDate(e.date)}</div>
          ${e.startTime ? `<div class="exam-info-item">🕐 ${fmtTime(e.startTime)}${e.endTime ? ' – ' + fmtTime(e.endTime) : ''}</div>` : ''}
          ${e.venue ? `<div class="exam-info-item">📍 ${e.venue}</div>` : ''}
        </div>
      </div>`;
    });
  }

  el.innerHTML = html;
}

window.enableExamNotifs = async function () {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    sendExamNotifications(true);
    renderExamView();
    showToast('Exam reminders enabled');
  }
};

function sendExamNotifications(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  examEntries.forEach(e => {
    const code = normCode(e.course || '');
    const days = examDaysLeft(e.date);
    if (days === null || days < 0 || days > 7) return;
    const key = `exam-notif-${code}-${e.date}-${new Date().toDateString()}`;
    if (!force && localStorage.getItem(key)) return;
    const r = examReadiness[code] || { pct: 0 };
    let title, body;
    if (days === 0) {
      title = `${code} exam is TODAY`;
      body = `Starts at ${fmtTime(e.startTime)}${e.venue ? ' · ' + e.venue : ''}. Good luck!`;
    } else if (r.pct >= 85) {
      title = `${code} in ${days} day${days === 1 ? '' : 's'} — you're ready`;
      body = `${r.pct}% complete. Test your knowledge to seal the deal.`;
    } else if (r.pct < 30) {
      title = `${code} in ${days} day${days === 1 ? '' : 's'} — action needed`;
      body = `Only ${r.pct}% done. Open Unify and keep studying.`;
    } else {
      title = `${code} exam in ${days} day${days === 1 ? '' : 's'}`;
      body = `${r.pct}% done. Keep pushing — you can get there.`;
    }
    try {
      new Notification(title, {
        body, icon: '/icons/apple-touch-icon.png', tag: key,
      });
      localStorage.setItem(key, '1');
    } catch (_) {}
  });
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const urlWeek = parseInt(params.get('week'), 10);
  const urlTopic = parseInt(params.get('topic'), 10);
  if (Number.isFinite(urlWeek) && urlWeek >= 0 && urlWeek < courseTopics.length) {
    showWeekView(urlWeek);
  } else {
    showCourseView();
  }
});
