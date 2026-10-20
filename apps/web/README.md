# Unify Learn — Web App (v1.26.1)

Student + author frontend. Vite 5 + React 18 + TypeScript 5 + React Router 6.
Deploys to Vercel from `DIBBLS/Unify` (frontend-only mirror of the main monorepo).

## Stack

Classic/Story designs + dark mode (CSS tokens, per-device), Playfair Display +
DM Sans + Nunito, emerald theme, 1px flat cards, lucide icons, MathJax math,
SVG Box Boy mascot, Web Push, offline worker (SW v8 + offline write queue).
Device prefs (theme, design, role hint, push prompt) in `localStorage`;
everything else server-side. Secondary/author routes (studio, admin, browse,
share, classes, onboarding, notifications, explore) are `React.lazy` — the
student's first load never downloads them.

## Scripts

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # tsc + vite build -> dist/
npm run preview
```

## Env (plain names work; `VITE_` equivalents too)

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL (Auth) |
| `SUPABASE_PUBLISHABLE_KEY` | anon key (Auth; public-safe) |
| `API_URL` | Render backend URL, no trailing slash |
| `USE_BACKEND` | `1` (backend is the source of truth) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key (fallback baked into `src/lib/push.ts`) |

Built-in public fallbacks keep local dev working; env vars override.

## Routes

| Route | Who | What |
|---|---|---|
| `/auth` | public | Email + Google sign in/up, forgot-password, welcome-back splash |
| `/onboarding` | signed in | Role-first setup (student 8 / lecturer 6 / contributor 3 steps) |
| `/dashboard` | signed in | Students: XP/streak/resume/course cards; authors: notes/courses stats + My Classes entry; admins: oversight card |
| `/course` | student | My Courses (bulk week counts) |
| `/explore` | student | Enroll-only catalog (single bulk call + alias search) |
| `/course/:code`, `/learn/:code/week/:week` | student (+preview roles) | Lecture reader (Lecture 1/2/3, `?c=`): hero, chapter tabs, recalls, read-aloud, EOQ exam, share, Save offline, XP-gated PDF. Only these routes get the floating pill: Focus + zoom-in (content column only) |
| `/s/:token` | public | Expiring share landing with preview card + join CTA |
| `/browse` | lecturer/contributor | Level-scoped note browser (read-only previews) |
| `/classes` | lecturer/contributor | My Classes: weekly timetable manager + live roster per taught course |
| `/notifications` | signed in | Bell list, auto-opens on fresh entry when unread |
| `/profile` | signed in | Inline edit, email change + verify CTA, any-size avatar upload (on-device 256px JPEG), appearance (design/theme/push), version footer |
| `/studio` | lecturer/contributor/admin | AI / manual / external-AI authoring, lecture pickers, versioned publish |
| `/admin`, `/admin/content` | admin | Modules (analytics, models, unis, courses, session, announce, users), all-content tree |
| `*` | public | Mascot 404 with nav links |

## Key client rules

- XP/progress/quiz recording is students-only (server-enforced); staff reads record nothing.
- Learning paths are students-only; authors/admins use `?preview=1` (read-only, no resume/XP).
- 30-min sliding idle TTL (persisted), Remember-me opt-in, exact resume (course/week/topic/lecture) for students.
- Offline-first: progress/quiz/resume bank in `lib/offline` queue when offline and flush on reconnect; reader weeks save into the SW content cache (`Save offline`).
- Reader controls: Focus + zoom live only in the floating pill on note readers (`components/ZoomBar.tsx`); zoom is desktop, zoom-IN only (100–150%), targets `#unify-content` so header/nav stay normal, and the first zoom-in enables Focus. Both Focus and zoom persist per device (localStorage) and are **retained when switching notes**. The layout hides the chrome bars only on reader routes — the rest of the app always renders normally, so neither ever leaks outside the notes section. The % reset button returns zoom to 100% and exits Focus.
- Every selector uses the `Drop` overlay component — never a native `<select>`. The panel is a floating overlay with shared spacing; call-site `style` only styles the trigger (give triggers in tight rows a real `min-width`).
- Math is one MathJax pipeline (`Formula`/`MathText`/`MathPlain`); Studio review and editor previews render real formulas through `Formula`, never plain text. Offline, `Formula` falls back to glyph text (`√(x)`, `a⁄b`).
- Zero `window.confirm` — all confirmations use the designed `ConfirmModal`.
- Hooks live above early returns (error #310 guard — see git history).

## Backend

All data flows through the Render API (`src/lib/api.ts`). See root `SETUP.md`.
