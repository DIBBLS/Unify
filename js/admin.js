import { auth, db } from "./firebase-config.js";
import {
  listCourses,
  upsertCourse,
  deleteCourse as deleteCourseDoc,
  getCourse,
  normalizeCode,
} from "./courses-service.js";
import {
  getRole,
  canManageCourses,
  canPostUpdates,
  canManageTimetable,
  canGrantAccess,
  getAssignment,
  normField,
} from "./roles.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
  onSnapshot,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "olotuchjosh@gmail.com";
let me = null,
  myProfile = null,
  myRole = 'student';

// ── AUTH GATE ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  document.getElementById("loadingScreen").style.display = "none";

  if (!user) {
    window.location.href = "Auth.html";
    return;
  }
  me = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  myProfile = snap.exists() ? snap.data() : {};

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || myProfile.isAdmin === true;
  const isClassRep = myProfile.isCourseRep === true;

  // Bootstrap: ensure super-admin flag is set
  if (isSuperAdmin && !myProfile.isAdmin) {
    await setDoc(
      doc(db, "users", user.uid),
      { isAdmin: true, role: 'super_admin', email: user.email },
      { merge: true },
    );
    myProfile.isAdmin = true;
    myProfile.role = 'super_admin';
  }

  if (!isAdmin && !isClassRep) {
    document.getElementById("accessDenied").style.display = "block";
    return;
  }

  // Derive role
  if (isSuperAdmin) myRole = 'super_admin';
  else if (myProfile.role) myRole = myProfile.role;
  else if (isAdmin) myRole = 'academic_lead';
  else myRole = 'class_rep';

  const displayName = myProfile.name || user.email;
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("navUser").textContent = user.email;
  document.getElementById("postedAsLabel").textContent = displayName;
  document.getElementById("adminNameDisplay").textContent = displayName;

  // Show/hide sections by role
  const postSec = document.getElementById("postUpdateSection");
  const courseSec = document.getElementById("manageCoursesSection");
  const accessSec = document.getElementById("adminAccessSection");
  const recentSec = document.getElementById("recentUpdatesSection");
  const ttSec = document.getElementById("timetableSection");

  if (postSec && !canPostUpdates(myRole)) postSec.style.display = "none";
  if (courseSec && !canManageCourses(myRole)) courseSec.style.display = "none";
  if (accessSec && !canGrantAccess(myRole)) accessSec.style.display = "none";
  if (ttSec && !canManageTimetable(myRole)) ttSec.style.display = "none";

  initTheme();
  listenToUpdates();
  if (canGrantAccess(myRole)) loadAdmins();
  if (canManageCourses(myRole)) loadCourses();
  if (canManageTimetable(myRole)) initTimetableSection(myRole, myProfile);
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "Auth.html";
});

