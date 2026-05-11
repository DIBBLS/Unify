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
  canUploadContent,
  getAssignment,
  normField,
} from "./roles.js?v=content-3";
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
  if (!canUploadContent(myRole)) hide("content");

  // Hide audience hint for non-class-reps
  if (myRole !== "class_rep") {
    const aud = document.getElementById("annAudience");
    if (aud) aud.textContent = "";
  }

  listenToUpdates();
  if (canGrantAccess(myRole)) loadAdmins();
  if (canManageCourses(myRole)) loadCourses();
  if (canManageTimetable(myRole)) initTimetableSection(myRole, myProfile);
  if (canUploadContent(myRole)) loadContentCourseList();
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
  const contentPostedAs = document.getElementById("contentPostedAsLabel");
  if (contentPostedAs) contentPostedAs.textContent = displayName;

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
          ${isSuper ? "" : `<button class="btn-revoke" onclick="revokeAdmin('${d.id}','${escapeHtml(u.email || "")}')"}>Revoke</button>`}
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
  const sel = document.getElementById("ttTargetSelectors");
  const sub = document.getElementById("ttClassSub");

  if (role === "class_rep") {
    _ttTarget = {
      faculty: profile.assignedFaculty || "",
      department: profile.assignedDepartment || "",
      level: profile.assignedLevel || "",
      semester: profile.assignedSemester || "",
    };
    const complete = _ttTarget.department && _ttTarget.level && _ttTarget.semester;
    if (complete) {
      if (sel) sel.style.display = "none";
      if (sub) {
        const txt = [_ttTarget.department, _ttTarget.level, _ttTarget.semester].filter(Boolean).join(" · ");
        sub.textContent = `${txt} — durations are flexible (set any start & end time).`;
      }
    } else {
      // No complete assignment — show the picker so they can still scope it
      if (sel) sel.style.display = "block";
      if (sub) sub.textContent = "Your class assignment is incomplete. Pick the class below, or ask a super admin to set your assignment.";
      // Pre-fill any partial values onto the selectors
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setVal("ttFaculty", _ttTarget.faculty);
      setVal("ttDept", _ttTarget.department);
      setVal("ttLevel", _ttTarget.level);
      setVal("ttSemester", _ttTarget.semester);
    }
  } else {
    if (sel) sel.style.display = "block";
    if (sub) sub.textContent = "Select Faculty, Department, Level & Semester below to manage that class's weekly timetable.";
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

let _ttDraftSeq = 0;

function renderTimetableSheet(entries) {
  const tbody = document.getElementById("ttSheetBody");
  if (!tbody) return;

  // Stats
  const countEl = document.getElementById("ttCount");
  if (countEl) countEl.textContent = `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;
  const sEntries = document.getElementById("statEntries");
  if (sEntries) sEntries.textContent = String(entries.length);

  const targetReady = !!(_ttTarget.department && _ttTarget.level);
  const addBtn = document.getElementById("ttAddRowBtn");
  if (addBtn) addBtn.disabled = !targetReady;

  // Strip saved-entry rows but preserve any in-progress draft rows
  Array.from(tbody.querySelectorAll("tr:not([data-draft])")).forEach((r) => r.remove());

  const todayName = DAYS[(new Date().getDay() + 6) % 7] || "";
  const dayOrder = Object.fromEntries(DAYS.map((d, i) => [d, i]));
  const sorted = [...entries].sort((a, b) => {
    const dc = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
    return dc !== 0 ? dc : (a.startTime || "").localeCompare(b.startTime || "");
  });

  const firstDraft = tbody.querySelector("[data-draft]");

  if (!sorted.length && !firstDraft) {
    const tr = document.createElement("tr");
    tr.className = "tt-empty-row";
    tr.innerHTML = `<td colspan="7" class="tt-empty">${
      targetReady
        ? 'No classes scheduled — click <strong>+ Add row</strong> to build the week.'
        : 'Pick Faculty, Department, Level &amp; Semester in the panel above to begin.'
    }</td>`;
    tbody.appendChild(tr);
    return;
  }

  let lastDay = null;
  sorted.forEach((e) => {
    const tr = document.createElement("tr");
    tr.dataset.id = e.id;
    if (e.day === todayName) tr.classList.add("row-today");
    if (e.day !== lastDay) {
      tr.classList.add("row-day-start");
      lastDay = e.day;
    }
    tr.innerHTML = `
      <td><span class="tt-day-pill">${escapeHtml(e.day || "—")}</span></td>
      <td class="tt-code-cell">${escapeHtml(e.courseCode || "—")}</td>
      <td class="tt-time-cell">${escapeHtml(e.startTime || "")}</td>
      <td class="tt-time-cell">${escapeHtml(e.endTime || "")}</td>
      <td class="tt-meta-cell">${escapeHtml(e.venue || "")}</td>
      <td class="tt-meta-cell">${escapeHtml(e.lecturer || "")}</td>
      <td class="tt-act-cell"><button class="tt-del-btn" onclick="deleteTimetableEntry('${e.id}','${escapeHtml(e.courseCode || "")}')" title="Remove">✕</button></td>`;
    tbody.insertBefore(tr, firstDraft);
  });
}

// Backwards-compat alias
function renderTimetableGrid(entries) {
  renderTimetableSheet(entries);
}

window.addTTDraftRow = function () {
  if (!(_ttTarget.department && _ttTarget.level && _ttTarget.semester)) {
    showToast("Pick Faculty, Department, Level & Semester first");
    const sel = document.getElementById("ttTargetSelectors");
    if (sel) {
      sel.style.display = "block";
      sel.scrollIntoView({ behavior: "smooth", block: "center" });
      const missing = ["ttFaculty", "ttDept", "ttLevel", "ttSemester"]
        .map((id) => document.getElementById(id))
        .find((el) => el && !el.value);
      missing?.focus();
    }
    return;
  }
  const tbody = document.getElementById("ttSheetBody");
  if (!tbody) return;
  tbody.querySelector(".tt-empty-row")?.remove();

  _ttDraftSeq += 1;
  const uid = "draft_" + _ttDraftSeq;
  const tr = document.createElement("tr");
  tr.dataset.draft = uid;
  tr.className = "tt-draft-row";
  tr.innerHTML = `
    <td><select class="tt-cell-input tt-cell-day" data-f="day">
      <option value="">—</option>
      ${DAYS.map((d) => `<option value="${d}">${d}</option>`).join("")}
    </select></td>
    <td><input class="tt-cell-input" data-f="courseCode" placeholder="ECE 308" list="ttCodeSuggestions" oninput="this.value=this.value.toUpperCase()" /></td>
    <td><input class="tt-cell-input tt-cell-time" data-f="startTime" type="time" /></td>
    <td><input class="tt-cell-input tt-cell-time" data-f="endTime" type="time" /></td>
    <td><input class="tt-cell-input" data-f="venue" placeholder="e.g. LT1" /></td>
    <td><input class="tt-cell-input" data-f="lecturer" placeholder="e.g. Dr. Adeyemi" /></td>
    <td class="tt-act-cell"><button class="tt-del-btn" onclick="removeTTDraftRow('${uid}')" title="Remove draft">✕</button></td>`;
  tbody.appendChild(tr);
  updateTTSaveBtn();
  tr.querySelector("select")?.focus();
};

window.removeTTDraftRow = function (uid) {
  const tr = document.querySelector(`tr[data-draft="${uid}"]`);
  if (tr) tr.remove();
  updateTTSaveBtn();
  const tbody = document.getElementById("ttSheetBody");
  if (tbody && !tbody.querySelector("tr")) renderTimetableSheet(_ttEntries);
};

function updateTTSaveBtn() {
  const drafts = document.querySelectorAll("tr[data-draft]");
  const btn = document.getElementById("ttSaveAllBtn");
  const hint = document.getElementById("ttDraftHint");
  const count = drafts.length;
  if (btn) {
    btn.style.display = count > 0 ? "inline-flex" : "none";
    btn.textContent = count === 1 ? "Save 1 entry" : `Save ${count} entries`;
  }
  if (hint) hint.textContent = count > 0 ? `${count} unsaved row${count === 1 ? "" : "s"}` : "";
}

window.saveTTDraftRows = async function () {
  if (!(_ttTarget.department && _ttTarget.level && _ttTarget.semester)) {
    showToast("Select a class first");
    return;
  }
  const drafts = Array.from(document.querySelectorAll("tr[data-draft]"));
  if (!drafts.length) return;

  const btn = document.getElementById("ttSaveAllBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }

  let saved = 0, skipped = 0, errors = 0;
  for (const tr of drafts) {
    tr.classList.remove("tt-row-error");
    const get = (f) => (tr.querySelector(`[data-f="${f}"]`)?.value || "").trim();
    const day = get("day");
    const courseCode = get("courseCode").toUpperCase();
    const startTime = get("startTime");
    const endTime = get("endTime");
    const venue = get("venue") || null;
    const lecturer = get("lecturer") || null;

    if (!day || !courseCode || !startTime || !endTime || startTime >= endTime) {
      tr.classList.add("tt-row-error");
      skipped += 1;
      continue;
    }

    try {
      await addDoc(collection(db, "timetableEntries"), {
        day, courseCode, startTime, endTime, venue, lecturer,
        faculty: _ttTarget.faculty,
        department: _ttTarget.department,
        level: _ttTarget.level,
        semester: _ttTarget.semester,
        createdBy: me?.uid || null,
        createdAt: serverTimestamp(),
      });
      tr.remove();
      saved += 1;
    } catch (e) {
      console.error(e);
      tr.classList.add("tt-row-error");
      errors += 1;
    }
  }

  if (saved > 0) {
    await loadTimetableEntries(_ttTarget);
    showToast(`${saved} entr${saved === 1 ? "y" : "ies"} saved`);
  }
  if (skipped > 0) showToast(`${skipped} row${skipped === 1 ? "" : "s"} need day, code & valid times`);
  if (errors > 0) showToast(`${errors} error${errors === 1 ? "" : "s"} — check Firestore rules`);

  updateTTSaveBtn();
  if (btn) btn.disabled = false;
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

// ── COURSE CONTENT ───────────────────────────────────────
async function loadContentCourseList() {
  try {
    const courses = await listCourses();
    const dl = document.getElementById("ccCodeSuggestions");
    if (!dl) return;
    dl.innerHTML = courses.map(c => `<option value="${c.code}">`).join("");
  } catch (e) {
    // Datalist is non-critical; silently skip if courses can't load
  }
  initContentFilePicker();
}

function initContentFilePicker() {
  const zone = document.getElementById("ccDropZone");
  const input = document.getElementById("ccFileInput");
  const sub = document.getElementById("ccDropSub");
  const textarea = document.getElementById("ccHtml");
  const titleInp = document.getElementById("ccTitle");
  if (!zone || !input || !textarea) return;

  function handleFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== "text/html") {
      sub.textContent = `${file.name} — not an HTML file`;
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const html = String(e.target.result || "");
      textarea.value = html;
      sub.innerHTML = `<strong>${file.name}</strong> loaded · ${(file.size / 1024).toFixed(1)} KB`;
      // Auto-fill the title from <title> if blank
      if (!titleInp.value) {
        const m = html.match(/<title>([^<]+)<\/title>/i);
        if (m) titleInp.value = m[1].split(/[—|·:-]/).pop().trim();
      }
    };
    reader.onerror = () => { sub.textContent = "Could not read file"; };
    reader.readAsText(file);
  }

  input.addEventListener("change", (e) => handleFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach(ev =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("cc-drop-zone-active");
    })
  );
  ["dragleave", "drop"].forEach(ev =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("cc-drop-zone-active");
    })
  );
  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

window.uploadCourseContent = async function () {
  if (!canUploadContent(myRole)) {
    showToast("Permission denied");
    return;
  }

  const btn = document.getElementById("ccUploadBtn");
  const courseCode = document.getElementById("ccCode").value.trim().toUpperCase().replace(/\s+/g, " ");
  const weekRaw = document.getElementById("ccWeek").value;
  const title = document.getElementById("ccTitle").value.trim();
  const htmlContent = document.getElementById("ccHtml").value.trim();
  const youtubeUrl = document.getElementById("ccYoutube").value.trim();

  if (!courseCode) { showToast("Enter a course code"); return; }
  if (!weekRaw) { showToast("Select a week"); return; }
  if (!htmlContent && !youtubeUrl) {
    showToast("Add either HTML notes, a YouTube link, or both");
    return;
  }

  const week = parseInt(weekRaw, 10);
  // Deterministic ID per (course, week). setDoc + merge means re-uploading
  // partial fields (e.g. just the YouTube link) doesn't wipe out the rest.
  const docId = courseCode.replace(/\s+/g, "_") + "_W" + week;

  btn.disabled = true;
  btn.textContent = "Uploading…";
  try {
    const ref = doc(db, "courseContent", docId);
    const existing = await getDoc(ref);
    const now = serverTimestamp();

    // Build payload — only include fields the user actually filled in,
    // so a YouTube-only update doesn't blank out existing HTML/title.
    const payload = {
      courseCode,
      week,
      updatedAt: now,
      updatedBy: me.uid,
      updatedByName: myProfile?.name || myProfile?.firstName || me.email,
    };
    if (title) payload.title = title;
    if (htmlContent) payload.htmlContent = htmlContent;
    if (youtubeUrl) payload.youtubeUrl = youtubeUrl;
    if (!existing.exists()) {
      payload.createdAt = now;
      payload.createdBy = me.uid;
      payload.createdByName = myProfile?.name || myProfile?.firstName || me.email;
    }

    await setDoc(ref, payload, { merge: true });

    // Clear form
    document.getElementById("ccCode").value = "";
    document.getElementById("ccWeek").value = "";
    document.getElementById("ccTitle").value = "";
    document.getElementById("ccHtml").value = "";
    document.getElementById("ccYoutube").value = "";

    showToast(
      existing.exists()
        ? `Week ${week} updated for ${courseCode}`
        : `Week ${week} uploaded for ${courseCode}`
    );
    // Reset drop sub text
    const sub = document.getElementById("ccDropSub");
    if (sub) sub.textContent = "Whole-page HTML works — styles and scripts stay isolated";
  } catch (e) {
    console.error("[uploadCourseContent]", e);
    if (e?.code === "permission-denied") {
      showToast("Permission denied — Firestore rules not deployed yet");
    } else if (String(e?.message || "").includes("longer than")) {
      showToast("Note too large for Firestore (>1MB). Trim or split it.");
    } else {
      showToast("Upload failed: " + (e?.message || "unknown error"));
    }
  }
  btn.disabled = false;
  btn.textContent = "Upload →";
};
