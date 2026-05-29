import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null, userProfile = {};
let courseCode = '', courseName = '', courseTopics = [];
// Firestore-uploaded course content, indexed by week number (1-15)
let firestoreContentByWeek = {};

function normCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// Simple XSS sanitiser for rendering coordinator-supplied content
function sanitise(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
let topicProgress = {}; // { "topicKey": { done: bool, confidence: 1-5, reviewDates: [] } }
let activeWeekIdx = null, activeTopicIdx = null;
let selectedConfidence = 0;
let saveTimeout = null;

// ── DARK MODE handled by js/theme.js ──────────────────

// ── MOBILE SIDEBAR TOGGLE ──────────────────────────────
window.toggleMobileSidebar = function() {
  const sidebar = document.getElementById('learnSidebar');
  const toggle  = document.getElementById('sidebarMobileToggle');
  const label   = document.getElementById('sidebarToggleLabel');
  const isOpen  = sidebar.classList.toggle('sidebar-open');
  toggle.classList.toggle('open', isOpen);
  label.textContent = isOpen ? '📋 Hide Course Outline' : '📋 Course Outline';
};

// ── MOBILE WEEK SELECTOR ───────────────────────────────
function renderMobileWeekBar() {
  const bar = document.getElementById('mobileWeekBar');
  if (!bar) return;
  const numWeeks = Math.min(courseTopics.length || 15, 15);
  bar.innerHTML = Array.from({ length: numWeeks }, (_, wi) => {
    const isActive = activeWeekIdx === wi;
    return `<button class="week-pill${isActive ? ' active' : ''}" onclick="jumpToWeek(${wi})">Week ${wi + 1}</button>`;
  }).join('');
}

window.jumpToWeek = function(wi) {
  // Save to sessionStorage
  try { sessionStorage.setItem('unify-last-week-' + courseCode, String(wi)); } catch(e) {}
  toggleWeek(wi);
  // Auto-close sidebar on mobile
  const sidebar = document.getElementById('learnSidebar');
  if (sidebar && window.innerWidth <= 900 && sidebar.classList.contains('sidebar-open')) {
    sidebar.classList.remove('sidebar-open');
    const toggle = document.getElementById('sidebarMobileToggle');
    if (toggle) toggle.classList.remove('open');
    const label = document.getElementById('sidebarToggleLabel');
    if (label) label.textContent = '📋 Course Outline';
  }
};

// ── AUTH ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'Auth.html'; return; }
  currentUser = user;

  // Get course from URL params
  const params = new URLSearchParams(window.location.search);
  courseCode = normCode(params.get('course') || '');
  courseName = params.get('name') || courseCode;

  document.getElementById('navCourseName').textContent = courseName;
  document.getElementById('sidebarCode').textContent = courseCode;
  document.getElementById('sidebarName').textContent = courseName;

  await Promise.all([loadUserData(), loadFirestoreContent(courseCode)]);
  // Generate stubs for any course not manually defined in courseContent.js
  if (window.generateCourseStubs) window.generateCourseStubs();
  buildCurriculum();
  renderSidebar();
  renderMobileWeekBar();
  document.getElementById('loadingOverlay').style.display = 'none';

  // Restore last week from sessionStorage
  let autoOpened = false;
  try {
    const lastWi = sessionStorage.getItem('unify-last-week-' + courseCode);
    if (lastWi !== null) {
      const wi = parseInt(lastWi, 10);
      if (Number.isFinite(wi) && wi >= 0 && wi < courseTopics.length) {
        toggleWeek(wi);
        autoOpened = true;
      }
    }
  } catch(e) {}

  // Auto-open first incomplete topic
  if (!autoOpened) {
    const firstIncomplete = findFirstIncomplete();
    if (firstIncomplete) openTopic(firstIncomplete.w, firstIncomplete.t);
  }
});

// ── LOAD DATA ─────────────────────────────────────────
async function loadUserData() {
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (snap.exists()) {
      const d = snap.data();
      userProfile = d;
      topicProgress = d.topicProgress?.[courseCode] || {};
    }
  } catch(e) { console.error(e); }
}

// Loads admin-uploaded weekly content from Firestore, keyed by week number.
async function loadFirestoreContent(code) {
  firestoreContentByWeek = {};
  if (!code) return;
  const variants = [...new Set([code, code.replace(/\s/g, '')])];
  for (const variant of variants) {
    try {
      const snap = await getDocs(
        query(collection(db, 'courseContent'), where('courseCode', '==', variant))
      );
      console.log(`[learn] courseContent query for "${variant}": ${snap.size} doc(s)`);
      if (!snap.empty) {
        const ts = (d) => {
          const v = d.updatedAt || d.createdAt;
          return v?.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0);
        };
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => ts(b) - ts(a));
        docs.forEach(data => {
          const wk = Number(data.week);
          if (!Number.isFinite(wk)) return;
          if (firestoreContentByWeek[wk]) return;
          firestoreContentByWeek[wk] = data;
        });
        break;
      }
    } catch (e) {
      console.warn(`[learn] Firestore content load failed for "${variant}":`, e);
    }
  }
  console.log('[learn] firestoreContentByWeek keys:', Object.keys(firestoreContentByWeek));
}

