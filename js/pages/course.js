/**
 * Unify — Dynamic course page
 *
 * Renders a course based on ?code=<COURSE CODE>. Reads from Firestore
 * `courses/{code}` first; falls back to hard-coded data so existing
 * courses (e.g. ECE 301) still render until they're migrated.
 */

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  query,
  where,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  resolveCourse,
  getHardcodedWeeks,
  normalizeCode,
} from '../courses-service.js';

// ── AUTH GATE ────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'Auth.html';
    return;
  }
  init();
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const rawCode = params.get('code') || params.get('course') || '';
  const code = normalizeCode(rawCode);
  const loading = document.getElementById('loadingScreen');
  const main = document.getElementById('mainContent');

  if (!code) {
    showNotFound('No course code in URL.');
    loading.style.display = 'none';
    main.style.display = 'block';
    return;
  }

  const { course, source } = await resolveCourse(code);

  if (!course) {
    showNotFound(
      `We couldn't find a course matching "${code}". Ask an admin to add it from the Admin panel.`,
    );
    loading.style.display = 'none';
    main.style.display = 'block';
    return;
  }

  renderHero(course, source);
  renderAbout(course);
  renderWeeks(code, source);
  renderActions(code, course, source);

  loading.style.display = 'none';
  main.style.display = 'block';

  // Load Firestore-uploaded content after page is visible (non-blocking)
  renderFirestoreContent(code);
}

function renderHero(course, source) {
  document.getElementById('courseCode').textContent = course.code;
  document.getElementById('courseTitle').textContent =
    course.title || 'Untitled course';

  const metaParts = [
    course.department,
    course.level,
    course.semester,
    course.units ? `${course.units} units` : null,
  ].filter(Boolean);
  document.getElementById('courseMeta').textContent = metaParts.join(' · ');

  const tag = document.getElementById('courseSourceTag');
  if (source === 'hardcoded') {
    tag.textContent = 'Legacy course — not yet migrated';
    tag.classList.add('tag-legacy');
  } else if (source === 'firestore') {
    tag.textContent = '';
  }
}

function renderAbout(course) {
  if (!course.description) return;
  document.getElementById('aboutSection').style.display = 'block';
  document.getElementById('aboutBody').textContent = course.description;
}

function renderWeeks(code, source) {
  const wrap = document.getElementById('weeksWrap');
  const weeks = getHardcodedWeeks(code);

  if (!weeks || !weeks.length) {
    if (source === 'firestore') {
      document.getElementById('weeksEmptySub').textContent =
        'Faculty will upload weekly topics and materials soon. They will appear here automatically.';
    }
    return;
  }

  // Hard-coded weeks — render same shape Learn.html / dashboard accordion uses.
  let topicProgress = {};
  try {
    const stored = localStorage.getItem('unify-topic-' + code);
    if (stored) topicProgress = JSON.parse(stored);
  } catch (e) {}

  wrap.innerHTML =
    `<div class="weeks">` +
    weeks
      .map((week, wi) => {
        const subtopics = week.subtopics || [];
        const enc = encodeURIComponent(code);
        const topicsHtml = subtopics
          .map((t, ti) => {
            const key = `w${wi}_t${ti}`;
            const done = topicProgress[key]?.done;
            return `<a class="topic" href="learn.html?course=${enc}&name=${enc}&week=${wi}&topic=${ti}">
            <span class="topic-check ${done ? 'done' : ''}">✓</span>
            <span class="topic-text">${escapeHtml(t)}</span>
          </a>`;
          })
          .join('');
        const time = week.time ? ` · ${escapeHtml(week.time)}` : '';
        return `<div class="week">
        <div class="week-head" onclick="this.parentElement.classList.toggle('open')">
          <span class="week-num">Wk ${wi + 1}</span>
          <span class="week-title">${escapeHtml(week.topic || 'Untitled')}${time}</span>
          <span class="week-chev">▾</span>
        </div>
        <div class="week-body">${topicsHtml}</div>
      </div>`;
      })
      .join('') +
    `</div>`;
}

