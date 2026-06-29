# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Unify Learn

Unify Learn is a student academic platform for LASU (Lagos State University) engineering students. It provides CGPA calculation, timetable management, a learning library with week-by-week course content, career resources, and a social profile/feed.

## Running the project

No build system or server required. Open any `.html` file directly in a browser. There are no dependencies to install.

## Architecture

**Pure HTML/CSS/JS multi-page app.** Each page is a self-contained `.html` file with all its CSS inlined in a `<style>` block. There is no shared stylesheet across pages (except `style.css`, used only by `waitlist.html`).

### Pages and their roles

| File | Purpose |
|---|---|
| `index.html` | User profile + social feed |
| `dashboard.html` | Main hub — CGPA overview, quick links |
| `Auth.html` | Sign in / Sign up |
| `Onboarding.html` | First-time setup flow |
| `Learn.html` | Course learning browser (sidebar + content area) |
| `timetable.html` | Weekly timetable with notification bell |
| `profile.html` | Extended profile with tabs |
| `careers.html` | Career resources and opportunities |
| `predictor.html` | CGPA predictor tool |
| `Admin.html` | Admin panel for course/content management |
| `waitlist.html` | Pre-launch waitlist page |

### Shared JS data files

These are loaded via `<script>` tags and expose globals on `window`:

- **`courses.js`** — `coursesDatabase` (Faculty of Engineering course lists, structured by `Faculty → Department → Level → Semester → [course codes]`), `courseResources` (Google Drive links per course), `resourceTypes`, `getResources()`. Exposes all to `window.*` for anticipated Firebase integration.
- **`course2.js`** — Parallel to `courses.js` for Faculty of Environmental Science. Most departments have empty arrays — only Industrial Design has some courses populated.
- **`Coursecontent.JS`** — `UNIFY_COURSE_CONTENT` object mapping course codes to 12-week topic/subtopic structures with estimated reading times. Shared courses (e.g. ECE 351, MAT 101) are defined once and referenced by all departments.
- **`script.js`** — UI logic for the predictor page: dropdown population, CGPA calculation (`gradeToPoint`, `cgpaClass`, `updateStats`), course add/load/clear.

### Course content pages

`Coursecontents/<COURSE CODE>/W{1-12}.html` — rich HTML study pages for individual weeks, one file per week per course. Only CHE 206 and ECE 210 have content so far. Each folder may also contain a `Course Outline.html`.

These pages are linked from `Learn.html` and are standalone — they include their own nav, theme toggle, and prev/next week navigation links.

## Design system

All pages use the same CSS custom property tokens:

- **Fonts**: `Playfair Display` (serif, display/headings) and `DM Sans` (body)
- **Theme**: `data-theme="dark"` on `<html>` switches the CSS variable set. Toggle is a button that sets `localStorage` and flips the attribute. Default is `auto` on most pages (reads `prefers-color-scheme`), `light` on `Admin.html`.
- **Key variables**: `--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text2`, `--text3`, `--green` (accent)

## Adding course data

**To add course resources (Google Drive links):**
Edit `courseResources` in `courses.js` (Engineering) or `course2.js` (Environmental Science):
```js
var courseResources = {
  "ECE 301": {
    "Course Outline": "https://drive.google.com/...",
    "Lecture Material PDF": "...",
    "Video Courses": "...",
    "Past Questions": "...",
    "Continuous Assessment": "..."
  }
};
```

**To add a new course's weekly content:**
Add an entry to `UNIFY_COURSE_CONTENT` in `Coursecontent.JS` following the existing pattern (12 weeks, each with `topic`, `subtopics[]`, `time`).

**To add a week's study page:**
Create `Coursecontents/<COURSE CODE>/W{n}.html`, following the structure of existing week files. Include prev/next navigation links and a back link to `Learn.html`.

## Known issues

`courses.js` has syntax errors on lines 68, 112, and 130 where two string literals are adjacent with no comma between them inside arrays (e.g. `"MEE 352""ECE 351"`). These will cause JS parse errors if those arrays are accessed.