async function saveProgress() {
  // Save to localStorage for dashboard mastery tracker
  try { localStorage.setItem('unify-topic-' + courseCode, JSON.stringify(topicProgress)); } catch(e) {}
  if (!currentUser) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', currentUser.uid),
        { topicProgress: { [courseCode]: topicProgress } },
        { merge: true }
      );
    } catch(e) { console.error(e); }
  }, 600);
}

// ── CURRICULUM BUILDER ───────────────────────────────
function buildCurriculum() {
  const entry = window.UNIFY_COURSE_CONTENT?.[courseCode];
  if (entry && entry.weeks) {
    courseTopics = entry.weeks;
  } else {
    const genericTopics = [
      "Introduction & Fundamentals", "Core Concepts Part 1", "Core Concepts Part 2",
      "Analysis Methods", "Design Principles", "Applications Part 1",
      "Applications Part 2", "Advanced Topics", "Case Studies",
      "Problem Solving Techniques", "Integration & Review", "Exam Preparation"
    ];
    courseTopics = genericTopics.map((topic, i) => ({
      week: i + 1, topic,
      subtopics: [`${topic} — Theory`, `${topic} — Practice`],
      time: 12
    }));
  }
}

function getSubtopicContentFile(subtopicName) {
  return window.getTopicContentFile?.(courseCode, subtopicName) || null;
}

