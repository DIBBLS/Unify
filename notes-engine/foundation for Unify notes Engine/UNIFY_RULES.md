# UNIFY_RULES.md
# Rules for converting lecture notes into Unify learning pages
# Reference file: week1-reference.html
# Read this file AND week1-reference.html before converting any notes.

---

## YOUR JOB

Convert raw lecture notes into an interactive Unify learning page.
You are NOT summarizing. You are NOT rewriting.
You are STRUCTURING the existing content into the Unify format.

---

## GOLDEN RULE

**Never let the student read more than one subtopic without interacting.**

Read → Interact → Read → Interact → Read → Interact.

That is the only acceptable flow.

---

## STEP 1 — PARSE THE NOTES FIRST

Before writing any HTML, read the full notes file and identify:

1. How many **Topics** are there? (major sections, e.g. "Topic 1: Memory")
2. Inside each Topic, how many **Subtopics** are there? (e.g. "Primary Memory", "Cache", "Secondary Storage")
3. What is the natural **break point** for each subtopic?

A subtopic ends when:
- A new heading appears
- OR a clearly different concept starts
- OR after 3–5 bullet points / 2–3 paragraphs on the same concept

Write this outline in a comment at the top of the HTML file before you start coding.

---

## STEP 2 — PAGE STRUCTURE

Build the page in this exact order:

```
1. Topbar (Unify wordmark + course pill + dark mode toggle)
2. Progress bar (top of page, scroll-driven)
3. Hero block (course, week number, title, learning outcome, meta chips)
4. Topic Progress Steps (pills showing Topic 1 → Topic 2 → ... → Quiz)
5. Tags row (topic keywords as pills)
6. For each Topic:
   a. Section label + Section title
   b. For each Subtopic inside the Topic:
      - Subtopic heading (number + title)
      - Topic card (the content)
      - Mini Check (questions immediately after)
   c. Topic Active Recall (2–3 deeper questions at the end of the full topic)
7. Pulse Check (after each full Topic — not after subtopics)
8. Repeat for all Topics
9. End-of-Week Quiz (10 questions, 60% to pass)
```

---

## STEP 3 — MINI CHECK RULES

### When to insert a Mini Check
- After EVERY subtopic. No exceptions.
- If a subtopic is very short (1 paragraph), still add at least 1 question.
- If a subtopic is long (5+ bullet points), add 3 questions.

### How many questions per Mini Check
| Subtopic length | Questions |
|---|---|
| 1 paragraph | 1 question |
| 2–3 paragraphs or 3–5 bullets | 2 questions |
| Long / detailed subtopic | 3 questions |

### Question type mix
Use a mix across the page. Do not use the same type twice in a row.
- **MCQ** (4 options, one correct) — good for definitions, comparisons, identifying
- **Fill-in-the-blank (FITB)** — good for key terms, names, numbers, dates
- **Reveal** (student thinks, then reveals answer) — good for "explain" or "trace" questions

### Writing good questions
- Questions must come directly from the content just read. No outside knowledge.
- MCQ wrong answers must be plausible (not obviously silly).
- FITB answers must accept common abbreviations AND full names (e.g. "RAM" and "Random Access Memory").
- Reveal questions should ask the student to explain a mechanism or compare two things.
- Never ask a question whose answer wasn't in the subtopic above it.

### Mini Check HTML structure
Copy exactly from week1-reference.html. The three types are:

**MCQ:**
```html
<div class="mini-check">
  <div class="mini-check-header">
    <span class="mini-check-icon">⚡</span>
    <span class="mini-check-title">Quick Check — [Subtopic Name]</span>
    <span class="mini-check-sub">[N] question(s)</span>
  </div>
  <div class="mc-mcq-item">
    <div class="mc-q">[Question text]</div>
    <div class="mc-mcq-opts" id="mc-[unique-id]">
      <div class="mc-mcq-opt" onclick="mcMcq(this,'mc-[unique-id]',false,'mc-[unique-id]-fb')"><span class="mc-ltr">A</span> [Option]</div>
      <div class="mc-mcq-opt" onclick="mcMcq(this,'mc-[unique-id]',true,'mc-[unique-id]-fb')"><span class="mc-ltr">B</span> [Correct option]</div>
      <div class="mc-mcq-opt" onclick="mcMcq(this,'mc-[unique-id]',false,'mc-[unique-id]-fb')"><span class="mc-ltr">C</span> [Option]</div>
      <div class="mc-mcq-opt" onclick="mcMcq(this,'mc-[unique-id]',false,'mc-[unique-id]-fb')"><span class="mc-ltr">D</span> [Option]</div>
    </div>
    <div class="mc-mcq-fb" id="mc-[unique-id]-fb"></div>
  </div>
</div>
```

**Fill-in-the-blank:**
```html
<div class="mc-fitb-item">
  <div class="mc-q">[Question with ________ blank]</div>
  <div class="mc-fitb-row">
    <input class="mc-fitb-input" id="mc-[unique-id]-inp" placeholder="Your answer…" type="text">
    <button class="mc-fitb-btn" onclick="mcFitb('mc-[unique-id]-inp','mc-[unique-id]-fb',['answer1','answer2'])">Check</button>
  </div>
  <div class="mc-fitb-fb" id="mc-[unique-id]-fb"></div>
</div>
```

