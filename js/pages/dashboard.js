import { auth, db } from "../firebase-config.js";
import { listCourses } from "../courses-service.js";

// ── 300 Level auto-enrol map (mirrors Onboarding.js) ────────────────────────
const _S300 = ['CHE 352','MEE 352','ECE 316','ECE 352','GNS 312','ENT 312'];
const COURSES_300L = {
  'Electronic & Computer Engineering':  [..._S300,'ECE 302','ECE 308','ECE 310','ECE 312','ECE 314','ECE 320','ECE 350'],
  'Mechanical Engineering':             [..._S300,'MEE 354'],
  'Industrial & Petroleum Engineering': [..._S300,'IPE 316'],
  'Aerospace Engineering':              [..._S300,'ASE 363','ASE 366'],
  'Civil Engineering':                  _S300.filter(c=>c!=='CHE 352').concat(['CVE 304','CVE 308','CVE 310']),
  'Chemical & Polymer Engineering':     _S300.filter(c=>c!=='CHE 352'&&c!=='ECE 316').concat(['CHE 312','CHE 314']),
};
function normaliseCourses(raw) {
  // Convert plain strings → objects; filter out anything completely unparseable
  return (raw || []).map(c => {
    if (c && typeof c === 'object' && c.course) return c;
    if (typeof c === 'string' && c.trim()) return { course: c.trim().toUpperCase(), grade: '-', units: 3 };
    return null;
  }).filter(Boolean);
}

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null,
  saveTimeout = null,
  activeCourseId = null;
let userProfile = {},
  aspirations = [];
let weekProgress = {};
let savedGoalPlan = null; // module-scope so the inline save can update it

// ── DEBUG ─────────────────────────────────────────────
// Temporary visible debug panel for Step 1 (course discovery).
// Remove once dynamic courses are confirmed working.
const DEBUG_COURSES = false;
let debugLogs = [];
function dbg(msg, data) {
  const line = data !== undefined ? `${msg} ${JSON.stringify(data)}` : msg;
  console.log("[unify-debug]", line);
  if (DEBUG_COURSES) {
    debugLogs.push(line);
    renderDebugPanel();
  }
}
function renderDebugPanel() {
  if (!DEBUG_COURSES) return;
  let panel = document.getElementById("__unifyDebug");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "__unifyDebug";
    panel.style.cssText =
      "position:fixed;bottom:8px;left:8px;right:8px;max-height:40vh;overflow:auto;" +
      "background:rgba(0,0,0,0.92);color:#0f0;font:11px/1.4 ui-monospace,Menlo,monospace;" +
      "padding:10px 12px;border-radius:8px;z-index:99999;white-space:pre-wrap;" +
      "box-shadow:0 4px 12px rgba(0,0,0,0.4);";
    const close = document.createElement("button");
    close.textContent = "× close debug";
    close.style.cssText =
      "position:absolute;top:6px;right:8px;background:#f00;color:#fff;border:none;" +
      "padding:2px 8px;border-radius:4px;font:11px ui-monospace;cursor:pointer;";
    close.onclick = () => panel.remove();
    panel.appendChild(close);
    const body = document.createElement("div");
    body.id = "__unifyDebugBody";
    body.style.marginTop = "18px";
    panel.appendChild(body);
    document.body.appendChild(panel);
  }
  const body = document.getElementById("__unifyDebugBody");
  if (body) body.textContent = debugLogs.join("\n");
}
function normaliseField(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ");
}
function eq(a, b) {
  return normaliseField(a) === normaliseField(b);
}
// Self-test: if this commit is loaded, the line below will appear in the
// debug panel as "BUILD: dept normalise OK". If it is missing or shows FAIL,
// the browser is still serving the previous dashboard.js from cache.
(function () {
  const probe =
    normaliseField("Electronic & Computer Engineering") ===
    normaliseField("Electronic and Computer Engineering");
  setTimeout(() => {
    dbg("BUILD: dept normalise " + (probe ? "OK" : "FAIL"));
  }, 0);
})();

// ── SECURITY ──────────────────────────────────────────
function sanitise(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/[/]/g, "&#x2F;");
}

const rateLimits = {};
function rateLimit(key, max = 5, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimits[key]) rateLimits[key] = [];
  rateLimits[key] = rateLimits[key].filter((t) => now - t < windowMs);
  if (rateLimits[key].length >= max) return false;
  rateLimits[key].push(now);
  return true;
}

// ── AUTH ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "Auth.html";
    return;
  }
  currentUser = user;
  dbg("auth: signed in as", { uid: user.uid, email: user.email });

  let first = "Builder";
  if (user.displayName && user.displayName.trim()) {
    first = user.displayName.trim().split(/\s+/)[0];
  } else if (user.email) {
    const raw = user.email
      .split("@")[0]
      .replace(/[._\-0-9]/g, " ")
      .trim();
    const words = raw.split(/\s+/).filter(Boolean);
    first =
      words.length > 1
        ? words[0]
        : raw.charAt(0).toUpperCase() + raw.slice(1, 9);
  }

  const hr = new Date().getHours();
  const greet =
    hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("heroName").innerHTML =
    `${greet},<br><em id="heroFirstName">${first}.</em>`;
  document.getElementById("navUserName").textContent = first;

  await loadUserData();
  initStreak();
  subscribeNotifications();
  document.getElementById("loadingOverlay").style.display = "none";
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && window.courses?.length)
    displayCourses();
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "Auth.html";
});

