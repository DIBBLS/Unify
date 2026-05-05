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
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const ROLE_LABEL = {
  super_admin: "Super Admin",
  academic_lead: "Academic Lead",
  class_rep: "Class Rep",
};
const ROLE_CLASS = {
  super_admin: "role-super",
  academic_lead: "role-academic",
  class_rep: "",
};

let me = null;
let myProfile = null;
let myRole = "student";
let _ttTarget = { faculty: "", department: "", level: "", semester: "" };
let _ttEntries = [];
let _annKind = "general";

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
  const isClassRep = myProfile.role === "class_rep";

  // Bootstrap super-admin
  if (isSuperAdmin && !myProfile.isAdmin) {
    await setDoc(
      doc(db, "users", user.uid),
      { isAdmin: true, role: "super_admin", email: user.email },
      { merge: true },
    );
    myProfile.isAdmin = true;
    myProfile.role = "super_admin";
  }

  if (!isAdmin && !isClassRep) {
    document.getElementById("accessDenied").style.display = "block";
    return;
  }

  // Derive role
  if (isSuperAdmin) myRole = "super_admin";
  else if (myProfile.role) myRole = myProfile.role;
  else if (isAdmin) myRole = "academic_lead";
  else myRole = "class_rep";

  document.getElementById("mainContent").style.display = "block";

  hydrateHero(user);
  initAnchorNav();
  initTheme();

  // Section gates
  if (!canPostUpdates(myRole)) hide("announcements");
  if (!canManageCourses(myRole)) hide("courses");
  if (!canGrantAccess(myRole)) hide("access");
  if (!canManageTimetable(myRole)) hide("timetable");

  // Hide audience hint for non-class-reps
  if (myRole !== "class_rep") {
    const aud = document.getElementById("annAudience");
    if (aud) aud.textContent = "";
  }

  listenToUpdates();
  if (canGrantAccess(myRole)) loadAdmins();
  if (canManageCourses(myRole)) loadCourses();
  if (canManageTimetable(myRole)) initTimetableSection(myRole, myProfile);
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "Auth.html";
});

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
  const link = document.querySelector(`.anchor-link[data-anchor="${id}"]`);
  if (link) link.style.display = "none";
}

// ── HERO + STATS ─────────────────────────────────────────
function hydrateHero(user) {
  const firstName = (myProfile.firstName || myProfile.name || user.email.split("@")[0] || "Builder").split(" ")[0];
  const displayName = myProfile.name || myProfile.firstName || user.email;

  document.getElementById("heroName").textContent = firstName;
  document.getElementById("heroEmail").textContent = user.email;
  document.getElementById("navUser").textContent = user.email;

  const postedAs = document.getElementById("postedAsLabel");
  if (postedAs) postedAs.textContent = displayName;

  // Role badge
  const rb = document.getElementById("roleBadge");
  rb.textContent = ROLE_LABEL[myRole] || "Member";
  rb.classList.add(ROLE_CLASS[myRole] || "");

  // Class assignment line
  const a = getAssignment(myProfile);
  const classStr =
    [a.faculty, a.department, a.level, a.semester].filter(Boolean).join(" · ") ||
    (myRole === "super_admin"
      ? "All faculties"
      : "No class assigned — contact super admin");
  document.getElementById("heroClass").textContent = classStr;

  // Stats: assigned class
  const sClass = document.getElementById("statClass");
  const sClassSub = document.getElementById("statClassSub");
  if (a.department) {
    sClass.textContent = a.department.replace(/Engineering/i, "Eng.").trim();
    sClassSub.textContent = [a.level, a.semester].filter(Boolean).join(" · ") || "—";
  } else if (myRole === "super_admin") {
    sClass.textContent = "All Classes";
    sClassSub.textContent = "Super admin scope";
  } else {
    sClass.textContent = "Unassigned";
    sClassSub.textContent = "—";
  }

  // Audience hint on announcement composer
  const aud = document.getElementById("annAudience");
  if (aud && myRole === "class_rep" && a.department) {
    aud.textContent = `Audience: ${a.department}${a.level ? " · " + a.level : ""}`;
  }
}

