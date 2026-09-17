/**
 * Unify Notes Creation Engine — Frontend Client Logic
 */

let currentNoteJson = null;
let currentRenderedHtml = "";
let uploadedFigures = [];

// Sample Raw Notes text for demonstration
const SAMPLE_RAW_NOTES = `TOPIC 1: Wind Energy — Power, Forces & Calculations

1.1 Why Air Density Matters First
Before calculating any wind power, you need to know the density of the air at your site. Wind power is directly proportional to air density. Denser air carries more mass per cubic metre, and more mass means more kinetic energy per second flowing through the turbine blades. Air density depends on pressure and temperature at the site. Ideal gas law formula: \\[ \\rho = \\frac{P}{RT} \\] where P = 1.01325 x 10^5 Pa, R = 287 J/kg K, T = 15°C + 273 = 288K. Evaluating gives rho = 1.226 kg/m^3.

1.2 The Five Wind Power Quantities
Your lecturer always asks for five things in order:
(i) Total Power Density: P_total / A = 1/2 * rho * V^3. V is wind speed. Power varies with V^3 (doubling V gives 8x power).
(ii) Maximum Obtainable Power Density (Betz Limit = 59.3%): P_max / A = 8/27 * rho * V^3. Derived by Albert Betz in 1919.
(iii) Reasonably Obtainable Power Density: P / A = eta * 1/2 * rho * V^3 with turbine efficiency eta = 35%.
(iv) Total Power Output: P = (P/A) * Swept Area (A = pi * D^2 / 4).
(v) Mechanical forces: Torque T_max = 2/27 * (rho * pi * D * V^3) / (N/60) and Maximum Axial Thrust F_max = pi/9 * rho * D^2 * V^2.

[FIGURE: turbine-rotor-1 | caption: Horizontal Axis Wind Turbine Rotor Diagram | description: Showing swept area A = pi D^2 / 4 and wind velocity vectors V_in and V_out.]

Worked Example 9.1:
Given turbine diameter D = 120m, wind speed V = 15 m/s, rotational speed N = 40 rpm at max efficiency, standard conditions (1 atm, 15°C).
Step 1: Air density rho = 1.226 kg/m^3.
Step 2: Total power density = 1/2 * 1.226 * 15^3 = 2069 W/m^2.
Step 3: Betz max power density = 8/27 * 1.226 * 15^3 = 1226 W/m^2.
Step 4: At 35% efficiency = 0.35 * 2069 = 724 W/m^2.
Step 5: Total power P = 724 * (pi * 120^2 / 4) = 8184 kW.
Step 6: Torque = 55,170 N·m.
Step 7: Axial thrust = 1,385,870 N.


TOPIC 2: Family Biogas Digester — Design & Power Output

2.1 What a Biogas Digester Actually Is
A biogas digester is an airtight sealed tank where organic waste is mixed with water and left to ferment anaerobically. Bacteria break down organic matter producing biogas (methane + CO2). Mechanical stomach analogy: daily dung input enters, retention time for fermentation, gas piped from top, spent slurry out bottom as fertiliser.

2.2 The Four Quantities — Input to Output
Four step chain:
1. Daily dry matter input mo = cows * kg/day per cow.
2. Daily slurry volume Vf = mo / rho_in (rho_in = 50 kg/m^3 for cattle dung).
3. Digester volume Vd = Vf * tr (retention time tr = 20 days).
4. Daily biogas production Vb = C * mo (C = 0.24 m^3/kg).
Energy formula: E = eta * Hm * Fm * Vb (eta = 0.6, Hm = 28 MJ/m^3, Fm = 0.8 methane fraction).

Worked Example 9.2:
5 cows, 2 kg/day per cow dry matter = 10 kg/day.
Vf = 10 / 50 = 0.2 m^3/day.
Vd = 0.2 * 20 = 4 m^3.
Vb = 0.24 * 10 = 2.4 m^3/day.
E = 0.6 * 28 * 0.8 * 2.4 = 32.25 MJ/day (373W continuous thermal power).


TOPIC 3: Village Community Biogas Plant — Supply, Demand & Digester Sizing

3.1 Supply vs Demand Logic
Community plant steps:
1. Total dung supply from animal census (cow = 10kg, ox = 12kg, buffalo = 15kg, pig = 2kg).
2. Winter gas yield = 42 L/kg (always design on winter minimum yield).
3. Cooking demand = 0.227 m^3/person/day. Lighting demand = 0.126 m^3/lamp·hr.
4. Verify supply > demand.
5. Divide dung across digesters, calculate daily charge volume with equal water mix (slurry density = 1090 kg/m^3).
6. Digester volume Vd = 1.1 * Vcharge * tr (30 days retention, 10% safety factor).
7. Dimensions: H = D geometry rule gives Vd = (pi/4) D^3.

Worked Example 9.3:
98 families (490 persons), 102 cows, 124 oxen, 52 buffalo, 3 pigs.
Total dung = 3300 kg/day.
Winter gas supply = 42 * 3300 = 138.6 m^3/day.
Cooking demand = 111.23 m^3/day. Lighting demand = 24.69 m^3/day. Total demand = 136.92 m^3/day. Supply > Demand (1.68 m^3 surplus).
4 digesters, dung per digester = 825 kg. Charge volume Vcharge = (825+825)/1090 = 1.51 m^3/day.
Vd = 1.1 * 1.51 * 30 = 49.53 m^3.
D = (49.53 / 0.785)^(1/3) = 4m, H = 4m.
`;