// ── LOAD DATA ─────────────────────────────────────────
async function loadUserData() {
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (!snap.exists() || !snap.data().university) {
      window.location.href = "Onboarding.html";
      return;
    }
    const d = snap.data();
    savedGoalPlan = d.gradePlanner || null;

    // Backfill email so admins can grant access by email (legacy docs lack it)
    const authEmail = (currentUser.email || '').toLowerCase();
    if (authEmail && (d.email || '').toLowerCase() !== authEmail) {
      try {
        await setDoc(doc(db, "users", currentUser.uid), { email: authEmail }, { merge: true });
        d.email = authEmail;
      } catch (e) { /* non-fatal */ }
    }

    // Show Admin Console link for non-student roles
    const userRole = d.role || (d.isAdmin ? 'super_admin' : 'student');
    if (userRole !== 'student') {
      const adminLink = document.getElementById('adminNavLink');
      if (adminLink) adminLink.style.display = 'flex';
    }

    userProfile = {
      university: d.university,
      faculty: d.faculty,
      department: d.department,
      level: d.level,
    };
    dbg("profile:", userProfile);
    const semSel = document.getElementById("semester");
    dbg("dashboard semester selector value:", semSel ? semSel.value : "(no element)");

    if (!d.firstName) {
      const nudge = document.getElementById("nameNudge");
      if (nudge) nudge.style.display = "flex";
    }
    if (d.firstName) {
      const first = d.firstName;
      const hr = new Date().getHours();
      const greet =
        hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
      document.getElementById("heroName").innerHTML =
        `${greet},<br><em id="heroFirstName">${first}.</em>`;
      document.getElementById("navUserName").textContent = first;
    }

    // Normalise courses — convert legacy plain strings to objects
    window.courses = normaliseCourses(d.courses);
    aspirations = d.aspirations || [];
    weekProgress = d.weekProgress || {};

    document.getElementById("heroTag").textContent =
      `${d.university} · ${d.level}`;
    document.getElementById("heroDept").textContent = d.department;

    // Show persisted CGPA immediately from Firestore (before courses render)
    if (typeof d.cgpa === "number" && d.cgpa > 0) {
      document.getElementById("statCGPA").textContent = d.cgpa.toFixed(2);
    }
    applyStatsMask();

    if (window.courses.length === 0) {
      // Try 300L mapping first (covers old users who signed up before auto-enrol)
      const mapped = d.level === '300 Level' ? COURSES_300L[d.department] || [] : [];
      if (mapped.length) {
        window.courses = mapped.map(code => ({ course: code, grade: '-', units: 3 }));
        if (currentUser) {
          setDoc(doc(db, 'users', currentUser.uid), { courses: window.courses }, { merge: true }).catch(() => {});
        }
      } else {
        await autoLoadCourses(d.department, d.level);
      }
    }

    renderAspirations();
  } catch (e) {
    console.error("loadUserData error:", e);
    window.courses = [];
  }

  renderGoalCard(savedGoalPlan);
  displayCourses();
  updateStats();
  renderPlanner();

  // Eagerly probe Firestore so the debug panel reports immediately
  // on first paint, without requiring the student to click "+ Add".
  loadCoursePickerList();
}

function renderGoalCard(gp) {
  const card = document.getElementById("goalCard");
  const wrap = card?.parentElement; // .goal-card-wrap
  if (!card) return;

  // Plan exists → the hero stats (Target / Sem GP / CGPA) already show
  // this info, so we hide the entire card to avoid duplication. Predictor
  // is reachable by clicking the Target stat.
  if (gp && gp.target) {
    card.innerHTML = '';
    if (wrap) wrap.style.display = 'none';
    return;
  }

  // Plan missing → show inline chip picker as a one-time nudge
  if (wrap) wrap.style.display = '';
  const chipForm = `
    <div class="goal-chip-form" id="goalChipForm">
      <div class="goal-setup-chips">
        <button class="goal-chip" data-val="4.50" data-cls="first" onclick="selectGoalChip(this)">First Class <span>≥ 4.50</span></button>
        <button class="goal-chip" data-val="3.50" data-cls="upper" onclick="selectGoalChip(this)">2nd Upper <span>≥ 3.50</span></button>
        <button class="goal-chip" data-val="2.40" data-cls="lower" onclick="selectGoalChip(this)">2nd Lower <span>≥ 2.40</span></button>
        <button class="goal-chip" data-val="1.50" data-cls="pass" onclick="selectGoalChip(this)">Pass <span>≥ 1.50</span></button>
      </div>
      <div class="goal-setup-actions">
        <button class="goal-save-btn" id="goalSaveBtn" onclick="saveGoalTarget()" disabled>Save target →</button>
        <a href="predictor.html" class="goal-setup-link">Full planner ↗</a>
      </div>
    </div>`;
  card.innerHTML = `
    <div class="goal-card-setup">
      <div class="goal-card-setup-title">Set your graduation target</div>
      <div class="goal-card-setup-sub">Pick a class — we'll track whether you're on pace.</div>
      ${chipForm}
    </div>`;
}

let _pendingGoalVal = null, _pendingGoalCls = null;