// ── POST UPDATE ───────────────────────────────────────────
window.postUpdate = async function () {
  const code = document.getElementById("upCode").value.trim().toUpperCase();
  const status = document.getElementById("upStatus").value;
  const lecturer = document.getElementById("upLecturer").value.trim();
  const venue = document.getElementById("upVenue").value.trim();
  const message = document.getElementById("upMessage").value.trim();

  if (!code) {
    showToast("Enter a course code first");
    return;
  }

  const btn = document.getElementById("postBtn");
  btn.disabled = true;
  btn.textContent = "Posting...";

  try {
    const ts = Date.now();
    const updateId = code.replace(/\s+/g, "_") + "_" + ts;
    const payload = {
      courseCode: code,
      status,
      lecturer: lecturer || null,
      venue: venue || null,
      message: message || null,
      postedBy: myProfile?.name || me.email,
      postedByEmail: me.email,
      postedAt: serverTimestamp(),
    };

    // class_rep: tag with assignment so notifications are filtered by class
    if (myRole === 'class_rep') {
      const a = getAssignment(myProfile);
      if (a.faculty) payload.targetFaculty = a.faculty;
      if (a.department) payload.targetDepartment = a.department;
      if (a.level) payload.targetLevel = a.level;
      if (a.semester) payload.targetSemester = a.semester;
    }

    // History log entry
    await setDoc(doc(db, "courseUpdates", updateId), payload);

    // Latest canonical state for this course (what students read live)
    await setDoc(doc(db, "courseStatus", code.replace(/\s+/g, "_")), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    ["upCode", "upLecturer", "upVenue", "upMessage"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    document.getElementById("upStatus").value = "confirmed";
    showToast("Update posted — students notified");
  } catch (e) {
    console.error(e);
    showToast("Error posting update");
  }
  btn.disabled = false;
  btn.textContent = "Post Update →";
};

// ── LIVE UPDATE LOG ───────────────────────────────────────
function listenToUpdates() {
  const q = query(collection(db, "courseUpdates"), orderBy("postedAt", "desc"));
  onSnapshot(q, (snap) => {
    const el = document.getElementById("updateLog");
    if (snap.empty) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No updates posted yet.</div></div>`;
      return;
    }
    const chips = {
      confirmed: "chip-confirmed",
      postponed: "chip-postponed",
      cancelled: "chip-cancelled",
      venue_change: "chip-venue_change",
    };
    const labels = {
      confirmed: "Confirmed",
      postponed: "Postponed",
      cancelled: "Cancelled",
      venue_change: "Venue Change",
    };

    el.innerHTML =
      `<div class="update-log">` +
      snap.docs
        .slice(0, 40)
        .map((d) => {
          const u = d.data();
          const ts = u.postedAt?.toDate();
          const timeStr = ts
            ? ts.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              }) +
              " · " +
              ts.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Just now";
          const chip = `<span class="chip ${chips[u.status] || "chip-venue_change"}">${labels[u.status] || u.status}</span>`;
          const details = [
            u.lecturer ? `Lecturer: <strong>${u.lecturer}</strong>` : null,
            u.venue ? `Venue: <strong>${u.venue}</strong>` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return `<div class="update-item">
        <div class="update-course-code">${u.courseCode}</div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${chip}${u.message ? `<span style="font-size:13px;color:var(--text2);">${u.message}</span>` : ""}</div>
          ${details ? `<div class="update-detail">${details}</div>` : ""}
          <div class="update-meta">Posted by ${u.postedBy} · ${timeStr}</div>
        </div>
        <button class="btn-icon" onclick="delUpdate('${d.id}')" title="Delete">✕</button>
      </div>`;
        })
        .join("") +
      `</div>`;
  });
}

window.delUpdate = async function (id) {
  if (
    !confirm(
      "Delete this update? Students will no longer see it in their notifications.",
    )
  )
    return;
  try {
    await deleteDoc(doc(db, "courseUpdates", id));
    showToast("Deleted");
  } catch (e) {
    showToast("Error");
  }
};

// ── GRANT / REVOKE ADMIN ──────────────────────────────────
window.grantAdmin = async function () {
  const email = document
    .getElementById("grantEmail")
    .value.trim()
    .toLowerCase();
  const role = document.getElementById("grantRole")?.value || "academic_lead";
  const fb = document.getElementById("grantFeedback");
  if (!email) {
    fb.style.color = "var(--red)";
    fb.textContent = "Enter an email address.";
    return;
  }

  fb.style.color = "var(--text3)";
  fb.textContent = "Looking up account...";

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      fb.style.color = "var(--red)";
      fb.textContent = `No Unify account found for ${email}. They need to sign up first.`;
      return;
    }
    const userSnap = snap.docs[0];
    const existing = userSnap.data();
    if (existing.isAdmin && existing.role === role) {
      fb.style.color = "var(--amber)";
      fb.textContent = `${email} already has ${role} access.`;
      return;
    }

    const update = { role };
    if (role === 'class_rep') {
      update.isCourseRep = true;
      update.isAdmin = false;
      const gFaculty = document.getElementById("grantFaculty")?.value || '';
      const gDept = document.getElementById("grantDept")?.value || '';
      const gLevel = document.getElementById("grantLevel")?.value || '';
      const gSemester = document.getElementById("grantSemester")?.value || '';
      if (gFaculty) update.assignedFaculty = gFaculty;
      if (gDept) update.assignedDepartment = gDept;
      if (gLevel) update.assignedLevel = gLevel;
      if (gSemester) update.assignedSemester = gSemester;
    } else {
      update.isAdmin = true;
    }

    await updateDoc(userSnap.ref, update);
    fb.style.color = "var(--green-deep)";
    fb.textContent = `Access granted to ${email} as ${role}.`;
    document.getElementById("grantEmail").value = "";
    if (document.getElementById("grantRole")) document.getElementById("grantRole").value = "academic_lead";
    showToast(`${email} is now ${role}`);
    loadAdmins();
  } catch (e) {
    console.error(e);
    fb.style.color = "var(--red)";
    fb.textContent = "Error — check Firestore rules.";
  }
};

window.revokeAdmin = async function (uid, email) {
  if (!confirm(`Revoke admin access for ${email}?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), {
      isAdmin: false,
      isCourseRep: false,
      role: null,
      assignedFaculty: null,
      assignedDepartment: null,
      assignedLevel: null,
      assignedSemester: null,
    });
    showToast(`Access revoked for ${email}`);
    loadAdmins();
  } catch (e) {
    showToast("Error revoking access");
  }
};

async function loadAdmins() {
  const container = document.getElementById("adminList");
  try {
    const [adminSnap, repSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("isAdmin", "==", true))),
      getDocs(query(collection(db, "users"), where("isCourseRep", "==", true))),
    ]);

    const seen = new Set();
    const allDocs = [];
    for (const d of [...adminSnap.docs, ...repSnap.docs]) {
      if (!seen.has(d.id)) { seen.add(d.id); allDocs.push(d); }
    }

    if (!allDocs.length) { container.innerHTML = ""; return; }

    const roleBadgeLabel = { super_admin: 'Super Admin', academic_lead: 'Academic Lead', class_rep: 'Class Rep' };

    container.innerHTML = allDocs.map((d) => {
      const u = d.data();
      const isSuperAdmin = u.email === SUPER_ADMIN_EMAIL;
      const role = isSuperAdmin ? 'super_admin' : (u.role || (u.isAdmin ? 'academic_lead' : 'class_rep'));
      const badgeLabel = roleBadgeLabel[role] || role;
      const assignment = [u.assignedDepartment, u.assignedLevel].filter(Boolean).join(' · ');
      return `<div class="admin-item">
        <div>
          <div class="admin-item-name">${u.name || "—"} <span class="super-badge" style="font-size:10px;padding:2px 6px;">${badgeLabel}</span></div>
          <div class="admin-item-email">${u.email || ""} ${assignment ? "· " + assignment : (u.department ? "· " + u.department : "")}</div>
        </div>
        ${
          isSuperAdmin
            ? ``
            : `<button class="btn-revoke" onclick="revokeAdmin('${d.id}','${u.email}')">Revoke</button>`
        }
      </div>`;
    }).join("");
  } catch (e) {
    console.error(e);
  }
}