// Initialize UI
document.addEventListener("DOMContentLoaded", () => {
  console.log("Unify Notes Creation Engine UI initialized.");
  const savedKey = localStorage.getItem("unify_anthropic_api_key");
  const keyInput = document.getElementById("c-apikey");
  if (savedKey && keyInput) {
    keyInput.value = savedKey;
  }
  if (keyInput) {
    keyInput.addEventListener("input", (e) => {
      localStorage.setItem("unify_anthropic_api_key", e.target.value.trim());
    });
  }
});

// Main Tab Switcher
function switchMainTab(tabId) {
  document.querySelectorAll(".main-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  document.getElementById(`mtab-${tabId}`).classList.add("active");
  document.getElementById(`sec-${tabId}`).classList.add("active");
}

// Load Sample Raw Notes into textarea
function loadSampleRawNotes() {
  document.getElementById("raw-notes-input").value = SAMPLE_RAW_NOTES.trim();
  showStatus("convert-status", "Sample raw notes loaded into input area.", "info");
}

// Figure Upload Handler
async function uploadFigure() {
  const fileInput = document.getElementById("fig-file");
  const captionInput = document.getElementById("fig-caption");

  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select an image file to upload.");
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("figureImage", file);
  formData.append("figureId", file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_-]/gi, "_"));

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const captionText = captionInput.value.trim() || file.name;
    const tagSnippet = `[FIGURE: ${data.id} | caption: ${captionText}]`;

    uploadedFigures.push({ tag: tagSnippet, url: data.url });

    // Render tag item
    const tagsList = document.getElementById("fig-tags-list");
    const tagEl = document.createElement("div");
    tagEl.className = "fig-tag-item";
    tagEl.innerHTML = `
      <span>${tagSnippet}</span>
      <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${tagSnippet}')">Copy Snippet</button>
    `;
    tagsList.appendChild(tagEl);

    fileInput.value = "";
    captionInput.value = "";
    alert(`Image uploaded! Snippet created: ${tagSnippet}\nPaste this snippet into your raw notes text where the figure should appear.`);
  } catch (err) {
    alert(`Upload failed: ${err.message}`);
  }
}

// Convert Raw Notes via Claude API
async function convertRawNotes() {
  const rawText = document.getElementById("raw-notes-input").value.trim();
  if (!rawText) {
    showStatus("convert-status", "Please paste raw notes text first.", "error");
    return;
  }

  const course = document.getElementById("c-course").value.trim();
  const week = parseInt(document.getElementById("c-week").value) || 1;
  const title = document.getElementById("c-title").value.trim();
  const subtitle = document.getElementById("c-subtitle").value.trim();
  const learningOutcome = document.getElementById("c-outcome").value.trim();
  const segmentationMode = document.getElementById("c-mode").value;
  const tagsStr = document.getElementById("c-tags").value;
  const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);

  const apiKey = (document.getElementById("c-apikey") ? document.getElementById("c-apikey").value.trim() : "");

  const convertBtn = document.getElementById("btn-convert");
  convertBtn.disabled = true;
  convertBtn.innerHTML = "⏳ Converting notes with Claude API... Please wait";
  showStatus("convert-status", "Calling Anthropic Messages API & structuring content into JSON schema...", "info");

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;

    const res = await fetch("/api/convert", {
      method: "POST",
      headers,
      body: JSON.stringify({
        course,
        week,
        title,
        subtitle,
        learningOutcome,
        segmentationMode,
        rawNotesText: rawText,
        tags
      })
    });

    const data = await res.json();
    convertBtn.disabled = false;
    convertBtn.innerHTML = "⚡ Convert Raw Notes to Unify JSON (Claude API)";

    if (data.error) {
      showStatus("convert-status", `Conversion Error: ${data.error} — ${data.details || data.message || ""}`, "error");
      return;
    }

    currentNoteJson = data.note;
    document.getElementById("json-editor-input").value = JSON.stringify(currentNoteJson, null, 2);

    showStatus("convert-status", "✅ Raw notes successfully structured into Unify Note JSON! Switching to JSON Editor...", "success");

    setTimeout(() => {
      switchMainTab("editor");
      validateCurrentJson();
      renderJsonToPreview();
    }, 1000);
  } catch (err) {
    convertBtn.disabled = false;
    convertBtn.innerHTML = "⚡ Convert Raw Notes to Unify JSON (Claude API)";
    showStatus("convert-status", `Network or Server Error: ${err.message}`, "error");
  }
}