window.selectGoalChip = function(btn) {
  document.querySelectorAll('.goal-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  _pendingGoalVal = parseFloat(btn.dataset.val);
  _pendingGoalCls = btn.dataset.cls;
  const saveBtn = document.getElementById('goalSaveBtn');
  if (saveBtn) saveBtn.disabled = false;
};

window.saveGoalTarget = async function() {
  if (!_pendingGoalVal || !currentUser) return;
  const btn = document.getElementById('goalSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const update = {
      target: _pendingGoalVal,
      targetClass: _pendingGoalCls,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', currentUser.uid), { gradePlanner: update }, { merge: true });
    savedGoalPlan = { ...(savedGoalPlan || {}), ...update };
    renderGoalCard(savedGoalPlan);
    updateStats();
    const t = document.getElementById('milestoneToast');
    if (t) { t.textContent = 'Target saved!'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
  } catch(e) {
    console.error('saveGoalTarget:', e);
    const t = document.getElementById('milestoneToast');
    if (t) { t.textContent = 'Save failed — try again'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
    if (btn) { btn.disabled = false; btn.textContent = 'Save target →'; }
  }
};

window.clearGoalTarget = function() {
  _pendingGoalVal = null; _pendingGoalCls = null;
  renderGoalCard(null);
};

// ── STATS HIDE/SHOW (bank-style eye toggle) ──────────────
let _statsHidden = localStorage.getItem('unify-stats-hidden') === '1';

function applyStatsMask() {
  const ids = ['statTarget', 'statSemGP', 'statCGPA', 'statCourses'];
  const eyeBtn = document.getElementById('statsEyeBtn');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (_statsHidden) {
      if (!el.dataset.real) el.dataset.real = el.textContent;
      el.textContent = '••••';
    } else {
      if (el.dataset.real) { el.textContent = el.dataset.real; delete el.dataset.real; }
    }
  });
  if (eyeBtn) eyeBtn.textContent = _statsHidden ? '👁' : '🙈';
}

window.toggleStatsVisibility = function() {
  _statsHidden = !_statsHidden;
  localStorage.setItem('unify-stats-hidden', _statsHidden ? '1' : '0');
  applyStatsMask();
};

async function autoLoadCourses(dept, level) {
  const semEl = document.getElementById("semester");
  const sem = semEl ? semEl.value : "First Semester";
  dbg("autoLoadCourses called with", { dept, level, sem });

  const courseMap = {};

  // Hardcoded fallback
  const hardcodedList =
    window.coursesDatabase?.["Faculty of Engineering"]?.[dept]?.[level]?.[sem] || [];
  dbg("hardcoded match count:", hardcodedList.length);
  hardcodedList.filter(Boolean).forEach((c) => {
    const code = String(c).trim().toUpperCase();
    courseMap[code] = { course: code, grade: "-", units: 3 };
  });

  // Firestore courses — merge in (Firestore units win)
  try {
    const all = await listCourses();
    dbg("Firestore listCourses returned:", all.length + " docs");
    all.forEach((c, i) => {
      const code = String(c.code || "").trim().toUpperCase();
      const matchDept = !c.department || eq(c.department, dept);
      const matchLevel = !c.level || eq(c.level, level);
      const matchSem = !c.semester || eq(c.semester, sem);
      const included = !!code && matchDept && matchLevel && matchSem;
      dbg(`  [auto] #${i} ${c.code} →`, {
        faculty: c.faculty || "(blank)",
        department: c.department || "(blank)",
        level: c.level || "(blank)",
        semester: c.semester || "(blank)",
        matchDept, matchLevel, matchSem,
        included,
      });
      if (included) {
        courseMap[code] = {
          course: code,
          grade: courseMap[code]?.grade || "-",
          units: c.units || courseMap[code]?.units || 3,
        };
      }
    });
  } catch (e) {
    dbg("Firestore listCourses ERROR:", e?.message || String(e));
    console.warn("[dashboard] Could not load Firestore courses:", e);
  }

  dbg("autoLoadCourses final list:", Object.keys(courseMap));
  if (!Object.keys(courseMap).length) {
    return;
  }

  window.courses = Object.values(courseMap);
  if (currentUser) {
    setDoc(
      doc(db, "users", currentUser.uid),
      { courses: window.courses },
      { merge: true },
    ).catch(() => {});
  }
  showMilestone("Courses loaded.");
}

// ── SAVE ──────────────────────────────────────────────
async function _doSave() {
  if (!currentUser) return;
  try {
    let pts = 0, units = 0;
    window.courses.forEach((c) => {
      const p = gradeToPoint(c.grade);
      if (p !== null && c.units) {
        pts += p * Number(c.units);
        units += Number(c.units);
      }
    });
    const cgpa = units > 0 ? parseFloat((pts / units).toFixed(2)) : 0;
    await setDoc(
      doc(db, "users", currentUser.uid),
      { courses: window.courses, aspirations, weekProgress, cgpa },
      { merge: true },
    );
    const ind = document.getElementById("saveIndicator");
    if (ind) { ind.classList.add("visible"); setTimeout(() => ind.classList.remove("visible"), 2000); }
  } catch (e) {
    console.error(e);
  }
}

// immediate=true → skip debounce (used for add/remove so navigating away doesn't lose data)
window.saveUserData = function (immediate = false) {
  if (!currentUser) return;
  clearTimeout(saveTimeout);
  if (immediate) { _doSave(); }
  else { saveTimeout = setTimeout(_doSave, 600); }
};

// ── STATS ─────────────────────────────────────────────
window.updateStats = function () {
  const count = window.courses.length;
  const graded = window.courses.filter(
    (c) => c.grade && c.grade !== "-",
  ).length;
  document.getElementById("coursesCount").textContent =
    count + " course" + (count !== 1 ? "s" : "");
  document.getElementById("statCourses").textContent = count;
  document.getElementById("emptyState").style.display =
    count === 0 ? "block" : "none";

  // Sem GP = the required average GP per semester to reach the target (from plan).
  // Falls back to the calculated GP from current courses when no plan exists.
  let pts = 0, units = 0;
  window.courses.forEach((c) => {
    const p = gradeToPoint(c.grade);
    if (p !== null && c.units) {
      pts += p * Number(c.units);
      units += Number(c.units);
    }
  });
  const calcGP = units > 0 ? pts / units : null;
  const semGP = (savedGoalPlan?.neededAvg != null)
    ? Math.min(5, Math.max(0, parseFloat(savedGoalPlan.neededAvg)))
    : calcGP;

  document.getElementById("statSemGP").textContent =
    semGP !== null ? Number(semGP).toFixed(2) : "—";

  // Cumulative CGPA: prefer predictor-entered value, fall back to calc
  const cumCGPA = (savedGoalPlan?.cgpa != null && savedGoalPlan.cgpa > 0)
    ? savedGoalPlan.cgpa : calcGP;
  document.getElementById("statCGPA").textContent =
    cumCGPA !== null ? Number(cumCGPA).toFixed(2) : "—";

  // Target CGPA from saved plan
  const t = savedGoalPlan?.target;
  const targetEl = document.getElementById("statTarget");
  if (targetEl) targetEl.textContent = t != null ? Number(t).toFixed(2) : "—";

  // Apply hidden mask if active
  applyStatsMask();

};

function gradeToPoint(g) {
  return { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }[g?.toUpperCase()] ?? null;
}

// ── COURSE GRID ───────────────────────────────────────
window.displayCourses = function () {
  const ul = document.getElementById("courses");
  ul.innerHTML = "";
  window.courses.forEach((c, idx) => {
    const isActive = activeCourseId === idx;
    const li = document.createElement("li");
    li.className = "course-item" + (isActive ? " active-card" : "");
    const parts = c.course.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)\s*(.*)$/);
    const code = parts ? parts[1] : c.course;
    const name = parts && parts[2] ? parts[2] : "";
    const grade = c.grade && c.grade !== "-" ? c.grade.toUpperCase() : null;
    const weeks = weekProgress[c.course] || [];
    const weekPct = Math.round((weeks.length / 12) * 100);

    let progressPct = weekPct;
    let progressColor = "var(--text)";
    try {
      const stored = localStorage.getItem("unify-topic-" + c.course);
      if (stored) {
        const tp = JSON.parse(stored);
        const curriculum = generateWeekStructure(code);
        const total = curriculum.reduce((a, w) => a + w.subtopics.length, 0);
        const done = Object.values(tp).filter((t) => t.done).length;
        if (total > 0) {
          progressPct = Math.round((done / total) * 100);
          progressColor =
            progressPct >= 70
              ? "var(--green)"
              : progressPct >= 30
                ? "var(--yellow)"
                : "var(--text)";
        }
      }
    } catch (e) {}

    li.innerHTML = `
      <div class="course-card-inner">
        <button class="course-rm-btn" title="Not my course — remove" onclick="removeCourse(event,${idx})">×</button>
        <div class="course-accent accent-${idx % 6}"></div>
        <div class="course-card-code">${code}</div>
        ${name ? `<div class="course-card-name">${name}</div>` : ""}
        <div class="course-progress-wrap">
          <div class="course-progress-track">
            <div class="course-progress-fill" style="width:${progressPct}%;background:${progressColor};"></div>
          </div>
          <span class="course-progress-pct">${progressPct}%</span>
        </div>
        <div class="course-card-footer">
          <div class="course-card-grade ${grade ? "grade-" + grade : "grade-none"}">${grade || "—"}</div>
          <div class="course-card-units">${c.units} units</div>
        </div>
        <div class="course-card-tap">${isActive ? "✕ close" : "tap for resources"}</div>
      </div>`;

    // ── FIX: inline grade editing — tap the grade badge to change it ──
    // This lets students update their grade directly from the card and persists immediately.
    const gradeEl = li.querySelector(".course-card-grade");
    gradeEl.title = "Tap to set grade";
    gradeEl.style.cursor = "pointer";
    gradeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      showGradePicker(idx, li, gradeEl);
    });

    li.addEventListener("click", () => {
      if (activeCourseId === idx) {
        closeResourcePanel();
      } else {
        activeCourseId = idx;
        openResourcePanel(c.course);
        displayCourses();
      }
    });
    ul.appendChild(li);

    let pressTimer;
    li.addEventListener(
      "touchstart",
      () => {
        pressTimer = setTimeout(() => showRemoveConfirm(idx), 500);
      },
      { passive: true },
    );
    li.addEventListener("touchend", () => clearTimeout(pressTimer), {
      passive: true,
    });
    li.addEventListener("touchmove", () => clearTimeout(pressTimer), {
      passive: true,
    });
  });
  updateStats();
};

