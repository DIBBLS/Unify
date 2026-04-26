import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
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
  myProfile = null;

// ── AUTH GATE ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  document.getElementById("loadingScreen").style.display = "none";

  if (!user) {
    window.location.href = "auth.html";
    return;
  }
  me = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  myProfile = snap.exists() ? snap.data() : {};

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || myProfile.isAdmin === true;

  // Bootstrap: ensure super-admin flag is set
  if (isSuperAdmin && !myProfile.isAdmin) {
    await setDoc(
      doc(db, "users", user.uid),
      { isAdmin: true, email: user.email },
      { merge: true },
    );
  }

  if (!isAdmin) {
    document.getElementById("accessDenied").style.display = "block";
    return;
  }

  const displayName = myProfile.name || user.email;
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("navUser").textContent = user.email;
  document.getElementById("postedAsLabel").textContent = displayName;
  document.getElementById("adminNameDisplay").textContent = displayName;

  initTheme();
  listenToUpdates();
  loadAdmins();
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "auth.html";
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
  const email = document.getElementById("grantEmail").value.trim().toLowerCase();
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
    if (userSnap.data().isAdmin) {
      fb.style.color = "var(--amber)";
      fb.textContent = `${email} already has admin access.`;
      return;
    }
    await updateDoc(userSnap.ref, { isAdmin: true });
    fb.style.color = "var(--green-deep)";
    fb.textContent = `Admin access granted to ${email}.`;
    document.getElementById("grantEmail").value = "";
    showToast(`${email} is now an admin`);
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
    await updateDoc(doc(db, "users", uid), { isAdmin: false });
    showToast(`Access revoked for ${email}`);
    loadAdmins();
  } catch (e) {
    showToast("Error revoking access");
  }
};

async function loadAdmins() {
  const container = document.getElementById("adminList");
  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("isAdmin", "==", true)),
    );
    if (snap.empty) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = snap.docs
      .map((d) => {
        const u = d.data();
        const isSuperAdmin = u.email === SUPER_ADMIN_EMAIL;
        return `<div class="admin-item">
        <div>
          <div class="admin-item-name">${u.name || "—"}</div>
          <div class="admin-item-email">${u.email || ""} ${u.department ? "· " + u.department : ""}</div>
        </div>
        ${
          isSuperAdmin
            ? `<span class="super-badge">Super Admin</span>`
            : `<button class="btn-revoke" onclick="revokeAdmin('${d.id}','${u.email}')">Revoke</button>`
        }
      </div>`;
      })
      .join("");
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

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