// ── SIDEBAR ───────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('weekList');
  const doneCount = Object.values(topicProgress).filter(t => t.done).length;
  const total = courseTopics.reduce((a, w) => a + w.subtopics.length, 0);
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  document.getElementById('sidebarProgress').style.width = pct + '%';
  document.getElementById('sidebarProgressPct').textContent = pct + '%';

  list.innerHTML = courseTopics.map((week, wi) => {
    const totalT = week.subtopics.length;
    const doneT = week.subtopics.filter((_, ti) => topicProgress[topicKey(wi, ti)]?.done).length;
    const allDone = doneT === totalT;
    const isActiveWeek = activeWeekIdx === wi;
    const someDone = doneT > 0 && !allDone;
    return `
      <div class="week-item ${allDone ? 'done' : ''} ${isActiveWeek ? 'active' : ''}" onclick="toggleWeek(${wi})">
        <div class="week-header">
          <div class="week-check" style="${someDone ? 'border-color:var(--text3)' : ''}">${allDone ? '✓' : ''}</div>
          <div style="flex:1;min-width:0;">
            <div class="week-label">Week ${week.week}</div>
            <div class="week-topic">${week.topic}</div>
          </div>
          <span class="week-progress-count">${doneT}/${totalT}</span>
        </div>
        <div class="week-subtopics">
          ${week.subtopics.map((sub, ti) => {
            const key = topicKey(wi, ti);
            const done = topicProgress[key]?.done;
            const isActive = activeWeekIdx === wi && activeTopicIdx === ti;
            const hasRich = window.getTopicContentFile?.(courseCode, sub) != null;
            return `<div class="subtopic-item ${done ? 'done' : ''} ${isActive ? 'active' : ''}" onclick="event.stopPropagation(); openTopic(${wi}, ${ti})">
              <div class="subtopic-dot">${done ? '✓' : ''}</div>
              <span style="flex:1;">${sub}</span>
              ${hasRich ? `<span style="font-size:9px;font-weight:600;letter-spacing:.04em;padding:1px 6px;border-radius:4px;background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);white-space:nowrap;flex-shrink:0;">READY</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  // Update mobile week bar active state
  renderMobileWeekBar();
}

window.toggleWeek = function(wi) {
  if (activeWeekIdx === wi && activeTopicIdx === null) {
    activeWeekIdx = null;
    renderSidebar();
    showPlaceholder();
    return;
  }
  activeWeekIdx = wi;
  activeTopicIdx = null;
  renderSidebar();
  showWeekLanding(wi);
}

window.startWeek = function() {
  if (activeWeekIdx === null) return;
  const week = courseTopics[activeWeekIdx];
  let startAt = 0;
  for (let ti = 0; ti < week.subtopics.length; ti++) {
    if (!topicProgress[topicKey(activeWeekIdx, ti)]?.done) { startAt = ti; break; }
  }
  openTopic(activeWeekIdx, startAt);
}

function showPlaceholder() {
  document.getElementById('lessonPlaceholder').style.display = '';
  document.getElementById('weekLanding').style.display = 'none';
  document.getElementById('lessonView').style.display = 'none';
  document.getElementById('courseCompletePage').classList.remove('show');
}

function showWeekLanding(wi) {
  const week = courseTopics[wi];
  const totalT = week.subtopics.length;
  const doneT = week.subtopics.filter((_, ti) => topicProgress[topicKey(wi, ti)]?.done).length;

  document.getElementById('lessonPlaceholder').style.display = 'none';
  document.getElementById('weekLanding').style.display = 'block';
  document.getElementById('lessonView').style.display = 'none';
  document.getElementById('courseCompletePage').classList.remove('show');

  document.getElementById('wlBreadcrumb').textContent = courseCode + ' · Week ' + week.week;
  document.getElementById('wlTitle').textContent = week.topic;
  document.getElementById('wlTime').textContent = '~' + week.time + ' min';
  document.getElementById('wlProgress').textContent = doneT + ' / ' + totalT + ' topics';
  document.getElementById('wlProgress').style.background = doneT === totalT ? 'rgba(74,222,128,0.15)' : '';
  document.getElementById('wlProgress').style.color = doneT === totalT ? 'var(--green)' : '';

  const entry = window.UNIFY_COURSE_CONTENT?.[courseCode];
  const weekEntry = entry?.weeks?.[wi];
  const summary = weekEntry?.summary || 'Work through each topic below. Mark complete as you go — your progress is saved automatically.';
  document.getElementById('wlSummary').textContent = summary;

  document.getElementById('wlTopics').innerHTML = week.subtopics.map((sub, ti) => {
    const done = topicProgress[topicKey(wi, ti)]?.done;
    const hasRich = window.getTopicContentFile?.(courseCode, sub) != null;
    const conf = topicProgress[topicKey(wi, ti)]?.confidence || 0;
    const stars = conf > 0 ? '★'.repeat(conf) : '';
    return `<div class="wl-topic-row ${done ? 'done' : ''}" onclick="openTopic(${wi}, ${ti})">
      <div class="wl-topic-circle">${done ? '✓' : ''}</div>
      <span class="wl-topic-name">${sub}</span>
      ${hasRich ? `<span class="wl-ready-badge">READY</span>` : ''}
      ${stars ? `<span style="font-size:11px;color:var(--yellow);letter-spacing:1px;">${stars}</span>` : ''}
      <span class="wl-topic-status">${done ? 'Done' : 'Not started'}</span>
    </div>`;
  }).join('');

  const allDone = doneT === totalT;
  document.getElementById('wlStartBtn').textContent = allDone ? 'Review Week →' : (doneT > 0 ? 'Continue →' : 'Start Week →');

  document.getElementById('learnMain').scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function topicKey(wi, ti) { return `w${wi}_t${ti}`; }

function findFirstIncomplete() {
  for (let wi = 0; wi < courseTopics.length; wi++) {
    for (let ti = 0; ti < courseTopics[wi].subtopics.length; ti++) {
      if (!topicProgress[topicKey(wi, ti)]?.done) return { w: wi, t: ti };
    }
  }
  return null;
}

// ── OPEN TOPIC (LESSON PAGE) ──────────────────────────
window.openTopic = function(wi, ti) {
  activeWeekIdx = wi;
  activeTopicIdx = ti;
  selectedConfidence = topicProgress[topicKey(wi, ti)]?.confidence || 0;

  const week = courseTopics[wi];
  if (!week) { console.warn('openTopic: week', wi, 'not found in courseTopics'); return; }
  const subtopic = week.subtopics[ti];
  if (!subtopic) { console.warn('openTopic: subtopic', ti, 'not found in week', wi); return; }
  const key = topicKey(wi, ti);
  const isDone = topicProgress[key]?.done;

  document.getElementById('lessonPlaceholder').style.display = 'none';
  document.getElementById('weekLanding').style.display = 'none';
  document.getElementById('lessonView').style.display = 'block';
  document.getElementById('courseCompletePage').classList.remove('show');

  // Header
  document.getElementById('lessonBreadcrumb').textContent = `${courseCode} · Week ${week.week}`;
  document.getElementById('lessonTitle').textContent = subtopic;
  document.getElementById('lessonTime').textContent = `${week.time} min`;
  document.getElementById('lessonStatusBadge').textContent = isDone ? '✓ Completed' : 'In Progress';
  document.getElementById('lessonStatusBadge').style.background = isDone ? 'rgba(74,222,128,0.15)' : '';
  document.getElementById('lessonStatusBadge').style.color = isDone ? '#4ade80' : '';
  // Sync sticky bar
  const stickyBtn = document.getElementById('markCompleteBtn');
  if (stickyBtn) {
    stickyBtn.className = 'sticky-complete-btn' + (isDone ? ' completed' : '');
    document.getElementById('markCompleteBtnText').textContent = isDone ? '✓ Completed' : '✓ Mark Complete';
  }

  // Populate content
  populateLesson(week, subtopic, wi, ti);

  // Complete button state
  const btn = document.getElementById('markCompleteBtn');
  const btnText = document.getElementById('markCompleteBtnText');
  if (isDone) {
    btn.classList.add('completed');
    btnText.textContent = '✓ Completed';
  } else {
    btn.classList.remove('completed');
    btnText.textContent = '✓ Mark as Complete';
  }

  // Confidence buttons
  document.querySelectorAll('.conf-btn').forEach((b, i) => {
    b.classList.toggle('selected', i + 1 === selectedConfidence);
  });

  // Review reminder
  const reviewReminder = document.getElementById('reviewReminder');
  if (isDone) {
    reviewReminder.style.display = 'flex';
    const days = getNextReviewDays(key);
    document.getElementById('reviewDays').textContent = days;
  } else {
    reviewReminder.style.display = 'none';
  }

  // Next button
  const hasNext = getNextTopic(wi, ti) !== null;
  document.getElementById('nextLessonBtn').style.display = hasNext ? 'flex' : 'none';

  renderSidebar();
  // Scroll to top of lesson
  document.getElementById('learnMain').scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── POPULATE LESSON CONTENT ───────────────────────────
function populateLesson(week, subtopic, wi, ti) {
  const resources = window.getResources ? window.getResources(courseCode) : {};
  const weekResources = window.getWeekResources?.(courseCode, wi) || {};
  const weekEntry = window.UNIFY_COURSE_CONTENT?.[courseCode]?.weeks?.[wi];

  // ── SIDEBAR: course outline link ──
  const outlineUrl = weekResources.outline || resources['Course Outline'] || '';
  const outlineEl = document.getElementById('courseOutlineLink');
  if (outlineEl) {
    if (outlineUrl) { outlineEl.href = outlineUrl; outlineEl.classList.remove('unavailable'); }
    else { outlineEl.href = '#'; outlineEl.classList.add('unavailable'); }
  }

  // ── NOTES CARD ──────────────────────────────────────────────────────────
  const fsContent = firestoreContentByWeek[week.week] || null;
  const notesUrl = weekResources.notes || '';
  const weekSummary = weekEntry?.summary || '';
  const subtopics = week.subtopics || [];

  // Title and meta
  document.getElementById('notesCardTitle').textContent = week.topic;
  document.getElementById('notesCardMeta').textContent =
    courseCode + ' · Week ' + week.week + ' · ' + subtopic;

  // Description
  document.getElementById('notesCardDesc').textContent =
    (fsContent && fsContent.title) ||
    weekSummary ||
    'Peer-reviewed notes for this week — written by students who sat through this course, reviewed by the departmental coordinator.';

  // Tags
  document.getElementById('notesCardTags').innerHTML = subtopics
    .map(s => `<span class="notes-tag">${sanitise(s)}</span>`).join('');

  // Action
  const actionEl = document.getElementById('notesCardAction');
  if (fsContent && fsContent.htmlContent) {
    actionEl.innerHTML = `
      <button type="button" class="notes-read-btn" onclick="openNotes(${week.week})">
        <div class="notes-read-btn-left">
          <span class="notes-read-btn-icon">📖</span>
          <div>
            <div class="notes-read-btn-text">View full notes</div>
            <div class="notes-read-btn-sub">Week ${week.week} — uploaded by your coordinator</div>
          </div>
        </div>
        <span class="notes-read-btn-arrow">↗</span>
      </button>`;
  } else if (notesUrl) {
    actionEl.innerHTML = `
      <a href="${sanitise(notesUrl)}" target="_blank" class="notes-read-btn">
        <div class="notes-read-btn-left">
          <span class="notes-read-btn-icon">📖</span>
          <div>
            <div class="notes-read-btn-text">Read full notes</div>
            <div class="notes-read-btn-sub">Week ${week.week} — formulas, diagrams, past questions</div>
          </div>
        </div>
        <span class="notes-read-btn-arrow">↗</span>
      </a>`;
  } else {
    actionEl.innerHTML = `
      <div class="notes-unavailable">
        <span style="font-size:20px;opacity:.4;">📄</span>
        <div>
          <div style="font-weight:600;margin-bottom:2px;">Notes not uploaded yet</div>
          <div style="font-size:12px;">Check back soon — coordinator is reviewing.</div>
        </div>
      </div>`;
  }

  // ── VIDEO ──────────────────────────────────────────────────────────────
  const videoUrl =
    (fsContent && fsContent.youtubeUrl) ||
    weekResources.video ||
    resources['Video Courses'] ||
    '';
  const videoEl = document.getElementById('videoContent');
  if (videoUrl && (videoUrl.includes('youtube') || videoUrl.includes('youtu.be'))) {
    const m = videoUrl.match(/(?:youtube[.]com[/]watch[?]v=|youtu[.]be[/])([a-zA-Z0-9_-]{11})/);
    if (m) {
      videoEl.innerHTML = `<iframe src="https://www.youtube.com/embed/${m[1]}" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`;
    }
  } else {
    videoEl.innerHTML = `<div class="video-placeholder-inner"><div class="vp-icon">▶</div><div class="vp-text">No video linked yet for this topic.</div></div>`;
  }
}


// ── FULL LESSON RENDERER ─────────────────────────────────────────────────────
function renderFullLesson(weekEntry, wi) {
  if (!weekEntry) return '';

  const tags = weekEntry.subtopics || [];
  const tagsHtml = tags.length
    ? `<div class="fl-tags">${tags.map(t => `<span class="fl-tag">${sanitise(t)}</span>`).join('')}</div>`
    : '';

  const topicsHtml = weekEntry.topicData
    ? weekEntry.topicData.map((topic, i) => renderTopicBlock(topic, wi, i)).join('')
    : renderWeekOverview(weekEntry, wi);

  return `<div class="fl-content">${tagsHtml}${topicsHtml}</div>`;
}

function renderWeekOverview(weekEntry, wi) {
  const subtopics = weekEntry.subtopics || [];

  const subtopicList = subtopics.map((sub, i) => {
    const hasContent = weekEntry.content?.[sub]?.hasContent;
    const fileUrl = weekEntry.content?.[sub]?.htmlFile || '';
    return `
      <div class="fl-topic">
        <div class="fl-topic-header" onclick="toggleFLTopic(this)">
          <div>
            <div class="fl-topic-num">Topic ${wi + 1}.${i + 1}</div>
            <div class="fl-topic-title">${sanitise(sub)}</div>
          </div>
          <span class="fl-topic-chevron">▾</span>
        </div>
        <div class="fl-topic-body">
          ${hasContent && fileUrl
            ? `<p>This topic has a full peer-reviewed breakdown available.
               <a href="${sanitise(fileUrl)}" target="_blank"
                 style="color:var(--green);font-weight:600;text-decoration:none;">
                 Open full lesson ↗</a></p>`
            : `<p style="color:var(--text3);">Full peer-reviewed content coming soon — written by students
               who sat through this course and reviewed by the departmental coordinator.</p>`
          }
        </div>
      </div>`;
  }).join('');

  return subtopicList || '<p style="color:var(--text3);font-size:14px;">Content coming soon.</p>';
}

function renderTopicBlock(topic, wi, ti) {
  let html = `
    <div class="fl-topic">
      <div class="fl-topic-header" onclick="toggleFLTopic(this)">
        <div>
          <div class="fl-topic-num">Topic ${wi + 1}.${ti + 1}</div>
          <div class="fl-topic-title">${sanitise(topic.title || '')}</div>
        </div>
        <span class="fl-topic-chevron">▾</span>
      </div>
      <div class="fl-topic-body">`;

  if (topic.body) html += `<p>${sanitise(topic.body)}</p>`;
  if (topic.body2) html += `<p>${sanitise(topic.body2)}</p>`;

  if (topic.formulas) {
    topic.formulas.forEach(f => {
      html += `<div class="fl-formula">
        <div class="fl-formula-label">${sanitise(f.label || '')}</div>
        ${(f.eqs || []).map(eq => `<div class="fl-formula-eq">${sanitise(eq)}</div>`).join('')}
        ${f.vars ? `<div class="fl-formula-vars">${sanitise(f.vars)}</div>` : ''}
        ${(f.steps || []).map(s => `<div class="fl-step"><div class="fl-step-label">${sanitise(s.label)}</div><p>${sanitise(s.text)}</p></div>`).join('')}
      </div>`;
    });
  }

  if (topic.analogy) {
    html += `<div class="fl-analogy">
      <div class="fl-analogy-label">Nigerian Analogy</div>
      ${sanitise(topic.analogy)}
    </div>`;
  }

  if (topic.mistake) {
    html += `<div class="fl-mistake">
      <div class="fl-mistake-label">Common Mistake</div>
      ${sanitise(topic.mistake)}
    </div>`;
  }

  if (topic.examDef) {
    html += `<div class="fl-examdef">
      <div class="fl-examdef-label">${sanitise(topic.examDef.label || 'Exam-Ready Definition')}</div>
      <div class="fl-examdef-text">${sanitise(topic.examDef.text)}</div>
    </div>`;
  }

  html += `</div></div>`;
  return html;
}

window.toggleFullLesson = function() {
  const body = document.getElementById('flBody');
  const btn = document.getElementById('flExpandBtn');
  const text = document.getElementById('flExpandText');
  const icon = document.getElementById('flExpandIcon');
  const isOpen = body.classList.contains('open');

  body.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  text.textContent = isOpen ? 'Expand lesson' : 'Collapse';
  icon.textContent = isOpen ? '▾' : '▴';

  if (!isOpen) {
    document.getElementById('sectionFullLesson').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.toggleFLTopic = function(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('.fl-topic-chevron');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  header.classList.toggle('open', !isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function generatePastQuestions(topic, code, wi) {
  const qs = [
    { year: '2022/23', text: `[Past exam question on ${topic} from ${code} — add via courseContent.js]` },
    { year: '2019/20', text: `[Past exam question on ${topic} — ${code} LASU examination — add via courseContent.js]` },
  ];
  return qs.map(q => `
    <div class="question-card">
      <span class="question-type-badge q-exam">📄 Past Exam ${q.year}</span>
      <div class="question-text">${q.text}</div>
      <button class="show-solution-btn" onclick="toggleSolution(this)">Reveal Solution</button>
      <div class="solution-box">Solution will be added here.</div>
    </div>`).join('');
}

function generatePracticeQuestions(topic, code) {
  const qs = [
    `Apply the key concept from ${topic}. Show full working.`,
    `A scenario related to ${topic} is described below. Determine the solution step by step.`,
    `Without referring to your notes, write down the key formula(s) for ${topic} and explain each term.`,
  ];
  return qs.map((q, i) => `
    <div class="practice-card">
      <span class="practice-badge">Practice ${i + 1}</span>
      <div class="question-text" style="margin-bottom:0;">${q}</div>
      <div class="question-math" style="margin-top:10px;">[Problem to be inserted by coordinator]</div>
      <button class="reveal-btn" onclick="toggleReveal(this)">Reveal Answer</button>
      <div class="reveal-answer">Answer will be added here.</div>
    </div>`).join('');
}

// ── INTERACTIONS ──────────────────────────────────────
window.toggleExample = function(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
  header.querySelector('span:last-child').textContent = body.classList.contains('open') ? '▲' : '▼';
}

window.toggleSolution = function(btn) {
  const box = btn.nextElementSibling;
  box.classList.toggle('open');
  btn.textContent = box.classList.contains('open') ? 'Hide Solution' : 'Reveal Solution';
}

window.toggleReveal = function(btn) {
  const box = btn.nextElementSibling;
  box.classList.toggle('open');
  btn.textContent = box.classList.contains('open') ? 'Hide Answer' : 'Reveal Answer';
  if (box.classList.contains('open')) {
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
  } else {
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

window.setConfidence = function(val) {
  selectedConfidence = val;
  document.querySelectorAll('.conf-btn').forEach((b, i) => {
    b.classList.toggle('selected', i + 1 === val);
  });
  const key = topicKey(activeWeekIdx, activeTopicIdx);
  if (!topicProgress[key]) topicProgress[key] = {};
  topicProgress[key].confidence = val;
  saveProgress();
}

window.markComplete = function() {
  const key = topicKey(activeWeekIdx, activeTopicIdx);
  const alreadyDone = topicProgress[key]?.done;

  if (!topicProgress[key]) topicProgress[key] = {};
  topicProgress[key].done = !alreadyDone;

  if (!alreadyDone) {
    topicProgress[key].completedAt = Date.now();
    topicProgress[key].confidence = selectedConfidence;
    topicProgress[key].reviewDates = getReviewSchedule();

    const btn = document.getElementById('markCompleteBtn');
    btn.className = 'sticky-complete-btn completed';
    document.getElementById('markCompleteBtnText').textContent = '✓ Completed';
    document.getElementById('lessonStatusBadge').textContent = '✓ Completed';
    document.getElementById('reviewReminder').style.display = 'flex';
    document.getElementById('reviewDays').textContent = 2;

    showToast('🎉 Topic complete! Review in 2 days.');

    const totalTopics = courseTopics.reduce((a, w) => a + w.subtopics.length, 0);
    const doneCount = Object.values(topicProgress).filter(t => t.done).length;
    if (doneCount >= totalTopics) {
      setTimeout(() => {
        document.getElementById('lessonView').style.display = 'none';
        document.getElementById('courseCompletePage').classList.add('show');
        populateCourseSummary();
      }, 1500);
    }
  } else {
    topicProgress[key].done = false;
    const btn = document.getElementById('markCompleteBtn');
    btn.className = 'sticky-complete-btn';
    document.getElementById('markCompleteBtnText').textContent = '✓ Mark Complete';
    document.getElementById('lessonStatusBadge').textContent = 'In Progress';
    document.getElementById('reviewReminder').style.display = 'none';
  }

  saveProgress();
  renderSidebar();
}

window.goToNext = function() {
  const next = getNextTopic(activeWeekIdx, activeTopicIdx);
  if (next) openTopic(next.w, next.t);
}

function getNextTopic(wi, ti) {
  const week = courseTopics[wi];
  if (ti + 1 < week.subtopics.length) return { w: wi, t: ti + 1 };
  if (wi + 1 < courseTopics.length) return { w: wi + 1, t: 0 };
  return null;
}

function getReviewSchedule() {
  const now = Date.now();
  return [
    now + 2 * 86400000,
    now + 5 * 86400000,
    now + 12 * 86400000,
  ];
}

function getNextReviewDays(key) {
  const dates = topicProgress[key]?.reviewDates || [];
  const now = Date.now();
  const next = dates.find(d => d > now);
  if (!next) return 12;
  return Math.max(1, Math.round((next - now) / 86400000));
}


// ── COURSE COMPLETE SUMMARY ───────────────────────────
function populateCourseSummary() {
  const totalTopics = courseTopics.reduce((a, w) => a + w.subtopics.length, 0);
  const allProgress = Object.values(topicProgress);
  const doneTopics = allProgress.filter(t => t.done);
  const ratedTopics = doneTopics.filter(t => t.confidence > 0);
  const avgConf = ratedTopics.length
    ? (ratedTopics.reduce((a, t) => a + t.confidence, 0) / ratedTopics.length).toFixed(1)
    : '–';
  const strongCount = ratedTopics.filter(t => t.confidence >= 4).length;

  document.getElementById('ccStatDone').textContent = doneTopics.length;
  document.getElementById('ccStatWeeks').textContent = courseTopics.length;
  document.getElementById('ccStatConf').textContent = avgConf + (avgConf !== '–' ? '/5' : '');
  document.getElementById('ccStatStrong').textContent = strongCount;
  document.getElementById('ccTitle').textContent = courseName + ' — Complete!';

  const weekGrid = document.getElementById('ccWeekGrid');
  weekGrid.innerHTML = courseTopics.map((week, wi) => {
    const keys = week.subtopics.map((_, ti) => topicKey(wi, ti));
    const done = keys.filter(k => topicProgress[k]?.done).length;
    const total = week.subtopics.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const confs = keys.map(k => topicProgress[k]?.confidence || 0).filter(c => c > 0);
    const avgW = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

    const dots = Array.from({length: 5}, (_, i) => {
      const filled = i < Math.round(avgW);
      const cls = filled ? (avgW >= 4 ? 'filled high' : 'filled') : '';
      return `<div class="cc-conf-dot ${cls}"></div>`;
    }).join('');

    return `<div class="cc-week-row">
      <span class="cc-week-num">Week ${wi + 1}</span>
      <span class="cc-week-name">${week.title}</span>
      <span class="cc-week-topics">${done}/${total}</span>
      <div class="cc-week-bar-wrap">
        <div class="cc-week-bar-track"><div class="cc-week-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="cc-week-conf">${dots}</div>
    </div>`;
  }).join('');

  const confCounts = [0, 0, 0, 0, 0];
  doneTopics.forEach(t => { if (t.confidence >= 1 && t.confidence <= 5) confCounts[t.confidence - 1]++; });
  const maxCount = Math.max(...confCounts, 1);
  const barColors = ['#ef4444','#fbbf24','#60a5fa','#4ade80','#22c55e'];
  const confChart = document.getElementById('ccConfChart');
  confChart.innerHTML = confCounts.map((count, i) => {
    const pct = Math.round((count / maxCount) * 100);
    return `<div class="cc-conf-bar-wrap">
      <div class="cc-conf-bar-count">${count || ''}</div>
      <div class="cc-conf-bar" style="height:${Math.max(pct, count > 0 ? 8 : 3)}%;background:${barColors[i]};opacity:${count > 0 ? 1 : 0.15};"></div>
      <div class="cc-conf-bar-label">${i + 1}★</div>
    </div>`;
  }).join('');

  const hint = avgConf >= 4 ? '🔥 Strong mastery overall — well done!'
    : avgConf >= 3 ? '🙂 Good grasp of the material. Review low-confidence topics before exams.'
    : avgConf !== '–' ? '📚 Some topics need more work. Use the review list below.'
    : 'Rate topics as you review them to see your confidence score.';
  document.getElementById('ccConfHint').textContent = hint;

  const weakTopics = [];
  courseTopics.forEach((week, wi) => {
    week.subtopics.forEach((sub, ti) => {
      const k = topicKey(wi, ti);
      if (topicProgress[k]?.done && (topicProgress[k]?.confidence || 0) <= 2) {
        weakTopics.push({ week: wi + 1, name: sub });
      }
    });
  });
  if (weakTopics.length > 0) {
    document.getElementById('ccReviewSection').style.display = 'block';
    document.getElementById('ccReviewList').innerHTML = weakTopics.map(t =>
      `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;background:var(--surface);">
        <span style="color:var(--text3);font-size:10px;">Wk${t.week}</span> ${t.name}
      </span>`
    ).join('');
  }
}

window.exportCourseSummary = function() {
  const totalTopics = courseTopics.reduce((a, w) => a + w.subtopics.length, 0);
  const doneTopics = Object.values(topicProgress).filter(t => t.done);
  const ratedTopics = doneTopics.filter(t => t.confidence > 0);
  const avgConf = ratedTopics.length
    ? (ratedTopics.reduce((a, t) => a + t.confidence, 0) / ratedTopics.length).toFixed(1) : 'N/A';

  let text = `UNIFY — COURSE SUMMARY\n`;
  text += `Course: ${courseName} (${courseCode})\n`;
  text += `Date: ${new Date().toLocaleDateString('en-GB', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}\n`;
  text += `${'─'.repeat(50)}\n\n`;
  text += `OVERVIEW\n`;
  text += `Topics completed: ${doneTopics.length} / ${totalTopics}\n`;
  text += `Weeks covered: ${courseTopics.length}\n`;
  text += `Average confidence: ${avgConf}/5\n`;
  text += `Strong topics (4-5★): ${ratedTopics.filter(t => t.confidence >= 4).length}\n\n`;

  text += `WEEK-BY-WEEK BREAKDOWN\n${'─'.repeat(50)}\n`;
  courseTopics.forEach((week, wi) => {
    const keys = week.subtopics.map((_, ti) => topicKey(wi, ti));
    const done = keys.filter(k => topicProgress[k]?.done).length;
    const confs = keys.map(k => topicProgress[k]?.confidence || 0).filter(c => c > 0);
    const avgW = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(1) : 'N/A';
    text += `\nWeek ${wi + 1}: ${week.title}\n`;
    text += `  Progress: ${done}/${week.subtopics.length} topics | Avg confidence: ${avgW}\n`;
    week.subtopics.forEach((sub, ti) => {
      const k = topicKey(wi, ti);
      const p = topicProgress[k];
      const status = p?.done ? `✓ (${p.confidence || 0}★)` : '○';
      text += `  ${status} ${sub}\n`;
    });
  });

  text += `\n${'─'.repeat(50)}\n`;
  text += `Generated by Unify — unify.netlify.app\n`;

  const blob = new Blob([text], {type: 'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${courseCode}-summary-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  showToast('📄 Summary exported!');
}

window.reviewWeakTopics = function() {
  for (let wi = 0; wi < courseTopics.length; wi++) {
    for (let ti = 0; ti < courseTopics[wi].subtopics.length; ti++) {
      const k = topicKey(wi, ti);
      if (topicProgress[k]?.done && (topicProgress[k]?.confidence || 0) <= 2) {
        document.getElementById('courseCompletePage').classList.remove('show');
        document.getElementById('lessonView').style.display = '';
        openTopic(wi, ti);
        showToast('📌 Reviewing weak topic — ' + courseTopics[wi].subtopics[ti]);
        return;
      }
    }
  }
  showToast('No weak topics found — you\'re solid! 🔥');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── FIRESTORE NOTES MODAL ─────────────────────────────────────────────
function wrapIfSnippet(html) {
  const trimmed = String(html || '').trim();
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"><\/script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous" onload="renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}]})"><\/script>
    <style>
      body { font-family: 'DM Sans', system-ui, sans-serif; line-height: 1.7; color: #0a0a0a; padding: 28px 24px; max-width: 860px; margin: 0 auto; word-wrap: break-word; overflow-wrap: break-word; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
      @media (max-width:600px){ body { padding: 20px 14px; } }
      h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; line-height: 1.2; margin-top: 1.4em; }
      pre, code { font-family: ui-monospace, Menlo, monospace; }
      pre { background: #f5f4f0; padding: 14px; border-radius: 8px; overflow-x: auto; }
    </style>
  </head><body>${trimmed}</body></html>`;
}

window.openNotes = function (weekNum) {
  const item = firestoreContentByWeek[Number(weekNum)];
  if (!item) return;
  window.open(`notes.html?id=${encodeURIComponent(item.id)}`, '_blank', 'noopener,noreferrer');
};