// ── INLINE GRADE PICKER ───────────────────────────────
// Tapping a grade badge on the card opens a small picker and saves immediately.
function showGradePicker(idx, cardEl, gradeEl) {
  // Remove any existing picker
  document.querySelectorAll(".grade-picker-popup").forEach((el) => el.remove());

  const grades = ["A", "B", "C", "D", "E", "F", "-"];
  const popup = document.createElement("div");
  popup.className = "grade-picker-popup";
  popup.style.cssText = `
    position:absolute;
    z-index:200;
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:10px;
    padding:8px;
    display:flex;
    gap:6px;
    flex-wrap:wrap;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);
    max-width:200px;
  `;

  grades.forEach((g) => {
    const btn = document.createElement("button");
    btn.textContent = g === "-" ? "—" : g;
    const current = window.courses[idx]?.grade?.toUpperCase();
    const isActive = (g === "-" && current === "-") || g === current;
    btn.style.cssText = `
      width:36px;height:36px;
      border-radius:8px;
      border:1.5px solid ${isActive ? "var(--green)" : "var(--border)"};
      background:${isActive ? "var(--green-bg)" : "var(--bg)"};
      color:var(--text);
      font-family:var(--font-display);
      font-size:15px;
      font-weight:700;
      cursor:pointer;
    `;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.courses[idx].grade = g;
      popup.remove();
      saveUserData();
      displayCourses();
      updateStats();
      const label = g === "-" ? "—" : `Grade: ${g}`;
      showMilestone(`${window.courses[idx]?.course} → ${label}`);
    });
    popup.appendChild(btn);
  });

  // Position popup near the grade badge
  cardEl.style.position = "relative";
  cardEl.querySelector(".course-card-inner").appendChild(popup);

  // Close on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener("click", close);
      }
    };
    document.addEventListener("click", close);
  }, 0);
}

// ── RESOURCE PANEL ────────────────────────────────────
window.closeResourcePanel = function () {
  document.getElementById("resourcePanel")?.classList.remove("open");
  activeCourseId = null;
  document
    .querySelectorAll(".course-item")
    .forEach((el) => el.classList.remove("active-card"));
};

window.openResourcePanel = function (courseName) {
  const parts = courseName.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)\s*(.*)$/);
  const code = parts ? parts[1] : courseName;
  const name = parts && parts[2] ? parts[2] : courseName;

  document.getElementById("resourcePanelTitle").textContent =
    code + (name && name !== code ? " — " + name : "");
  document.getElementById("resourcePanelMeta").textContent =
    (userProfile.level || "") +
    (userProfile.department ? " · " + userProfile.department : "");
  document.getElementById("resourcePanel").classList.add("open");

  const enc = encodeURIComponent(courseName);
  const encCode = encodeURIComponent(code);
  document.getElementById("learnPageBtn").href =
    "learn.html?course=" + enc + "&name=" + enc;

  buildWeekAccordion(courseName, code);
};

async function buildWeekAccordion(courseName, code) {
  const accordion = document.getElementById("weekAccordion");
  accordion.innerHTML = `<div style="padding:16px; color:var(--text3); font-size:13px;">Loading weeks…</div>`;

  let topicProgress = {};
  try {
    const stored = localStorage.getItem("unify-topic-" + courseName);
    if (stored) topicProgress = JSON.parse(stored);
  } catch (e) {}

  // Fetch weeks from Firestore courseContent collection
  // Sort client-side to avoid needing a composite index on courseCode+week
  let weeks = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "courseContent"),
        where("courseCode", "==", code),
      ),
    );
    weeks = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
  } catch (e) {
    console.warn("[dashboard] buildWeekAccordion Firestore error:", e);
  }

  if (weeks.length === 0) {
    accordion.innerHTML = `<div style="padding:16px; color:var(--text3); font-size:13px;">No content uploaded yet for this course.</div>`;
    return;
  }

  const enc = encodeURIComponent(courseName);
  accordion.innerHTML = weeks
    .map((week, wi) => {
      const weekNum = week.week ?? wi + 1;
      const title = week.title || `Week ${weekNum}`;
      const key = `w${wi}_t0`;
      const p = topicProgress[key];
      const done = p?.done;
      const conf = p?.confidence || 0;
      const stars = conf > 0 ? "★".repeat(conf) : "";
      const isFirst = wi === 0;

      const topicRow = `<a class="topic-row" href="learn.html?course=${enc}&name=${enc}">
        <div class="topic-check ${done ? "done" : ""}">✓</div>
        <span class="topic-name">${title}</span>
        ${stars ? `<span class="topic-conf">${stars}</span>` : ""}
      </a>`;

      return `<div class="week-acc-item">
      <div class="week-acc-header ${isFirst ? "open" : ""}" onclick="toggleWeekAcc(this)">
        <span class="week-acc-num">Wk ${weekNum}</span>
        <span class="week-acc-title">${title}</span>
        <span class="week-acc-done">${done ? "1" : "0"}/1</span>
        <span class="week-acc-check">▼</span>
      </div>
      <div class="week-acc-body ${isFirst ? "open" : ""}">${topicRow}</div>
    </div>`;
    })
    .join("");
}