// ── THEME ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("unify-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeBtn").textContent =
    saved === "dark" ? "☀ Light" : "☾ Dark";
}
window.toggleTheme = function () {
  const cur = document.documentElement.getAttribute("data-theme");
  const nxt = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nxt);
  localStorage.setItem("unify-theme", nxt);
  document.getElementById("themeBtn").textContent =
    nxt === "dark" ? "☀ Light" : "☾ Dark";
};

// ── MANAGE COURSES ────────────────────────────────────────
const CADD_FIELDS = [
  "cAddCode",
  "cAddTitle",
  "cAddFaculty",
  "cAddDept",
  "cAddLevel",
  "cAddSemester",
  "cAddUnits",
  "cAddDesc",
];
let editingCourseCode = null;

window.saveCourse = async function () {
  const code = normalizeCode(document.getElementById("cAddCode").value);
  const title = document.getElementById("cAddTitle").value.trim();
  const faculty = document.getElementById("cAddFaculty").value.trim();
  const department = document.getElementById("cAddDept").value.trim();
  const level = document.getElementById("cAddLevel").value;
  const semester = document.getElementById("cAddSemester").value;
  const units = parseInt(document.getElementById("cAddUnits").value, 10) || 3;
  const description = document.getElementById("cAddDesc").value.trim();
  const fb = document.getElementById("cAddFeedback");

  if (!code) {
    fb.style.color = "var(--red)";
    fb.textContent = "Course code is required.";
    return;
  }
  if (!title) {
    fb.style.color = "var(--red)";
    fb.textContent = "Course title is required.";
    return;
  }

  const btn = document.getElementById("cAddBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  fb.style.color = "var(--text3)";
  fb.textContent = "Saving course…";

  try {
    await upsertCourse(
      { code, title, faculty, department, level, semester, units, description },
      me?.uid,
    );
    fb.style.color = "var(--green-deep)";
    fb.textContent = editingCourseCode
      ? `Updated ${code}.`
      : `Added ${code}. Students can now select this course.`;
    showToast(editingCourseCode ? "Course updated" : "Course added");
    resetCourseForm();
    loadCourses();
  } catch (e) {
    console.error(e);
    fb.style.color = "var(--red)";
    fb.textContent =
      "Error saving course — check Firestore rules allow admin writes to /courses.";
  } finally {
    btn.disabled = false;
    btn.textContent = editingCourseCode ? "Update Course →" : "Save Course →";
  }
};

function resetCourseForm() {
  CADD_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "cAddUnits") el.value = "3";
    else el.value = "";
  });
  editingCourseCode = null;
  const btn = document.getElementById("cAddBtn");
  if (btn) btn.textContent = "Save Course →";
}

