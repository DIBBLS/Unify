# Unify Learn

Study platform for Nigerian engineering students (starting with LASU). Guided weekly notes with recall cards and quizzes, course pages with each week's attendance, a timetable (class times plus your own), **QR pass attendance**, a class board where students ask their class rep and vote in polls, daily streaks and course games (including **Term of the Day**), and an authoring Studio for lecturers and contributors. Mobile-first PWA with an offline reader, push notifications with email as the backup, light and dark themes, and Box Boy, the mascot.

Current version: see `CHANGELOG.md` (the app also shows it in Me).

## How the pieces fit

```
Browser (PWA) ──HTTPS──▶ Vercel (static web app) ──HTTPS──▶ Render (API) ──▶ Supabase (Postgres + Auth + Storage)
                              ▲                                  ▲
                         DIBBLS/Unify                      knight-dev01/Unify
                       (frontend mirror)                    (full monorepo)
```

| Layer | Tech | Where it lives |
|---|---|---|
| Web app | Vite 5, React 18, TypeScript, React Router 6, KaTeX (loaded on demand) | `apps/web` |
| API | Express 4, TypeScript, zod, supabase-js (service role), Prisma migrations | `notes-engine` |
| Data and auth | Supabase Postgres, Auth, Storage (profile photos, diagrams) | `supabase/` (reference), `notes-engine/prisma` (authoritative) |
| Hosting | Vercel (web), Render (API, `render.yaml`) | |
| AI authoring | Gemini by default, Anthropic optional, Studio only | `notes-engine/src/lib/ai*` |

Two repos: the full monorepo is `knight-dev01/Unify` (backend deploys from here). `DIBBLS/Unify` is a **frontend-only mirror** that Vercel builds. Push to the fork, then run `scripts/Sync-Frontend.ps1` to update the mirror. Never merge the mirror back into the fork.

## Roles

| Role | Sees |
|---|---|
| Student | Home (greeting, streak, Term of the Day, updates slider), Courses, Timetable, Class (board, attendance), Me. A student who is a **class rep** also gets the rep tools on Home (Post, Questions, Class list, Live wire, Confirm today) |
| Lecturer | Home, Classroom (QR attendance, materials, timetable), Studio, Me |
| Contributor | Home, Studio (assigned courses only), Me |
| Admin | One hub with a sidebar: users, requests, class reps, courses, content, universities, semester, announcements and Home slider updates, AI models, **live performance**, analytics, errors, capacity audit |

Roles lock at assignment and are enforced on the server, not just hidden in the UI.

## Features worth knowing about

