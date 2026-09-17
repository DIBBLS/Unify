# Unify Notes Creation Engine — Build Brief for Gemini (Antigravity)

This is what you paste into Gemini/Antigravity, along with the three attached reference files:
- `UNIFY_RULES.md` — the actual conversion rules Unify has used all along
- `UNIFY_MATHJAX_RULE.md` — the math-rendering rule
- `mee352-week2-unify.html` — a real, already-published Unify note (ground truth for CSS/JS/markup)

Give Gemini all four files together. The rules and reference file are not background reading — they are the literal source of truth for the schema and the render template below. Nothing in this brief should contradict them; where anything here seems to disagree with `UNIFY_RULES.md`, the rules file wins.

---

## 1. The problem, in plain terms

Right now, turning a topic into a live Unify note works like this:

1. Dibble sends raw notes to Claude in chat, along with `UNIFY_RULES.md` and `UNIFY_MATHJAX_RULE.md`.
2. Claude hand-writes the *entire* HTML file for that week, copying CSS/JS from a reference file by hand each time.
3. Dibble copies that HTML and manually pastes it into the backend/repo.
4. Repeat every week, per course.

This doesn't scale — it burns tokens regenerating identical CSS/JS every time, it's manual, and it can't run inside a mobile app. The fix: separate **content structuring** (AI's job) from **rendering** (done once, reused forever).

## 1.5 Critical architecture requirement: the engine must work WITHOUT the AI

Build to this from the start: **the Claude API is an optional convenience layer, not a dependency.** The core engine — schema, parser, renderer, storage — must be able to produce a working, rendered Unify note with zero AI calls.

To make that true:
- The render template is the CSS (`<style>`) and JS (`<script>`) blocks lifted **verbatim** from `mee352-week2-unify.html` — per `UNIFY_RULES.md` Steps 8–9 ("Use the CSS exactly. Copy all JS functions exactly. Only change the data."). Don't rewrite this logic; extract it once into the template and slot data in.
- Define the JSON schema in Section 3 as the single source of "data" that fills that template.
- A human can write/edit that JSON by hand (or via a simple form) and get a fully working, correctly-styled note with **no AI involved at all**. Claude's only job is producing that JSON automatically from messy raw notes, as a convenience layer on top.

Build order for Gemini: **extract the template (CSS/JS/skeleton) from the reference HTML + build the JSON schema + renderer first, and prove it works by hand-authoring one topic's JSON → then wire in the Claude API call as an "auto-structure my raw notes" feature on top.**

## 2. What to build (the demo)

A small web app with three parts:

**A. Input screen**
A form where a lecturer/course-admin pastes raw notes text and picks:
- Course code (e.g. MEE 352)
- Week number
- Segmentation mode (see Section 3.5)
- Optional image uploads, referenced from the raw text via `[FIGURE: some-id | caption: ...]` placeholders (maps to `UNIFY_RULES.md`'s `.diagram-box` handling — see Section 3.3)

**B. Processing (Claude API call)**
Send the raw text + metadata to Claude via the Anthropic Messages API, with a system prompt built from `UNIFY_RULES.md` + `UNIFY_MATHJAX_RULE.md` (Section 3.2). The only change from the original rules: Claude now outputs **structured JSON matching the schema in Section 3.1**, never raw HTML. Everything else — the Golden Rule (Read → Interact → Read), Mini Check density table, question-type rotation, Pulse Check structure, EOQ rules, ID naming convention, content style rules — carries over unchanged from the rules file.

**C. Render + preview**
The template from Section 1.5 takes the JSON and renders a note that is pixel-identical in style to existing Unify notes, because it's literally built from one. Preview it live in the demo; the same template becomes the in-app renderer later (web + mobile) — JSON gets stored (e.g. Firestore) and the app renders it on the fly, zero copy-pasting.

## 3. The schema, system prompt, and rules — grounded in the real files

### 3.1 JSON schema

This schema is a direct translation of `UNIFY_RULES.md`'s page structure (Step 2) and the actual markup in `mee352-week2-unify.html`, into data:

```json
{
  "course": "MEE 352",
  "week": 6,
  "title": "string",
  "subtitle": "string",
  "learningOutcome": "string",
  "metaChips": ["string", "..."],
  "tags": ["string", "..."],
  "topics": [
    {
      "number": 1,
      "title": "string",
      "abbr": "short-slug-for-ids",
      "subtopics": [
        {
          "number": 1,
          "abbr": "short-slug",
          "title": "string",
          "content": [
            { "type": "paragraph", "text": "string" },
            { "type": "bullets", "items": ["string", "..."] },
            { "type": "formula", "label": "string", "equation": "\\[ LaTeX here \\]", "note": "string" },
            { "type": "symbol", "symbol": "string", "name": "string", "desc": "string" },
            { "type": "insight", "text": "string" },
            { "type": "diagram", "caption": "string", "description": "string", "imageRef": "string | null (matches an uploaded file id, or null for a text-only placeholder box)" }
          ],
          "miniCheck": {
            "questions": [
              { "type": "mcq", "question": "string", "options": ["A", "B", "C", "D"], "correctIndex": 0 },
              { "type": "fitb", "question": "string with ________ blank", "acceptedAnswers": ["string", "..."] },
              { "type": "reveal", "question": "string", "answer": "string, may include <strong> for key terms" }
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
          { "type": "fitb", "question": "string", "acceptedAnswers": ["string", "..."] }
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
        "topicRef": "string (which topic this maps to, for the 'topics to review' list)"
      }
    ]
  }
}
```

Rules baked into the schema (from `UNIFY_RULES.md`):
- Every subtopic **must** have a `miniCheck` — no exceptions, even a 1-paragraph subtopic gets at least 1 question (Step 3).
- Mini Check question count follows the length table: 1 paragraph → 1 question, 2–3 paragraphs/3–5 bullets → 2 questions, long/detailed → 3 questions.
- Question types must not repeat back-to-back within a Mini Check.
- `activeRecall` gets 2–4 cards per topic, each with a Reveal-style answer only (no MCQ/FITB), badge types exactly as listed.
- `pulseCheck.questions` is always exactly 3: MCQ, MCQ, FITB, covering the whole topic (Step 5).
- `eoq.questions` is always exactly 10: 8 MCQ + 2 FITB, spread across all topics, at least 1 per major topic (Step 6).
- FITB `acceptedAnswers` must include at least 2 forms where applicable (abbreviation + full name).
- IDs at render time follow `mc-[topic]-[subtopic-abbr]-[qnum]` (e.g. `mc-1-airdens-1`) — generate these from `topic.number` + `subtopic.abbr`, don't let Claude invent raw HTML ids.

### 3.2 System prompt for the Claude API call

Concatenate `UNIFY_RULES.md` and `UNIFY_MATHJAX_RULE.md` verbatim as the base of the system prompt, then append this override block so the output target changes from HTML to JSON without touching any of the actual conversion logic:

```
OUTPUT FORMAT OVERRIDE:
Everything above describes the Unify note format and how to structure content — follow all of it exactly (Golden Rule, Mini Check density, question-type rotation, Pulse Check structure, EOQ rules, content style, diagram handling).

However, you do NOT output HTML. Output ONLY valid JSON matching the schema below, no preamble, no markdown fences, no commentary:

[paste the schema from Section 3.1 here]

Where the rules describe an HTML structure to copy (Mini Check divs, recall-card, pulse-check, eoq-question), instead populate the corresponding JSON fields — the app's template handles all markup and styling.

Where the raw notes contain a figure/diagram reference, and the admin has NOT tagged it with a [FIGURE: id | caption: ...] placeholder, generate a "diagram" content block with your best caption/description from context but leave "imageRef" null. If the admin HAS tagged it, carry the id through as "imageRef" and never invent, describe, or alter the image itself.
```

### 3.3 Diagrams / images — mapped to the real `.diagram-box` rule

`UNIFY_RULES.md` Step 7 already specifies this: where notes reference a figure, add a `.diagram-box` placeholder with the figure's caption and a short description. That maps directly onto the schema's `diagram` content type. Two paths:
- **Admin has the actual image file** → uploads it, tags the raw text with `[FIGURE: turbine-diagram-1 | caption: ...]`, Claude carries the id through as `imageRef`, and the renderer shows the real image with caption.
- **No image yet / text-only placeholder** → Claude fills `caption` and `description` from the notes and leaves `imageRef: null`; the renderer shows a labeled placeholder box, matching how `.diagram-box` already works today.

### 3.4 Math — unchanged from `UNIFY_MATHJAX_RULE.md`

No changes needed here at all. Keep the MathJax CDN script tag in the template's `<head>`, keep `\( ... \)` / `\[ ... \]` delimiters in `equation`/`text`/`answer` fields exactly as the rule file specifies, and call `MathJax.typesetPromise()` after the JSON injects content into the DOM (since MathJax only renders on load by default — it needs to be told to re-scan after dynamic insertion).

## 3.5 Input modes — admin chooses how content gets segmented

The input form needs a mode selector, not just a single text box:

1. **Per-topic** — admin submits one topic's raw notes at a time. Most control, most manual work. Safe fallback.
2. **Whole week, my headers** (default/recommended) — admin pastes the entire week's raw notes with their own headings already in it. The parser/AI splits strictly along those headers rather than guessing boundaries — this matches `UNIFY_RULES.md` Step 1's "identify topics and subtopics" instruction, just with the boundaries pre-marked instead of inferred. Build and test this mode first.
3. **Whole week, AI decides** — admin pastes fully unstructured raw notes and grants the AI authority to find topic/subtopic boundaries itself, per Step 1's break-point rules (new heading, clearly different concept, or 3–5 bullets/2–3 paragraphs on one concept). Treat as an advanced/opt-in toggle — ship after mode 2 is proven, since full autonomy over boundaries is the likeliest source of inconsistent structure between topics.

Pass the selected mode into the Claude call as part of the user message so the system prompt's Step 1 instructions adjust accordingly — modes 1–2 tell Claude to strictly respect the admin's existing structure and never invent new splits; mode 3 explicitly grants it that authority.

## 4. API call structure (for Gemini to implement)

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: UNIFY_NOTES_SYSTEM_PROMPT, // UNIFY_RULES.md + UNIFY_MATHJAX_RULE.md + the override block from Section 3.2
    messages: [
      {
        role: "user",
        content: `Course: ${course}\nWeek: ${week}\nSegmentation mode: ${mode}\n\nRaw notes:\n${rawNotesText}`
      }
    ]
  })
});