window.editCourse = async function (code) {
  const c = await getCourse(code);
  if (!c) {
    showToast("Course not found");
    return;
  }
  document.getElementById("cAddCode").value = c.code || "";
  document.getElementById("cAddTitle").value = c.title || "";
  document.getElementById("cAddFaculty").value = c.faculty || "";
  document.getElementById("cAddDept").value = c.department || "";
  document.getElementById("cAddLevel").value = c.level || "";
  document.getElementById("cAddSemester").value = c.semester || "";
  document.getElementById("cAddUnits").value = c.units || 3;
  document.getElementById("cAddDesc").value = c.description || "";
  editingCourseCode = c.code;
  document.getElementById("cAddBtn").textContent = "Update Course →";
  document.getElementById("cAddCode").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
};

window.removeCourseDoc = async function (code) {
  if (
    !confirm(
      `Delete course ${code}? Students who already added it will keep their entry until they remove it themselves, but the dynamic course page will no longer load data.`,
    )
  )
    return;
  try {
    await deleteCourseDoc(code);
    showToast(`${code} deleted`);
    loadCourses();
  } catch (e) {
    console.error(e);
    showToast("Error deleting course");
  }
};

async function loadCourses() {
  const el = document.getElementById("courseList");
  if (!el) return;
  try {
    const courses = await listCourses();
    if (!courses.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">No courses added yet. Add the first one above.</div></div>`;
      return;
    }
    el.innerHTML =
      `<div class="update-log">` +
      courses
        .map((c) => {
          const meta = [c.department, c.level, c.semester]
            .filter(Boolean)
            .join(" · ");
          return `<div class="update-item">
        <div class="update-course-code">${c.code}</div>
        <div>
          <div style="font-weight:600;font-size:14px;">${c.title || "—"}</div>
          ${meta ? `<div class="update-detail">${meta}</div>` : ""}
          ${c.description ? `<div class="update-meta">${c.description}</div>` : ""}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-icon" style="border-color:var(--border);color:var(--text2);" onclick="editCourse('${c.code}')" title="Edit">Edit</button>
          <button class="btn-icon" onclick="removeCourseDoc('${c.code}')" title="Delete">✕</button>
        </div>
      </div>`;
        })
        .join("") +
      `</div>`;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-text">Couldn't load courses. Check Firestore rules.</div></div>`;
  }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── GRANT FORM ROLE TOGGLE ────────────────────────────────
window.onGrantRoleChange = function () {
  const role = document.getElementById("grantRole")?.value;
  const fields = document.getElementById("grantAssignmentFields");
  if (fields) fields.style.display = role === "class_rep" ? "block" : "none";
};

// ── TIMETABLE MANAGER ─────────────────────────────────────
let _ttTarget = { faculty: "", department: "", level: "", semester: "" };

window.onTTTargetChange = function () {
  _ttTarget = {
    faculty: document.getElementById("ttFaculty")?.value || "",
    department: document.getElementById("ttDept")?.value || "",
    level: document.getElementById("ttLevel")?.value || "",
    semester: document.getElementById("ttSemester")?.value || "",
  };
  if (_ttTarget.department && _ttTarget.level && _ttTarget.semester) {
    loadTimetableEntries(_ttTarget);
    populateTTCodeSuggestions(_ttTarget);
  }
};

window.initTimetableSection = async function (role, profile) {
  if (role === "class_rep") {
    _ttTarget = {
      faculty: profile.assignedFaculty || "",
      department: profile.assignedDepartment || "",
      level: profile.assignedLevel || "",
      semester: profile.assignedSemester || "",
    };
    const info = document.getElementById("timetableClassInfo");
    if (info) {
      info.textContent = [
        _ttTarget.faculty,
        _ttTarget.department,
        _ttTarget.level,
        _ttTarget.semester,
      ]
        .filter(Boolean)
        .join(" · ") || "No class assigned — contact the super admin.";
    }
  } else {
    // super_admin: show target selectors
    const sel = document.getElementById("ttTargetSelectors");
    if (sel) sel.style.display = "block";
    const info = document.getElementById("timetableClassInfo");
    if (info) info.textContent = "Select a class above to manage its timetable.";
    return; // entries loaded when dropdowns change
  }

  await loadTimetableEntries(_ttTarget);
  await populateTTCodeSuggestions(_ttTarget);
};

async function populateTTCodeSuggestions(target) {
  const dl = document.getElementById("ttCodeSuggestions");
  if (!dl) return;
  try {
    const all = await listCourses();
    const filtered = all.filter((c) => {
      const md = !c.department || normField(c.department) === normField(target.department);
      const ml = !c.level || normField(c.level) === normField(target.level);
      return md && ml;
    });
    dl.innerHTML = filtered
      .map((c) => `<option value="${c.code}">`)
      .join("");
  } catch (e) {}
}

async function loadTimetableEntries(target) {
  const el = document.getElementById("timetableList");
  if (!el) return;
  if (!target.department || !target.level) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Select a class to see its entries.</div></div>`;
    return;
  }
  try {
    const q = query(
      collection(db, "timetableEntries"),
      where("department", "==", target.department),
      where("level", "==", target.level),
      orderBy("day"),
      orderBy("startTime"),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">No timetable entries yet for this class.</div></div>`;
      return;
    }
    const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    el.innerHTML =
      `<div class="update-log">` +
      snap.docs
        .map((d) => {
          const e = d.data();
          const meta = [e.lecturer, e.venue].filter(Boolean).join(" · ");
          return `<div class="update-item">
            <div class="update-course-code">${e.day}</div>
            <div>
              <div style="font-weight:600;font-size:14px;">${e.courseCode} &nbsp; <span style="font-size:12px;font-weight:400;color:var(--text2);">${e.startTime} – ${e.endTime}</span></div>
              ${meta ? `<div class="update-detail">${meta}</div>` : ""}
              <div class="update-meta">${e.level} · ${e.semester || ""}</div>
            </div>
            <button class="btn-icon" onclick="deleteTimetableEntry('${d.id}','${e.courseCode}')" title="Delete">✕</button>
          </div>`;
        })
        .join("") +
      `</div>`;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-text">Error loading entries.</div></div>`;
  }
}