window.toggleWeekAcc = function (header) {
  const body = header.nextElementSibling;
  const isOpen = header.classList.contains("open");
  header.classList.toggle("open", !isOpen);
  body.classList.toggle("open", !isOpen);
};

// ── COURSE ACTIONS ────────────────────────────────────
window.switchSemester = async function () {
  const sem = document.getElementById("semester").value;
  dbg("switchSemester to", sem);

  const existing = {};
  (window.courses || []).forEach((c) => {
    existing[c.course] = { grade: c.grade, units: c.units };
  });

  const courseMap = {};

  const hardcodedList =
    window.coursesDatabase?.["Faculty of Engineering"]?.[
      userProfile.department
    ]?.[userProfile.level]?.[sem] || [];
  dbg("switchSemester hardcoded count:", hardcodedList.length);
  hardcodedList.filter(Boolean).forEach((c) => {
    const code = String(c).trim().toUpperCase();
    courseMap[code] = {
      course: code,
      grade: existing[code]?.grade || "-",
      units: existing[code]?.units || 3,
    };
  });

  try {
    const all = await listCourses();
    dbg("switchSemester Firestore docs:", all.length);
    all.forEach((c, i) => {
      const code = String(c.code || "").trim().toUpperCase();
      const matchDept =
        !c.department || eq(c.department, userProfile.department);
      const matchLevel = !c.level || eq(c.level, userProfile.level);
      const matchSem = !c.semester || eq(c.semester, sem);
      const included = !!code && matchDept && matchLevel && matchSem;
      dbg(`  [switch] #${i} ${c.code} →`, {
        department: c.department || "(blank)",
        level: c.level || "(blank)",
        semester: c.semester || "(blank)",
        matchDept, matchLevel, matchSem,
        included,
      });
      if (included && !courseMap[code]) {
        courseMap[code] = {
          course: code,
          grade: existing[code]?.grade || "-",
          units: existing[code]?.units || c.units || 3,
        };
      }
    });
  } catch (e) {
    dbg("switchSemester Firestore ERROR:", e?.message || String(e));
    console.warn("[dashboard] Could not load Firestore courses:", e);
  }

  if (!Object.keys(courseMap).length) {
    alert("No courses found for this semester.");
    return;
  }

  window.courses = Object.values(courseMap);
  activeCourseId = null;
  closeResourcePanel();
  displayCourses();
  saveUserData(true);
  renderPlanner();
};