function renderActions(code, course, source) {
  const wrap = document.getElementById('courseActions');
  const enc = encodeURIComponent(code);
  const actions = [];

  // For hard-coded courses we keep the legacy Learn.html link so nothing breaks.
  if (source === 'hardcoded' || getHardcodedWeeks(code)) {
    actions.push(
      `<a class="course-action" href="learn.html?course=${enc}&name=${enc}">
        <div class="course-action-title">Open in legacy Learn page</div>
        <div class="course-action-sub">The original study experience for this course</div>
      </a>`,
    );
  }

  actions.push(
    `<a class="course-action" href="dashboard.html">
      <div class="course-action-title">Add to my dashboard</div>
      <div class="course-action-sub">Track this course alongside your CGPA</div>
    </a>`,
  );

  wrap.innerHTML = actions.join('');
}

function showNotFound(message) {
  document.querySelector('.course-page').style.display = 'none';
  const nf = document.getElementById('notFound');
  document.getElementById('nfSub').textContent = message;
  nf.style.display = 'block';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── FIRESTORE COURSE CONTENT ─────────────────────────────

function getYoutubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') || u.pathname.replace('/embed/', '').split('?')[0];
    }
  } catch (e) {}
  return null;
}

function renderContentCard(item) {
  const ytId = getYoutubeId(item.youtubeUrl);
  const thumbHtml = ytId
    ? `<a class="fc-thumb" href="${escapeHtml(item.youtubeUrl)}" target="_blank" rel="noopener noreferrer">
        <img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" alt="Watch Week ${item.week} video" loading="lazy" />
        <div class="fc-play">▶</div>
      </a>`
    : '';

  // Safely encode content for the onclick attribute
  const safeId = escapeHtml(item.id);
  const safeTitle = escapeHtml(item.title);

  const videoBtn = ytId
    ? `<a class="fc-btn fc-btn-video" href="${escapeHtml(item.youtubeUrl)}" target="_blank" rel="noopener noreferrer">Watch Video</a>`
    : '';

  return `<div class="fc-week-card">
    <div class="fc-week-label">Week ${item.week}</div>
    <div class="fc-week-title">${safeTitle}</div>
    ${thumbHtml}
    <div class="fc-actions">
      <button class="fc-btn fc-btn-notes" onclick="openNotes('${safeId}')">View Notes</button>
      ${videoBtn}
    </div>
  </div>`;
}

// Store content keyed by doc ID for modal lookup
const _contentStore = {};

async function renderFirestoreContent(code) {
  const wrap = document.getElementById('weeksWrap');
  if (!wrap) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'courseContent'), where('courseCode', '==', code))
    );

    if (snap.empty) return;

    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.week - b.week);

    // Cache for modal lookup
    docs.forEach(d => { _contentStore[d.id] = d; });

    wrap.innerHTML = `<div class="fc-weeks">${docs.map(renderContentCard).join('')}</div>`;
  } catch (e) {
    console.warn('[course] Firestore content load failed:', e);
  }
}

// Detects whether the stored content is a full HTML document or just a snippet.
// Full pages render perfectly; snippets get wrapped so basic typography still works.
function wrapIfSnippet(html) {
  const trimmed = String(html || '').trim();
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: 'DM Sans', system-ui, sans-serif; line-height: 1.7; color: #0a0a0a; padding: 28px; max-width: 760px; margin: 0 auto; }
      h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; line-height: 1.2; margin-top: 1.4em; }
      pre, code { font-family: ui-monospace, Menlo, monospace; }
      pre { background: #f5f4f0; padding: 14px; border-radius: 8px; overflow-x: auto; }
    </style>
  </head><body>${trimmed}</body></html>`;
}

window.openNotes = function (id) {
  const item = _contentStore[id];
  if (!item) return;
  document.getElementById('notesModalTitle').textContent = `Week ${item.week} — ${item.title}`;
  const iframe = document.getElementById('notesModalFrame');
  iframe.srcdoc = wrapIfSnippet(item.htmlContent);

  document.getElementById('notesOverlay').classList.add('open');
};

window.closeNotesModal = function () {
  document.getElementById('notesOverlay').classList.remove('open');
  const iframe = document.getElementById('notesModalFrame');
  if (iframe) iframe.srcdoc = '';
};

window.handleNotesOverlayClick = function (e) {
  if (e.target === document.getElementById('notesOverlay')) closeNotesModal();
};