- **Attendance:** each student shows My pass, a QR that changes every 30 seconds, and the class rep or lecturer scans it. A student with a dead phone is typed in by matric number (marked "typed in"). Online classes share a 6-digit code in the meeting chat instead. No photos are taken. One shared session per course, so a lecturer and class rep are always in step.
- **Attendance on the course page:** each timetabled class (or an Extra class) gets its own register; students see "Came to 3 of 4 classes held" week by week. Class reps set the timetable. Level admins approve class reps; heads of department and deans see attendance counts only.
- **Class lists:** the class rep uploads names and matric numbers (Excel, Word, PDF, CSV or pasted). Students claim their own entry once (by matric; LASU email verification optional). Typed matrics must be on the list, the register shows who's absent and exports as CSV, and problems go to the class rep's inbox. Only the class's reps see the list.
- **Notes:** versioned weekly notes, lectures 1 to 3, recall cards, pulse checks, an end-of-week quiz with timer and pass mark, read-aloud, offline saving. Math renders with KaTeX first and MathJax as a fallback.
- **Studio:** manual mode edits one section at a time (week, each topic, each part, recall, pulse check, quiz). An equation builder opens as a full overlay.
- **Course page:** big title, a short introduction, the lecturers with the weeks each one teaches (the class rep sets them, 1 to 4 per course), a "Link your matric number" prompt until linked, then all 12 weeks as compact rows with a tick, cross or empty circle for every class. Today's class has Read notes and a small Pass button.
- **Class rep tools:** Confirm today (tomorrow after 5 PM), class rules (when classes get confirmed, with a push reminder then, and the latest a lecturer can cancel), class size and how many joined, Manage courses by level and semester, and clearing the whole class list.
- **Class board:** the live wire on top, announcements, polls (2 to 4 options, optional closing time) and questions. Students ask the class rep from a bar at the bottom; classmates see a question once it's answered and can add "same question". The class rep answers or turns a question into a poll.
- **Live wire:** emergencies only (class cancelled, moved or happening now). It reaches every phone at once, through quiet hours, and is emailed to anyone push can't reach. Normal news is an announcement.
- **Timetable:** the class times the class rep sets, plus each person's own entries (study time, labs, office hours) that only they see.
- **Streaks and games:** weekends never break a streak. The day's first open shows the streak screen (green milestone screen at 3, 7, 14 and 30 days); students back after a week get Welcome back instead. Games: Keywords, Crossword and Term of the Day (a daily word from the course's notes, the same for the whole course, six guesses). Leaderboards are held for now.
- **Reminders:** students pick their study times by period in onboarding. One reminder at each time if they haven't studied, at most one follow-up about 105 minutes later, never more than 3 a day, nothing between 10 PM and 6 AM without their yes. Tapping any notification opens the page it's about.
- **Email:** one branded layout for every email. On Brevo's free plan (300 a day) the app keeps a daily budget and spends it by priority, emails class updates only to people push can't reach, and sends each student a weekly summary on their own day. See `docs/OPERATIONS.md`, Email.
- **Hidden for now:** the CGPA target and the game leaderboards. Both are switches in `apps/web/src/lib/features.ts`.
- **Home updates slider:** admins publish live notices with a Box Boy; everyone sees them within about 30 seconds.
- **Self-updating PWA:** every build has an id; open copies notice a newer build, reload onto it, and the previous build's cache is deleted.
- **Observability:** per-minute request metrics per module, browser Web Vitals, and alert emails to admins when something is suddenly wrong.

## Quick start

```bash
git clone https://github.com/knight-dev01/Unify.git
cd Unify

# Web app
cd apps/web && npm install && npm run dev        # http://localhost:3000

# API (second shell). Needs notes-engine/.env, see .env.example
cd notes-engine && npm install && npm run dev
```

No Supabase project to hand? `notes-engine/scripts/loadtest/` has a fake Supabase you can point the API at for local work and load tests.

## Documentation map

| Doc | What is in it |
|---|---|
| `SETUP.md` | First-time Supabase, Render and Vercel setup, every environment variable |
| `docs/OPERATIONS.md` | Running it: deploys, env, alerts, updates, backups, privacy, runbook |
| `docs/PRODUCTION-READINESS.md` | Honest grade for production and for 100 simultaneous users, with the punch list |
| `docs/SCALABILITY.md` | How each module grows with users, the 1,000-row rule and the paging helpers, what is fixed and what is left |
| `apps/web/README.md` | Frontend structure, routes, conventions |
| `notes-engine/README.md` | API structure, routes, limits, scripts |
| `docs/Unify-Brand-Kit/` | Brand and UI guidelines |
| `notes-engine/emails/` | The sign-up, invite, password-reset and new-note emails as HTML, to paste into Supabase and to preview |
| `docs/Unify-Learn-Documentation.pdf` | Every document in one book (local only, not in git; rebuilt by hand) |
| `docs/archive/` | Superseded docs: PRDs, reviews, handoffs, redesign plans, v1.x developer report |
| `CHANGELOG.md` | Every release |

## Versioning

SemVer. Bump `version` in the root, `apps/web`, and `notes-engine` `package.json` files and `APP_VERSION` in `apps/web/src/lib/version.ts` together, add a `CHANGELOG.md` entry, and carry the version in the commit message.

## License

© 2026 Unify Learn