// Load Hand-Authored Sample JSON (Zero-AI Standalone Mode)
async function loadSampleJson() {
  try {
    const res = await fetch("/api/sample");
    const data = await res.json();
    currentNoteJson = data;
    document.getElementById("json-editor-input").value = JSON.stringify(data, null, 2);
    validateCurrentJson();
    showStatus("convert-status", "Loaded pre-authored MEE 352 sample note into editor.", "info");
  } catch (err) {
    alert("Failed to load sample JSON: " + err.message);
  }
}

// Validate Current JSON in Editor
async function validateCurrentJson() {
  const jsonText = document.getElementById("json-editor-input").value.trim();
  const reportEl = document.getElementById("validation-report");

  if (!jsonText) {
    reportEl.className = "validation-report fail";
    reportEl.innerHTML = "❌ Editor is empty.";
    return false;
  }

  try {
    const parsed = JSON.parse(jsonText);
    currentNoteJson = parsed;

    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    });
    const result = await res.json();

    if (result.valid) {
      reportEl.className = "validation-report pass";
      reportEl.innerHTML = `
        <strong>✅ Schema & Quality Rules Checklist: PASSED CLEANLY!</strong><br>
        • Every subtopic has a Mini Check<br>
        • Question type rotation enforced<br>
        • Active Recall & Pulse Check properly structured<br>
        • End-of-Week Quiz has 10 questions (8 MCQ + 2 FITB) with feedback object
      `;
      return true;
    } else {
      reportEl.className = "validation-report fail";
      reportEl.innerHTML = `
        <strong>❌ Schema Validation Warnings (${result.errors.length}):</strong>
        <ul style="margin-top: 6px; padding-left: 20px;">
          ${result.errors.map(e => `<li>${e}</li>`).join("")}
        </ul>
      `;
      return false;
    }
  } catch (err) {
    reportEl.className = "validation-report fail";
    reportEl.innerHTML = `❌ JSON Syntax Error: ${err.message}`;
    return false;
  }
}

// Render JSON to Live Preview Iframe
async function renderJsonToPreview() {
  const isValid = await validateCurrentJson();
  if (!isValid) {
    if (!confirm("JSON validation reported issues. Do you still want to force rendering?")) {
      return;
    }
  }

  try {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentNoteJson)
    });

    if (!res.ok) {
      const errData = await res.json();
      alert("Render failed: " + (errData.error || "Unknown error"));
      return;
    }

    currentRenderedHtml = await res.text();

    const iframe = document.getElementById("note-preview-iframe");
    iframe.srcdoc = currentRenderedHtml;

    document.getElementById("preview-meta").textContent = `${currentNoteJson.course || "NOTE"} • Week ${currentNoteJson.week || 1}`;

    switchMainTab("preview");
  } catch (err) {
    alert("Render Error: " + err.message);
  }
}

// Download Standalone HTML File
function downloadRenderedHtml() {
  if (!currentRenderedHtml) {
    alert("Please render a note preview first.");
    return;
  }
  const course = (currentNoteJson?.course || "unify").toLowerCase().replace(/[^a-z0-9]/gi, "_");
  const week = currentNoteJson?.week || 1;
  const filename = `${course}-week${week}-unify.html`;

  const blob = new Blob([currentRenderedHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Save Note to Engine Storage
async function saveNoteToEngine() {
  if (!currentNoteJson) {
    alert("No JSON note to save.");
    return;
  }
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentNoteJson)
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Note successfully saved to storage as: ${data.filename}`);
    } else {
      alert("Save failed: " + data.error);
    }
  } catch (err) {
    alert("Save Error: " + err.message);
  }
}

// Helper: Show status box message
function showStatus(boxId, message, type) {
  const box = document.getElementById(boxId);
  box.className = `status-box ${type}`;
  box.textContent = message;
}