const data = await response.json();
const jsonText = data.content.find(b => b.type === "text").text;
const structuredNote = JSON.parse(jsonText); // strip ```json fences first if present
```

Notes for Gemini:
- Store the Claude API key server-side only (env variable), never expose it client-side.
- Wrap the JSON.parse in a try/catch — strip any accidental ` ```json ` fences before parsing.
- `max_tokens` raised to 8192 since a full week's JSON (multiple topics, all Mini Checks, Active Recall, Pulse Checks, 10-question EOQ) is a lot more content than a single HTML fragment.
- Validate the returned JSON against the schema before saving/rendering — specifically check the Section 3.1 hard rules (every subtopic has a miniCheck, pulseCheck has exactly 3 questions in MCQ/MCQ/FITB order, eoq has exactly 10 questions as 8 MCQ + 2 FITB). Reject and retry once if any of these fail — this is the automated version of `UNIFY_RULES.md`'s Step 10 quality checklist.

## 5. Rendering template

Extract directly from `mee352-week2-unify.html`, unchanged:
- The full `<style>` block (all CSS variables, `.hero`, `.tab-nav`/`.tab-panel`, `.topic-card`, `.symbol-card`, `.formula-box`, `.insight-box`, `.diagram-box`, `.mini-check` variants, `.recall-card`, `.pulse-check`, `.eoq-*` classes, dark mode variables)
- The full `<script>` block (`toggleDark`, `switchTab`, `toggleAnswer`, `mcReveal`, `mcMcq`, `mcFitb`, `pcAnswer`/`pcFitb` if present, `eoqSelect`, `eoqSubmit`, scroll progress bar logic)

Then build a thin templating layer (plain JS string building, or a framework's templating — Gemini's choice) that walks the JSON schema and generates the matching HTML nodes for: hero, tags, tab nav (one tab per topic), each subtopic's `topic-card` + `mini-check` (mapping `mcq`→`mc-mcq-item`, `fitb`→`mc-fitb-item`, `reveal`→`mc-reveal-item`), `recall-card`s, `pulse-check`, and the `eoq-question` list + `eoqFB` feedback object. Generate the `mc-[topic]-[subtopic-abbr]-[qnum]` IDs programmatically so they're always unique, instead of asking Claude to invent them.

Do not touch colors, fonts, or component class names — Step 8 of `UNIFY_RULES.md` is explicit that these stay fixed.

## 6. Demo scope (keep it small)

For a first working demo, Gemini should build, **in this order**:
1. Extract the template (CSS/JS/skeleton) from `mee352-week2-unify.html` + build the JSON schema + renderer — prove it works by hand-authoring one topic's JSON and rendering it, no AI involved yet.
2. The input form (course, week, segmentation-mode selector, raw text paste box, image upload with `[FIGURE: ...]` tagging)
3. The backend route that builds the system prompt from the two rules files + calls Claude + validates the response against the schema — wired into the same renderer from step 1
4. A "Save" button that stores the JSON (local file or simple Firestore write is fine for the demo — doesn't need to be production-grade yet)

Explicitly out of scope for v1: auth/roles (lecturer vs student-admin), real image upload storage (a local `/uploads` folder is fine for the demo), and mobile rendering — those come after the demo proves the JSON pipeline works end to end.

## 7. Why this matters (context for whoever picks this up)

This replaces the manual "chat with Claude → copy HTML → paste into repo" workflow with something that works the same way inside the actual Unify mobile app later: raw notes in, structured JSON out, one template (lifted straight from an already-published note) renders it everywhere. It's also the foundation piece already scoped in the Unify Learn PRD v3 as the "Notes Creation Engine" — this demo is the first real implementation, using the Claude API key already on hand instead of the originally-planned Groq model, and grounded directly in the actual conversion rules (`UNIFY_RULES.md`, `UNIFY_MATHJAX_RULE.md`) rather than a reconstruction of them.