// ── ANCHOR NAV ───────────────────────────────────────────
function initAnchorNav() {
  const links = document.querySelectorAll(".anchor-link");
  links.forEach((lnk) => {
    lnk.addEventListener("click", (e) => {
      e.preventDefault();
      const id = lnk.dataset.anchor;
      const el = document.getElementById(id);
      if (!el) return;
      // Open <details> if collapsed
      if (el.tagName === "DETAILS" && !el.open) el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Active section highlight via IntersectionObserver
  const sections = Array.from(document.querySelectorAll(".panel"));
  if (!sections.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = en.target.id;
          links.forEach((l) =>
            l.classList.toggle("active", l.dataset.anchor === id),
          );
        }
      });
    },
    { rootMargin: "-40% 0px -50% 0px", threshold: 0 },
  );
  sections.forEach((s) => io.observe(s));
}

// ── ANNOUNCEMENT KIND TOGGLE ─────────────────────────────
window.setAnnKind = function (kind) {
  _annKind = kind;
  document.querySelectorAll(".seg").forEach((s) => {
    s.classList.toggle("active", s.dataset.kind === kind);
  });
  document.getElementById("annGeneralFields").style.display =
    kind === "general" ? "block" : "none";
  document.getElementById("annCourseFields").style.display =
    kind === "course" ? "block" : "none";
};

// ── POST UPDATE ──────────────────────────────────────────
window.postUpdate = async function () {
  const btn = document.getElementById("postBtn");
  const kind = _annKind;
  let payload;

  if (kind === "general") {
    const title = document.getElementById("annTitle").value.trim();
    const message = document.getElementById("annMessage").value.trim();
    if (!title && !message) {
      showToast("Add a title or message first");
      return;
    }
    payload = {
      kind: "general",
      title: title || "Announcement",
      message: message || null,
      courseCode: "__GENERAL__",
      status: "general",
      postedBy: myProfile?.name || myProfile?.firstName || me.email,
      postedByEmail: me.email,
      postedAt: serverTimestamp(),
    };
  } else {
    const code = document.getElementById("upCode").value.trim().toUpperCase();
    const status = document.getElementById("upStatus").value;
    const lecturer = document.getElementById("upLecturer").value.trim();
    const venue = document.getElementById("upVenue").value.trim();
    const message = document.getElementById("upMessage").value.trim();
    if (!code) {
      showToast("Enter a course code first");
      return;
    }
    payload = {
      kind: "course",
      courseCode: code,
      status,
      lecturer: lecturer || null,
      venue: venue || null,
      message: message || null,
      postedBy: myProfile?.name || myProfile?.firstName || me.email,
      postedByEmail: me.email,
      postedAt: serverTimestamp(),
    };
  }

  // class_rep: tag with assignment so notifications filter by class
  if (myRole === "class_rep") {
    const a = getAssignment(myProfile);
    if (a.faculty) payload.targetFaculty = a.faculty;
    if (a.department) payload.targetDepartment = a.department;
    if (a.level) payload.targetLevel = a.level;
    if (a.semester) payload.targetSemester = a.semester;
  }

  btn.disabled = true;
  btn.textContent = "Posting…";
  try {
    const ts = Date.now();
    const codeForId = (payload.courseCode || "GEN").replace(/\s+/g, "_");
    await setDoc(doc(db, "courseUpdates", codeForId + "_" + ts), payload);

    // Latest canonical state for course-specific only
    if (kind === "course") {
      await setDoc(
        doc(db, "courseStatus", payload.courseCode.replace(/\s+/g, "_")),
        { ...payload, updatedAt: serverTimestamp() },
      );
    }

    // Reset form
    if (kind === "general") {
      document.getElementById("annTitle").value = "";
      document.getElementById("annMessage").value = "";
    } else {
      ["upCode", "upLecturer", "upVenue", "upMessage"].forEach(
        (id) => (document.getElementById(id).value = ""),
      );
      document.getElementById("upStatus").value = "confirmed";
    }
    showToast("Announcement posted — class notified");
  } catch (e) {
    console.error(e);
    showToast("Error posting — check Firestore rules");
  }
  btn.disabled = false;
  btn.textContent = "Post →";
};

// ── ACTIVITY FEED (live) ─────────────────────────────────
function listenToUpdates() {
  const q = query(collection(db, "courseUpdates"), orderBy("postedAt", "desc"));
  onSnapshot(q, (snap) => {
    renderActivity(snap);
    updateAnnouncementStats(snap);
  });
}