window.addCourse = function () {
  const name = document.getElementById("courseInput").value.trim();
  const grade = document
    .getElementById("gradeInput")
    .value.toUpperCase()
    .trim();
  const units = parseInt(document.getElementById("unitsInput").value) || 3;
  if (!name) {
    alert("Please enter a course code.");
    return;
  }
  window.courses.push({ course: name, grade: grade || "-", units });
  displayCourses();
  saveUserData(true);
  ["courseInput", "gradeInput", "unitsInput"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  if (window.courses.length === 1) showMilestone("📚 First course added!");
};

window.clearCourses = async function () {
  if (!window.courses.length || !confirm("Reset courses for this semester?"))
    return;
  window.courses = [];
  activeCourseId = null;
  closeResourcePanel();
  await autoLoadCourses(userProfile.department, userProfile.level);
  displayCourses();
};

window.toggleAddCourse = function () {
  const row = document.getElementById("addCourseRow");
  row.classList.toggle("open");
  if (row.classList.contains("open")) {
    setTimeout(() => document.getElementById("addCourseCode").focus(), 50);
    loadCoursePickerList();
  }
};

window.addCourseInline = function () {
  const code = (document.getElementById("addCourseCode").value || "")
    .trim()
    .toUpperCase();
  const units = parseInt(document.getElementById("addCourseUnits").value) || 3;
  if (!code) return;
  window.courses.push({ course: code, grade: "-", units });
  displayCourses();
  saveUserData(true);
  document.getElementById("addCourseCode").value = "";
  document.getElementById("addCourseUnits").value = "";
  document.getElementById("addCourseRow").classList.remove("open");
  if (window.courses.length === 1) showMilestone("📚 First course added!");
  loadCoursePickerList();
};

async function loadCoursePickerList() {
  const container = document.getElementById("coursePickerList");
  if (!container) return;
  dbg("loadCoursePickerList opened. profile:", userProfile);

  try {
    const all = await listCourses();
    dbg("picker: Firestore returned", all.length + " docs");
    const added = new Set(
      (window.courses || []).map((c) =>
        String(c.course || c).trim().toUpperCase(),
      ),
    );

    const available = [];
    all.forEach((c, i) => {
      const code = String(c.code || "").trim().toUpperCase();
      const alreadyAdded = added.has(code);
      const matchDept =
        !c.department ||
        !userProfile.department ||
        eq(c.department, userProfile.department);
      const matchLevel =
        !c.level || !userProfile.level || eq(c.level, userProfile.level);
      const included = !!code && !alreadyAdded && matchDept && matchLevel;
      dbg(`  [picker] #${i} ${c.code} →`, {
        faculty: c.faculty || "(blank)",
        department: c.department || "(blank)",
        level: c.level || "(blank)",
        semester: c.semester || "(blank)",
        alreadyAdded, matchDept, matchLevel,
        included,
      });
      if (included) available.push(c);
    });

    dbg("picker: available count:", available.length);

    if (!available.length) {
      container.innerHTML =
        `<div class="picker-label">No additional Firestore courses for your class yet</div>`;
      return;
    }

    container.innerHTML =
      `<div class="picker-label">Available for your class</div>` +
      `<div class="picker-chips">` +
      available
        .map(
          (c) =>
            `<button class="picker-chip" onclick="addPickerCourse('${sanitise(c.code)}',${Number(c.units) || 3})">` +
            `<span class="picker-code">${sanitise(c.code)}</span>` +
            (c.title ? `<span class="picker-title">${sanitise(c.title)}</span>` : "") +
            `<span class="picker-add">+ Add</span>` +
            `</button>`,
        )
        .join("") +
      `</div>`;
  } catch (e) {
    dbg("picker ERROR:", e?.message || String(e));
    container.innerHTML =
      `<div class="picker-label" style="color:#f55">Error loading courses: ${sanitise(e?.message || String(e))}</div>`;
  }
}

window.addPickerCourse = function (code, units) {
  code = String(code).trim().toUpperCase();
  if (
    window.courses.some(
      (c) => String(c.course || c).trim().toUpperCase() === code,
    )
  ) {
    showMilestone(`${code} is already in your list.`);
    return;
  }
  window.courses.push({ course: code, grade: "-", units: units || 3 });
  displayCourses();
  saveUserData(true);
  loadCoursePickerList();
  if (window.courses.length === 1) showMilestone("📚 First course added!");
  else showMilestone(`${code} added.`);
};

window.removeCourse = function (event, idx) {
  event.stopPropagation();
  if (!window.courses.length) return;
  const name = window.courses[idx]?.course || "course";
  window.courses.splice(idx, 1);
  if (activeCourseId === idx) {
    activeCourseId = null;
    closeResourcePanel();
  } else if (activeCourseId > idx) activeCourseId--;
  displayCourses();
  saveUserData(true);
  showMilestone(`${name} removed from your list.`);
};

let _removeConfirmTimer = null;
window.showRemoveConfirm = function (idx) {
  const name = window.courses[idx]?.course || "course";
  const toast = document.getElementById("milestoneToast");
  const text = document.getElementById("milestoneText");
  clearTimeout(_removeConfirmTimer);
  text.innerHTML = `Remove <strong>${name}</strong>? <span style="text-decoration:underline;cursor:pointer" onclick="window.removeCourse({stopPropagation:()=>{}},${idx})">Yes, remove</span>`;
  toast.classList.add("show");
  _removeConfirmTimer = setTimeout(() => toast.classList.remove("show"), 4000);
};

// ── TOAST ─────────────────────────────────────────────
window.showMilestone = function (msg) {
  const t = document.getElementById("milestoneToast");
  document.getElementById("milestoneText").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
};

// ── STREAK + REVIEW SYSTEM ────────────────────────────
const REVIEW_QUESTIONS = [
  {
    topic: "Laplace Transform",
    course: "ECE 301",
    question: "What does the Laplace Transform do to a differential equation?",
    options: [
      "Makes it harder to solve",
      "Converts it into an algebraic equation",
      "Removes all variables",
      "Converts it to a graph",
    ],
    answer: 1,
    explanation:
      "Exactly right. Laplace acts like a translator — it turns the messy differential equation into a simpler algebraic one you can solve normally, then translate back.",
  },
  {
    topic: "Superposition Theorem",
    course: "ECE 301",
    question:
      "When using Superposition, what do you do with sources you are NOT currently analysing?",
    options: [
      "Leave them as they are",
      "Double their value",
      "Replace voltage sources with short circuits, current sources with open circuits",
      "Remove them from the circuit entirely",
    ],
    answer: 2,
    explanation:
      "Correct! You deactivate the other sources — voltage sources become wires (short circuit), current sources become gaps (open circuit). Then you analyse one source at a time.",
  },
  {
    topic: "Fourier Series",
    course: "ECE 301",
    question: "What kind of signal can be represented using a Fourier Series?",
    options: [
      "Any random signal",
      "Only DC signals",
      "Periodic signals",
      "Only sine waves",
    ],
    answer: 2,
    explanation:
      "Fourier Series works on periodic signals — signals that repeat. It breaks them down into a sum of simple sine and cosine waves.",
  },
  {
    topic: "Thevenin's Theorem",
    course: "ECE 301",
    question:
      "What does Thevenin's theorem let you replace a complex circuit with?",
    options: [
      "A single resistor",
      "A voltage source and series resistor",
      "A current source and parallel resistor",
      "An open circuit",
    ],
    answer: 1,
    explanation:
      "Right! Thevenin says any linear circuit can be simplified to just one voltage source (Vth) in series with one resistor (Rth). Makes analysis so much easier.",
  },
  {
    topic: "Network Analysis",
    course: "ECE 301",
    question: "In mesh analysis, what do you assign to each independent loop?",
    options: [
      "A node voltage",
      "A mesh current",
      "A power value",
      "A frequency",
    ],
    answer: 1,
    explanation:
      "Mesh analysis assigns a loop current (mesh current) to each independent loop. You then apply KVL around each mesh to build equations and solve.",
  },
];

let streakData = {
  count: 0,
  lastStudied: null,
  todayDone: false,
  weekDays: [],
};
let currentQuestion = null;
let reviewAnswered = false;

function initStreak() {
  const saved = localStorage.getItem("unify-streak");
  if (saved) streakData = JSON.parse(saved);

  const today = new Date().toDateString();
  streakData.todayDone = streakData.lastStudied === today;

  if (streakData.lastStudied) {
    const last = new Date(streakData.lastStudied);
    const now = new Date();
    const diffDays = Math.floor((now - last) / 86400000);
    if (diffDays > 1) {
      streakData.count = 0;
      streakData.weekDays = [];
      saveStreak();
    }
  }

  renderStreak();
}

function saveStreak() {
  localStorage.setItem("unify-streak", JSON.stringify(streakData));
}

function renderStreak() {
  const nudge = document.getElementById("streakNudge");
  if (!nudge) return; // streak card removed from dashboard
  const daysVal = document.getElementById("streakDaysVal");
  const message = document.getElementById("streakMessage");
  const sub = document.getElementById("streakSub");
  const btn = document.getElementById("streakActionBtn");
  const dots = document.getElementById("streakDots");
  const fire = document.getElementById("streakFire");

  daysVal.textContent = streakData.count;

  const week = streakData.weekDays || [];
  dots.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const cls = i < week.length ? "done" : i === week.length ? "active" : "";
    return '<div class="streak-dot ' + cls + '"></div>';
  }).join("");

  if (streakData.todayDone) {
    nudge.classList.add("completed");
    nudge.style.cursor = "default";
    fire.textContent = "✅";
    message.textContent = "Done for today!";
    sub.textContent =
      streakData.count > 0
        ? streakData.count +
          "-day streak. Come back tomorrow to keep it going. 💪"
        : "You studied today. Come back tomorrow!";
    btn.textContent = "See you tomorrow";
    btn.style.background = "#4ade80";
    btn.style.color = "#0a0a0a";
  } else {
    nudge.classList.remove("completed");
    fire.textContent =
      streakData.count >= 7 ? "🔥" : streakData.count >= 3 ? "⚡" : "💡";

    const hr = new Date().getHours();
    const greet =
      hr < 12
        ? "Morning check-in"
        : hr < 17
          ? "Afternoon nudge"
          : "Evening review";

    if (streakData.count === 0) {
      message.textContent = "Start your streak today 🚀";
      sub.textContent = "One question. 2 minutes. That's all it takes.";
    } else if (streakData.count === 1) {
      message.textContent = "Day 2 — keep it going!";
      sub.textContent = "You showed up yesterday. Show up today.";
    } else {
      message.textContent =
        greet + " — " + streakData.count + " days strong 🔥";
      sub.textContent = "Quick question from your last topic. 2 minutes max.";
    }
    btn.textContent = "Let's go →";
    btn.style.background = "";
    btn.style.color = "";
  }
}

