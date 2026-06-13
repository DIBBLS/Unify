/**
 * unify-analytics.js
 * Drop-in Firebase Analytics tracker for all Unify Learn pages.
 *
 * HOW TO USE:
 * Add this ONE line at the bottom of every Unify HTML file,
 * just before the closing </body> tag:
 *
 *   <script type="module" src="/unify-analytics.js"></script>
 *
 * That's it. Everything below runs automatically.
 *
 * REQUIREMENTS:
 * - Your firebaseConfig object must include measurementId: "G-XXXXXXXX"
 * - Firebase App must already be initialized on the page before this script runs
 *   (this script uses getApp() to grab the existing instance — no double-init)
 */

import {
  getAnalytics,
  logEvent,
  setCurrentScreen,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// ─── INIT ──────────────────────────────────────────────────────────────────
let analytics;
try {
  analytics = getAnalytics(getApp());
} catch (err) {
  // If analytics fails (e.g. measurementId missing), fail silently
  console.warn("[Unify Analytics] Could not initialize:", err.message);
}

if (!analytics) {
  // Stop here — no point running event listeners
  throw new Error("[Unify Analytics] Skipping — analytics not available.");
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

/**
 * Get the course name from the page.
 * Tries the <title> tag first, falls back to pathname.
 */
function getCourseName() {
  return document.title?.trim() || window.location.pathname;
}

/**
 * Get current week number if the page shows one.
 * Looks for a visible "Week X" or "W X" pattern anywhere on the page.
 */
function getActiveWeek() {
  // Check URL first (e.g. /ece351-w3.html)
  const urlWeek = window.location.pathname.match(/w(\d+)/i);
  if (urlWeek) return `Week ${urlWeek[1]}`;

  // Check any active/selected tab with "week" in its text
  const activeTab = document.querySelector(
    ".week-tab.active, .tab.active, [data-week][aria-selected='true']"
  );
  if (activeTab) {
    const weekMatch = activeTab.textContent.match(/w(?:eek)?\s*(\d+)/i);
    if (weekMatch) return `Week ${weekMatch[1]}`;
  }

  return null;
}

// ─── 1. PAGE VIEW ──────────────────────────────────────────────────────────
// Fires once when the page loads. Tells Analytics which page was opened.

setCurrentScreen(analytics, getCourseName());
logEvent(analytics, "page_view", {
  page_title: getCourseName(),
  page_path: window.location.pathname,
  week: getActiveWeek(),
});

// ─── 2. TOPIC / WEEK TAB CLICKS ────────────────────────────────────────────
// Fires when a student clicks a topic tab or week selector.
// Looks for elements with data-week, data-topic, or common tab class names.

document.addEventListener("click", (e) => {
  if (!analytics) return;

  // Match week tabs (data-week="3" or class="week-tab")
  const weekTab = e.target.closest("[data-week], .week-tab, .week-btn");
  if (weekTab) {
    const weekNum =
      weekTab.dataset.week ||
      weekTab.textContent.match(/\d+/)?.[0] ||
      "unknown";
    logEvent(analytics, "week_selected", {
      course: getCourseName(),
      week: `Week ${weekNum}`,
    });
  }

  // Match topic tabs (data-topic="BJT Biasing" or class="topic-tab")
  const topicTab = e.target.closest("[data-topic], .topic-tab, .topic-btn");
  if (topicTab) {
    const topicName =
      topicTab.dataset.topic ||
      topicTab.textContent.trim().slice(0, 60);
    logEvent(analytics, "content_view", {
      course: getCourseName(),
      week: getActiveWeek(),
      topic: topicName,
    });
  }
});

// ─── 3. QUIZ INTERACTIONS ──────────────────────────────────────────────────
// Fires when a student submits the end-of-week quiz or a mini-check.

document.addEventListener("click", (e) => {
  if (!analytics) return;

  // End-of-week quiz submit
  const quizSubmit = e.target.closest(
    "#submitQuiz, .quiz-submit, [data-action='submit-quiz'], .submit-quiz"
  );
  if (quizSubmit) {
    logEvent(analytics, "quiz_submitted", {
      course: getCourseName(),
      week: getActiveWeek(),
    });
  }

  // Mini-checks (MCQ option selected or Reveal button clicked)
  const miniCheck = e.target.closest(
    ".mini-check .option, .mcq-option, .reveal-btn, [data-check]"
  );
  if (miniCheck) {
    logEvent(analytics, "mini_check_interaction", {
      course: getCourseName(),
      week: getActiveWeek(),
      type: miniCheck.dataset.check || miniCheck.className || "unknown",
    });
  }
});

// ─── 4. QUIZ PASS / FAIL ───────────────────────────────────────────────────
// If your quiz JS sets a result on the DOM, this picks it up.
// It watches for a result element appearing with "pass" or "fail" text/class.

const quizObserver = new MutationObserver((mutations) => {
  if (!analytics) return;

  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue; // skip text nodes

      const resultEl = node.matches?.(
        ".quiz-result, #quizResult, .result-banner, [data-result]"
      )
        ? node
        : node.querySelector?.(
            ".quiz-result, #quizResult, .result-banner, [data-result]"
          );

      if (resultEl) {
        const text = (resultEl.textContent || "").toLowerCase();
        const passed =
          resultEl.dataset.result === "pass" ||
          text.includes("pass") ||
          text.includes("congratulations") ||
          text.includes("well done");

        logEvent(analytics, "quiz_result", {
          course: getCourseName(),
          week: getActiveWeek(),
          result: passed ? "pass" : "fail",
        });
      }
    }
  }
});

quizObserver.observe(document.body, { childList: true, subtree: true });

// ─── 5. SCROLL DEPTH ───────────────────────────────────────────────────────
// Fires once each when user reaches 25%, 50%, 75%, 100% of the page.
// Good for knowing if students are actually reading the content.

const scrollMilestones = new Set();
window.addEventListener("scroll", () => {
  if (!analytics) return;

  const scrolled =
    window.scrollY + window.innerHeight;
  const total = document.documentElement.scrollHeight;
  const pct = Math.round((scrolled / total) * 100);

  [25, 50, 75, 100].forEach((milestone) => {
    if (pct >= milestone && !scrollMilestones.has(milestone)) {
      scrollMilestones.add(milestone);
      logEvent(analytics, "scroll_depth", {
        course: getCourseName(),
        week: getActiveWeek(),
        depth_percent: milestone,
      });
    }
  });
}, { passive: true });

// ─── 6. SESSION DURATION ───────────────────────────────────────────────────
// Fires when the student leaves the page (tab close, navigate away).
// Records roughly how long they spent on the content.

const sessionStart = Date.now();
window.addEventListener("beforeunload", () => {
  if (!analytics) return;

  const seconds = Math.round((Date.now() - sessionStart) / 1000);
  logEvent(analytics, "session_end", {
    course: getCourseName(),
    week: getActiveWeek(),
    duration_seconds: seconds,
  });
});

console.log("[Unify Analytics] Tracking active on:", getCourseName());