function renderActivity(snap) {
  const el = document.getElementById("updateLog");
  if (snap.empty) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No activity yet.</div></div>`;
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
        const ts = u.postedAt?.toDate?.();
        const timeStr = ts
          ? ts.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
            " · " +
            ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : "Just now";

        if (u.kind === "general") {
          return `<div class="update-item update-general">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span class="chip chip-general">General</span>
              </div>
              <div class="update-title">${escapeHtml(u.title || "Announcement")}</div>
              ${u.message ? `<div class="update-msg">${escapeHtml(u.message)}</div>` : ""}
              <div class="update-meta">Posted by ${escapeHtml(u.postedBy || "—")} · ${timeStr}</div>
            </div>
            <button class="btn-icon" onclick="delUpdate('${d.id}')" title="Delete">✕</button>
          </div>`;
        }

        const chip = `<span class="chip ${chips[u.status] || "chip-venue_change"}">${labels[u.status] || u.status || "—"}</span>`;
        const details = [
          u.lecturer ? `Lecturer: <strong>${escapeHtml(u.lecturer)}</strong>` : null,
          u.venue ? `Venue: <strong>${escapeHtml(u.venue)}</strong>` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return `<div class="update-item">
          <div class="update-course-code">${escapeHtml(u.courseCode || "—")}</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${chip}${u.message ? `<span style="font-size:13px;color:var(--text2);">${escapeHtml(u.message)}</span>` : ""}</div>
            ${details ? `<div class="update-detail">${details}</div>` : ""}
            <div class="update-meta">Posted by ${escapeHtml(u.postedBy || "—")} · ${timeStr}</div>
          </div>
          <button class="btn-icon" onclick="delUpdate('${d.id}')" title="Delete">✕</button>
        </div>`;
      })
      .join("") +
    `</div>`;
}

function updateAnnouncementStats(snap) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let weekCount = 0;
  let mostRecent = null;
  snap.docs.forEach((d) => {
    const u = d.data();
    const ts = u.postedAt?.toDate?.();
    if (ts && ts.getTime() >= sevenDaysAgo) weekCount += 1;
    if (ts && (!mostRecent || ts > mostRecent.ts)) {
      mostRecent = { ts, code: u.kind === "general" ? "Announcement" : (u.courseCode || "—") };
    }
  });
  document.getElementById("statUpdates").textContent = String(weekCount);
  if (mostRecent) {
    const ts = mostRecent.ts;
    const sLast = document.getElementById("statLast");
    const sLastSub = document.getElementById("statLastSub");
    sLast.textContent = mostRecent.code;
    sLastSub.textContent = ts.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
      " · " +
      ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.delUpdate = async function (id) {
  if (!confirm("Delete this update? Students will no longer see it.")) return;
  try {
    await deleteDoc(doc(db, "courseUpdates", id));
    showToast("Deleted");
  } catch (e) {
    showToast("Error");
  }
};

// ── GRANT / REVOKE ADMIN ─────────────────────────────────
window.grantAdmin = async function () {
  const email = document.getElementById("grantEmail").value.trim().toLowerCase();
  const role = document.getElementById("grantRole")?.value || "academic_lead";
  const fb = document.getElementById("grantFeedback");
  if (!email) {
    fb.style.color = "var(--red)";
    fb.textContent = "Enter an email address.";
    return;
  }
  fb.style.color = "var(--text3)";
  fb.textContent = "Looking up account…";

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    let userSnap = snap.empty ? null : snap.docs[0];
    if (!userSnap) {
      const allSnap = await getDocs(collection(db, "users"));
      allSnap.docs.forEach((docSnap) => {
        const stored = (docSnap.data().email || "").toLowerCase().trim();
        if (stored && stored === email) userSnap = docSnap;
      });
    }
    if (!userSnap) {
      fb.style.color = "var(--red)";
      fb.textContent = `No account found for ${email}. Ask them to sign in once first.`;
      return;
    }

    const existing = userSnap.data();
    if (existing.isAdmin && existing.role === role) {
      fb.style.color = "var(--amber)";
      fb.textContent = `${email} already has ${role} access.`;
      return;
    }

    const update = { role };
    if (role === "class_rep") {
      update.isAdmin = false;
      const gFaculty = document.getElementById("grantFaculty")?.value || "";
      const gDept = document.getElementById("grantDept")?.value || "";
      const gLevel = document.getElementById("grantLevel")?.value || "";
      const gSemester = document.getElementById("grantSemester")?.value || "";
      if (gFaculty) update.assignedFaculty = gFaculty;
      if (gDept) update.assignedDepartment = gDept;
      if (gLevel) update.assignedLevel = gLevel;
      if (gSemester) update.assignedSemester = gSemester;
    } else {
      update.isAdmin = true;
    }

    await updateDoc(userSnap.ref, update);
    fb.style.color = "var(--green-deep)";
    fb.textContent = `Access granted to ${email} as ${ROLE_LABEL[role] || role}.`;
    document.getElementById("grantEmail").value = "";
    showToast(`${email} is now ${ROLE_LABEL[role] || role}`);
    loadAdmins();
  } catch (e) {
    console.error(e);
    fb.style.color = "var(--red)";
    fb.textContent = "Error — check Firestore rules.";
  }
};

window.revokeAdmin = async function (uid, email) {
  if (!confirm(`Revoke access for ${email}?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), {
      isAdmin: false,
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
  if (!container) return;
  try {
    const [adminSnap, repSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("isAdmin", "==", true))),
      getDocs(query(collection(db, "users"), where("role", "==", "class_rep"))),
    ]);
    const seen = new Set();
    const allDocs = [];
    for (const d of [...adminSnap.docs, ...repSnap.docs]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        allDocs.push(d);
      }
    }
    if (!allDocs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-text">No admins or reps yet.</div></div>`;
      return;
    }
    container.innerHTML = allDocs
      .map((d) => {
        const u = d.data();
        const isSuper = u.email === SUPER_ADMIN_EMAIL;
        const role = isSuper
          ? "super_admin"
          : u.role || (u.isAdmin ? "academic_lead" : "class_rep");
        const tagClass =
          role === "super_admin"
            ? "role-super"
            : role === "academic_lead"
              ? "role-academic"
              : "role-rep";
        const assignment = [u.assignedDepartment, u.assignedLevel].filter(Boolean).join(" · ");
        return `<div class="admin-item">
          <div>
            <div class="admin-item-name">
              ${escapeHtml(u.firstName || u.name || "—")}
              <span class="role-tag ${tagClass}">${ROLE_LABEL[role] || role}</span>
            </div>
            <div class="admin-item-email">${escapeHtml(u.email || "")}${assignment ? " · " + escapeHtml(assignment) : (u.department ? " · " + escapeHtml(u.department) : "")}</div>
          </div>
          ${isSuper ? "" : `<button class="btn-revoke" onclick="revokeAdmin('${d.id}','${escapeHtml(u.email || "")}')">Revoke</button>`}
        </div>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
  }
}

// ── THEME ────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("unify-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = saved === "dark" ? "☀ Light" : "☾ Dark";
}
window.toggleTheme = function () {
  const cur = document.documentElement.getAttribute("data-theme");
  const nxt = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nxt);
  localStorage.setItem("unify-theme", nxt);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = nxt === "dark" ? "☀ Light" : "☾ Dark";
};

// ── MANAGE COURSES ───────────────────────────────────────
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
    fb.textContent = editingCourseCode ? `Updated ${code}.` : `Added ${code}.`;
    showToast(editingCourseCode ? "Course updated" : "Course added");
    resetCourseForm();
    loadCourses();
  } catch (e) {
    console.error(e);
    fb.style.color = "var(--red)";
    fb.textContent = "Error saving course — check Firestore rules.";
  } finally {
    btn.disabled = false;
    btn.textContent = editingCourseCode ? "Update Course →" : "Save Course →";
  }
};

function resetCourseForm() {
  CADD_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = id === "cAddUnits" ? "3" : "";
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
  document.getElementById("courses").open = true;
  document.getElementById("cAddCode").scrollIntoView({ behavior: "smooth", block: "center" });
};

window.removeCourseDoc = async function (code) {
  if (!confirm(`Delete course ${code}?`)) return;
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
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">No courses added yet.</div></div>`;
      return;
    }
    el.innerHTML =
      `<div class="update-log">` +
      courses
        .map((c) => {
          const meta = [c.department, c.level, c.semester].filter(Boolean).join(" · ");
          return `<div class="update-item">
            <div class="update-course-code">${escapeHtml(c.code)}</div>
            <div>
              <div style="font-weight:600;font-size:14px;">${escapeHtml(c.title || "—")}</div>
              ${meta ? `<div class="update-detail">${escapeHtml(meta)}</div>` : ""}
              ${c.description ? `<div class="update-meta">${escapeHtml(c.description)}</div>` : ""}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn-icon" style="border-color:var(--border);color:var(--text2);" onclick="editCourse('${escapeHtml(c.code)}')" title="Edit">Edit</button>
              <button class="btn-icon" onclick="removeCourseDoc('${escapeHtml(c.code)}')" title="Delete">✕</button>
            </div>
          </div>`;
        })
        .join("") +
      `</div>`;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-text">Couldn't load courses.</div></div>`;
  }
}

