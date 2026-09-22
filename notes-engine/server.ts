// @ts-nocheck — legacy JS-style server; new app code lives in typed src/ modules.
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { validateUnifyNote } = require("./src/schema");
const { renderUnifyNote } = require("./src/renderer");

const app = express();
const PORT = process.env.PORT || 3000;

const CORS_ORIGINS = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Storage directories
const STORAGE_DIR = path.join(__dirname, "storage/notes");
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage for uploaded figure images
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "_");
    cb(null, `${basename}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage: uploadStorage });

// Load system prompt rules files safely
let rulesPath = path.join(__dirname, "UNIFY_RULES.md");
if (!fs.existsSync(rulesPath)) {
  rulesPath = path.join(__dirname, "foundation for Unify notes Engine", "UNIFY_RULES.md");
}
let mathRulesPath = path.join(__dirname, "UNIFY_MATHJAX_RULE.md");
if (!fs.existsSync(mathRulesPath)) {
  mathRulesPath = path.join(__dirname, "foundation for Unify notes Engine", "UNIFY_MATHJAX_RULE.md");
}

const unifyRules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, "utf-8") : "";
const unifyMathRules = fs.existsSync(mathRulesPath) ? fs.readFileSync(mathRulesPath, "utf-8") : "";

const SCHEMA_SPEC = `
{
  "course": "string (e.g. MEE 352)",
  "week": number (e.g. 6),
  "title": "string",
  "subtitle": "string",
  "learningOutcome": "string",
  "metaChips": ["string", "..."],
  "tags": ["string", "..."],
  "topics": [
    {
      "number": 1,
      "title": "string",
      "abbr": "short-slug",
      "subtopics": [
        {
          "number": "1.1",
          "abbr": "short-slug",
          "title": "string",
          "content": [
            { "type": "paragraph", "text": "string" },
            { "type": "bullets", "items": ["string", "..."] },
            { "type": "formula", "label": "string", "equation": "\\[ LaTeX \\]", "note": "string" },
            { "type": "symbol", "symbol": "string", "name": "string", "desc": "string" },
            { "type": "insight", "text": "string" },
            { "type": "analogy", "text": "string" },
            { "type": "workedExample", "eyebrow": "string", "title": "string", "given": ["string"], "steps": [{ "label": "Step 1", "title": "string", "body": "string", "math": "\\[ LaTeX \\]" }], "result": "string" },
            { "type": "diagram", "caption": "string", "description": "string", "imageRef": "string | null" }
          ],
          "miniCheck": {
            "questions": [
              { "type": "mcq", "question": "string", "options": ["A", "B", "C", "D"], "correctIndex": 0 },
              { "type": "fitb", "question": "string with ________ blank", "acceptedAnswers": ["string", "..."] },
              { "type": "reveal", "question": "string", "answer": "string with <strong>key terms</strong>" }
            ]
          }
        }
      ],
      "activeRecall": [
        { "badge": "Definition | Mechanism | Comparison | Application", "question": "string", "answer": "string" }
      ],
      "pulseCheck": {
        "number": 1,
        "questions": [
          { "type": "mcq", "question": "string", "options": ["A", "B", "C", "D"], "correctIndex": 0 },
          { "type": "mcq", "question": "string", "options": ["A", "B", "C", "D"], "correctIndex": 0 },
          { "type": "fitb", "question": "string with ________ blank", "acceptedAnswers": ["string", "..."] }
        ]
      }
    }
  ],
  "eoq": {
    "questions": [
      {
        "number": 1,
        "type": "mcq",
        "question": "string",
        "options": ["A", "B", "C", "D"],
        "correct": "A",
        "feedback": { "correct": "string", "wrong": "string" },
        "topicRef": "string (which topic this maps to, for topics to review list)"
      }
    ]
  }
}
`;

const SYSTEM_PROMPT = `${unifyRules}

---

${unifyMathRules}

---

OUTPUT FORMAT OVERRIDE:
Everything above describes the Unify note format and how to structure content — follow all of it exactly (Golden Rule, Mini Check density, question-type rotation, Pulse Check structure, EOQ rules, content style, diagram handling).

However, you do NOT output HTML. Output ONLY valid JSON matching the schema below, no preamble, no markdown fences, no commentary:

${SCHEMA_SPEC}

Where the rules describe an HTML structure to copy (Mini Check divs, recall-card, pulse-check, eoq-question), instead populate the corresponding JSON fields — the app's template handles all markup and styling.

Where the raw notes contain a figure/diagram reference, and the admin has NOT tagged it with a [FIGURE: id | caption: ...] placeholder, generate a "diagram" content block with your best caption/description from context but leave "imageRef" null. If the admin HAS tagged it, carry the id through as "imageRef" and never invent, describe, or alter the image itself.
`;

// Health check (Render healthCheckPath + client warmup ping)
app.get("/healthz", (req, res) => res.json({ ok: true, service: "unify-api" }));

// v1 app API (Supabase-backed). Compiled to dist/src/routes/v1.js by tsc.
const v1 = require("./src/routes/v1");
app.use("/v1", v1.default || v1);

// API Routes

// 1. Get preloaded hand-authored sample note
app.get("/api/sample", (req, res) => {
  const samplePath = path.join(__dirname, "samples/hand_authored_note.json");
  if (fs.existsSync(samplePath)) {
    const data = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
    return res.json(data);
  }
  res.status(404).json({ error: "Sample note not found." });
});

// 2. Validate JSON note
app.post("/api/validate", (req, res) => {
  const result = validateUnifyNote(req.body);
  res.json(result);
});

// 3. Render JSON note to HTML
app.post("/api/render", (req, res) => {
  try {
    const validation = validateUnifyNote(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Schema Validation Failed", details: validation.errors });
    }
    const html = renderUnifyNote(req.body);
    res.type("text/html").send(html);
  } catch (err) {
    res.status(500).json({ error: "Rendering Error", message: err.message });
  }
});

// 4. Image Upload Route
app.post("/api/upload", upload.single("figureImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    id: req.body.figureId || req.file.filename,
    url: fileUrl,
    filename: req.file.filename
  });
});

// 5. Save Note Route
app.post("/api/save", (req, res) => {
  try {
    const note = req.body;
    const filename = `${(note.course || "NOTE").toLowerCase().replace(/[^a-z0-9]/gi, "_")}_week${note.week || 1}_${Date.now()}.json`;
    const filePath = path.join(STORAGE_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(note, null, 2), "utf-8");
    res.json({ success: true, filename, path: filePath });
  } catch (err) {
    res.status(500).json({ error: "Failed to save note", message: err.message });
  }
});

// 6. List Saved Notes
app.get("/api/notes", (req, res) => {
  try {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".json"));
    const notes = files.map(f => {
      const content = JSON.parse(fs.readFileSync(path.join(STORAGE_DIR, f), "utf-8"));
      return {
        filename: f,
        course: content.course,
        week: content.week,
        title: content.title,
        updatedAt: fs.statSync(path.join(STORAGE_DIR, f)).mtime
      };
    });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Failed to list notes", message: err.message });
  }
});

// 7. Claude API Conversion Endpoint
app.post("/api/convert", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(400).json({
      error: "Missing Anthropic API Key. Please set ANTHROPIC_API_KEY in process.env or pass x-api-key header."
    });
  }

  const { course, week, segmentationMode, rawNotesText, title, subtitle, learningOutcome, tags } = req.body;

  if (!rawNotesText || !rawNotesText.trim()) {
    return res.status(400).json({ error: "Raw notes text cannot be empty." });
  }

  let modeInstruction = "";
  if (segmentationMode === "per-topic") {
    modeInstruction = "Segmentation Mode: Per-Topic. Treat the provided text as one single topic and strictly respect all existing section headers.";
  } else if (segmentationMode === "whole-week-headers") {
    modeInstruction = "Segmentation Mode: Whole Week, My Headers. Split topics and subtopics strictly along the admin's existing headings and section titles.";
  } else {
    modeInstruction = "Segmentation Mode: Whole Week, AI Decides. You have authority to identify logical topic and subtopic break points from unstructured text.";
  }

  const userPrompt = `Course Code: ${course || "MEE 352"}
Week Number: ${week || 1}
${title ? `Title: ${title}` : ""}
${subtitle ? `Subtitle: ${subtitle}` : ""}
${learningOutcome ? `Learning Outcome: ${learningOutcome}` : ""}
${tags ? `Tags: ${tags.join(", ")}` : ""}
${modeInstruction}

RAW LECTURE NOTES TO STRUCTURE:
${rawNotesText}
`;

  try {
    const fetch = (await import("node-fetch")).default || globalThis.fetch;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "Anthropic API Error", details: errText });
    }

    const data = await response.json();
    let jsonText = data.content.find(b => b.type === "text").text;

    // Clean any accidental markdown fences ```json ... ```
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    const noteJson = JSON.parse(jsonText);

    // Validate quality rules
    const validation = validateUnifyNote(noteJson);
    if (!validation.valid) {
      console.warn("AI output failed validation warnings:", validation.errors);
    }

    res.json({
      success: true,
      note: noteJson,
      validation
    });
  } catch (err) {
    console.error("Conversion error:", err);
    res.status(500).json({ error: "Failed to convert raw notes", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Unify Notes Creation Engine running at http://localhost:${PORT}`);
});
