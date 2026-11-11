# Unify Learn

Study platform for Nigerian engineering students (starting with LASU). Guided weekly notes with recall cards and quizzes, a timetable, **QR pass attendance**, a class board, a CGPA planner, and an authoring Studio for lecturers and contributors. Mobile-first PWA with an offline reader, light and dark themes, and Box Boy, the mascot.

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
| Student | Home (greeting, CGPA card, updates slider), Courses, Timetable, Class (board, attendance), Me |
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
- **CGPA planner:** current CGPA and target are strict decimals from 0.00 to 5.00 (two places at most), checked in the app and on the server.
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
| `apps/web/README.md` | Frontend structure, routes, conventions |
| `notes-engine/README.md` | API structure, routes, limits, scripts |
| `docs/Unify-Brand-Kit/` | Brand and UI guidelines |
| `docs/DEVELOPER-REPORT.md` | Older bug-by-bug history (v1.x) |
| `CHANGELOG.md` | Every release |

## Versioning

SemVer. Bump `version` in the root, `apps/web`, and `notes-engine` `package.json` files and `APP_VERSION` in `apps/web/src/lib/version.ts` together, add a `CHANGELOG.md` entry, and carry the version in the commit message.

## License

© 2026 Unify Learn
