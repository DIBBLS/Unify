let courses = [];

function populateDepartments() {
  const deptSelect = document.getElementById("department");
  deptSelect.innerHTML = "";
  Object.keys(coursesDatabase["Faculty of Engineering"]).forEach(dept => {
    const opt = document.createElement("option");
    opt.value = dept;
    opt.textContent = dept;
    deptSelect.appendChild(opt);
  });
}

function gradeToPoint(grade) {
  grade = grade.toUpperCase();
  if (grade === "A") return 5;
  if (grade === "B") return 4;
  if (grade === "C") return 3;
  if (grade === "D") return 2;
  if (grade === "E") return 1;
  if (grade === "F") return 0;
  return null;
}

function cgpaClass(cgpa) {
  if (cgpa >= 4.50) return { label: "First Class", cls: "first" };
  if (cgpa >= 3.50) return { label: "Second Class Upper (2.1)", cls: "upper" };
  if (cgpa >= 2.40) return { label: "Second Class Lower (2.2)", cls: "" };
  if (cgpa >= 1.50) return { label: "Third Class", cls: "" };
  if (cgpa >= 1.00) return { label: "Pass", cls: "" };
  return { label: "No grades yet", cls: "" };
}

function updateStats() {
  const graded = courses.filter(c => c.grade !== "-" && gradeToPoint(c.grade) !== null);
  const totalUnits = courses.reduce((s, c) => s + c.units, 0);
  let cgpa = 0;

  if (graded.length > 0) {
    let weighted = 0, units = 0;
    graded.forEach(c => { weighted += gradeToPoint(c.grade) * c.units; units += c.units; });
    cgpa = weighted / units;
  }

  document.getElementById("cgpa").textContent = cgpa.toFixed(2);
  document.getElementById("statCourses").textContent = courses.length;
  document.getElementById("statUnits").textContent = totalUnits;
  document.getElementById("statGraded").textContent = graded.length;

  const cls = cgpaClass(cgpa);
  const classEl = document.getElementById("cgpaClass");
  classEl.textContent = graded.length > 0 ? cls.label : "No grades yet";
  classEl.className = "cgpa-class " + cls.cls;

  document.getElementById("coursesCount").textContent = courses.length + " course" + (courses.length !== 1 ? "s" : "");
  document.getElementById("emptyState").style.display = courses.length === 0 ? "block" : "none";
}

const resourceIcons = {
  "Course Outline": "📄",
  "Lecture Material PDF": "📚",
  "Video Courses": "🎬",
  "Past Questions": "📝",
  "Continuous Assessment": "✅"
};

function gradeClass(grade) {
  if (grade === "A") return "grade-a";
  if (grade === "B") return "grade-b";
  if (grade === "C") return "grade-c";
  return "";
}

function displayCourses() {
  const ul = document.getElementById("courses");
  ul.innerHTML = "";

  courses.forEach((c) => {
    const li = document.createElement("li");
    li.className = "course-item";

    const header = document.createElement("div");
    header.className = "course-header";
    header.innerHTML = `
      <span class="course-toggle">▶</span>
      <span class="course-name">${c.course}</span>
      <span class="course-grade ${gradeClass(c.grade)}">${c.grade !== "-" ? "Grade: " + c.grade : "No grade"}</span>
      <span class="course-units">${c.units} units</span>
    `;

    const resources = document.createElement("div");
    resources.className = "course-resources hidden";

    const res = getResources(c.course);
    resourceTypes.forEach(type => {
      const link = res[type] || "";
      const row = document.createElement("div");
      row.className = "resource-row";
      if (link) {
        row.innerHTML = `<span class="resource-icon">${resourceIcons[type]}</span><a href="${link}" target="_blank" class="resource-link">${type}</a>`;
      } else {
        row.innerHTML = `<span class="resource-icon">${resourceIcons[type]}</span><span class="resource-name">${type}</span><span class="resource-empty">Not uploaded yet</span>`;
      }
      resources.appendChild(row);
    });

    header.addEventListener("click", () => {
      const open = !resources.classList.contains("hidden");
      resources.classList.toggle("hidden", open);
      header.querySelector(".course-toggle").textContent = open ? "▶" : "▼";
    });

    li.appendChild(header);
    li.appendChild(resources);
    ul.appendChild(li);
  });

  updateStats();
}

function loadCourses() {
  const dept = document.getElementById("department").value;
  const level = document.getElementById("level").value;
  const sem = document.getElementById("semester").value;
  const data = coursesDatabase["Faculty of Engineering"][dept];
  if (!data || !data[level] || !data[level][sem]) {
    alert("No courses found for this selection.");
    return;
  }
  courses = data[level][sem].map(c => ({ course: c, grade: "-", units: 3 }));
  displayCourses();
}

function addCourse() {
  const name = document.getElementById("course").value.trim();
  const grade = document.getElementById("grade").value.toUpperCase().trim();
  const units = parseInt(document.getElementById("units").value) || 3;

  if (!name) { alert("Please enter a course name."); return; }
  const valid = ["A","B","C","D","E","F","-",""];
  if (grade && !valid.includes(grade)) { alert("Invalid grade. Use A, B, C, D, E, or F."); return; }

  courses.push({ course: name, grade: grade || "-", units });
  displayCourses();
  document.getElementById("course").value = "";
  document.getElementById("grade").value = "";
  document.getElementById("units").value = "";
}

function clearCourses() {
  if (courses.length === 0) return;
  if (confirm("Clear all courses?")) { courses = []; displayCourses(); }
}

window.onload = populateDepartments;