// ── TOAST ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── GRANT FORM ROLE TOGGLE ───────────────────────────────
window.onGrantRoleChange = function () {
  const role = document.getElementById("grantRole")?.value;
  const fields = document.getElementById("grantAssignmentFields");
  if (fields) fields.style.display = role === "class_rep" ? "block" : "none";
};

// ── TIMETABLE MANAGER (day-card grid) ────────────────────
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
  } else {
    renderTimetableGrid([]); // pre-class state
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
    const sub = document.getElementById("ttClassSub");
    if (sub) {
      const txt = [_ttTarget.department, _ttTarget.level, _ttTarget.semester]
        .filter(Boolean)
        .join(" · ");
      sub.textContent = txt
        ? `${txt} — durations are flexible (set any start & end time).`
        : "No class assigned — contact the super admin.";
    }
  } else {
    const sel = document.getElementById("ttTargetSelectors");
    if (sel) sel.style.display = "block";
    const sub = document.getElementById("ttClassSub");
    if (sub) sub.textContent = "Select a class above to manage its weekly timetable.";
    renderTimetableGrid([]);
    return;
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
    dl.innerHTML = filtered.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.title || "")}</option>`).join("");
  } catch (e) {}
}

async function loadTimetableEntries(target) {
  if (!target.department || !target.level) {
    _ttEntries = [];
    renderTimetableGrid([]);
    return;
  }
  try {
    const q = query(
      collection(db, "timetableEntries"),
      where("department", "==", target.department),
      where("level", "==", target.level),
    );
    const snap = await getDocs(q);
    _ttEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    _ttEntries.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    renderTimetableGrid(_ttEntries);
  } catch (e) {
    console.error(e);
    _ttEntries = [];
    renderTimetableGrid([]);
  }
}

function renderTimetableGrid(entries) {
  const grid = document.getElementById("ttGrid");
  if (!grid) return;

  // Stats
  const countEl = document.getElementById("ttCount");
  if (countEl) countEl.textContent = `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;
  const sEntries = document.getElementById("statEntries");
  if (sEntries) sEntries.textContent = String(entries.length);

  const targetReady = !!(_ttTarget.department && _ttTarget.level);
  const todayName = DAYS[(new Date().getDay() + 6) % 7] || ""; // Mon=0
  const byDay = {};
  DAYS.forEach((d) => (byDay[d] = []));
  entries.forEach((e) => {
    if (byDay[e.day]) byDay[e.day].push(e);
  });

  grid.innerHTML = DAYS.map((day) => {
    const list = byDay[day];
    const isToday = day === todayName;
    const entriesHtml = list.length
      ? list
          .map(
            (e) => `
        <div class="entry">
          <div class="entry-time">${escapeHtml(e.startTime || "")} – ${escapeHtml(e.endTime || "")}</div>
          <div class="entry-code">${escapeHtml(e.courseCode || "—")}</div>
          ${e.venue || e.lecturer ? `<div class="entry-meta">${escapeHtml([e.venue, e.lecturer].filter(Boolean).join(" · "))}</div>` : ""}
          <button class="entry-del" onclick="deleteTimetableEntry('${e.id}','${escapeHtml(e.courseCode || "")}')" title="Remove">✕</button>
        </div>`,
          )
          .join("")
      : `<div class="day-empty">No classes scheduled</div>`;

    const addControl = targetReady
      ? `
        <button class="day-add-toggle" onclick="toggleDayAddForm('${day}')">+ Add class</button>
        <div class="day-add-form" id="addForm-${day}" hidden>
          <div>
            <label class="time-pair-label">Course code</label>
            <input id="ttCode-${day}" placeholder="e.g. ECE 308" list="ttCodeSuggestions" oninput="this.value=this.value.toUpperCase()" />
          </div>
          <div>
            <label class="time-pair-label">Time</label>
            <div class="time-pair">
              <input id="ttStart-${day}" type="time" />
              <input id="ttEnd-${day}" type="time" />
            </div>
          </div>
          <div>
            <label class="time-pair-label">Venue (optional)</label>
            <input id="ttVenue-${day}" placeholder="e.g. ECE Block, LT1" />
          </div>
          <div>
            <label class="time-pair-label">Lecturer (optional)</label>
            <input id="ttLecturer-${day}" placeholder="e.g. Dr. Adeyemi" />
          </div>
          <div class="day-add-warn" id="warn-${day}" style="display:none"></div>
          <div class="day-add-foot">
            <button type="button" class="btn btn-ghost" onclick="toggleDayAddForm('${day}')">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="addClassToDay('${day}')">Add</button>
          </div>
        </div>`
      : "";

    return `
      <div class="day-card ${isToday ? "is-today" : ""}">
        <div class="day-card-head">
          <span class="day-name">${day}</span>
          <span class="day-count">${list.length}</span>
        </div>
        <div class="day-entries">${entriesHtml}</div>
        ${addControl}
      </div>`;
  }).join("");
}