window.openReview = function () {
  if (!document.getElementById("reviewModalOverlay")) return;
  if (streakData.todayDone) return;
  reviewAnswered = false;

  currentQuestion =
    REVIEW_QUESTIONS[Math.floor(Math.random() * REVIEW_QUESTIONS.length)];

  document.getElementById("reviewModalTopic").textContent =
    currentQuestion.topic;
  document.getElementById("reviewModalCourse").textContent =
    currentQuestion.course;
  document.getElementById("reviewQuestion").textContent =
    currentQuestion.question;
  document
    .getElementById("reviewResult")
    .classList.remove("show", "win", "lose");
  document.getElementById("reviewDoneBtn").textContent = "Done ✓";
  document.getElementById("reviewDoneBtn").disabled = false;

  const opts = document.getElementById("reviewOptions");
  opts.innerHTML = currentQuestion.options
    .map(
      (opt, i) =>
        '<button class="review-option" onclick="answerQuestion(' +
        i +
        ')">' +
        opt +
        "</button>",
    )
    .join("");

  document.getElementById("reviewModalOverlay").classList.add("open");
};

window.answerQuestion = function (idx) {
  if (reviewAnswered) return;
  reviewAnswered = true;

  const opts = document.querySelectorAll(".review-option");
  const correct = currentQuestion.answer;
  const isCorrect = idx === correct;

  opts.forEach((opt, i) => {
    if (i === correct) opt.classList.add("correct");
    else if (i === idx && !isCorrect) opt.classList.add("wrong");
    opt.style.pointerEvents = "none";
  });

  const result = document.getElementById("reviewResult");
  const title = document.getElementById("reviewResultTitle");
  const body = document.getElementById("reviewResultBody");

  result.classList.add("show");
  if (isCorrect) {
    result.classList.add("win");
    title.textContent = "🔥 Correct!";
    body.textContent = currentQuestion.explanation;
    document.getElementById("reviewDoneBtn").textContent = "Keep the streak! ✓";
  } else {
    result.classList.add("lose");
    title.textContent = "😅 Not quite — here's why:";
    body.textContent = currentQuestion.explanation;
    document.getElementById("reviewDoneBtn").textContent = "Got it ✓";
  }
};

window.finishReview = function () {
  const today = new Date().toDateString();
  if (streakData.lastStudied !== today) {
    streakData.count += 1;
    streakData.weekDays = [...(streakData.weekDays || []).slice(-6), today];
  }
  streakData.lastStudied = today;
  streakData.todayDone = true;
  saveStreak();
  renderStreak();
  closeReview();
  showMilestone("🔥 " + streakData.count + "-day streak! Keep going.");
};

window.closeReview = function () {
  const el = document.getElementById("reviewModalOverlay");
  if (el) el.classList.remove("open");
};

window.closeReviewOnOverlay = function (e) {
  const el = document.getElementById("reviewModalOverlay");
  if (el && e.target === el) closeReview();
};

// ── STUDY PLANNER ─────────────────────────────────────
var plannerPrefs = JSON.parse(localStorage.getItem("unify-planner") || "null");
var plannerDoneToday = JSON.parse(
  localStorage.getItem("unify-planner-done-" + new Date().toDateString()) ||
    "[]",
);

const TIME_SLOTS = {
  morning: [
    ["7:00 AM", "8:00 AM"],
    ["8:00 AM", "9:00 AM"],
    ["9:00 AM", "10:00 AM"],
  ],
  afternoon: [
    ["2:00 PM", "3:00 PM"],
    ["3:00 PM", "4:00 PM"],
    ["4:00 PM", "5:00 PM"],
  ],
  night: [
    ["8:00 PM", "9:00 PM"],
    ["9:00 PM", "10:00 PM"],
    ["10:00 PM", "11:00 PM"],
  ],
};