window.saveTimetableEntry = async function () {
  const day = document.getElementById("ttDay").value;
  const courseCode = document.getElementById("ttCode").value.trim().toUpperCase();
  const startTime = document.getElementById("ttStart").value;
  const endTime = document.getElementById("ttEnd").value;
  const venue = document.getElementById("ttVenue").value.trim() || null;
  const lecturer = document.getElementById("ttLecturer").value.trim() || null;
  const fb = document.getElementById("ttFeedback");
  const warn = document.getElementById("ttWarning");
  const btn = document.getElementById("ttSaveBtn");

  if (!courseCode || !startTime || !endTime) {
    fb.style.color = "var(--red)";
    fb.textContent = "Course code, start time, and end time are required.";
    return;
  }
  if (startTime >= endTime) {
    fb.style.color = "var(--red)";
    fb.textContent = "End time must be after start time.";
    return;
  }
  if (!_ttTarget.department || !_ttTarget.level || !_ttTarget.semester) {
    fb.style.color = "var(--red)";
    fb.textContent = "No class target set — select a class first.";
    return;
  }

  // Overlap check
  try {
    const q = query(
      collection(db, "timetableEntries"),
      where("department", "==", _ttTarget.department),
      where("level", "==", _ttTarget.level),
      where("day", "==", day),
    );
    const existing = await getDocs(q);
    const conflict = existing.docs.find((d) => {
      const e = d.data();
      return startTime < e.endTime && endTime > e.startTime;
    });
    if (conflict) {
      const ce = conflict.data();
      warn.style.display = "block";
      warn.textContent = `⚠ Overlap with ${ce.courseCode} (${ce.startTime}–${ce.endTime}) on ${day}. Entry saved anyway.`;
    } else {
      warn.style.display = "none";
    }
  } catch (e) {}

  btn.disabled = true;
  btn.textContent = "Saving…";
  fb.textContent = "";

  try {
    await addDoc(collection(db, "timetableEntries"), {
      day,
      courseCode,
      startTime,
      endTime,
      venue,
      lecturer,
      faculty: _ttTarget.faculty,
      department: _ttTarget.department,
      level: _ttTarget.level,
      semester: _ttTarget.semester,
      createdBy: me?.uid || null,
      createdAt: serverTimestamp(),
    });
    fb.style.color = "var(--green-deep)";
    fb.textContent = `${courseCode} added to ${day}.`;
    document.getElementById("ttCode").value = "";
    document.getElementById("ttStart").value = "";
    document.getElementById("ttEnd").value = "";
    document.getElementById("ttVenue").value = "";
    document.getElementById("ttLecturer").value = "";
    showToast(`${courseCode} — ${day} added`);
    await loadTimetableEntries(_ttTarget);
  } catch (e) {
    console.error(e);
    fb.style.color = "var(--red)";
    fb.textContent = "Error saving — check Firestore rules.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Entry →";
  }
};

window.deleteTimetableEntry = async function (id, code) {
  if (!confirm(`Remove ${code} from the timetable?`)) return;
  try {
    await deleteDoc(doc(db, "timetableEntries", id));
    showToast(`${code} removed`);
    await loadTimetableEntries(_ttTarget);
  } catch (e) {
    showToast("Error removing entry");
  }
};