window.toggleDayAddForm = function (day) {
  const form = document.getElementById(`addForm-${day}`);
  if (!form) return;
  const open = !form.hasAttribute("hidden");
  if (open) {
    form.setAttribute("hidden", "");
  } else {
    form.removeAttribute("hidden");
    setTimeout(() => document.getElementById(`ttCode-${day}`)?.focus(), 50);
  }
};

window.addClassToDay = async function (day) {
  if (!_ttTarget.department || !_ttTarget.level || !_ttTarget.semester) {
    showToast("Select a class first");
    return;
  }
  const code = (document.getElementById(`ttCode-${day}`)?.value || "").trim().toUpperCase();
  const startTime = document.getElementById(`ttStart-${day}`)?.value || "";
  const endTime = document.getElementById(`ttEnd-${day}`)?.value || "";
  const venue = (document.getElementById(`ttVenue-${day}`)?.value || "").trim() || null;
  const lecturer = (document.getElementById(`ttLecturer-${day}`)?.value || "").trim() || null;
  const warn = document.getElementById(`warn-${day}`);

  if (!code || !startTime || !endTime) {
    if (warn) {
      warn.style.display = "block";
      warn.textContent = "Course code, start and end time are required.";
    }
    return;
  }
  if (startTime >= endTime) {
    if (warn) {
      warn.style.display = "block";
      warn.textContent = "End time must be after start time.";
    }
    return;
  }

  // Overlap warning (does not block save)
  const conflict = _ttEntries.find(
    (e) => e.day === day && startTime < e.endTime && endTime > e.startTime,
  );
  if (conflict && warn) {
    warn.style.display = "block";
    warn.textContent = `⚠ Overlaps ${conflict.courseCode} (${conflict.startTime}–${conflict.endTime}). Saved anyway.`;
  } else if (warn) {
    warn.style.display = "none";
  }

  try {
    await addDoc(collection(db, "timetableEntries"), {
      day,
      courseCode: code,
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
    showToast(`${code} added — ${day}`);
    // Clear inputs but keep form open for next entry
    ["ttCode", "ttStart", "ttEnd", "ttVenue", "ttLecturer"].forEach((p) => {
      const el = document.getElementById(`${p}-${day}`);
      if (el) el.value = "";
    });
    document.getElementById(`ttCode-${day}`)?.focus();
    await loadTimetableEntries(_ttTarget);
  } catch (e) {
    console.error(e);
    if (warn) {
      warn.style.display = "block";
      warn.textContent = "Error saving — check Firestore rules.";
    }
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