function renderPlanner() {
  const sessions = document.getElementById("plannerSessions");
  const empty = document.getElementById("plannerEmpty");
  if (!plannerPrefs || !window.courses?.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  const { duration, sessionsPerDay, timeOfDay } = plannerPrefs;
  const slots = TIME_SLOTS[timeOfDay] || TIME_SLOTS.afternoon;
  const count = Math.min(
    parseInt(sessionsPerDay),
    slots.length,
    window.courses.length,
  );

  const dayIndex = new Date().getDate();
  const rotated = [...window.courses].sort((a, b) => {
    const sa = typeof a === "string" ? a : a.course || "";
    const sb = typeof b === "string" ? b : b.course || "";
    return sa.localeCompare(sb);
  });
  const todayCourses = [];
  for (let i = 0; i < count; i++)
    todayCourses.push(rotated[(dayIndex + i) % rotated.length]);

  const durationLabel =
    duration >= 60
      ? Math.floor(duration / 60) +
        "h" +
        (duration % 60 ? (duration % 60) + "m" : "")
      : duration + " min";

  sessions.innerHTML = todayCourses
    .map((c, i) => {
      const slot = slots[i];
      const isDone = plannerDoneToday.includes(i);
      const courseStr =
        typeof c === "string" ? c : c.course || c.name || c.code || "Course";
      const parts = courseStr.split(" ");
      const codeDisplay = parts.slice(0, 2).join(" ");
      return `<div class="planner-session ${isDone ? "done" : ""}" onclick="togglePlannerSession(${i}, this)">
      <div class="planner-session-check">✅</div>
      <div class="planner-session-time">${slot[0]} – ${slot[1]}</div>
      <div class="planner-session-topic">${courseStr}</div>
      <div class="planner-session-course">${codeDisplay}</div>
      <span class="planner-session-duration">${durationLabel}</span>
    </div>`;
    })
    .join("");
}

window.togglePlannerSession = function (idx, el) {
  if (plannerDoneToday.includes(idx)) {
    plannerDoneToday = plannerDoneToday.filter((i) => i !== idx);
    el.classList.remove("done");
  } else {
    plannerDoneToday.push(idx);
    el.classList.add("done");
    const allCards = document.querySelectorAll(".planner-session");
    if (plannerDoneToday.length === allCards.length)
      showMilestone("📚 All sessions done today! Incredible.");
  }
  localStorage.setItem(
    "unify-planner-done-" + new Date().toDateString(),
    JSON.stringify(plannerDoneToday),
  );
};

window.openPlannerSetup = function () {
  const overlay = document.getElementById("plannerModalOverlay");
  overlay.classList.add("open");
  if (plannerPrefs) {
    selectChipByVal("duration", plannerPrefs.duration);
    selectChipByVal("sessions", plannerPrefs.sessionsPerDay);
    selectChipByVal("time", plannerPrefs.timeOfDay);
  }
};
window.closePlannerSetup = function () {
  document.getElementById("plannerModalOverlay").classList.remove("open");
};
window.selectChip = function (el, group) {
  document
    .querySelectorAll(`#${group}Chips .planner-chip`)
    .forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
};
function selectChipByVal(group, val) {
  document.querySelectorAll(`#${group}Chips .planner-chip`).forEach((c) => {
    c.classList.toggle("selected", c.dataset.val == val);
  });
}
window.savePlannerSetup = function () {
  const duration = parseInt(
    document.querySelector("#durationChips .planner-chip.selected")?.dataset
      .val || "60",
  );
  const sessionsPerDay = parseInt(
    document.querySelector("#sessionsChips .planner-chip.selected")?.dataset
      .val || "2",
  );
  const timeOfDay =
    document.querySelector("#timeChips .planner-chip.selected")?.dataset.val ||
    "afternoon";
  plannerPrefs = { duration, sessionsPerDay, timeOfDay };
  localStorage.setItem("unify-planner", JSON.stringify(plannerPrefs));
  closePlannerSetup();
  renderPlanner();
  showMilestone("📅 Study plan updated!");
};

// ── ASPIRATIONS ───────────────────────────────────────
window.addAspiration = function () {
  const input = document.getElementById("aspirationInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  aspirations.push(text);
  input.value = "";
  renderAspirations();
  saveUserData();
  showMilestone("🎯 Aspiration added — go build it!");
};

window.removeAspiration = function (idx) {
  aspirations.splice(idx, 1);
  renderAspirations();
  saveUserData();
};

function renderAspirations() {
  const list = document.getElementById("aspirationList");
  if (!list) return;
  list.innerHTML =
    aspirations.length === 0
      ? '<div style="font-size:13px;color:var(--text3);padding:8px 0;">No aspirations yet — add what you\'re working towards.</div>'
      : aspirations
          .map(
            (a, i) => `
        <div class="aspiration-item">
          <div class="aspiration-dot"></div>
          <div class="aspiration-text">${a}</div>
          <button class="aspiration-del" onclick="removeAspiration(${i})">×</button>
        </div>`,
          )
          .join("");
}

// ── NOTIFICATIONS ─────────────────────────────────────
let _unreadCount = 0;

function subscribeNotifications() {
  const q = query(collection(db, 'courseUpdates'), orderBy('postedAt', 'desc'));
  onSnapshot(q, snap => {
    const myCodes = (window.courses || []).map(c => (c.code || c.name || '').toUpperCase());
    const updates = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => {
        if (u.targetDepartment) {
          const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
          if (norm(userProfile.department) !== norm(u.targetDepartment)) return false;
          if (u.targetLevel && norm(userProfile.level) !== norm(u.targetLevel)) return false;
        }
        return u.kind === 'general' || !myCodes.length || myCodes.includes((u.courseCode || '').toUpperCase());
      });

    const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
    _unreadCount = updates.filter(u => !readIds.includes(u.id)).length;
    _updateBell(_unreadCount);
    _renderNotifDrawer(updates.slice(0, 30), readIds);
  });
}

function _updateBell(count) {
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

function _renderNotifDrawer(updates, readIds) {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!updates.length) {
    list.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><div class="notif-empty-text">No updates for your class yet.</div></div>`;
    return;
  }
  const chipClass = { confirmed: 'notif-chip-confirmed', postponed: 'notif-chip-postponed', cancelled: 'notif-chip-cancelled', venue_change: 'notif-chip-venue_change', general: 'notif-chip-general' };
  const chipLabel = { confirmed: 'Confirmed', postponed: 'Postponed', cancelled: 'Cancelled', venue_change: 'Venue Change', general: 'Announcement' };
  list.innerHTML = updates.map(u => {
    const isUnread = !readIds.includes(u.id);
    const ts = u.postedAt?.toDate?.();
    const timeStr = ts ? ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    const statusKey = u.kind === 'general' ? 'general' : u.status;
    const chip = `<span class="notif-chip ${chipClass[statusKey] || 'notif-chip-general'}">${chipLabel[statusKey] || statusKey}</span>`;
    const label = u.kind === 'general' ? (u.title || 'Announcement') : u.courseCode;
    const details = [u.lecturer ? `Lecturer: ${u.lecturer}` : null, u.venue ? `Venue: ${u.venue}` : null].filter(Boolean).join(' · ');
    return `<div class="notif-item ${isUnread ? 'unread' : ''}" onclick="markRead('${u.id}')">
      <div class="notif-item-top">
        <span class="notif-course-code">${label}</span>
        <div style="display:flex;align-items:center;gap:6px;">${chip}${isUnread ? '<div class="notif-unread-dot"></div>' : ''}</div>
      </div>
      ${u.message ? `<div class="notif-msg">${u.message}</div>` : ''}
      ${details ? `<div class="notif-detail">${details}</div>` : ''}
      <div class="notif-meta">Posted by ${u.postedBy || 'Admin'} · ${timeStr}</div>
    </div>`;
  }).join('');
}

window.markRead = function (id) {
  const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
  if (!readIds.includes(id)) readIds.push(id);
  localStorage.setItem('unify-read-notifs', JSON.stringify(readIds));
  _updateBell(Math.max(0, _unreadCount - 1));
  document.querySelector(`.notif-item[onclick="markRead('${id}')"]`)?.classList.remove('unread');
};

window.markAllRead = function () {
  const list = document.getElementById('notifList');
  const ids = Array.from(list?.querySelectorAll('.notif-item') || []).map(el => {
    const m = el.getAttribute('onclick')?.match(/markRead\('(.+?)'\)/);
    return m ? m[1] : null;
  }).filter(Boolean);
  const readIds = JSON.parse(localStorage.getItem('unify-read-notifs') || '[]');
  ids.forEach(id => { if (!readIds.includes(id)) readIds.push(id); });
  localStorage.setItem('unify-read-notifs', JSON.stringify(readIds));
  _updateBell(0);
  list?.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  list?.querySelectorAll('.notif-unread-dot').forEach(el => el.remove());
};

window.toggleNotifDrawer = function () {
  document.getElementById('notifDrawer')?.classList.toggle('open');
  document.getElementById('notifOverlay')?.classList.toggle('active');
};

window.closeNotifDrawer = function () {
  document.getElementById('notifDrawer')?.classList.remove('open');
  document.getElementById('notifOverlay')?.classList.remove('active');
};