**Reveal:**
```html
<div class="mc-reveal-item">
  <div class="mc-q">[Question text]</div>
  <button class="mc-reveal-btn" onclick="mcReveal(this)">Reveal Answer</button>
  <div class="mc-answer">[Full answer with <strong>key terms bolded</strong>]</div>
</div>
```

### IDs must be unique across the entire page
Use a consistent naming convention:
`mc-[topic number]-[subtopic abbreviation]-[question number]`
Example: `mc-1-ram-1`, `mc-2-alu-2`, `mc-3-vn-1`

---

## STEP 4 — TOPIC ACTIVE RECALL RULES

At the end of each full topic (after all subtopics and their Mini Checks), add 2–4 Active Recall cards.

These are deeper than Mini Checks. They should:
- Ask the student to connect concepts across the whole topic
- Use badge types: Definition, Mechanism, Comparison, Application
- Have a Reveal Answer button (not MCQ or FITB)

Copy the `.recall-card` HTML structure exactly from week1-reference.html.

---

## STEP 5 — PULSE CHECK RULES

Add one Pulse Check after each complete Topic (not after subtopics).

Each Pulse Check has exactly 3 questions:
- Question 1: MCQ
- Question 2: MCQ
- Question 3: Fill-in-the-blank

Questions should cover the whole topic, not just the last subtopic.

Copy the `.pulse-check` HTML structure from week1-reference.html.
Each Pulse Check gets a number: Pulse Check ①, ②, ③ etc.

---

## STEP 6 — END-OF-WEEK QUIZ RULES

Always 10 questions. 60% to pass (6/10).

Question mix:
- 8 MCQ questions
- 2 Fill-in-the-blank questions
- Spread across all topics covered in the week
- Include at least 1 question per major topic

Each question needs a feedback string in the `eoqFeedbacks` object:
- `correct`: 1 sentence explaining why it's right
- `wrong`: 1 sentence explaining the correct concept

If the student fails, show a "Topics to review" list pointing to the specific topics they missed.
If the student passes, show "Week [N+1] unlocked — [Next week's topic name]".

---

## STEP 7 — CONTENT RULES

### Paragraph style
Break long paragraphs into bullet points wherever possible.
Max 3 sentences per paragraph before switching to bullets.

**Bad (wall of text):**
> Primary memory, also called main memory, is a fast memory that operates at electronic speeds. Programs must be stored in this memory while they are being executed. The memory consists of a large number of semiconductor storage cells, each capable of storing one bit of information.

**Good (scannable bullets):**
- Primary memory is also called main memory.
- It operates at electronic speed.
- Programs must be stored here while being executed.
- Consists of semiconductor storage cells — each stores one bit.

### What NOT to change
- Do not invent content not in the notes.
- Do not skip any concept from the notes.
- Do not reorder topics.
- Do not add opinions or extra explanation beyond what is in the notes.

### Diagrams
Where the notes reference a figure or diagram, add a `.diagram-box` placeholder with:
- The figure name/caption from the notes
- A short description of what the diagram shows

---

## STEP 8 — DESIGN RULES

Use the CSS from week1-reference.html exactly. Do not change:
- Color variables
- Font families (Playfair Display + DM Sans)
- Component class names
- Dark mode logic
- Progress bar logic
- Scroll-driven topic tracker logic

You may adjust:
- The number of topic progress steps (match the actual number of topics)
- The hero content (course, week number, title, learning outcomes)
- The tags row (match the actual topics in the notes)

---

## STEP 9 — JAVASCRIPT RULES

Copy all JS functions from week1-reference.html exactly:
- `toggleDark()`
- `toggleAnswer()`
- `mcReveal()`
- `mcMcq()`
- `mcFitb()`
- `pcAnswer()`
- `pcFitb()`
- `eoqSelect()`
- `eoqSubmit()`
- Scroll progress bar + topic tracker logic

Only change the data inside these functions (question answers, topic names, feedback strings).
Do NOT rewrite the logic.

---

## STEP 10 — QUALITY CHECK

Before saving the output file, verify:

- [ ] Every subtopic has a Mini Check immediately after it
- [ ] No two subtopics appear before a Mini Check
- [ ] All Mini Check IDs are unique
- [ ] All FITB answers accept at least 2 forms (abbreviation + full name where applicable)
- [ ] Pulse Check appears after each full Topic
- [ ] End-of-Week Quiz has exactly 10 questions
- [ ] eoqFeedbacks object has an entry for all 10 questions
- [ ] Dark mode toggle works
- [ ] Progress bar is present
- [ ] Hero has the correct week number and learning outcomes

---

## FILE NAMING

Output files should follow this pattern:
`ece350-week[N]-unify.html`

Example: `ece350-week2-unify.html`

---

## HOW TO START

When given a new notes file, say this to yourself first:

> "I will read the notes fully, identify all topics and subtopics, then build the page section by section — content block, then Mini Check, content block, then Mini Check — never moving forward without an interaction."

Then build.
